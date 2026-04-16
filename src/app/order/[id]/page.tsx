'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { OrderWithItems } from '@/types';
import { formatCurrency, formatTime, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import QRCode from 'react-qr-code';
import Link from 'next/link';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'served'];

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isCash = searchParams.get('cash') === '1';
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    setOrder(data.order);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          setOrder((prev) => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Order not found</p>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const isReady = order.status === 'ready';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Hero token */}
      <div className={`text-white px-6 py-8 text-center transition-all ${isReady ? 'bg-green-500' : 'bg-gradient-to-br from-orange-500 to-orange-600'}`}>
        {isReady && <p className="text-2xl mb-1">🔔</p>}
        <p className="text-sm font-medium opacity-80 mb-1">
          {isReady ? 'Your order is ready!' : 'Token Number'}
        </p>
        <div className="text-8xl font-black tabular-nums">{order.token_number}</div>
        <p className="mt-2 font-bold text-lg opacity-90">
          {ORDER_STATUS_LABELS[order.status]}
        </p>
        <p className="text-xs opacity-70 mt-1">
          {order.order_type === 'parcel' ? '📦 Parcel' : '🍽️ Dine In'} · {formatTime(order.created_at)}
        </p>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Cash payment notice */}
        {isCash && order.payment_status === 'unpaid' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="font-bold text-yellow-800">💵 Please pay at the counter</p>
            <p className="text-yellow-600 text-sm mt-1">Show this screen to staff</p>
          </div>
        )}

        {/* Status progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-700 mb-4">Order Status</p>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.filter(s => s !== 'served').map((step, i) => {
              const stepIndex = STATUS_STEPS.indexOf(step);
              const done = currentStepIndex > stepIndex;
              const active = currentStepIndex === stepIndex;
              const icons: Record<string, string> = {
                pending: '📋',
                confirmed: '✅',
                preparing: '👨‍🍳',
                ready: '🔔',
              };
              return (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white ring-4 ring-orange-200' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {icons[step]}
                  </div>
                  <p className={`text-xs mt-1 font-semibold ${active ? 'text-orange-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {ORDER_STATUS_LABELS[step]}
                  </p>
                  {i < 3 && (
                    <div className="absolute" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${ORDER_STATUS_COLORS[order.status]}`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-700 mb-3">Order Items</p>
          <div className="space-y-2">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{item.product_name_en}</p>
                  <p className="text-orange-500 text-xs">{item.product_name_kn}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">x{item.quantity}</p>
                  <p className="text-gray-500 text-xs">{formatCurrency(item.subtotal)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 mt-3 flex justify-between font-black">
            <span>Total</span>
            <span className="text-orange-600">{formatCurrency(order.total_amount)}</span>
          </div>
        </div>

        {/* QR for tracking */}
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <p className="text-sm font-bold text-gray-600 mb-3">Save this QR to track order</p>
          <div className="flex justify-center">
            <QRCode value={`${appUrl}/order/${order.id}`} size={120} />
          </div>
        </div>

        <Link
          href="/menu"
          className="block text-center text-orange-500 font-bold py-3"
        >
          + Order More
        </Link>
      </div>
    </div>
  );
}
