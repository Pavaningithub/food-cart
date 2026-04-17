import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/payments/verify
 *
 * Two modes:
 * 1. FAST (checkout callback): receives razorpay_payment_id + razorpay_order_id + razorpay_signature
 *    → verifies HMAC locally (no external call) → updates DB instantly.
 * 2. POLL FALLBACK (Android UPI): receives only order_id
 *    → hits Razorpay API to check status (used when webhook is delayed).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    // ── FAST PATH: signature provided by Razorpay checkout handler ──────────
    if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expected !== razorpay_signature) {
        return NextResponse.json({ verified: false, reason: 'invalid_signature' }, { status: 400 });
      }

      const supabase = createServiceClient();

      // Update order by razorpay_order_id (don't need order_id from client — read from DB)
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('razorpay_order_id', razorpay_order_id)
        .single();

      if (!order) {
        return NextResponse.json({ verified: false, reason: 'order_not_found' }, { status: 404 });
      }

      await Promise.all([
        supabase
          .from('orders')
          .update({ payment_status: 'paid', payment_method: 'online', status: 'ordered' })
          .eq('id', order.id),
        supabase
          .from('payments')
          .update({ status: 'captured', razorpay_payment_id, razorpay_signature })
          .eq('razorpay_order_id', razorpay_order_id),
      ]);

      return NextResponse.json({ verified: true });
    }

    // ── POLL FALLBACK PATH: only order_id provided (Android UPI polling) ────
    if (!order_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!order_id || !UUID_RE.test(order_id)) {
      return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get our payment record (must exist — created during S2S intent call)
    const { data: payment } = await supabase
      .from('payments')
      .select('razorpay_payment_id, razorpay_order_id, status')
      .eq('order_id', order_id)
      .single();

    if (!payment?.razorpay_payment_id) {
      // No payment record yet — webhook may still be on its way
      return NextResponse.json({ verified: false, reason: 'no_payment_record' });
    }

    // Already captured in DB — nothing to do
    if (payment.status === 'captured') {
      return NextResponse.json({ verified: true });
    }

    // Hit Razorpay API directly to check payment status
    const credentials = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );

    if (!rzpRes.ok) {
      return NextResponse.json({ verified: false, reason: 'razorpay_api_error' });
    }

    const rzpPayment = await rzpRes.json();
    console.log(`Verify check: payment ${payment.razorpay_payment_id} status = ${rzpPayment.status}`);

    if (rzpPayment.status === 'captured') {
      // Payment confirmed by Razorpay — update DB (webhook may arrive later too, that's fine)
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', payment_method: 'online', status: 'ordered' })
        .eq('id', order_id);

      await supabase
        .from('payments')
        .update({ status: 'captured', method: rzpPayment.method })
        .eq('order_id', order_id);

      return NextResponse.json({ verified: true });
    }

    if (rzpPayment.status === 'failed') {
      await supabase.from('payments').update({ status: 'failed' }).eq('order_id', order_id);
      await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', order_id);
      return NextResponse.json({ verified: false, reason: 'payment_failed' });
    }

    // Status is 'created' or 'authorized' — customer may still be in the UPI app
    return NextResponse.json({ verified: false, reason: rzpPayment.status });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ verified: false, reason: 'server_error' }, { status: 500 });
  }
}
