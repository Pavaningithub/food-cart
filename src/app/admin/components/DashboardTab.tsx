'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Users, ShoppingBag, Package, Wallet,
  ArrowUpRight, ArrowDownRight, Clock, Star, RefreshCw, Share2,
} from 'lucide-react';

// Dynamic import for recharts (no SSR)
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const ComposedChart = dynamic(() => import('recharts').then((m) => m.ComposedChart), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Stats {
  date_range: { from: string; to: string };
  total_orders: number;
  cancelled_orders: number;
  dine_in_orders: number;
  parcel_orders: number;
  footfall: number;
  online_revenue: number;
  cash_revenue: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  avg_order_value: number;
  total_items_sold: number;
  top_items: { name_en: string; name_kn: string; count: number; revenue: number }[];
  peak_hour: number;
  best_day: { date: string; revenue: number; orders: number };
  expense_by_category: Record<string, number>;
}

interface DailyBreakdown {
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

type DateRange = 'today' | 'week' | 'month' | 'custom';
type SortField = 'date' | 'orders' | 'revenue' | 'expenses' | 'profit';
type SortDir = 'asc' | 'desc';

const EXPENSE_CAT_LABELS: Record<string, string> = {
  raw_materials: '🥩 Raw Materials',
  labour: '👷 Labour',
  gas: '🔥 Gas',
  packaging: '📦 Packaging',
  other: '🔖 Other',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [chartType, setChartType] = useState<'revenue' | 'orders' | 'profit'>('revenue');

  const getDateRange = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    if (range === 'today') return { from: today, to: today };
    if (range === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { from: d.toISOString().split('T')[0], to: today };
    }
    if (range === 'month') {
      const d = new Date();
      d.setDate(1);
      return { from: d.toISOString().split('T')[0], to: today };
    }
    return { from: customFrom || today, to: customTo || today };
  }, [range, customFrom, customTo]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    try {
      const res = await fetch(`/api/admin/stats?from=${from}&to=${to}`);
      const data = await res.json();
      setStats(data.stats);
      setDaily(data.daily_breakdown ?? []);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortedDaily = [...daily].sort((a, b) => {
    const av = a[sortField] as number | string;
    const bv = b[sortField] as number | string;
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const shareOnWhatsApp = () => {
    if (!stats) return;
    const { from, to } = getDateRange();
    const rangeLabel = from === to ? from : `${from} to ${to}`;
    const msg = [
      `*ಒಗ್ಗರಣೆ BOWL — Report (${rangeLabel})*`,
      ``,
      `📦 Orders: ${stats.total_orders}`,
      `🍽️ Dine-in: ${stats.dine_in_orders} | 📦 Parcel: ${stats.parcel_orders}`,
      ``,
      `💰 Revenue: ${formatCurrency(stats.total_revenue)}`,
      `  • Online: ${formatCurrency(stats.online_revenue)}`,
      `  • Cash:   ${formatCurrency(stats.cash_revenue)}`,
      `💸 Expenses: ${formatCurrency(stats.total_expenses)}`,
      `📈 Net Profit: ${formatCurrency(stats.net_profit)} (${stats.profit_margin}%)`,
      ``,
      `🏆 Top Item: ${stats.top_items?.[0]?.name_en ?? '-'}`,
      `⚡ Avg Order: ${formatCurrency(stats.avg_order_value)}`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
        <div className="bg-white rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  const s = stats!;
  const isToday = range === 'today';
  const multiDay = daily.length > 1;

  // Chart data — shorten date labels
  const chartData = daily.map((d) => ({
    ...d,
    label: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="p-4 space-y-5 max-w-6xl mx-auto pb-10">

      {/* ── Period selector + actions ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['today', 'week', 'month', 'custom'] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              range === r ? 'bg-[#8B1A1A] text-white' : 'bg-white text-gray-600 border hover:border-[#8B1A1A]'
            }`}
          >
            {r === 'today' ? '📅 Today' : r === 'week' ? '📆 Last 7 Days' : r === 'month' ? '🗓️ This Month' : '🔍 Custom'}
          </button>
        ))}
        {range === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            <button onClick={fetchStats}
              className="bg-[#8B1A1A] text-white px-4 py-2 rounded-xl text-sm font-bold">
              Apply
            </button>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={fetchStats}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={shareOnWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700">
            <Share2 size={14} /> WhatsApp
          </button>
        </div>
      </div>

      {/* ── KPI Cards row 1 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet size={20} className="text-green-600" />}
          label="Total Revenue"
          value={formatCurrency(s.total_revenue)}
          sub={`Online ${formatCurrency(s.online_revenue)} · Cash ${formatCurrency(s.cash_revenue)}`}
          bg="bg-green-50"
          accent="text-green-700"
        />
        <KpiCard
          icon={s.net_profit >= 0 ? <TrendingUp size={20} className="text-emerald-600" /> : <TrendingDown size={20} className="text-red-500" />}
          label="Net Profit"
          value={formatCurrency(s.net_profit)}
          sub={`${s.profit_margin}% margin`}
          bg={s.net_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
          accent={s.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}
        />
        <KpiCard
          icon={<ShoppingBag size={20} className="text-orange-500" />}
          label="Total Orders"
          value={s.total_orders.toString()}
          sub={`Dine-in ${s.dine_in_orders} · Parcel ${s.parcel_orders}`}
          bg="bg-orange-50"
          accent="text-orange-700"
        />
        <KpiCard
          icon={<Package size={20} className="text-purple-500" />}
          label="Items Sold"
          value={s.total_items_sold.toString()}
          sub={`Avg order ${formatCurrency(s.avg_order_value)}`}
          bg="bg-purple-50"
          accent="text-purple-700"
        />
      </div>

      {/* ── KPI Cards row 2 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users size={20} className="text-blue-500" />}
          label="Footfall"
          value={s.footfall.toString()}
          sub={s.cancelled_orders > 0 ? `${s.cancelled_orders} cancelled` : 'All completed'}
          bg="bg-blue-50"
          accent="text-blue-700"
        />
        <KpiCard
          icon={<TrendingDown size={20} className="text-red-500" />}
          label="Total Expenses"
          value={formatCurrency(s.total_expenses)}
          sub={Object.keys(s.expense_by_category ?? {}).length + ' categories'}
          bg="bg-red-50"
          accent="text-red-700"
        />
        <KpiCard
          icon={<Clock size={20} className="text-indigo-500" />}
          label="Peak Hour"
          value={s.total_orders > 0 ? `${s.peak_hour}:00–${s.peak_hour + 1}:00` : '—'}
          sub="Busiest time of day"
          bg="bg-indigo-50"
          accent="text-indigo-700"
        />
        <KpiCard
          icon={<Star size={20} className="text-yellow-500" />}
          label="Best Day"
          value={multiDay && s.best_day?.revenue > 0 ? s.best_day.date.slice(5) : '—'}
          sub={multiDay && s.best_day?.revenue > 0 ? `${formatCurrency(s.best_day.revenue)} · ${s.best_day.orders} orders` : 'Single day view'}
          bg="bg-yellow-50"
          accent="text-yellow-700"
        />
      </div>

      {/* ── Revenue / Orders / Profit trend chart ─────────────────────────── */}
      {multiDay && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-black text-gray-800 text-lg">📈 Trend Analysis</h3>
            <div className="flex gap-1">
              {(['revenue', 'orders', 'profit'] as const).map((ct) => (
                <button key={ct} onClick={() => setChartType(ct)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    chartType === ct ? 'bg-[#8B1A1A] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {ct}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  chartType === 'orders' ? String(v) : `₹${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`
                }
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) =>
                  chartType === 'orders' ? [v, name] : [formatCurrency(Number(v)), name]
                }
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              {chartType === 'revenue' && (
                <>
                  <Bar dataKey="online_revenue" name="Online" stackId="rev" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="cash_revenue" name="Cash" stackId="rev" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Line dataKey="revenue" name="Total" stroke="#8B1A1A" strokeWidth={2} dot={false} />
                </>
              )}
              {chartType === 'orders' && (
                <>
                  <Bar dataKey="dine_in" name="Dine-in" stackId="ord" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="parcel" name="Parcel" stackId="ord" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  <Line dataKey="orders" name="Total Orders" stroke="#374151" strokeWidth={2} dot={false} />
                </>
              )}
              {chartType === 'profit' && (
                <>
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.7} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.7} />
                  <Line dataKey="profit" name="Profit" stroke="#8B1A1A" strokeWidth={2.5} dot={{ r: 3 }} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── P&L Summary ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-black text-gray-800 mb-4 text-lg">📊 Profit & Loss</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <ArrowUpRight size={16} />
              <span className="text-xs font-bold">Revenue</span>
            </div>
            <p className="text-2xl font-black text-green-700">{formatCurrency(s.total_revenue)}</p>
            <p className="text-xs text-green-500 mt-1">
              Online {Math.round(s.total_revenue > 0 ? (s.online_revenue / s.total_revenue) * 100 : 0)}% · Cash {Math.round(s.total_revenue > 0 ? (s.cash_revenue / s.total_revenue) * 100 : 0)}%
            </p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
              <ArrowDownRight size={16} />
              <span className="text-xs font-bold">Expenses</span>
            </div>
            <p className="text-2xl font-black text-red-600">{formatCurrency(s.total_expenses)}</p>
            <p className="text-xs text-red-400 mt-1">
              {Object.keys(s.expense_by_category ?? {}).length} categories
            </p>
          </div>
          <div className={`text-center p-4 rounded-xl ${s.net_profit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-xs font-bold text-gray-600">Net Profit</span>
            </div>
            <p className={`text-2xl font-black ${s.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(s.net_profit)}
            </p>
            <p className={`text-xs mt-1 ${s.net_profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {s.profit_margin}% margin
            </p>
          </div>
        </div>

        {/* Expense by category */}
        {Object.keys(s.expense_by_category ?? {}).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Expense Breakdown</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(s.expense_by_category ?? {}).map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-600">{EXPENSE_CAT_LABELS[cat] ?? cat}</span>
                  <span className="text-xs font-black text-red-600">{formatCurrency(amt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Order split ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dine-in vs Parcel */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4">🍽️ Order Type Split</h3>
          <div className="flex gap-3">
            <SplitBar label="Dine-in" count={s.dine_in_orders} total={s.total_orders} color="bg-purple-500" />
            <SplitBar label="Parcel" count={s.parcel_orders} total={s.total_orders} color="bg-pink-500" />
          </div>
        </div>

        {/* Payment method split */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4">💳 Payment Split</h3>
          <div className="flex gap-3">
            <SplitBar label="Online" count={s.online_revenue} total={s.total_revenue} color="bg-blue-500" isCurrency />
            <SplitBar label="Cash" count={s.cash_revenue} total={s.total_revenue} color="bg-yellow-500" isCurrency />
          </div>
        </div>
      </div>

      {/* ── Top Items ──────────────────────────────────────────────────────── */}
      {s.top_items?.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4 text-lg">🏆 Top Selling Items</h3>
          <div className="space-y-3">
            {s.top_items.map((item, i) => {
              const maxCount = s.top_items[0]?.count ?? 1;
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${
                    i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-600'
                  }`}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-semibold text-gray-800 text-sm">{item.name_en}</span>
                        <span className="text-orange-500 text-xs ml-2">{item.name_kn}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-gray-900 text-sm">{item.count} sold</span>
                        <span className="text-gray-400 text-xs ml-2">{formatCurrency(item.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#8B1A1A] to-orange-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Daily Breakdown Table ───────────────────────────────────────────── */}
      {multiDay && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-black text-gray-800 text-lg">📋 Daily Breakdown</h3>
            <p className="text-xs text-gray-400 mt-0.5">Click column headers to sort</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                  {(
                    [
                      ['date', 'Date'],
                      ['orders', 'Orders'],
                      ['revenue', 'Revenue'],
                      ['expenses', 'Expenses'],
                      ['profit', 'Profit'],
                    ] as [SortField, string][]
                  ).map(([field, label]) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      className="px-4 py-3 text-left cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
                    >
                      {label}
                      {sortField === field && (
                        <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDaily.map((d, i) => (
                  <tr key={d.date} className={`border-t ${i % 2 === 0 ? '' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                    <td className="px-4 py-3 font-semibold text-gray-700">{d.date}</td>
                    <td className="px-4 py-3 text-gray-800">
                      {d.orders}
                      <span className="text-xs text-gray-400 ml-1">({d.dine_in}D/{d.parcel}P)</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(d.revenue)}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{d.expenses > 0 ? formatCurrency(d.expenses) : '—'}</td>
                    <td className={`px-4 py-3 font-black ${d.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(d.profit)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-black text-sm">
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3">{s.total_orders}</td>
                  <td className="px-4 py-3 text-green-700">{formatCurrency(s.total_revenue)}</td>
                  <td className="px-4 py-3 text-red-600">{formatCurrency(s.total_expenses)}</td>
                  <td className={`px-4 py-3 ${s.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(s.net_profit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Today single day detail (no chart needed) ──────────────────────── */}
      {isToday && daily.length === 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4">⏱️ Today at a Glance</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-blue-700">{s.dine_in_orders}</p>
              <p className="text-xs text-blue-500 font-semibold">Dine-in Orders</p>
            </div>
            <div className="bg-pink-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-pink-700">{s.parcel_orders}</p>
              <p className="text-xs text-pink-500 font-semibold">Parcel Orders</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-green-700">{formatCurrency(s.online_revenue)}</p>
              <p className="text-xs text-green-500 font-semibold">Online Revenue</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-yellow-700">{formatCurrency(s.cash_revenue)}</p>
              <p className="text-xs text-yellow-600 font-semibold">Cash Revenue</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub, bg, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  bg: string;
  accent: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1 leading-tight">{sub}</p>
    </div>
  );
}

function SplitBar({
  label, count, total, color, isCurrency = false,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  isCurrency?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-sm font-black text-gray-900">
          {isCurrency ? formatCurrency(count) : count}
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct}%</p>
    </div>
  );
}
