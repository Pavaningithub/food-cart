import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const supabase = createServiceClient();

    console.log('Razorpay webhook event:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      // Find our order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('razorpay_order_id', razorpayOrderId)
        .single();

      if (orderError || !order) {
        console.error('Order not found for razorpay_order_id:', razorpayOrderId);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Update order status
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'online',
          status: 'ordered',
        })
        .eq('id', order.id);

      // Update payment record
      await supabase
        .from('payments')
        .update({
          razorpay_payment_id: payment.id,
          razorpay_signature: signature,
          method: payment.method,
          status: 'captured',
          webhook_payload: event,
        })
        .eq('razorpay_order_id', razorpayOrderId);

      console.log(`Order ${order.id} (Token #${order.token_number}) payment confirmed`);
    } else if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      await supabase
        .from('payments')
        .update({
          razorpay_payment_id: payment.id,
          status: 'failed',
          webhook_payload: event,
        })
        .eq('razorpay_order_id', razorpayOrderId);

      // Update order payment status
      await supabase
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('razorpay_order_id', razorpayOrderId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
