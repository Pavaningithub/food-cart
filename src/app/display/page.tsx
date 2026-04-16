'use client';

import { useEffect, useState, useCallback } from 'react';
import { OrderWithItems } from '@/types';
import { createClient } from '@/lib/supabase/client';

export default function DisplayPage() {
  const [readyOrders, setReadyOrders] = useState<OrderWithItems[]>([]);
  const [preparingOrders, setPreparingOrders] = useState<OrderWithItems[]>([]);

  const fetchOrders = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/orders?date=${today}`);
    const data = await res.json();
    const all: OrderWithItems[] = data.orders ?? [];
    setReadyOrders(all.filter(o => o.status === 'ready' && o.payment_status === 'paid'));
    setPreparingOrders(all.filter(o => ['confirmed', 'preparing'].includes(o.status)));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('display-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-orange-600 text-center py-5">
        <h1 className="text-4xl font-black tracking-wide">🍛 FoodCart — ಫುಡ್ ಕಾರ್ಟ್</h1>
        <p className="text-orange-200 font-medium mt-1">Order Status Display</p>
      </div>

      <div className="flex flex-1 gap-0">
        {/* READY section */}
        <div className="flex-1 bg-green-900 border-r-4 border-gray-700">
          <div className="bg-green-700 text-center py-4">
            <h2 className="text-3xl font-black text-white">🔔 READY TO COLLECT</h2>
            <p className="text-green-200 text-sm">ತೆಗೆದುಕೊಳ್ಳಲು ಸಿದ್ಧ</p>
          </div>
          <div className="p-6">
            {readyOrders.length === 0 ? (
              <div className="text-center py-20 text-green-700">
                <p className="text-2xl font-bold">No orders ready yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {readyOrders.map((order) => (
                  <div key={order.id} className="bg-green-600 rounded-2xl p-6 text-center animate-bounce-once">
                    <div className="text-7xl font-black text-white tabular-nums">{order.token_number}</div>
                    <p className="text-green-200 text-sm mt-1">
                      {order.order_type === 'parcel' ? '📦 Parcel' : '🍽️ Dine In'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PREPARING section */}
        <div className="flex-1 bg-gray-900">
          <div className="bg-orange-900 text-center py-4">
            <h2 className="text-3xl font-black text-white">⏳ BEING PREPARED</h2>
            <p className="text-orange-200 text-sm">ತಯಾರಾಗುತ್ತಿದೆ</p>
          </div>
          <div className="p-6">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-20 text-gray-700">
                <p className="text-2xl font-bold">No orders in queue</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {preparingOrders.map((order) => (
                  <div key={order.id} className="bg-gray-800 rounded-xl p-4 text-center">
                    <div className="text-5xl font-black text-orange-400 tabular-nums">{order.token_number}</div>
                    <p className="text-gray-500 text-xs mt-1">
                      {order.order_type === 'parcel' ? '📦' : '🍽️'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer ticker */}
      <div className="bg-gray-900 border-t border-gray-800 py-3 text-center">
        <p className="text-gray-500 text-sm">
          🕐 {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} &nbsp;|&nbsp;
          Thank you for visiting FoodCart! Come again 😊
        </p>
      </div>
    </div>
  );
}
