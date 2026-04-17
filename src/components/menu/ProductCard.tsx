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
        'relative bg-white rounded-2xl shadow-sm border-2 transition-all duration-150 overflow-hidden',
        quantity > 0 ? 'border-brand shadow-[0_0_0_1px_#F5E8E8]' : 'border-transparent'
      )}
    >
      {/* Quantity badge */}
      {quantity > 0 && (
        <div className="absolute top-2 right-2 z-20">
          <span className="bg-brand text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
            {quantity}
          </span>
        </div>
      )}

      {/* Product image / emoji placeholder */}
      <div className="relative w-full h-36 bg-[#FFF3E0] overflow-hidden">
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
            <span className="text-5xl select-none">{emoji}</span>
          </div>
        )}

        {/* Category emoji pill */}
        <div className="absolute bottom-2 left-2">
          <span className="text-xs bg-white/90 backdrop-blur-sm text-brand px-2 py-0.5 rounded-full font-semibold shadow-sm">
            {emoji}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-1">{product.name_en}</h3>
        <p className="text-brand font-medium text-xs mt-0.5">{product.name_kn}</p>

        {product.description_en && (
          <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-snug">{product.description_en}</p>
        )}

        {/* Price + Controls */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-bold text-gray-900">₹{product.price}</span>

          {quantity === 0 ? (
            <button
              onClick={onAdd}
              className="bg-brand hover:bg-brand-dark active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl text-sm transition-all"
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
              <span className="font-bold text-gray-900 w-4 text-center text-sm">{quantity}</span>
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
