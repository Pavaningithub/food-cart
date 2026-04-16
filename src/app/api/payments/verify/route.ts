import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/payments/verify
 * Called by Android client after returning from UPI app.
 * Checks Razorpay's API directly for payment status — acts as a fallback
 * in case the webhook hasn't fired yet (network delay, cold start, etc.)
 *
 * Security: amount and status are read from Razorpay's server — never trusted from client.
 */
export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json();

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
