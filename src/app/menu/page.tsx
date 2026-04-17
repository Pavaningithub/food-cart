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
    // Show cached products instantly, then refresh in background
    const CACHE_KEY = 'ng_products_cache';
    const CACHE_TTL = 2 * 60 * 1000; // 2 min
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, products: cachedProducts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setProducts(cachedProducts);
          setLoading(false);
          return; // fresh enough — skip network
        }
        // Stale: show cached immediately, refresh silently
        setProducts(cachedProducts);
        setLoading(false);
      }
    } catch { /* ignore */ }
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const fresh = data.products ?? [];
      setProducts(fresh);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), products: fresh })); } catch { /* ignore */ }
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
    <div className="max-w-lg mx-auto pb-32" style={{ background: '#FFF8EC', minHeight: '100vh' }}>
      {/* ── Hero Header ── */}
      <div
        className="relative overflow-hidden px-5 pt-10 pb-8"
        style={{ background: 'linear-gradient(135deg, #6B1212 0%, #8B1A1A 45%, #B8352A 100%)' }}
      >
        {/* decorative blobs */}
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute top-6 right-8 w-20 h-20 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-black/10" />

        <div className="relative">
          <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">by NG&apos;s Cafe</p>
          <h1 className="text-4xl font-black text-white leading-none tracking-tight">
            ಒಗ್ಗರಣೆ <span className="text-yellow-300">BOWL</span>
          </h1>
          <p className="text-white/65 text-sm mt-1.5 font-medium">ಊಟ ತನ್ನಿಚ್ಛೆ &nbsp;·&nbsp; Made fresh, served hot 🔥</p>
        </div>

        {/* Order-type toggle embedded in header */}
        <div className="relative mt-5 bg-black/20 rounded-2xl p-1 flex gap-1">
          <button
            onClick={() => setOrderType('dine_in')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
              orderType === 'dine_in'
                ? 'bg-white text-brand shadow-md'
                : 'text-white/75 hover:text-white'
            }`}
          >
            🍽️ Dine In
          </button>
          <button
            onClick={() => setOrderType('parcel')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
              orderType === 'parcel'
                ? 'bg-white text-brand shadow-md'
                : 'text-white/75 hover:text-white'
            }`}
          >
            📦 Parcel
          </button>
        </div>
      </div>

      {/* Resume recent order banner */}
      <RecentOrderBanner />

      {/* ── Sticky category tabs ── */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-2.5 sticky top-0 z-40 shadow-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeCategory === 'all'
                ? 'bg-brand text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            ✨ All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="px-3 pt-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-52 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
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
                  <div key={cat} className="mb-8">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="w-1 h-5 rounded-full bg-brand inline-block" />
                      <h2 className="font-black text-gray-900 text-base">{CATEGORY_LABELS[cat]}</h2>
                      <span className="text-brand/60 text-sm font-semibold">{CATEGORY_LABELS_KN[cat]}</span>
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
