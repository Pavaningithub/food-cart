'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

const STORAGE_KEY = 'ng_recent_orders';
const MAX_ORDERS = 3;

function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface RecentOrderEntry {
  id: string;
  token_number: number;
  total_amount: number;
  status: string;
  payment_status: string;
  order_type: string;
  created_at: string;
}

export function saveRecentOrder(order: RecentOrderEntry) {
  try {
    const existing = getRecentOrders();
    const updated = [order, ...existing.filter((o) => o.id !== order.id)].slice(0, MAX_ORDERS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function getRecentOrders(): RecentOrderEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const orders: RecentOrderEntry[] = JSON.parse(raw);
    // Only show orders from today (reset at midnight)
    const cutoff = todayStart();
    return orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  } catch { return []; }
}

export function updateRecentOrderStatus(id: string, status: string, payment_status: string) {
  try {
    const orders = getRecentOrders();
    const updated = orders.map((o) => o.id === id ? { ...o, status, payment_status } : o);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

// ── Banner shown on menu page ─────────────────────────────────────────────
export default function RecentOrderBanner() {
  const [orders, setOrders] = useState<RecentOrderEntry[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const recent = getRecentOrders();
    const active = recent
      .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
      .slice(0, MAX_ORDERS);
    setOrders(active);
  }, []);

  if (dismissed || orders.length === 0) return null;

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-white px-4 py-2 flex items-center justify-between border-b">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Today&apos;s Orders</p>
        <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label="Dismiss">×</button>
      </div>
      <div className="divide-y divide-gray-100">
        {orders.map((order) => {
          const isPaid = order.payment_status === 'paid';
          const isFailed = order.payment_status === 'failed';
          const isPending = !isPaid && !isFailed;
          return (
            <div key={order.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${
              isFailed ? 'bg-red-50' : isPending ? 'bg-orange-50' : 'bg-green-50'
            }`}>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${
                  isFailed ? 'text-red-700' : isPending ? 'text-orange-700' : 'text-green-700'
                }`}>
                  {isFailed ? '❌' : isPending ? '⏳' : '✅'} Token #{order.token_number}
                  <span className="font-normal text-xs ml-2 opacity-70">
                    {order.order_type === 'parcel' ? '📦' : '🍽️'}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isFailed ? 'Payment failed' : isPending ? 'Awaiting payment' : 'Active'}
                  {' · '}{formatCurrency(order.total_amount)}
                </p>
              </div>
              <Link
                href={isFailed || isPending ? `/pay/${order.id}` : `/order/${order.id}`}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 ${
                  isFailed ? 'bg-red-600 text-white' :
                  isPending ? 'bg-orange-500 text-white' :
                  'bg-green-600 text-white'
                }`}
              >
                {isFailed ? 'Retry' : isPending ? 'Pay' : 'Track'}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
