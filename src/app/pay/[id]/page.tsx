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

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuto = searchParams.get('auto') === '1';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false); // polling after UPI app returns
  const [paid, setPaid] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [verifyTimedOut, setVerifyTimedOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [txnId, setTxnId] = useState<string | null>(null);
  // 'upi' = UPI-only via Razorpay | 'razorpay' = full methods
  const [paymentMode, setPaymentMode] = useState<'razorpay' | 'upi'>('razorpay');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggered = useRef(false);

  // ── Parallel-fetch order + settings (settings use localStorage cache) ───
  useEffect(() => {
    const CACHE_KEY = 'ng_settings_cache';
    const CACHE_TTL = 5 * 60 * 1000;

    async function getSettings(): Promise<{ key: string; value: string }[]> {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { ts, settings } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) return settings;
        }
      } catch { /* ignore */ }
      const d = await fetch('/api/admin/settings').then((r) => r.json());
      const all = d.settings ?? [];
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), settings: all })); } catch { /* ignore */ }
      return all;
    }

    async function init() {
      const [orderRes, settings] = await Promise.all([
        fetch(`/api/orders/${id}`).then((r) => r.json()),
        getSettings(),
      ]);
      setOrder(orderRes.order);
      if (orderRes.order?.payment_status === 'paid') setPaid(true);
      const mode = settings.find((x: { key: string }) => x.key === 'payment_mode')?.value as 'razorpay' | 'upi' | undefined;
      if (mode) setPaymentMode(mode);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setVerifying(false);
  }, []);

  // ── Poll until paid — fast at first, then slower, hard stop at 60s ───
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setVerifying(true);
    setVerifyTimedOut(false);
    let ticks = 0;
    const check = async () => {
      const data = await fetch(`/api/orders/${id}`).then((r) => r.json());
      if (data.order?.payment_status === 'paid') {
        stopPolling();
        setPaid(true);
        setTimeout(() => router.push(`/order/${id}`), 800);
      } else if (data.order?.payment_status === 'failed') {
        stopPolling();
        setPaymentFailed(true);
      }
    };
    pollRef.current = setInterval(async () => {
      ticks++;
      if (ticks <= 20) {
        // Fast phase: every 1s for 20s
        await check();
      } else if (ticks <= 40) {
        // Slow phase: every 3s for next 60s (ticks 21-40 at 3s each = 60s more)
        if ((ticks - 20) % 3 === 0) await check();
      } else {
        // Hard stop at ~80s total — show timed out state
        stopPolling();
        setVerifyTimedOut(true);
        setPaying(false);
      }
    }, 1000);
  }, [id, router, stopPolling]);

  // ── visibilitychange: when user returns from UPI app → start polling ─────
  useEffect(() => {
    if (paid) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && paying) {
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [paying, paid, startPolling]);

  // ── Open Razorpay / UPI intent ───────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (paying) return;
    setPaying(true);
    setPaymentFailed(false);
    setVerifyTimedOut(false);
    setDismissed(false);
    const platform = getPlatform();

    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: id, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Payment init failed');

      // ── Android: S2S UPI intent → OS opens GPay/PhonePe → webhook confirms ──
      if (platform === 'android' && data.upi_url) {
        // visibilitychange fires when user returns from UPI app → startPolling()
        window.location.href = data.upi_url;
        return; // paying=true so visibilitychange listener will fire
      }

      // ── iOS / Web: Razorpay checkout.js ─────────────────────────────────
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Could not load payment SDK'));
          document.head.appendChild(s);
        });
      }

      // For 'upi' mode: show UPI collect only (customer enters their VPA,
      // Razorpay pushes a collect request → they approve → webhook fires).
      // For 'razorpay' mode: show all methods (UPI + Cards + Net Banking).
      const upiOnlyConfig = paymentMode === 'upi' ? {
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay via UPI',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: false },
          },
        },
      } : {};

      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "NG's Cafe — ಒಗ್ಗರಣೆ BOWL",
        description: `Token #${order?.token_number}`,
        order_id: data.razorpay_order_id,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          // Verify signature on backend immediately — no webhook wait needed
          try {
            await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
          } catch { /* webhook will catch it as fallback */ }
          setTxnId(response.razorpay_payment_id);
          setDismissed(false);
          setPaid(true);
          setPaying(false);
          setTimeout(() => router.push(`/order/${id}`), 2000);
        },
        prefill: { name: '', email: '', contact: '' },
        theme: { color: '#8B1A1A' },
        ...upiOnlyConfig,
        modal: {
          ondismiss: () => {
            setPaying(false);
            setDismissed(true);
            // Don't poll — user explicitly closed. Order page realtime covers
            // the rare case they completed inside before closing.
          },
          escape: true,
        },
      });
      rzp.open();
    } catch (err: unknown) {
      setPaying(false);
      setPaymentFailed(true);
      toast.error(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    }
  }, [id, order, paymentMode, paying, startPolling]);

  // Auto-trigger on ?auto=1
  useEffect(() => {
    if (!isAuto || autoTriggered.current || loading || !order || paid) return;
    autoTriggered.current = true;
    handlePay();
  }, [isAuto, loading, order, paid, handlePay]);

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
        <h2 className="text-3xl font-black text-green-600 mb-2">Payment Confirmed! 🎉</h2>
        <p className="text-gray-500 mb-2">
          Token <span className="font-black text-brand text-xl">#{order.token_number}</span>
        </p>
        {txnId && (
          <p className="text-xs text-gray-400 font-mono bg-gray-100 rounded-lg px-3 py-2 inline-block mb-3">
            Txn ID: {txnId}
          </p>
        )}
        <p className="text-gray-400 text-sm">Taking you to your order…</p>
        <div className="mt-6 animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  const platform = getPlatform();

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      {/* Token hero — only reveal after paid */}
      <div className="bg-brand text-white px-6 pt-10 pb-8 text-center">
        <p className="text-brand-light text-sm font-semibold tracking-wide uppercase mb-1">
          {paid ? 'Your Token' : 'Complete Payment'}
        </p>
        {paid ? (
          <div className="text-8xl font-black tabular-nums leading-none">{order.token_number}</div>
        ) : (
          <div className="text-6xl font-black tabular-nums leading-none opacity-30">- - -</div>
        )}
        <p className="text-cream mt-3 font-medium text-base">
          {paid
            ? (order.order_type === 'parcel' ? '📦 Parcel Order' : '🍽️ Dine In')
            : 'Token revealed after payment'}
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
                    {item.product_name_en} <span className="text-gray-400">×{item.quantity}</span>
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

        {/* Verifying state */}
        {verifying && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 text-center space-y-2">
            <Loader2 size={24} className="animate-spin text-blue-500 mx-auto" />
            <p className="text-blue-700 font-bold text-sm">Confirming your payment…</p>
            <p className="text-blue-500 text-xs">Please wait — usually done in a moment</p>
            <p className="text-blue-400 text-xs">Do not close or refresh this page</p>
          </div>
        )}

        {/* Timed out — payment not confirmed yet */}
        {verifyTimedOut && !paid && !paymentFailed && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-4 space-y-2">
            <p className="text-yellow-800 font-bold text-sm">⏰ Payment not confirmed yet</p>
            <p className="text-yellow-700 text-xs">Your UPI app may still be processing. If money was deducted, it will appear in your order automatically within a few minutes.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setVerifyTimedOut(false); startPolling(); }}
                className="flex-1 bg-yellow-500 text-white font-bold py-2 rounded-xl text-sm"
              >
                Check Again
              </button>
              <button
                onClick={() => router.push(`/order/${id}`)}
                className="flex-1 bg-white border-2 border-yellow-300 text-yellow-700 font-bold py-2 rounded-xl text-sm"
              >
                View Order
              </button>
            </div>
          </div>
        )}

        {/* Dismissed banner */}
        {dismissed && !paymentFailed && !verifying && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-4 space-y-1">
            <p className="text-yellow-800 font-bold text-sm">⚠️ Payment window closed</p>
            <p className="text-yellow-700 text-xs">You closed without completing payment. Your order is saved — tap the button below to try again.</p>
            <p className="text-yellow-500 text-xs">No money has been deducted.</p>
          </div>
        )}

        {/* Failed banner */}
        {paymentFailed && !verifying && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <XCircle size={20} className="text-red-500 shrink-0" />
              <p className="text-red-700 font-bold text-sm">Payment did not go through</p>
            </div>
            <p className="text-red-600 text-xs pl-7">Your money has <span className="font-bold">not</span> been deducted. You can try again or pay at the counter.</p>
          </div>
        )}

        {/* Pay button */}
        {!verifying && (
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-3"
          >
            {paying ? (
              <><Loader2 size={22} className="animate-spin" /> Opening…</>
            ) : paymentFailed ? (
              <>🔄 Try Again — {formatCurrency(order.total_amount)}</>
            ) : platform === 'android' ? (
              <>📱 Pay {formatCurrency(order.total_amount)}</>
            ) : paymentMode === 'upi' ? (
              <>📱 Pay {formatCurrency(order.total_amount)} via UPI</>
            ) : (
              <>💳 Pay {formatCurrency(order.total_amount)} via Razorpay</>
            )}
          </button>
        )}

        {!verifying && (
          <p className="text-center text-xs text-gray-400">
            {platform === 'android'
              ? 'Opens GPay · PhonePe · Paytm — confirmed automatically'
              : paymentMode === 'upi'
              ? 'Enter your UPI ID (e.g. name@okaxis) — Razorpay sends a collect request'
              : 'UPI · Cards · Net Banking · Wallets — secured by Razorpay'}
          </p>
        )}

        {/* Cash fallback — always visible */}
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
