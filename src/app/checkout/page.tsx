'use client';

import { useState, useEffect, useRef } from 'react';
import { useCartStore } from '@/store/cart';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Minus, Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { saveRecentOrder } from '@/components/RecentOrderBanner';

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

      // Save to localStorage so customer can resume if they refresh/close
      saveRecentOrder({
        id: data.order.id,
        token_number: data.order.token_number,
        total_amount: data.order.total_amount,
        status: data.order.status,
        payment_status: data.order.payment_status,
        order_type: orderType,
        created_at: data.order.created_at,
      });

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
    <div className="max-w-lg mx-auto pb-10" style={{ background: '#FFF8EC', minHeight: '100vh' }}>
      {/* Header */}
      <div
        className="px-4 pt-8 pb-5 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #6B1212 0%, #8B1A1A 100%)' }}
      >
        <button onClick={() => router.back()} className="text-white/80 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Your Order</h1>
          <p className="text-white/55 text-xs">{items.length} item{items.length !== 1 ? 's' : ''} · Review before paying</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Order Type */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Order Type</p>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType('dine_in')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                orderType === 'dine_in' ? 'bg-brand text-white shadow-md' : 'bg-gray-100 text-gray-600'
              }`}
            >
              🍽️ Dine In
            </button>
            <button
              onClick={() => setOrderType('parcel')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                orderType === 'parcel' ? 'bg-brand text-white shadow-md' : 'bg-gray-100 text-gray-600'
              }`}
            >
              📦 Parcel <span className="opacity-70 font-normal text-xs">(+₹{parcelCharge})</span>
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Items</p>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{item.product.name_en}</p>
                  <p className="text-brand/70 text-xs font-medium">{item.product.name_kn}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="bg-brand-light text-brand w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="font-black w-5 text-center text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="bg-brand text-white w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Plus size={13} />
                  </button>
                  <button onClick={() => removeItem(item.product.id)} className="text-red-400 ml-1 active:scale-95 transition-all">
                    <Trash2 size={15} />
                  </button>
                </div>
                <span className="font-bold text-sm w-14 text-right text-gray-900">
                  {formatCurrency(item.product.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Special Instructions</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, spice level, extras… (optional)"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
            rows={2}
          />
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Bill Summary</p>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCurrency(sub)}</span>
            </div>
            {orderType === 'parcel' && (
              <div className="flex justify-between text-gray-600">
                <span>Parcel Charge</span>
                <span className="font-semibold">{formatCurrency(parcelCharge)}</span>
              </div>
            )}
            <div className="h-px bg-gray-100 my-1" />
            <div className="flex justify-between items-center">
              <span className="font-black text-gray-900 text-base">Total</span>
              <span className="font-black text-brand text-xl">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-1 pb-4">
          <button
            onClick={() => handlePlaceOrder('online')}
            disabled={loading}
            className="w-full text-white font-black text-lg py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg"
            style={{ background: loading ? '#aaa' : 'linear-gradient(135deg, #8B1A1A 0%, #C0392B 100%)', boxShadow: '0 6px 24px rgba(139,26,26,0.35)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin" /> Placing order…
              </span>
            ) : (
              `💳 Pay ${formatCurrency(total)}`
            )}
          </button>
          <p className="text-center text-gray-400 text-xs mt-2.5">Secured by Razorpay · UPI · Cards · Wallets</p>
        </div>
      </div>
    </div>
  );
}
