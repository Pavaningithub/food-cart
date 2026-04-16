'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Order } from '@/types';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Loader2, ShoppingBag } from 'lucide-react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, any>) => { open: () => void };
  }
}

/** Returns true if the browser is running on an iOS device */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [serverAmount, setServerAmount] = useState<number | null>(null); // paise from server
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    setOrder(data.order);
    if (data.order?.payment_status === 'paid') setPaid(true);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Poll after payment modal closes — webhook may take a few seconds
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (data.order?.payment_status === 'paid') {
        setPaid(true);
        if (pollRef.current) clearInterval(pollRef.current);
        setTimeout(() => router.push(`/order/${id}`), 1200);
      }
    }, 2500);
  }, [id, router]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /**
   * Razorpay hosted checkout:
   * - On Android: opens native UPI apps (GPay, PhonePe, Paytm) via intent
   * - On iPhone: opens Razorpay's web checkout with UPI collect / card options
   * - No separate QR to scan — payment happens in the same phone
   */
  const handlePay = useCallback(async () => {
    if (paying) return;
    setPaying(true);
    setPaymentFailed(false);

    try {
      // Lazy-load Razorpay checkout.js (only once)
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Could not load payment SDK'));
          document.head.appendChild(s);
        });
      }

      // Create Razorpay order on server
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Payment init failed');

      // Amount comes from server — display it so customer sees exact charge
      setServerAmount(data.amount); // in paise

      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,          // in paise
        currency: data.currency,      // INR
        name: 'FoodCart',
        description: `Token #${order?.token_number} — ${order?.order_type === 'parcel' ? 'Parcel' : 'Dine In'}`,
        order_id: data.razorpay_order_id,
        image: '/icon.png',           // optional logo
        // handler fires on successful payment captured by Razorpay SDK
        handler: (_response: Record<string, string>) => {
          setPaying(false);
          toast.success('Payment successful! 🎉');
          startPolling(); // also poll in case webhook is slightly delayed
          router.push(`/order/${id}`);
        },
        prefill: { name: '', email: '', contact: '' },
        notes: { order_id: id },
        theme: { color: '#f97316', backdrop_color: 'rgba(0,0,0,0.7)' },
        /**
         * Android: show native UPI app list (GPay, PhonePe, Paytm) via intent
         * iPhone: UPI intents don't work on iOS — show Razorpay web checkout
         *         with UPI collect (enter VPA) + card/netbanking options
         */
        config: isIOS() ? {
          // iOS — standard checkout, UPI collect + cards
          display: {
            blocks: {
              upi:  { name: 'Pay via UPI (VPA)', instruments: [{ method: 'upi', flow: 'collect' }] },
              card: { name: 'Pay via Card', instruments: [{ method: 'card' }] },
              nb:   { name: 'Net Banking', instruments: [{ method: 'netbanking' }] },
            },
            sequence: ['block.upi', 'block.card', 'block.nb'],
            preferences: { show_default_blocks: false },
          },
        } : {
          // Android — native UPI app intent list first, then card fallback
          display: {
            blocks: {
              upi:  { name: 'Pay via UPI App', instruments: [{ method: 'upi', flow: 'intent' }] },
              card: { name: 'Pay via Card', instruments: [{ method: 'card' }] },
            },
            sequence: ['block.upi', 'block.card'],
            preferences: { show_default_blocks: false },
          },
        },
        modal: {
          // Called when customer closes the modal without paying
          ondismiss: () => {
            setPaying(false);
            toast('Payment cancelled. Tap Pay again to retry.');
          },
          escape: true,
          animation: true,
          backdropclose: false,
        },
      });

      rzp.open();
    } catch (err: unknown) {
      setPaying(false);
      setPaymentFailed(true);
      toast.error(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    }
  }, [id, order, paying, router, startPolling]);

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

  // ── Payment confirmed ─────────────────────────────────────────
  if (paid) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <CheckCircle size={72} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-3xl font-black text-green-600 mb-2">Payment Done! 🎉</h2>
        <p className="text-gray-500 mb-2">Token <span className="font-black text-orange-500 text-xl">#{order.token_number}</span></p>
        <p className="text-gray-400 text-sm">Taking you to your order…</p>
        <div className="mt-6 animate-spin w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  // ── Main pay screen ────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">

      {/* Token hero */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 pt-10 pb-8 text-center">
        <p className="text-orange-200 text-sm font-semibold tracking-wide uppercase mb-1">Your Token</p>
        <div className="text-8xl font-black tabular-nums leading-none">{order.token_number}</div>
        <p className="text-orange-100 mt-3 font-medium text-base">
          {order.order_type === 'parcel' ? '📦 Parcel Order' : '🍽️ Dine In'}
        </p>
      </div>

      <div className="flex-1 px-4 pt-6 pb-10 space-y-4 bg-orange-50">

        {/* Bill card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3">Your Order</h3>
          <div className="space-y-2">
            {order && 'order_items' in order &&
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (order as any).order_items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.product_name_en} <span className="text-gray-400">×{item.quantity}</span></span>
                  <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
          </div>
          <div className="border-t pt-3 mt-3 space-y-1">
            {order.parcel_charge > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Parcel charge</span>
                <span>{formatCurrency(order.parcel_charge)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg">
              <span>Total</span>
              <span className="text-orange-600">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Payment failed notice */}
        {paymentFailed && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <XCircle size={20} className="text-red-500 shrink-0" />
            <p className="text-red-700 text-sm font-semibold">Payment did not go through. Please try again.</p>
          </div>
        )}

        {/* ── Primary CTA ── */}
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-3"
        >
          {paying ? (
            <><Loader2 size={22} className="animate-spin" /> Opening payment…</>
          ) : (
            // Show server amount once fetched, fallback to order total
            <>💳 Pay {serverAmount ? formatCurrency(serverAmount / 100) : formatCurrency(order.total_amount)}</>
          )}
        </button>

        {/* How it works */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">How to pay</p>
          <div className="space-y-2.5">
            {(isIOS() ? [
              { icon: '1️⃣', text: 'Tap the Pay button above' },
              { icon: '2️⃣', text: 'Enter your UPI ID (VPA) or use card' },
              { icon: '3️⃣', text: 'Approve the payment request in your UPI app' },
              { icon: '4️⃣', text: 'Done! Your token appears on the board' },
            ] : [
              { icon: '1️⃣', text: 'Tap the Pay button above' },
              { icon: '2️⃣', text: 'Choose GPay, PhonePe, Paytm or any UPI app' },
              { icon: '3️⃣', text: 'Approve the payment in your app' },
              { icon: '4️⃣', text: 'Done! Your token appears on the board' },
            ]).map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base">{icon}</span>
                <p className="text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400 text-center">
            {isIOS()
              ? 'iPhone · UPI VPA · Cards · Net Banking'
              : 'Android · GPay · PhonePe · Paytm · Any UPI App'}
          </p>
        </div>

        {/* Cash option */}
        <button
          onClick={() => router.push(`/order/${id}?cash=1`)}
          className="w-full bg-white border-2 border-gray-200 hover:border-orange-300 text-gray-600 font-semibold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <ShoppingBag size={18} />
          Pay at counter instead (Cash)
        </button>

      </div>
    </div>
  );
}
