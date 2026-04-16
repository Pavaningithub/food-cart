import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/payments/upi-confirm
 * Called when customer taps "I have paid" after a direct UPI transfer.
 * Marks the order as paid (pending_verification) so kitchen sees it immediately.
 * Admin can verify and cancel if fraudulent.
 */
export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json();

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!order_id || !UUID_RE.test(order_id)) {
      return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, payment_status, status')
      .eq('id', order_id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ ok: true, already_paid: true });
    }

    // Mark as paid with 'online' method (UPI is an online payment)
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: 'paid', payment_method: 'online' })
      .eq('id', order_id);

    if (updateError) throw updateError;

    // Upsert payment record for audit trail
    await supabase.from('payments').upsert(
      {
        order_id,
        status: 'captured',
        currency: 'INR',
      },
      { onConflict: 'order_id' }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('UPI confirm error:', err);
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
  }
}
