'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils';
import { TrendingUp, TrendingDown, Users, ShoppingBag, Package, Wallet } from 'lucide-react';

interface Stats {
  total_orders: number;
  dine_in_orders: number;
  parcel_orders: number;
  footfall: number;
  online_revenue: number;
  cash_revenue: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  total_items_sold: number;
  top_items: { name_en: string; name_kn: string; count: number }[];
}

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
}

interface CashEntry {
  id: string;
  entry_date: string;
  amount: number;
  notes: string | null;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

export default function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

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
    const res = await fetch(`/api/admin/stats?from=${from}&to=${to}`);
    const data = await res.json();
    setStats(data.stats);
    setExpenses(data.expenses ?? []);
    setCashEntries(data.cash_entries ?? []);
    setLoading(false);
  }, [getDateRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      {/* Date range picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['today', 'week', 'month', 'custom'] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              range === r ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border'
            }`}
          >
            {r === 'today' ? 'Today' : r === 'week' ? 'Last 7 Days' : r === 'month' ? 'This Month' : 'Custom'}
          </button>
        ))}
        {range === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm" />
            <span className="text-gray-500">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm" />
            <button onClick={fetchStats} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold">
              Apply
            </button>
          </>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users className="text-blue-500" />} label="Footfall" value={s.footfall.toString()} bg="bg-blue-50" />
        <StatCard icon={<ShoppingBag className="text-orange-500" />} label="Total Orders" value={s.total_orders.toString()} bg="bg-orange-50" />
        <StatCard icon={<Package className="text-purple-500" />} label="Items Sold" value={s.total_items_sold.toString()} bg="bg-purple-50" />
        <StatCard icon={<Wallet className="text-green-500" />} label="Total Revenue" value={formatCurrency(s.total_revenue)} bg="bg-green-50" />
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-sm font-medium mb-1">Dine In Orders</p>
          <p className="text-3xl font-black text-gray-900">{s.dine_in_orders}</p>
          <p className="text-gray-400 text-xs mt-1">🍽️ Dine in customers</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-sm font-medium mb-1">Parcel Orders</p>
          <p className="text-3xl font-black text-gray-900">{s.parcel_orders}</p>
          <p className="text-gray-400 text-xs mt-1">📦 Takeaway orders</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Online Revenue</p>
              <p className="text-2xl font-black text-green-600">{formatCurrency(s.online_revenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-sm font-medium mb-1">Cash Revenue</p>
              <p className="text-2xl font-black text-yellow-600">{formatCurrency(s.cash_revenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-black text-gray-800 mb-4 text-lg">📊 Profit & Loss</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs font-bold">Revenue</span>
            </div>
            <p className="text-2xl font-black text-green-700">{formatCurrency(s.total_revenue)}</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-bold">Expenses</span>
            </div>
            <p className="text-2xl font-black text-red-600">{formatCurrency(s.total_expenses)}</p>
          </div>
          <div className={`text-center p-3 rounded-xl ${s.net_profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-xs font-bold text-gray-600">Net Profit</span>
            </div>
            <p className={`text-2xl font-black ${s.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(s.net_profit)}
            </p>
          </div>
        </div>
      </div>

      {/* Top Items */}
      {s.top_items?.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4">🏆 Top Selling Items</h3>
          <div className="space-y-2">
            {s.top_items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-gray-400 font-bold w-5 text-sm">{i + 1}.</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{item.name_en}</p>
                  <p className="text-orange-500 text-xs">{item.name_kn}</p>
                </div>
                <span className="font-black text-gray-900 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm">
                  {item.count} sold
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses breakdown */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4">💸 Expenses Breakdown</h3>
          <div className="space-y-2">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{exp.description}</p>
                  <p className="text-gray-400 text-xs">{EXPENSE_CATEGORY_LABELS[exp.category]} · {exp.expense_date}</p>
                </div>
                <span className="font-bold text-red-600">{formatCurrency(exp.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash entries */}
      {cashEntries.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4">💵 Cash Entries</h3>
          <div className="space-y-2">
            {cashEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-gray-400 text-xs">{entry.entry_date}</p>
                  {entry.notes && <p className="text-gray-600 text-sm">{entry.notes}</p>}
                </div>
                <span className="font-bold text-green-600">{formatCurrency(entry.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-semibold text-gray-500">{label}</span></div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
    </div>
  );
}
