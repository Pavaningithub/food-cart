'use client';

import Image from 'next/image';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Product, ProductCategory } from '@/types';
import { formatCurrency, CATEGORY_LABELS } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X, Upload, ImageOff, Camera } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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

const CATEGORY_EMOJI: Record<string, string> = {
  main: '🍛', snack: '🥪', drink: '🥤', dessert: '🍮',
};

// Converts product English name to a URL-safe slug for auto-matching gallery uploads
function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Upload Button — inline per product card
// ─────────────────────────────────────────────────────────────────────────────
function ImageUploadButton({
  product,
  onUploaded,
}: {
  product: Product;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('product_id', product.id);
      fd.append('slug', toSlug(product.name_en));

      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Upload failed');
      }

      const { url } = await res.json();
      onUploaded(url);
      toast.success('Image uploaded! ✅');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove this product image?')) return;
    setRemoving(true);
    try {
      const slug = toSlug(product.name_en);
      // Try common extensions
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        await fetch(`/api/admin/upload-image?path=${slug}.${ext}&product_id=${product.id}`, {
          method: 'DELETE',
        });
      }
      // Also clear image_url regardless
      await fetch(`/api/admin/upload-image?product_id=${product.id}`, { method: 'DELETE' });
      onUploaded('');
      toast.success('Image removed');
    } catch {
      toast.error('Failed to remove image');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={product.image_url ? 'Replace image' : 'Upload image'}
        className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-semibold transition-all
          bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60"
      >
        {uploading ? (
          <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Uploading…</span>
        ) : (
          <span className="flex items-center gap-1"><Upload size={12} /> {product.image_url ? 'Replace' : 'Upload'}</span>
        )}
      </button>
      {product.image_url && (
        <button
          onClick={handleRemove}
          disabled={removing}
          title="Remove image"
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-60"
        >
          <ImageOff size={14} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Tab
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [view, setView] = useState<'list' | 'grid'>('list');

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

  // Update image URL in local state without full refetch
  const updateLocalImage = (productId: string, url: string) => {
    setProducts((prev) =>
      prev.map((p) => p.id === productId ? { ...p, image_url: url || null } : p)
    );
  };

  const FormFields = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
    <div className="bg-orange-50 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium">Name (English)</label>
          <input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:border-orange-400"
            placeholder="Sakkare Pongal" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Name (Kannada)</label>
          <input value={form.name_kn} onChange={(e) => setForm((f) => ({ ...f, name_kn: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:border-orange-400"
            placeholder="ಸಕ್ಕರೆ ಪೊಂಗಲ್" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Description (EN)</label>
          <input value={form.description_en} onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:border-orange-400"
            placeholder="Sweet rice & lentil dish" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Description (KN)</label>
          <input value={form.description_kn} onChange={(e) => setForm((f) => ({ ...f, description_kn: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:border-orange-400"
            placeholder="ಐಚ್ಛಿಕ" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Price (₹)</label>
          <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:border-orange-400"
            placeholder="60" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Category</label>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProductCategory }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:border-orange-400">
            {['main', 'snack', 'drink', 'dessert'].map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Sort Order</label>
          <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:border-orange-400" />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" id="avail" checked={form.is_available}
            onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))} className="rounded" />
          <label htmlFor="avail" className="text-sm font-medium text-gray-700">Available</label>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave}
          className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-600">
          <Check size={14} /> Save
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-300">
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-black text-gray-800 text-lg">
          Menu Items ({products.length})
        </h2>
        <div className="flex items-center gap-2">
          {/* List / Grid toggle */}
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
              List
            </button>
            <button onClick={() => setView('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'grid' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
              Grid
            </button>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-600"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Image slug hint */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <span className="font-bold">📸 Gallery auto-match:</span> Upload an image named after the product slug
        (e.g. <code className="bg-blue-100 px-1 rounded">sakkare-pongal.jpg</code> for "Sakkare Pongal") and it will
        auto-match. Or click <strong>Upload</strong> on any product below to directly assign an image.
      </div>

      {showAddForm && (
        <FormFields onSave={addProduct} onCancel={() => setShowAddForm(false)} />
      )}

      {loading ? (
        <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-3' : 'space-y-2'}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : view === 'list' ? (
        /* ── LIST VIEW ── */
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {editingId === product.id ? (
                <div className="p-4">
                  <FormFields onSave={() => saveEdit(product.id)} onCancel={() => setEditingId(null)} />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#FFF3E0] shrink-0">
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name_en} fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        {CATEGORY_EMOJI[product.category] ?? '🍽️'}
                      </div>
                    )}
                  </div>

                  {/* Name / category */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{product.name_en}</p>
                      <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                        {CATEGORY_LABELS[product.category]}
                      </span>
                      {!product.is_available && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Hidden</span>
                      )}
                    </div>
                    <p className="text-orange-500 text-xs">{product.name_kn}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Slug: <code className="bg-gray-100 px-1 rounded">{toSlug(product.name_en)}</code></p>
                  </div>

                  {/* Price */}
                  <div className="font-black text-gray-900 text-sm shrink-0">{formatCurrency(product.price)}</div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(product)}
                        className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteProduct(product.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ImageUploadButton
                      product={product}
                      onUploaded={(url) => updateLocalImage(product.id, url)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              {/* Image area */}
              <div className="relative w-full h-32 bg-[#FFF3E0] overflow-hidden group">
                {product.image_url ? (
                  <Image src={product.image_url} alt={product.name_en} fill className="object-cover" sizes="200px" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-300">
                    <span className="text-4xl">{CATEGORY_EMOJI[product.category] ?? '🍽️'}</span>
                    <span className="text-xs font-medium">No image</span>
                  </div>
                )}
                {/* Upload overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <OverlayUploadButton
                    product={product}
                    onUploaded={(url) => updateLocalImage(product.id, url)}
                  />
                </div>
                {!product.is_available && (
                  <div className="absolute top-1 right-1 bg-gray-800/70 text-white text-xs px-1.5 py-0.5 rounded-full">Hidden</div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-bold text-gray-900 text-sm line-clamp-1">{product.name_en}</p>
                <p className="text-orange-500 text-xs">{product.name_kn}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-black text-gray-900 text-sm">{formatCurrency(product.price)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(product)}
                      className="text-blue-500 hover:bg-blue-50 p-1 rounded-lg">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteProduct(product.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded-lg">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {editingId === product.id && (
                  <div className="mt-2">
                    <FormFields onSave={() => saveEdit(product.id)} onCancel={() => setEditingId(null)} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Overlay upload button shown on hover in grid view
function OverlayUploadButton({ product, onUploaded }: { product: Product; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('product_id', product.id);
      fd.append('slug', product.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error);
      const { url } = await res.json();
      onUploaded(url);
      toast.success('Image uploaded!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        className="flex items-center gap-1.5 bg-white text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow hover:bg-gray-100 transition-all">
        {uploading ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Camera size={12} />}
        {uploading ? 'Uploading…' : product.image_url ? 'Replace' : 'Upload'}
      </button>
    </>
  );
}
