'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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

function getPlatform(): 'android' | 'ios' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'web';
}

function buildUpiUrl(upiId: string, amount: number, tokenNumber: number) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: "NG's Cafe",
    am: amount.toFixed(2),
    tn: `Token ${tokenNumber} - NG's Cafe`,
    cu: 'INR',
  });
  return `upi://pay?${params.toString()}`;
}

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuto = searchParams.get('auto') === '1';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'razorpay' | 'upi'>('upi');
  const [upiId, setUpiId] = useState('');
  const [upiOpened, setUpiOpened] = useState(false);
  const [confirmingUpi, setConfirmingUpi] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggered = useRef(false);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    setOrder(data.order);
    if (data.order?.payment_status === 'paid') setPaid(true);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const s: { key: string; value: string }[] = data.settings ?? [];
        const mode = s.find((x) => x.key === 'payment_mode')?.value as 'razorpay' | 'upi' | undefined;
        const upi = s.find((x) => x.key === 'upi_id')?.value;
        if (mode) setPaymentMode(mode);
        if (upi) setUpiId(upi);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (data.order?.payment_status === 'paid') {
        setPaid(true);
        clearInterval(pollRef.current!);
        setTimeout(() => router.push(`/order/${id}`), 1200);
      }
    }, 2500);
  }, [id, router]);

  // ── Razorpay payment ────────────────────────────────────────────────────
  const handleRazorpay = useCallback(async () => {
    if (paying) return;
    setPaying(true);
    setPaymentFailed(false);
    const platform = getPlatform();
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: id, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Payment init failed');

      if (platform === 'android' && data.upi_url) {
        window.location.href = data.upi_url;
        return;
      }

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Could not load payment SDK'));
          document.head.appendChild(s);
        });
      }

      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "NG's Cafe — ಒಗ್ಗರಣೆ BOWL",
        description: `Token #${order?.token_number}`,
        order_id: data.razorpay_order_id,
        handler: () => {
          setPaying(false);
          toast.success('Payment successful! 🎉');
          startPolling();
          router.push(`/order/${id}`);
        },
        prefill: { name: '', email: '', contact: '' },
        theme: { color: '#8B1A1A' },
        config: {
          display: {
            blocks: {
              upi: { name: 'Pay via UPI', instruments: [{ method: 'upi', flow: 'collect' }] },
              card: { name: 'Card / Net Banking', instruments: [{ method: 'card' }, { method: 'netbanking' }] },
            },
            sequence: ['block.upi', 'block.card'],
            preferences: { show_default_blocks: false },
          },
        },
        modal: {
          ondismiss: () => { setPaying(false); setPaymentFailed(true); toast('Payment cancelled.'); },
          escape: true,
        },
      });
      rzp.open();
    } catch (err: unknown) {
      setPaying(false);
      setPaymentFailed(true);
      toast.error(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    }
  }, [id, order, paying, router, startPolling]);

  // ── UPI direct — open app ───────────────────────────────────────────────
  const handleUpiOpen = useCallback(() => {
    if (!order || !upiId) return;
    const upiUrl = buildUpiUrl(upiId, order.total_amount, order.token_number);
    setUpiOpened(true);
    window.location.href = upiUrl;
  }, [order, upiId]);

  // ── UPI direct — customer confirms payment after returning ──────────────
  const handleUpiConfirm = useCallback(async () => {
    if (!order) return;
    setConfirmingUpi(true);
    try {
      const res = await fetch('/api/payments/upi-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: id }),
      });
      if (!res.ok) throw new Error();
      setPaid(true);
      setTimeout(() => router.push(`/order/${id}`), 1200);
    } catch {
      toast.error('Could not confirm payment. Please show receipt to staff.');
    } finally {
      setConfirmingUpi(false);
    }
  }, [id, order, router]);

  // Auto-trigger Razorpay when ?auto=1
  useEffect(() => {
    if (!isAuto || autoTriggered.current || loading || !order || paid) return;
    if (paymentMode === 'razorpay') {
      autoTriggered.current = true;
      handleRazorpay();
    }
  }, [isAuto, loading, order, paid, paymentMode, handleRazorpay]);

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

  if (paid) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <CheckCircle size={72} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-3xl font-black text-green-600 mb-2">Payment Done! 🎉</h2>
        <p className="text-gray-500 mb-2">
          Token <span className="font-black text-brand text-xl">#{order.token_number}</span>
        </p>
        <p className="text-gray-400 text-sm">Taking you to your order…</p>
        <div className="mt-6 animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  const platform = getPlatform();

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      {/* Token hero */}
      <div className="bg-brand text-white px-6 pt-10 pb-8 text-center">
        <p className="text-brand-light text-sm font-semibold tracking-wide uppercase mb-1">Your Token</p>
        <div className="text-8xl font-black tabular-nums leading-none">{order.token_number}</div>
        <p className="text-cream mt-3 font-medium text-base">
          {order.order_type === 'parcel' ? '📦 Parcel Order' : '🍽️ Dine In'}
        </p>
      </div>

      <div className="flex-1 px-4 pt-6 pb-10 space-y-4 bg-cream">
        {/* Bill */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3">Your Order</h3>
          <div className="space-y-2">
            {order && 'order_items' in order &&
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (order as any).order_items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.product_name_en}{' '}
                    <span className="text-gray-400">×{item.quantity}</span>
                  </span>
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
              <span className="text-brand">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Failed banner */}
        {paymentFailed && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <XCircle size={20} className="text-red-500 shrink-0" />
            <div>
              <p className="text-red-700 text-sm font-bold">Payment did not go through</p>
              <p className="text-red-500 text-xs mt-0.5">Try again or pay at the counter</p>
            </div>
          </div>
        )}

        {/* ── UPI DIRECT MODE ── */}
        {paymentMode === 'upi' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center space-y-1">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Pay via UPI to</p>
              <p className="text-xl font-black text-brand">{upiId || '…'}</p>
              <p className="text-sm text-gray-500">NG&apos;s Cafe · Token #{order.token_number}</p>
            </div>

            {!upiOpened ? (
              <button
                onClick={handleUpiOpen}
                disabled={!upiId}
                className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-3"
              >
                📱 Pay {formatCurrency(order.total_amount)} via UPI
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-center">
                  <p className="text-blue-700 text-sm font-bold">Complete the payment in your UPI app</p>
                  <p className="text-blue-500 text-xs mt-1">Then tap the button below to confirm</p>
                </div>
                <button
                  onClick={handleUpiConfirm}
                  disabled={confirmingUpi}
                  className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black text-lg py-4 rounded-2xl shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {confirmingUpi ? <><Loader2 size={20} className="animate-spin" /> Confirming…</> : '✅ I have paid'}
                </button>
                <button
                  onClick={handleUpiOpen}
                  className="w-full bg-white border-2 border-brand/30 text-brand font-semibold py-3 rounded-2xl text-sm transition-all"
                >
                  Re-open UPI app
                </button>
              </div>
            )}

            {/* iOS / web fallback instructions */}
            {(platform === 'ios' || platform === 'web') && !upiOpened && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800 space-y-1">
                <p className="font-bold">If UPI app doesn&apos;t open automatically:</p>
                <p>Open GPay / PhonePe / Paytm and pay to:</p>
                <p className="font-black text-base">{upiId}</p>
                <p>Amount: <span className="font-bold">{formatCurrency(order.total_amount)}</span> · Note: Token #{order.token_number}</p>
              </div>
            )}
          </>
        )}

        {/* ── RAZORPAY MODE ── */}
        {paymentMode === 'razorpay' && (
          <>
            <button
              onClick={handleRazorpay}
              disabled={paying}
              className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-3"
            >
              {paying ? (
                <><Loader2 size={22} className="animate-spin" /> Opening…</>
              ) : platform === 'android' ? (
                <>🚀 Pay {formatCurrency(order.total_amount)} via UPI</>
              ) : (
                <>💳 Pay {formatCurrency(order.total_amount)}</>
              )}
            </button>
            <p className="text-center text-xs text-gray-400">
              {platform === 'android'
                ? 'Opens GPay / PhonePe / Paytm directly'
                : platform === 'ios'
                ? 'UPI • Cards • Net Banking'
                : 'Secure payment via Razorpay'}
            </p>
          </>
        )}

        {/* Cash fallback */}
        <button
          onClick={() => router.push(`/order/${id}?cash=1`)}
          className="w-full bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-600 font-semibold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <ShoppingBag size={18} />
          Pay at counter instead (Cash)
        </button>
      </div>
    </div>
  );
}
