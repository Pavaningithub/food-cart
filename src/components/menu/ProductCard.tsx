'use client';

import { cn } from '@/lib/utils';
import { Product } from '@/types';
import { Plus, Minus } from 'lucide-react';
import { CATEGORY_LABELS } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export default function ProductCard({ product, quantity, onAdd, onRemove }: ProductCardProps) {
  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl shadow-sm border-2 transition-all duration-150',
        quantity > 0 ? 'border-orange-400 shadow-orange-100' : 'border-transparent'
      )}
    >
      {/* Category badge */}
      <div className="absolute top-2 left-2 z-10">
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
          {CATEGORY_LABELS[product.category]}
        </span>
      </div>

      {/* Quantity badge */}
      {quantity > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-orange-500 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
            {quantity}
          </span>
        </div>
      )}

      <div className="p-4 pt-8">
        {/* Name */}
        <div className="mb-1">
          <h3 className="font-bold text-gray-900 text-base leading-tight">{product.name_en}</h3>
          <p className="text-orange-600 font-medium text-sm">{product.name_kn}</p>
        </div>

        {/* Description */}
        {product.description_en && (
          <p className="text-gray-500 text-xs mt-1 mb-3 line-clamp-2">{product.description_en}</p>
        )}

        {/* Price + Controls */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-lg font-bold text-gray-900">₹{product.price}</span>

          {quantity === 0 ? (
            <button
              onClick={onAdd}
              className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all"
            >
              ADD
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onRemove}
                className="bg-orange-100 hover:bg-orange-200 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all"
              >
                <Minus size={16} />
              </button>
              <span className="font-bold text-gray-900 w-5 text-center">{quantity}</span>
              <button
                onClick={onAdd}
                className="bg-orange-500 hover:bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
