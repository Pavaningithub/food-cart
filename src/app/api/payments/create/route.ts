// Payment create route — force redeploy 2026-04-16
import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createServiceClient } from '@/lib/supabase/server';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const order_id: string = body?.order_id;
    const platform: string = body?.platform ?? 'web'; // 'android' | 'ios' | 'web'

    // Validate UUID format — prevents path traversal / injection
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!order_id || !UUID_RE.test(order_id)) {
      return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ALWAYS read amount from DB — never trust client-sent amounts
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Order already paid' }, { status: 400 });
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Order was cancelled' }, { status: 400 });
    }

    // Amount is set HERE on the server from DB — customer cannot tamper it
    const amountPaise = Math.round(Number(order.total_amount) * 100);

    if (amountPaise < 100) {
      return NextResponse.json({ error: 'Order amount too low' }, { status: 400 });
    }

    // If a Razorpay order already exists and is still valid, reuse it
    let razorpayOrderId = order.razorpay_order_id;
    if (razorpayOrderId) {
      try {
        const existing = await razorpay.orders.fetch(razorpayOrderId);
        if (existing.status !== 'created') razorpayOrderId = null; // expired/paid — make fresh
      } catch {
        razorpayOrderId = null;
      }
    }

    if (!razorpayOrderId) {
      const rzpOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `fc_${order.id.slice(0, 8)}`,
        notes: {
          order_id: order.id,
          token: order.token_number.toString(),
          type: order.order_type,
        },
      });
      razorpayOrderId = rzpOrder.id;

      // Persist so webhook can match back
      await supabase.from('orders').update({ razorpay_order_id: razorpayOrderId }).eq('id', order_id);
      await supabase.from('payments').upsert(
        { order_id, razorpay_order_id: razorpayOrderId, amount: order.total_amount, currency: 'INR', status: 'created' },
        { onConflict: 'order_id' }
      );
    }

    // ── Android: try S2S UPI intent first ─────────────────────────────
    if (platform === 'android') {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
        const s2sRes = await fetch('https://api.razorpay.com/v1/payments', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: razorpayOrderId,
            method: 'upi',
            contact: '9999999999',
            email: 'pay@ngscafe.app',
            amount: amountPaise,
            currency: 'INR',
            ip: req.headers.get('x-forwarded-for') ?? '1.1.1.1',
            referrer: `${appUrl}/pay/${order_id}`,
            user_agent: req.headers.get('user-agent') ?? 'Mozilla/5.0',
            description: `NG's Cafe Token #${order.token_number}`,
            callback_url: `${appUrl}/order/${order_id}`,
            upi: { flow: 'intent' },
          }),
        });
        if (s2sRes.ok) {
          const s2sData = await s2sRes.json();
          const upiUrl: string | undefined = s2sData?.next?.[0]?.url;
          const razorpayPaymentId: string | undefined = s2sData?.razorpay_payment_id;
          if (upiUrl && razorpayPaymentId) {
            await supabase.from('payments').upsert(
              { order_id, razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, amount: order.total_amount, currency: 'INR', status: 'created' },
              { onConflict: 'order_id' }
            );
            return NextResponse.json({
              upi_url: upiUrl,
              razorpay_payment_id: razorpayPaymentId,
              razorpay_order_id: razorpayOrderId,
              amount: amountPaise,
              key_id: process.env.RAZORPAY_KEY_ID,
            });
          }
        }
      } catch (s2sErr) {
        console.warn('S2S intent failed, falling back to checkout modal:', s2sErr);
      }
      // S2S failed — fall through to standard checkout modal
    }

    // ── iOS / web / Android fallback: standard Razorpay checkout.js modal ──
    return NextResponse.json({
      razorpay_order_id: razorpayOrderId,
      amount: amountPaise,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
