'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminDashboard from './components/AdminDashboard';
import { Lock } from 'lucide-react';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check session
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    if (auth === 'true') setAuthenticated(true);
  }, []);

  const handlePinInput = useCallback(async (digit: string) => {
    if (digit === 'clear') { setPin(''); setError(''); return; }
    if (digit === 'back') { setPin(p => p.slice(0, -1)); return; }

    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: newPin }),
        });
        if (res.ok) {
          sessionStorage.setItem('admin_auth', 'true');
          setAuthenticated(true);
        } else {
          setError('Wrong PIN. Try again.');
          setPin('');
        }
      } catch {
        setError('Connection error');
        setPin('');
      } finally {
        setLoading(false);
      }
    }
  }, [pin]);

  if (authenticated) {
    return <AdminDashboard onLogout={() => { sessionStorage.removeItem('admin_auth'); setAuthenticated(false); setPin(''); }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-orange-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Admin Access</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your 4-digit PIN</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                pin.length > i ? 'bg-orange-500 scale-110' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-center text-sm font-semibold mb-4">{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9','clear','0','back'].map((key) => (
            <button
              key={key}
              onClick={() => handlePinInput(key)}
              disabled={loading}
              className={`h-14 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
                key === 'clear' ? 'bg-red-100 text-red-500 text-sm' :
                key === 'back' ? 'bg-gray-100 text-gray-600 text-sm' :
                'bg-gray-100 hover:bg-orange-100 text-gray-900'
              }`}
            >
              {key === 'back' ? '⌫' : key === 'clear' ? 'CLR' : key}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center mt-4">
            <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
