import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Daily stats for admin dashboard — enhanced with daily_breakdown for charts
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const startDate = from ?? date;
    const endDate = to ?? date;

    // Fetch all orders in range (include cancelled for full picture)
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('order_date', startDate)
      .lte('order_date', endDate);

    if (ordersError) throw ordersError;

    const orders = allOrders ?? [];

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

    // ── Aggregate ──────────────────────────────────────────────────────────
    const nonCancelledOrders = orders.filter((o) => o.status !== 'cancelled');
    const paidOrders = orders.filter(
      (o) => o.payment_status === 'paid' && o.status !== 'cancelled'
    );

    const totalOrders = nonCancelledOrders.length;
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
    const dineInOrders = nonCancelledOrders.filter((o) => o.order_type === 'dine_in').length;
    const parcelOrders = nonCancelledOrders.filter((o) => o.order_type === 'parcel').length;

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
    const profitMargin =
      totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Items sold
    const allItems = paidOrders.flatMap((o) => o.order_items ?? []);
    const totalItemsSold = allItems.reduce((sum, i) => sum + i.quantity, 0);

    // Items breakdown
    const itemBreakdown: Record<
      string,
      { name_en: string; name_kn: string; count: number; revenue: number }
    > = {};
    allItems.forEach((item) => {
      if (!itemBreakdown[item.product_id]) {
        itemBreakdown[item.product_id] = {
          name_en: item.product_name_en,
          name_kn: item.product_name_kn,
          count: 0,
          revenue: 0,
        };
      }
      itemBreakdown[item.product_id].count += item.quantity;
      itemBreakdown[item.product_id].revenue += Number(item.subtotal);
    });
    const topItems = Object.values(itemBreakdown)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── Daily breakdown for trend charts ────────────────────────────────────
    const dailyMap: Record<
      string,
      {
        date: string;
        orders: number;
        revenue: number;
        expenses: number;
        profit: number;
        dine_in: number;
        parcel: number;
        online_revenue: number;
        cash_revenue: number;
      }
    > = {};

    // Populate all dates in range so gaps show as 0
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = {
        date: key,
        orders: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        dine_in: 0,
        parcel: 0,
        online_revenue: 0,
        cash_revenue: 0,
      };
    }

    nonCancelledOrders.forEach((o) => {
      const key = o.order_date;
      if (!dailyMap[key]) return;
      dailyMap[key].orders += 1;
      if (o.payment_status === 'paid' && o.payment_method === 'online') {
        dailyMap[key].online_revenue += Number(o.total_amount);
        dailyMap[key].revenue += Number(o.total_amount);
      }
      if (o.order_type === 'dine_in') dailyMap[key].dine_in += 1;
      if (o.order_type === 'parcel') dailyMap[key].parcel += 1;
    });

    (cashEntries ?? []).forEach((e) => {
      const key = e.entry_date;
      if (!dailyMap[key]) return;
      dailyMap[key].cash_revenue += Number(e.amount);
      dailyMap[key].revenue += Number(e.amount);
    });

    (expenses ?? []).forEach((e) => {
      const key = e.expense_date;
      if (!dailyMap[key]) return;
      dailyMap[key].expenses += Number(e.amount);
    });

    const dailyBreakdown = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, profit: d.revenue - d.expenses }));

    // ── Peak hour ────────────────────────────────────────────────────────────
    const hourCounts: number[] = Array(24).fill(0);
    nonCancelledOrders.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      hourCounts[h] += 1;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // ── Expense by category ──────────────────────────────────────────────────
    const expenseByCategory: Record<string, number> = {};
    (expenses ?? []).forEach((e) => {
      expenseByCategory[e.category] =
        (expenseByCategory[e.category] ?? 0) + Number(e.amount);
    });

    // ── Best day ─────────────────────────────────────────────────────────────
    const bestDay = dailyBreakdown.reduce(
      (best, d) => (d.revenue > best.revenue ? d : best),
      dailyBreakdown[0] ?? { date: startDate, revenue: 0, orders: 0 }
    );

    return NextResponse.json({
      stats: {
        date_range: { from: startDate, to: endDate },
        total_orders: totalOrders,
        cancelled_orders: cancelledOrders,
        dine_in_orders: dineInOrders,
        parcel_orders: parcelOrders,
        footfall: totalOrders,
        online_revenue: onlineRevenue,
        cash_revenue: cashRevenue,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        profit_margin: profitMargin,
        avg_order_value: avgOrderValue,
        total_items_sold: totalItemsSold,
        top_items: topItems,
        peak_hour: peakHour,
        best_day: bestDay,
        expense_by_category: expenseByCategory,
      },
      daily_breakdown: dailyBreakdown,
      expenses: expenses ?? [],
      cash_entries: cashEntries ?? [],
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
