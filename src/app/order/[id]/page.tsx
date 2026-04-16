'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { OrderWithItems } from '@/types';
import { formatCurrency, formatTime, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import QRCode from 'react-qr-code';
import Link from 'next/link';
import { updateRecentOrderStatus } from '@/components/RecentOrderBanner';

const STATUS_STEPS = ['ordered', 'ready', 'delivered'];

function playReadyChime() {
  try {
    const ctx = new AudioContext();
    [1046, 1318, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.18 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.35);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.35);
    });
  } catch { /* ignore */ }
}

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isCash = searchParams.get('cash') === '1';
  const isOnlinePay = searchParams.get('auto') === '1' || (!isCash && searchParams.get('cash') !== '1');
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const prevStatus = useRef<string | null>(null);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    setOrder(data.order);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Realtime subscription with fallback polling
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          // Play chime + vibrate when order becomes ready
          if (prevStatus.current && prevStatus.current !== 'ready' && newStatus === 'ready') {
            playReadyChime();
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
          }
          prevStatus.current = newStatus;
          setOrder((prev) => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    // Fallback: poll every 15s in case websocket drops
    const poll = setInterval(() => fetchOrder(), 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [id, fetchOrder]);

  // Track status changes from polling too
  useEffect(() => {
    if (!order) return;
    if (prevStatus.current && prevStatus.current !== 'ready' && order.status === 'ready') {
      playReadyChime();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
    prevStatus.current = order.status;
  }, [order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep localStorage in sync so RecentOrderBanner reflects latest status
  useEffect(() => {
    if (order) updateRecentOrderStatus(order.id, order.status, order.payment_status);
  }, [order?.status, order?.payment_status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto" />
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
      <div className={`text-white px-6 py-8 text-center transition-all ${isReady ? 'bg-green-600' : 'bg-brand'}`}>
        {isReady && <p className="text-2xl mb-1">🔔</p>}
        <p className="text-sm font-medium opacity-80 mb-1">
          {isReady ? 'Your order is ready! 🎉' : 'Token Number'}
        </p>
        <div className="text-8xl font-black tabular-nums">{order.token_number}</div>
        <p className="mt-2 font-bold text-lg opacity-90">
          {ORDER_STATUS_LABELS[order.status]}
        </p>
        <p className="text-xs opacity-70 mt-1">
          {order.order_type === 'parcel' ? '📦 Parcel' : '🍽️ Dine In'} · {formatTime(order.created_at)}
        </p>
        {/* Realtime connection indicator */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-300 animate-pulse' : 'bg-yellow-300'}`} />
          <span className="text-xs opacity-60">{connected ? 'Live updates on' : 'Connecting...'}</span>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Payment status banners */}
        {isCash && order.payment_status === 'unpaid' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="font-bold text-yellow-800">💵 Please pay at the counter</p>
            <p className="text-yellow-600 text-sm mt-1">Show this screen to staff</p>
          </div>
        )}

        {!isCash && order.payment_status === 'unpaid' && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
            <div className="text-center">
              <p className="font-bold text-orange-800">⏳ Payment confirming…</p>
              <p className="text-orange-600 text-sm mt-1">Your payment is being verified. This page will update automatically.</p>
            </div>
            <a
              href={`/pay/${order.id}`}
              className="block w-full text-center bg-brand text-white font-bold py-2.5 rounded-xl text-sm"
            >
              Complete payment →
            </a>
          </div>
        )}

        {order.payment_status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-bold text-red-700">❌ Payment failed</p>
              <p className="text-red-600 text-sm mt-1">Your money was <span className="font-bold">not</span> deducted. Please try again or pay at the counter.</p>
            </div>
            <div className="flex gap-2">
              <a href={`/pay/${order.id}`} className="flex-1 text-center bg-brand text-white font-bold py-2.5 rounded-xl text-sm">
                Try Again
              </a>
              <a href={`/order/${order.id}?cash=1`} className="flex-1 text-center bg-white border-2 border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm">
                Pay at Counter
              </a>
            </div>
          </div>
        )}

        {order.payment_status === 'paid' && !isCash && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
            <p className="text-green-700 font-bold text-sm">✅ Payment received — NG&apos;s Cafe</p>
          </div>
        )}

        {/* Status progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-700 mb-4">Order Status</p>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => {
              const stepIndex = STATUS_STEPS.indexOf(step);
              const done = currentStepIndex > stepIndex;
              const active = currentStepIndex === stepIndex;
              const icons: Record<string, string> = {
                ordered: '📋',
                ready: '🔔',
                delivered: '✅',
              };
              return (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-brand text-white ring-4 ring-brand/20' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {icons[step]}
                  </div>
                  <p className={`text-xs mt-1 font-semibold ${active ? 'text-brand' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {ORDER_STATUS_LABELS[step]}
                  </p>
                  {i < STATUS_STEPS.length - 1 && (
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
                  <p className="text-brand text-xs">{item.product_name_kn}</p>
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
            <span className="text-brand font-black">{formatCurrency(order.total_amount)}</span>
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
          className="block text-center text-brand font-bold py-3"
        >
          + Order More
        </Link>
      </div>
    </div>
  );
}
