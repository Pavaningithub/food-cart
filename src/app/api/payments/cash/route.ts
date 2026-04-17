import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Mark cash order as paid
export async function POST(req: NextRequest) {
  try {
    const { order_id, pin } = await req.json();
    const supabase = createServiceClient();

    // Allow kitchen bypass key (no PIN needed on staff kitchen display)
    const kitchenKey = process.env.KITCHEN_KEY ?? process.env.NEXT_PUBLIC_KITCHEN_KEY;
    const isKitchenBypass = kitchenKey && pin === kitchenKey;

    if (!isKitchenBypass) {
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
    }

    // Update order
    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_method: 'cash',
        status: 'ordered',
      })
      .eq('id', order_id)
      .select()
      .single();

    if (error) throw error;

    // Create or update cash payment record (upsert handles pre-existing failed payment rows)
    await supabase.from('payments').upsert({
      order_id,
      amount: data.total_amount,
      currency: 'INR',
      method: 'cash',
      status: 'captured',
    }, { onConflict: 'order_id' });

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error('Cash payment error:', error);
    return NextResponse.json({ error: 'Failed to process cash payment' }, { status: 500 });
  }
}
