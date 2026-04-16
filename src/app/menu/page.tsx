'use client';

import { useEffect, useState, useCallback } from 'react';
import { Product, ProductCategory } from '@/types';
import { useCartStore } from '@/store/cart';
import ProductCard from '@/components/menu/ProductCard';
import CartBar from '@/components/menu/CartBar';
import { CATEGORY_LABELS, CATEGORY_LABELS_KN } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';
import RecentOrderBanner from '@/components/RecentOrderBanner';

const CATEGORIES: ProductCategory[] = ['main', 'snack', 'drink', 'dessert'];

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all');
  const { items, addItem, removeItem, orderType, setOrderType } = useCartStore();

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getQuantity = (productId: string) => {
    return items.find((i) => i.product.id === productId)?.quantity ?? 0;
  };

  const filtered = activeCategory === 'all'
    ? products.filter((p) => p.is_available)
    : products.filter((p) => p.category === activeCategory && p.is_available);

  return (
    <div className="max-w-lg mx-auto pb-28">
      {/* Header */}
      <div className="bg-brand text-white px-4 pt-6 pb-5">
        <div className="mb-0.5">
          <h1 className="text-3xl font-black tracking-tight leading-tight">ಒಗ್ಗರಣೆ <span className="font-black">BOWL</span></h1>
          <p className="text-white/70 text-xs font-medium">by NG&apos;s Cafe &nbsp;·&nbsp; ಊಟ ತನ್ನಿಚ್ಛೆ</p>
        </div>
      </div>

      {/* Resume recent order banner */}
      <RecentOrderBanner />

      {/* Order Type Toggle */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-40 shadow-sm">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setOrderType('dine_in')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
              orderType === 'dine_in'
                ? 'bg-brand text-white shadow'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            🍽️ Dine In
          </button>
          <button
            onClick={() => setOrderType('parcel')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
              orderType === 'parcel'
                ? 'bg-brand text-white shadow'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            📦 Parcel
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeCategory === 'all'
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="px-3 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No items available</p>
          </div>
        ) : (
          <>
            {activeCategory === 'all' ? (
              CATEGORIES.map((cat) => {
                const catItems = filtered.filter((p) => p.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="font-black text-gray-800 text-base">{CATEGORY_LABELS[cat]}</h2>
                      <span className="text-brand text-sm font-medium">{CATEGORY_LABELS_KN[cat]}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {catItems.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          quantity={getQuantity(product.id)}
                          onAdd={() => addItem(product)}
                          onRemove={() => removeItem(product.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={getQuantity(product.id)}
                    onAdd={() => addItem(product)}
                    onRemove={() => removeItem(product.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <CartBar />
    </div>
  );
}
