'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Product } from '@/types';
import { Plus, Minus } from 'lucide-react';

// Category fallback emojis shown when no image is uploaded yet
const CATEGORY_EMOJI: Record<string, string> = {
  main:    '🍛',
  snack:   '🥪',
  drink:   '🥤',
  dessert: '🍮',
};

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export default function ProductCard({ product, quantity, onAdd, onRemove }: ProductCardProps) {
  const emoji = CATEGORY_EMOJI[product.category] ?? '🍽️';

  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl overflow-hidden transition-all duration-150',
        quantity > 0
          ? 'shadow-lg ring-2 ring-brand'
          : 'shadow-sm hover:shadow-md'
      )}
    >
      {/* Image area */}
      <div className="relative w-full h-40 overflow-hidden" style={{ background: '#FFF3E0' }}>
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name_en}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl select-none">{emoji}</span>
          </div>
        )}

        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Quantity badge */}
        {quantity > 0 && (
          <div className="absolute top-2 right-2 z-20 bg-brand text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
            {quantity}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 pt-2.5">
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">{product.name_en}</h3>
        <p className="text-brand/80 font-semibold text-xs mt-0.5">{product.name_kn}</p>

        {product.description_en && (
          <p className="text-gray-400 text-xs mt-1 line-clamp-1 leading-snug">{product.description_en}</p>
        )}

        {/* Price + Controls */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-base font-black text-gray-900">₹{product.price}</span>

          {quantity === 0 ? (
            <button
              onClick={onAdd}
              className="bg-brand hover:bg-brand-dark active:scale-95 text-white font-black px-3.5 py-1.5 rounded-xl text-sm transition-all shadow-sm"
            >
              ADD
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onRemove}
                className="bg-brand-light hover:bg-[#EFCECE] text-brand w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
              >
                <Minus size={14} />
              </button>
              <span className="font-black text-gray-900 w-4 text-center text-sm">{quantity}</span>
              <button
                onClick={onAdd}
                className="bg-brand hover:bg-brand-dark text-white w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
