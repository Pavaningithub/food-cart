'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { playNewOrderAlert, playReadyAlert, unlockAudio } from '@/lib/sound';
import { OrderWithItems } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { formatTime, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/utils';
import toast from 'react-hot-toast';

type KitchenFilter = 'active' | 'all';

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KitchenFilter>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const prevOrdersRef = useRef<OrderWithItems[]>([]);

  const fetchOrders = useCallback(async (fromRealtime = false) => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/orders?date=${today}`);
    const data = await res.json();
    const incoming: OrderWithItems[] = data.orders ?? [];

    if (fromRealtime && initialLoadDone.current && soundEnabled) {
      const newOrders = incoming.filter(o => !knownOrderIds.current.has(o.id));
      if (newOrders.length > 0) {
        playNewOrderAlert();
        toast(`🔔 ${newOrders.length} new order${newOrders.length > 1 ? 's' : ''}!`, {
          duration: 4000,
          style: { background: '#f97316', color: '#fff', fontWeight: 'bold' },
        });
      }
      const justReady = incoming.filter(o =>
        o.status === 'ready' &&
        prevOrdersRef.current.find(prev => prev.id === o.id && prev.status === 'ordered')
      );
      if (justReady.length > 0) playReadyAlert();
    }

    incoming.forEach(o => knownOrderIds.current.add(o.id));
    prevOrdersRef.current = incoming;
    setOrders(incoming);
    setLoading(false);
    initialLoadDone.current = true;
  }, [soundEnabled]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchOrders(true))
      .subscribe();

    // Re-fetch when tab/screen becomes visible again (phone wake-up)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchOrders(); };
    document.addEventListener('visibilitychange', onVisible);
    // Fallback poll every 20s
    const poll = setInterval(() => fetchOrders(), 20000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Order marked as ${ORDER_STATUS_LABELS[status]}`);
      await fetchOrders();
    } catch {
      toast.error('Failed to update order');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleSound = () => {
    unlockAudio();
    setSoundEnabled(v => !v);
  };

  const displayOrders = orders.filter((o) => {
    if (o.status === 'cancelled') return false;
    if (filter === 'active') return ['ordered', 'ready'].includes(o.status);
    return true;
  });

  const pendingCount = orders.filter(o => o.status === 'ordered').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white" onClick={unlockAudio}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-orange-400">👨‍🍳 Kitchen Display</h1>
            <span className="text-gray-400 text-sm">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-black text-yellow-400">{pendingCount}</div>
              <div className="text-xs text-gray-400">Preparing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-green-400">{readyCount}</div>
              <div className="text-xs text-gray-400">Ready</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toggleSound(); }}
              title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
              className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all ${
                soundEnabled ? 'bg-green-700 text-green-200' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {soundEnabled ? '🔔 Sound ON' : '🔕 Muted'}
            </button>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${filter === 'active' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${filter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                All Today
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-24 text-gray-600">
            <div className="text-6xl mb-4">🍽️</div>
            <p className="text-xl font-bold">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayOrders.map((order) => (
              <KitchenCard
                key={order.id}
                order={order}
                onStatusChange={updateStatus}
                isUpdating={updatingId === order.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KitchenCard({
  order,
  onStatusChange,
  isUpdating,
}: {
  order: OrderWithItems;
  onStatusChange: (id: string, status: string) => void;
  isUpdating: boolean;
}) {
  const isReady = order.status === 'ready';
  const isPaid = order.payment_status === 'paid';

  const nextStatus: Record<string, string> = {
    ordered: 'ready', ready: 'delivered',
  };
  const nextLabel: Record<string, string> = {
    ordered: '🔔 Mark Ready', ready: '✓ Delivered',
  };

  const cardBg = isReady
    ? 'bg-green-900 border-green-500'
    : order.status === 'ordered'
    ? 'bg-orange-950 border-orange-500'
    : 'bg-gray-800 border-gray-700';

  const printKOT = () => {
    const time = new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const itemsHtml = (order.order_items ?? []).map(item =>
      `<tr>
        <td style="padding:2px 0">${item.product_name_en}<br/><small style="color:#555">${item.product_name_kn}</small></td>
        <td style="text-align:right;padding:2px 0">x${item.quantity}</td>
      </tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace;font-size:13px;width:72mm;padding:4mm}
      h2{font-size:18px;text-align:center;margin-bottom:2px}.center{text-align:center}
      .token{font-size:48px;font-weight:bold;text-align:center;margin:4px 0}
      .divider{border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{vertical-align:top}
      .total{font-weight:bold;font-size:15px}.footer{font-size:11px;text-align:center;margin-top:6px;color:#555}
      @page{size:80mm auto;margin:4mm}</style></head><body>
      <h2>FoodCart</h2>
      <p class="center">${order.order_type === 'parcel' ? '📦 PARCEL' : '🍽️ DINE IN'}</p>
      <div class="divider"></div>
      <div class="token">#${order.token_number}</div>
      <p class="center" style="font-size:11px">${time}</p>
      <div class="divider"></div>
      <table>${itemsHtml}</table>
      <div class="divider"></div>
      <table>
        <tr class="total"><td>TOTAL</td><td style="text-align:right">₹${Number(order.total_amount).toFixed(2)}</td></tr>
        <tr><td>Payment</td><td style="text-align:right">${isPaid ? '✅ PAID' : '⏳ UNPAID'}</td></tr>
      </table>
      ${order.notes ? `<div class="divider"></div><p>📝 ${order.notes}</p>` : ''}
      <div class="divider"></div>
      <p class="footer">Thank you!</p>
      </body></html>`;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300); }
  };

  return (
    <div className={`rounded-2xl border-2 p-4 flex flex-col transition-all ${cardBg} ${isReady ? 'animate-pulse-slow' : ''}`}>
      {/* Token + type */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-4xl font-black text-white tabular-nums">{order.token_number}</span>
          <p className="text-xs text-gray-400 font-medium">
            {order.order_type === 'parcel' ? '📦 PARCEL' : '🍽️ DINE IN'}
          </p>
        </div>
        <div className="text-right">
          {!isPaid && (
            <span className="bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full">UNPAID</span>
          )}
          <p className="text-gray-400 text-xs mt-1">{formatTime(order.created_at)}</p>
          <button
            onClick={printKOT}
            title="Print KOT"
            className="mt-1 text-gray-400 hover:text-white text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded transition-all"
          >🖨️ KOT</button>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-1.5 mb-3">
        {order.order_items?.map((item) => (
          <div key={item.id} className="flex justify-between items-center">
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{item.product_name_en}</p>
              <p className="text-orange-400 text-xs">{item.product_name_kn}</p>
            </div>
            <span className="text-white font-black text-lg ml-2">×{item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && (
        <p className="text-yellow-400 text-xs bg-yellow-900/30 rounded-lg px-2 py-1 mb-3">
          📝 {order.notes}
        </p>
      )}

      {/* Status + action */}
      <div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
        {nextStatus[order.status] && (
          <button
            onClick={() => onStatusChange(order.id, nextStatus[order.status])}
            disabled={isUpdating}
            className={`w-full mt-2 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
              isReady
                ? 'bg-green-500 hover:bg-green-400 text-white'
                : 'bg-orange-500 hover:bg-orange-400 text-white'
            }`}
          >
            {isUpdating ? '...' : nextLabel[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}
