'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

const STORAGE_KEY = 'ng_recent_orders';
const MAX_ORDERS = 5;
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    // Filter out orders older than 24h
    const cutoff = Date.now() - EXPIRY_MS;
    return orders.filter((o) => new Date(o.created_at).getTime() > cutoff);
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
    // Only show active (not delivered/cancelled) orders
    const active = recent.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled'
    );
    setOrders(active);
  }, []);

  if (dismissed || orders.length === 0) return null;

  const latest = orders[0];
  const isPaid = latest.payment_status === 'paid';
  const isFailed = latest.payment_status === 'failed';
  const isPending = !isPaid && !isFailed;

  return (
    <div className="mx-4 mt-3 rounded-2xl border shadow-sm overflow-hidden">
      <div className={`px-4 py-3 flex items-start justify-between gap-3 ${
        isFailed ? 'bg-red-50 border-red-200' :
        isPending ? 'bg-orange-50 border-orange-200' :
        'bg-green-50 border-green-200'
      }`}>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${isFailed ? 'text-red-700' : isPending ? 'text-orange-700' : 'text-green-700'}`}>
            {isFailed
              ? '❌ Payment failed — Token #' + latest.token_number
              : isPending
              ? '⏳ Payment pending — Token #' + latest.token_number
              : '✅ Order active — Token #' + latest.token_number}
          </p>
          <p className={`text-xs mt-0.5 ${isFailed ? 'text-red-500' : isPending ? 'text-orange-500' : 'text-green-600'}`}>
            {formatCurrency(latest.total_amount)} ·{' '}
            {latest.order_type === 'parcel' ? '📦 Parcel' : '🍽️ Dine In'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={isFailed || isPending ? `/pay/${latest.id}` : `/order/${latest.id}`}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
              isFailed ? 'bg-red-600 text-white' :
              isPending ? 'bg-orange-500 text-white' :
              'bg-green-600 text-white'
            }`}
          >
            {isFailed ? 'Retry' : isPending ? 'Pay' : 'Track'}
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      {orders.length > 1 && (
        <div className="bg-white px-4 py-2 border-t flex items-center justify-between">
          <p className="text-xs text-gray-500">{orders.length - 1} more order{orders.length > 2 ? 's' : ''} today</p>
          <Link href={`/order/${orders[0].id}`} className="text-xs text-brand font-semibold">
            View all →
          </Link>
        </div>
      )}
    </div>
  );
}
