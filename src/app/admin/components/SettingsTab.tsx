'use client';

import { useEffect, useState, useCallback } from 'react';
import { Setting } from '@/types';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';

// ── Daily Report Types ─────────────────────────────────────────────────────
interface DailyReport {
  date: string;
  totalOrders: number;
  onlineRevenue: number;
  cashRevenue: number;
  totalExpenses: number;
  netProfit: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  whatsappText: string;
}

// ── Change PIN Component ───────────────────────────────────────────────────
function ChangePinSection() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) return toast.error('New PIN must be 4 digits');
    if (newPin !== confirmPin) return toast.error('PINs do not match');
    setSaving(true);
    try {
      // Verify current PIN via admin auth
      const authRes = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: currentPin }),
      });
      if (!authRes.ok) { toast.error('Current PIN is incorrect'); return; }

      const saveRes = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'admin_pin', value: newPin }),
      });
      if (!saveRes.ok) throw new Error();
      toast.success('PIN changed successfully!');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch {
      toast.error('Failed to change PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="font-black text-gray-800 mb-4 text-lg">🔐 Change Admin PIN</h3>
      <div className="space-y-3 max-w-sm">
        <div>
          <label className="text-sm font-bold text-gray-700">Current PIN</label>
          <input type="password" maxLength={4} value={currentPin} onChange={e => setCurrentPin(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:border-orange-400" placeholder="••••" />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-700">New PIN</label>
          <input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:border-orange-400" placeholder="••••" />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-700">Confirm New PIN</label>
          <input type="password" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:border-orange-400" placeholder="••••"
            onKeyDown={e => e.key === 'Enter' && handleChange()} />
        </div>
        <button onClick={handleChange} disabled={saving || !currentPin || !newPin || !confirmPin}
          className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-60">
          {saving ? 'Changing...' : 'Change PIN'}
        </button>
      </div>
    </div>
  );
}

// ── Payment Mode Component ────────────────────────────────────────────────
function PaymentModeSection() {
  const [mode, setMode] = useState<'upi' | 'razorpay'>('upi');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const s: { key: string; value: string }[] = data.settings ?? [];
        const m = s.find((x) => x.key === 'payment_mode')?.value as 'upi' | 'razorpay' | undefined;
        if (m) setMode(m);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'payment_mode', value: mode }),
      });
      // Bust localStorage settings cache so pay page picks up new mode immediately
      try { localStorage.removeItem('ng_settings_cache'); } catch { /* ignore */ }
      toast.success('Payment mode saved!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="font-black text-gray-800 mb-1 text-lg">💳 Payment Mode</h3>
      <p className="text-xs text-gray-400 mb-4">Choose how customers pay online. Both modes use Razorpay and confirm automatically via webhook — no manual verification needed.</p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('upi')}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
            mode === 'upi' ? 'bg-brand text-white shadow' : 'bg-gray-100 text-gray-600'
          }`}
        >
          📱 UPI Only
          <span className="block text-xs font-normal opacity-75 mt-0.5">GPay · PhonePe · Paytm</span>
        </button>
        <button
          onClick={() => setMode('razorpay')}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
            mode === 'razorpay' ? 'bg-brand text-white shadow' : 'bg-gray-100 text-gray-600'
          }`}
        >
          💳 All Methods
          <span className="block text-xs font-normal opacity-75 mt-0.5">UPI + Cards + Net Banking</span>
        </button>
      </div>

      <div className={`rounded-xl p-3 mb-4 text-xs ${mode === 'upi' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
        {mode === 'upi'
          ? '✅ Android: opens UPI app directly · iOS: customer enters UPI ID, gets a push notification to approve. Auto-confirmed via Razorpay webhook.'
          : '✅ All platforms: Razorpay checkout with UPI, Debit/Credit Cards, Net Banking. Auto-confirmed via webhook.'}
        <span className="block mt-1 font-semibold">Fee: 2% per transaction (Razorpay standard)</span>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-brand hover:bg-brand-dark text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save Payment Mode'}
      </button>
    </div>
  );
}

// ── Daily Report Component ─────────────────────────────────────────────────
function DailyReportSection() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch(`/api/admin/report/daily?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="font-black text-gray-800 mb-4 text-lg">📊 Daily Closing Report</h3>
      <div className="flex gap-2 mb-4">
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
          className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
        <button onClick={fetchReport} disabled={loading}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-60">
          {loading ? '...' : 'Generate'}
        </button>
      </div>

      {report && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Orders', value: report.totalOrders, color: 'text-gray-800', bg: 'bg-gray-50' },
              { label: 'Net Profit', value: `₹${report.netProfit.toFixed(2)}`, color: report.netProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-green-50' },
              { label: 'Online Revenue', value: `₹${report.onlineRevenue.toFixed(2)}`, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Cash Revenue', value: `₹${report.cashRevenue.toFixed(2)}`, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <p className={`text-xl font-black ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {report.totalExpenses > 0 && (
            <p className="text-sm text-gray-500 text-center">Expenses deducted: ₹{report.totalExpenses.toFixed(2)}</p>
          )}

          {/* Top items */}
          {report.topItems.length > 0 && (
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">🏆 Top Items</p>
              <div className="space-y-1">
                {report.topItems.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{i + 1}. {item.name}</span>
                    <span className="font-bold text-gray-800">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WhatsApp share */}
          <button
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(report.whatsappText)}`, '_blank')}
            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600">
            <span>💬</span> Share via WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    const settingsArr: Setting[] = data.settings ?? [];
    setSettings(settingsArr);
    const vals: Record<string, string> = {};
    settingsArr.forEach((s) => { vals[s.key] = s.value; });
    setEditValues(vals);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSetting = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      if (!res.ok) throw new Error();
      toast.success('Saved!');
      fetchSettings();
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setSaving(null);
    }
  };

  const EDITABLE_SETTINGS = [
    { key: 'parcel_charge', label: 'Parcel Charge (₹)', type: 'number', description: 'Extra charge added to parcel orders' },
    { key: 'store_name_en', label: 'Store Name (English)', type: 'text', description: 'Displayed on customer pages' },
    { key: 'store_name_kn', label: 'Store Name (Kannada)', type: 'text', description: 'Kannada name on customer pages' },
    { key: 'store_tagline', label: 'Tagline', type: 'text', description: 'Short description shown on menu' },
    { key: 'upi_id', label: 'UPI ID', type: 'text', description: 'Your UPI ID for payment display' },
  ];

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      {/* Settings */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-black text-gray-800 mb-5 text-lg">⚙️ Store Settings</h3>
        {loading ? (
          <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-4">
            {EDITABLE_SETTINGS.map(({ key, label, type, description }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-bold text-gray-700">{label}</label>
                <p className="text-xs text-gray-400">{description}</p>
                <div className="flex gap-2">
                  <input
                    type={type}
                    value={editValues[key] ?? ''}
                    onChange={(e) => setEditValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                    maxLength={key === 'admin_pin' ? 4 : undefined}
                  />
                  <button
                    onClick={() => saveSetting(key)}
                    disabled={saving === key}
                    className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-60"
                  >
                    {saving === key ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Mode */}
      <PaymentModeSection />

      {/* Change PIN */}
      <ChangePinSection />

      {/* Daily Report */}
      <DailyReportSection />

      {/* QR Codes */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-black text-gray-800 mb-5 text-lg">📱 QR Codes</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <QRCode value={`${appUrl}/menu`} size={140} />
            </div>
            <p className="font-bold text-gray-800 text-sm">Customer Menu QR</p>
            <p className="text-gray-500 text-xs mt-1">Print and place at the counter</p>
            <p className="text-gray-400 text-xs mt-0.5 break-all">{appUrl}/menu</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <QRCode value={`${appUrl}/display`} size={140} />
            </div>
            <p className="font-bold text-gray-800 text-sm">Display Board QR</p>
            <p className="text-gray-500 text-xs mt-1">Open on a TV / large screen</p>
            <p className="text-gray-400 text-xs mt-0.5 break-all">{appUrl}/display</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <QRCode value={`${appUrl}/kitchen`} size={140} />
            </div>
            <p className="font-bold text-gray-800 text-sm">Kitchen Display QR</p>
            <p className="text-gray-500 text-xs mt-1">Open on chef's tablet</p>
            <p className="text-gray-400 text-xs mt-0.5 break-all">{appUrl}/kitchen</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <QRCode value={`${appUrl}/parcel`} size={140} />
            </div>
            <p className="font-bold text-gray-800 text-sm">Parcel Display QR</p>
            <p className="text-gray-500 text-xs mt-1">For packaging staff</p>
            <p className="text-gray-400 text-xs mt-0.5 break-all">{appUrl}/parcel</p>
          </div>
        </div>
      </div>

      {/* Staff Quick Links */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-black text-gray-800 mb-4 text-lg">🔗 Quick Links</h3>
        <div className="space-y-2">
          {[
            { label: 'Customer Menu', url: '/menu', icon: '🍛' },
            { label: 'Kitchen Display', url: '/kitchen', icon: '👨‍🍳' },
            { label: 'Parcel Display', url: '/parcel', icon: '📦' },
            { label: 'Token Board (Display)', url: '/display', icon: '📺' },
          ].map(({ label, url, icon }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 bg-gray-50 hover:bg-orange-50 px-4 py-3 rounded-xl transition-all"
            >
              <span className="text-xl">{icon}</span>
              <span className="font-semibold text-gray-800 text-sm">{label}</span>
              <span className="ml-auto text-gray-400 text-xs">{url} ↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
