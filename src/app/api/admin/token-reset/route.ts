import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET — return token reset history + cumulative stats
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Total orders ever
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Today's current token
    const today = new Date().toISOString().split('T')[0];
    const { data: counter } = await supabase
      .from('daily_token_counters')
      .select('last_token')
      .eq('order_date', today)
      .single();

    // Reset history (last 30)
    const { data: resets } = await supabase
      .from('token_resets')
      .select('*')
      .order('reset_at', { ascending: false })
      .limit(30);

    return NextResponse.json({
      current_token: counter?.last_token ?? 0,
      total_orders_ever: totalOrders ?? 0,
      resets: resets ?? [],
    });
  } catch (error) {
    console.error('Token reset GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST — reset today's token counter and log it
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { pin, note } = await req.json();

    // Verify PIN
    const { data: pinSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_pin')
      .single();
    const adminPin = process.env.ADMIN_PIN ?? pinSetting?.value ?? '1234';
    if (pin !== adminPin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Try using the DB function first
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'reset_daily_token',
      { p_date: today, p_note: note ?? null }
    );

    if (rpcError) {
      // Fallback: manual reset if function doesn't exist yet
      const { data: counter } = await supabase
        .from('daily_token_counters')
        .select('last_token')
        .eq('order_date', today)
        .single();

      const tokensUsed = counter?.last_token ?? 0;

      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Try to log the reset (table may not exist yet)
      await supabase.from('token_resets').insert({
        reset_date: today,
        tokens_used: tokensUsed,
        total_orders: totalOrders ?? 0,
        note: note ?? null,
      }).select();

      // Zero out the counter
      await supabase
        .from('daily_token_counters')
        .upsert({ order_date: today, last_token: 0 });

      return NextResponse.json({
        success: true,
        tokens_used: tokensUsed,
        total_orders: totalOrders ?? 0,
      });
    }

    return NextResponse.json({ success: true, ...(rpcResult as object) });
  } catch (error) {
    console.error('Token reset POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
