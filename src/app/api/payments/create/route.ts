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

    // If a Razorpay order already exists and is still valid, reuse it
    // This handles page refresh / retry without creating duplicate orders
    if (order.razorpay_order_id) {
      try {
        const existing = await razorpay.orders.fetch(order.razorpay_order_id);
        if (existing.status === 'created') {
          return NextResponse.json({
            razorpay_order_id: existing.id,
            amount: existing.amount,
            currency: existing.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
          });
        }
      } catch {
        // Existing order not found on Razorpay — create a fresh one below
      }
    }

    // Amount is set HERE on the server from DB — customer cannot tamper it
    const amountPaise = Math.round(Number(order.total_amount) * 100);

    // Sanity check: minimum ₹1
    if (amountPaise < 100) {
      return NextResponse.json({ error: 'Order amount too low' }, { status: 400 });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `fc_${order.id.slice(0, 8)}`,
      notes: {
        order_id: order.id,
        token: order.token_number.toString(),
        type: order.order_type,
      },
    });

    // Persist razorpay_order_id so webhook can match it back
    await supabase
      .from('orders')
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq('id', order_id);

    // Upsert payment record (idempotent)
    await supabase.from('payments').upsert(
      {
        order_id,
        razorpay_order_id: razorpayOrder.id,
        amount: order.total_amount,
        currency: 'INR',
        status: 'created',
      },
      { onConflict: 'order_id' }
    );

    return NextResponse.json({
      razorpay_order_id: razorpayOrder.id,
      // Return server-computed amount — client renders this, cannot change what Razorpay charges
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
