'use client';

import { useCartStore } from '@/store/cart';
import { ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

export default function CartBar() {
  const { items, totalItems, subtotal } = useCartStore();
  const router = useRouter();

  if (items.length === 0) return null;

  const count = totalItems();
  const total = subtotal();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-4 pointer-events-none">
      <button
        onClick={() => router.push('/checkout')}
        className="w-full max-w-lg mx-auto flex items-center justify-between pointer-events-auto transition-all active:scale-[0.98]"
        style={{
          background: 'linear-gradient(135deg, #8B1A1A 0%, #C0392B 100%)',
          borderRadius: '1.25rem',
          padding: '14px 20px',
          boxShadow: '0 8px 32px rgba(139,26,26,0.45)',
          display: 'flex',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="bg-white/20 rounded-xl p-2">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-gray-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {count}
            </span>
          </div>
          <span className="font-bold text-base text-white">
            {count} item{count !== 1 ? 's' : ''} in cart
          </span>
        </div>
        <div className="flex items-center gap-1 bg-white/20 rounded-xl px-3 py-1.5">
          <span className="font-black text-white text-base">{formatCurrency(total)}</span>
          <span className="text-white/80 text-sm">→</span>
        </div>
      </button>
    </div>
  );
}
