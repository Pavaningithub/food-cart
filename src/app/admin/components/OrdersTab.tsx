'use client';

import { useEffect, useState, useCallback } from 'react';
import { OrderWithItems } from '@/types';
import { formatCurrency, formatDateTime, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function OrdersTab() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date: dateFilter });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }, [dateFilter, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrder = async (id: string, updates: Record<string, string>) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      toast.success('Order updated');
      fetchOrders();
    } catch {
      toast.error('Failed to update order');
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      toast.success('Order deleted');
      fetchOrders();
    } catch {
      toast.error('Failed to delete order');
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-2xl shadow-sm">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            {['pending','confirmed','preparing','ready','served','cancelled'].map(s => (
              <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="self-end">
          <button onClick={fetchOrders} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold">
            Refresh
          </button>
        </div>
        <div className="self-end ml-auto text-sm text-gray-500 font-semibold">
          {orders.length} orders
        </div>
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No orders found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div className="text-2xl font-black text-orange-500 w-10 text-center tabular-nums">
                  {order.token_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
                      {order.payment_status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {order.order_type === 'parcel' ? '📦' : '🍽️'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{formatDateTime(order.created_at)}</p>
                </div>
                <div className="font-black text-gray-900">{formatCurrency(order.total_amount)}</div>
              </div>

              {/* Expanded */}
              {expandedId === order.id && (
                <div className="border-t px-4 pb-4 pt-3 bg-gray-50">
                  <div className="space-y-1.5 mb-3">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.product_name_en} × {item.quantity}</span>
                        <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                    {order.parcel_charge > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Parcel charge</span>
                        <span>{formatCurrency(order.parcel_charge)}</span>
                      </div>
                    )}
                  </div>

                  {order.notes && <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 mb-3">📝 {order.notes}</p>}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <select
                      defaultValue={order.status}
                      onChange={(e) => updateOrder(order.id, { status: e.target.value })}
                      className="border rounded-lg px-2 py-1.5 text-xs font-medium"
                    >
                      {['pending','confirmed','preparing','ready','served','cancelled'].map(s => (
                        <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <select
                      defaultValue={order.payment_status}
                      onChange={(e) => updateOrder(order.id, { payment_status: e.target.value })}
                      className="border rounded-lg px-2 py-1.5 text-xs font-medium"
                    >
                      {['unpaid','paid','failed','refunded'].map(s => (
                        <option key={s} value={s}>{s.toUpperCase()}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
