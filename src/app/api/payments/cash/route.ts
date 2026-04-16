import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Mark cash order as paid
export async function POST(req: NextRequest) {
  try {
    const { order_id, pin } = await req.json();
    const supabase = createServiceClient();

    // Verify admin PIN
    const { data: pinSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_pin')
      .single();

    const adminPin = process.env.ADMIN_PIN ?? pinSetting?.value ?? '1234';
    if (pin !== adminPin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 });
    }

    // Update order
    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_method: 'cash',
        status: 'confirmed',
      })
      .eq('id', order_id)
      .select()
      .single();

    if (error) throw error;

    // Create cash payment record
    await supabase.from('payments').insert({
      order_id,
      amount: data.total_amount,
      currency: 'INR',
      method: 'cash',
      status: 'captured',
    });

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error('Cash payment error:', error);
    return NextResponse.json({ error: 'Failed to process cash payment' }, { status: 500 });
  }
}
