'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { playNewOrderAlert, unlockAudio } from '@/lib/sound';
import { OrderWithItems } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ParcelPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const fetchOrders = useCallback(async (fromRealtime = false) => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/orders?date=${today}&order_type=parcel`);
    const data = await res.json();
    const incoming: OrderWithItems[] = (data.orders ?? []).filter((o: OrderWithItems) => o.status !== 'cancelled');

    if (fromRealtime && initialLoadDone.current && soundEnabled) {
      const newOrders = incoming.filter(o => !knownOrderIds.current.has(o.id));
      if (newOrders.length > 0) {
        playNewOrderAlert();
        toast(`📦 ${newOrders.length} new parcel${newOrders.length > 1 ? 's' : ''}!`, {
          duration: 4000,
          style: { background: '#3b82f6', color: '#fff', fontWeight: 'bold' },
        });
      }
    }

    incoming.forEach(o => knownOrderIds.current.add(o.id));
    setOrders(incoming);
    setLoading(false);
    initialLoadDone.current = true;
  }, [soundEnabled]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('parcel-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast.success('Updated!');
      await fetchOrders();
    } catch {
      toast.error('Failed to update');
    } finally {
      setUpdatingId(null);
    }
  };

  const active = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
  const done = orders.filter(o => o.status === 'served');

  return (
    <div className="min-h-screen bg-blue-950 text-white" onClick={unlockAudio}>
      <div className="bg-blue-900 border-b border-blue-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <h1 className="text-2xl font-black text-blue-300">📦 Parcel Orders</h1>
          <div className="flex items-center gap-4">
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-2xl font-black text-yellow-400">{active.length}</div>
                <div className="text-xs text-blue-400">Active</div>
              </div>
              <div>
                <div className="text-2xl font-black text-green-400">{done.length}</div>
                <div className="text-xs text-blue-400">Done Today</div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); unlockAudio(); setSoundEnabled(v => !v); }}
              className={`px-3 py-2 rounded-lg font-bold text-sm ${
                soundEnabled ? 'bg-green-700 text-green-200' : 'bg-blue-800 text-blue-400'
              }`}
            >
              {soundEnabled ? '🔔 Sound ON' : '🔕 Muted'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-blue-800 rounded-2xl h-48 animate-pulse" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="text-center py-24 text-blue-700">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-xl font-bold">No active parcel orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {active.map((order) => (
              <div
                key={order.id}
                className={`rounded-2xl border-2 p-4 flex flex-col ${
                  order.status === 'ready'
                    ? 'bg-green-900 border-green-500'
                    : 'bg-blue-800 border-blue-600'
                }`}
              >
                <div className="flex justify-between mb-3">
                  <div>
                    <div className="text-4xl font-black">{order.token_number}</div>
                    <p className="text-xs text-blue-300">{formatTime(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    {order.payment_status !== 'paid' && (
                      <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                        CASH
                      </span>
                    )}
                    <p className="text-green-400 font-bold mt-1">₹{order.total_amount}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 mb-3">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-sm font-medium">{item.product_name_en}</span>
                      <span className="font-black text-orange-400">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {order.parcel_charge > 0 && (
                  <p className="text-blue-400 text-xs mb-2">+₹{order.parcel_charge} parcel charge</p>
                )}

                {order.status === 'ready' ? (
                  <button
                    onClick={() => updateStatus(order.id, 'served')}
                    disabled={updatingId === order.id}
                    className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-2.5 rounded-xl text-sm"
                  >
                    ✓ Collected
                  </button>
                ) : (
                  <div className="text-center text-blue-400 text-xs font-medium py-2">
                    {order.status === 'preparing' ? '🔥 Preparing...' : '⏳ Waiting...'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
