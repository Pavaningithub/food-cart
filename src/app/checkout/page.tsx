'use client';

import { useState, useEffect, useRef } from 'react';
import { useCartStore } from '@/store/cart';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Minus, Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const { items, orderType, setOrderType, updateQuantity, removeItem, subtotal, clearCart } = useCartStore();
  const [parcelCharge, setParcelCharge] = useState(10);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const navigating = useRef(false);
  const router = useRouter();

  // Fetch parcel charge — use localStorage cache (5 min) to avoid slow cold-start on every load
  useEffect(() => {
    const CACHE_KEY = 'ng_settings_cache';
    const CACHE_TTL = 5 * 60 * 1000;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, settings } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          const s = (settings as { key: string; value: string }[]).find((x) => x.key === 'parcel_charge');
          if (s) setParcelCharge(Number(s.value));
          return; // skip network fetch
        }
      }
    } catch { /* ignore */ }
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const all = data.settings ?? [];
        const setting = all.find((s: { key: string; value: string }) => s.key === 'parcel_charge');
        if (setting) setParcelCharge(Number(setting.value));
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), settings: all })); } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  const sub = subtotal();
  const extra = orderType === 'parcel' ? parcelCharge : 0;
  const total = sub + extra;

  if (items.length === 0 && !navigating.current) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-4xl mb-4">🛒</p>
        <p className="text-gray-500 font-medium">Your cart is empty</p>
        <button onClick={() => router.push('/menu')} className="mt-4 text-brand font-bold">
          ← Back to Menu
        </button>
      </div>
    );
  }

  if (navigating.current) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <Loader2 size={36} className="animate-spin text-brand mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Setting up your order…</p>
      </div>
    );
  }

  const handlePlaceOrder = async (paymentMethod: 'online' | 'cash') => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, order_type: orderType, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (paymentMethod === 'online') {
        navigating.current = true;
        router.push(`/pay/${data.order.id}?auto=1`);
        clearCart();
      } else {
        navigating.current = true;
        router.push(`/order/${data.order.id}?cash=1`);
        clearCart();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-600">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-black">Your Order</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Order Type */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-700 mb-3">Order Type</p>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType('dine_in')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                orderType === 'dine_in' ? 'bg-brand text-white shadow' : 'bg-gray-100 text-gray-600'
              }`}
            >
              🍽️ Dine In
            </button>
            <button
              onClick={() => setOrderType('parcel')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                orderType === 'parcel' ? 'bg-brand text-white shadow' : 'bg-gray-100 text-gray-600'
              }`}
            >
              📦 Parcel <span className="opacity-75 text-xs">(+₹{parcelCharge})</span>
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="font-bold text-gray-700">Items</p>
          {items.map((item) => (
            <div key={item.product.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{item.product.name_en}</p>
                <p className="text-brand text-xs">{item.product.name_kn}</p>
                <p className="text-gray-500 text-sm">₹{item.product.price} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="bg-brand-light text-brand w-7 h-7 rounded-full flex items-center justify-center"
                >
                  <Minus size={14} />
                </button>
                <span className="font-bold w-5 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  className="bg-brand text-white w-7 h-7 rounded-full flex items-center justify-center"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="text-red-400 ml-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <span className="font-bold text-sm w-16 text-right">
                {formatCurrency(item.product.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-700 mb-2">Special Instructions</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requests? (optional)"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-brand"
            rows={2}
          />
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-700 mb-3">Bill Summary</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(sub)}</span>
            </div>
            {orderType === 'parcel' && (
              <div className="flex justify-between text-gray-600">
                <span>Parcel Charge</span>
                <span>{formatCurrency(parcelCharge)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-gray-900 text-base border-t pt-2 mt-2">
              <span>Total</span>
              <span className="text-brand font-black">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => handlePlaceOrder('online')}
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-98 disabled:opacity-60"
          >
            {loading ? '...' : `💳 Pay Online — ${formatCurrency(total)}`}
          </button>
          <button
            onClick={() => handlePlaceOrder('cash')}
            disabled={loading}
            className="w-full bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-700 font-bold text-base py-3.5 rounded-2xl transition-all active:scale-98 disabled:opacity-60"
          >
            💵 Pay at Counter (Cash)
          </button>
        </div>
      </div>
    </div>
  );
}
