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
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-transparent pointer-events-none">
      <button
        onClick={() => router.push('/checkout')}
        className="w-full max-w-lg mx-auto flex items-center justify-between bg-brand hover:bg-brand-dark active:scale-98 text-white rounded-2xl px-5 py-4 shadow-2xl pointer-events-auto transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-xl p-1.5">
            <ShoppingBag size={20} />
          </div>
          <span className="font-bold text-base">
            {count} item{count !== 1 ? 's' : ''} in cart
          </span>
        </div>
        <span className="font-bold text-lg">{formatCurrency(total)} →</span>
      </button>
    </div>
  );
}
