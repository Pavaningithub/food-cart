import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Daily stats for admin dashboard
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build date range
    const startDate = from ?? date;
    const endDate = to ?? date;

    // Fetch all paid orders in range
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('order_date', startDate)
      .lte('order_date', endDate)
      .neq('status', 'cancelled');

    if (ordersError) throw ordersError;

    // Fetch expenses in range
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (expensesError) throw expensesError;

    // Fetch cash entries in range
    const { data: cashEntries, error: cashError } = await supabase
      .from('cash_entries')
      .select('*')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (cashError) throw cashError;

    // Calculate stats
    const paidOrders = orders?.filter((o) => o.payment_status === 'paid') ?? [];
    const totalOrders = orders?.length ?? 0;
    const dineInOrders = orders?.filter((o) => o.order_type === 'dine_in').length ?? 0;
    const parcelOrders = orders?.filter((o) => o.order_type === 'parcel').length ?? 0;

    const onlineRevenue = paidOrders
      .filter((o) => o.payment_method === 'online')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const cashRevenue = (cashEntries ?? []).reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );

    const totalRevenue = onlineRevenue + cashRevenue;

    const totalExpenses = (expenses ?? []).reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );

    const netProfit = totalRevenue - totalExpenses;

    // Items sold
    const allItems = paidOrders.flatMap((o) => o.order_items ?? []);
    const totalItemsSold = allItems.reduce((sum, i) => sum + i.quantity, 0);

    // Items breakdown
    const itemBreakdown: Record<string, { name_en: string; name_kn: string; count: number }> = {};
    allItems.forEach((item) => {
      if (!itemBreakdown[item.product_id]) {
        itemBreakdown[item.product_id] = {
          name_en: item.product_name_en,
          name_kn: item.product_name_kn,
          count: 0,
        };
      }
      itemBreakdown[item.product_id].count += item.quantity;
    });

    const topItems = Object.values(itemBreakdown)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      stats: {
        date_range: { from: startDate, to: endDate },
        total_orders: totalOrders,
        dine_in_orders: dineInOrders,
        parcel_orders: parcelOrders,
        footfall: totalOrders,
        online_revenue: onlineRevenue,
        cash_revenue: cashRevenue,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        total_items_sold: totalItemsSold,
        top_items: topItems,
      },
      expenses: expenses ?? [],
      cash_entries: cashEntries ?? [],
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
