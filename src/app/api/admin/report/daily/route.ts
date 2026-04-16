import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];

    const supabase = createServiceClient();

    // Orders
    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_date', date)
      .neq('status', 'cancelled');

    // Expenses for the day
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('expense_date', date);

    // Cash entries for the day
    const { data: cashEntries } = await supabase
      .from('cash_entries')
      .select('*')
      .eq('entry_date', date);

    const totalOrders = orders?.length ?? 0;
    const paidOrders = orders?.filter(o => o.payment_status === 'paid') ?? [];
    const onlineRevenue = paidOrders
      .filter(o => o.payment_method === 'online')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);
    const cashRevenue = (cashEntries ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
    const totalRevenue = onlineRevenue + cashRevenue;
    const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = totalRevenue - totalExpenses;

    // Item breakdown
    const itemMap: Record<string, { name_en: string; name_kn: string; qty: number }> = {};
    for (const order of orders ?? []) {
      for (const item of order.order_items ?? []) {
        if (!itemMap[item.product_id]) {
          itemMap[item.product_id] = { name_en: item.product_name_en, name_kn: item.product_name_kn, qty: 0 };
        }
        itemMap[item.product_id].qty += item.quantity;
      }
    }
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty);

    // Expense breakdown by category
    const expenseByCategory: Record<string, number> = {};
    for (const exp of expenses ?? []) {
      expenseByCategory[exp.category] = (expenseByCategory[exp.category] ?? 0) + Number(exp.amount);
    }

    const report = {
      date,
      summary: {
        totalOrders,
        totalRevenue,
        onlineRevenue,
        cashRevenue,
        totalExpenses,
        netProfit,
      },
      topItems,
      expenseByCategory,
      // Pre-formatted text for WhatsApp sharing
      whatsappText: buildWhatsAppText({
        date,
        totalOrders,
        totalRevenue,
        onlineRevenue,
        cashRevenue,
        totalExpenses,
        netProfit,
        topItems: topItems.slice(0, 5),
      }),
    };

    return NextResponse.json({ report });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

function buildWhatsAppText(data: {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  onlineRevenue: number;
  cashRevenue: number;
  totalExpenses: number;
  netProfit: number;
  topItems: { name_en: string; qty: number }[];
}): string {
  const d = new Date(data.date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const lines = [
    `🍛 *FoodCart Daily Report*`,
    `📅 ${d}`,
    ``,
    `📊 *Summary*`,
    `• Orders: ${data.totalOrders}`,
    `• Revenue: ₹${data.totalRevenue.toFixed(0)}`,
    `  - Online: ₹${data.onlineRevenue.toFixed(0)}`,
    `  - Cash: ₹${data.cashRevenue.toFixed(0)}`,
    `• Expenses: ₹${data.totalExpenses.toFixed(0)}`,
    `• *Net Profit: ₹${data.netProfit.toFixed(0)}*`,
    ``,
    `🏆 *Top Items*`,
    ...data.topItems.map((item, i) => `${i + 1}. ${item.name_en} — ${item.qty} pcs`),
    ``,
    `_Sent from FoodCart_`,
  ];

  return lines.join('\n');
}
