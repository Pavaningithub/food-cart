'use client';

import { useEffect, useState, useCallback } from 'react';
import { Product, ProductCategory } from '@/types';
import { formatCurrency, CATEGORY_LABELS } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

interface ProductForm {
  name_en: string;
  name_kn: string;
  description_en: string;
  description_kn: string;
  price: string;
  category: ProductCategory;
  is_available: boolean;
  sort_order: string;
}

const EMPTY_FORM: ProductForm = {
  name_en: '', name_kn: '', description_en: '', description_kn: '',
  price: '', category: 'main', is_available: true, sort_order: '0',
};

export default function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name_en: product.name_en,
      name_kn: product.name_kn,
      description_en: product.description_en ?? '',
      description_kn: product.description_kn ?? '',
      price: product.price.toString(),
      category: product.category,
      is_available: product.is_available,
      sort_order: product.sort_order.toString(),
    });
  };

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: parseFloat(form.price), sort_order: parseInt(form.sort_order) }),
      });
      if (!res.ok) throw new Error();
      toast.success('Product updated!');
      setEditingId(null);
      fetchProducts();
    } catch {
      toast.error('Failed to update product');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const addProduct = async () => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: parseFloat(form.price), sort_order: parseInt(form.sort_order) }),
      });
      if (!res.ok) throw new Error();
      toast.success('Product added!');
      setShowAddForm(false);
      setForm(EMPTY_FORM);
      fetchProducts();
    } catch {
      toast.error('Failed to add product');
    }
  };

  const FormFields = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
    <div className="bg-orange-50 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium">Name (English)</label>
          <input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="Bisi Bele Bath" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Name (Kannada)</label>
          <input value={form.name_kn} onChange={e => setForm(f => ({ ...f, name_kn: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="ಬಿಸಿ ಬೇಳೆ ಬಾತ್" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Description (EN)</label>
          <input value={form.description_en} onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="Optional" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Description (KN)</label>
          <input value={form.description_kn} onChange={e => setForm(f => ({ ...f, description_kn: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="ಐಚ್ಛಿಕ" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Price (₹)</label>
          <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="60" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Category</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ProductCategory }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5">
            {['main','snack','drink','dessert'].map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Sort Order</label>
          <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" id="avail" checked={form.is_available}
            onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} className="rounded" />
          <label htmlFor="avail" className="text-sm font-medium text-gray-700">Available</label>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold">
          <Check size={14} /> Save
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold">
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-gray-800 text-lg">Menu Items ({products.length})</h2>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm"
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      {showAddForm && (
        <FormFields onSave={addProduct} onCancel={() => setShowAddForm(false)} />
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {editingId === product.id ? (
                <div className="p-4">
                  <FormFields onSave={() => saveEdit(product.id)} onCancel={() => setEditingId(null)} />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4">
                  <div className={`w-2 h-10 rounded-full ${product.is_available ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{product.name_en}</p>
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                        {CATEGORY_LABELS[product.category]}
                      </span>
                    </div>
                    <p className="text-orange-500 text-xs">{product.name_kn}</p>
                  </div>
                  <div className="font-black text-gray-900">{formatCurrency(product.price)}</div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(product)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteProduct(product.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
