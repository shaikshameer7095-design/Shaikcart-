import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Edit3,
  History,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest, formatINR } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import type { Brand, Category } from '../../types';

const PRESET_PRODUCT_IMAGES = [
  { label: 'Women Kurta', url: '/src/assets/images/prod_women_kurta_1795671298134.jpg' },
  { label: 'Men Jacket', url: '/src/assets/images/prod_men_jacket_1795671296290.jpg' },
  { label: 'Leather Tote', url: '/src/assets/images/prod_leather_tote_1795671299462.jpg' },
  { label: 'Home Table Lamp', url: '/src/assets/images/prod_home_lamp_1795671300481.jpg' },
  { label: 'Beauty Serum', url: '/src/assets/images/prod_beauty_serum_1795671300096.jpg' },
  { label: 'Headphones', url: '/src/assets/images/prod_headphones_1795671303264.jpg' },
  { label: 'Smartwatch', url: '/src/assets/images/prod_smartwatch_1795671300852.jpg' },
  { label: 'Sports Sneakers', url: '/src/assets/images/prod_sports_sneakers_1795671303643.jpg' },
  { label: 'Kids Outfit', url: '/src/assets/images/prod_kids_outfit_1795671304347.jpg' },
  { label: 'Ceramic Dining', url: '/src/assets/images/prod_ceramic_dining_1795671305225.jpg' },
  { label: 'Gift Hamper', url: '/src/assets/images/prod_gift_hamper_1795671306831.jpg' },
  { label: 'Silk Saree', url: '/src/assets/images/prod_silk_saree_1795674902650.jpg' },
  { label: 'Linen Shirt', url: '/src/assets/images/prod_linen_shirt_1795674901890.jpg' },
  { label: 'Wireless Earbuds', url: '/src/assets/images/prod_wireless_earbuds_1795674903526.jpg' },
  { label: 'Oud Perfume', url: '/src/assets/images/prod_perfume_oud_1795674903948.jpg' },
  { label: 'Espresso Machine', url: '/src/assets/images/prod_espresso_maker_1795674907266.jpg' },
  { label: 'Aviator Sunglasses', url: '/src/assets/images/prod_aviator_sunglasses_1795674906556.jpg' },
  { label: 'Yoga Mat Kit', url: '/src/assets/images/prod_yoga_kit_1795674907814.jpg' },
  { label: 'Travel Backpack', url: '/src/assets/images/prod_backpack_travel_1795674908417.jpg' },
  { label: 'Scented Candles', url: '/src/assets/images/prod_scented_candles_1795674907749.jpg' },
  { label: 'Kids Backpack', url: '/src/assets/images/prod_kids_backpack_1795674909775.jpg' },
];

interface AdminProductRow {
  id: number;
  name: string;
  slug: string;
  sku: string;
  categoryId: number | null;
  categoryName: string;
  subcategory: string;
  brandId: number | null;
  brandName: string;
  shortDescription: string;
  description: string;
  materials: string;
  dimensions: string;
  regularPrice: number;
  salePrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  primaryImage: string;
  colors: string[];
  sizes: string[];
  tags: string[];
  isFeatured: boolean;
  isBestseller: boolean;
  isNewArrival: boolean;
  isTrending: boolean;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

interface InventoryLogRow {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  changeAmount: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
}

const emptyProductForm = {
  name: '',
  sku: '',
  categoryId: '',
  subcategory: '',
  brandId: '',
  shortDescription: '',
  description: '',
  materials: '',
  dimensions: '',
  regularPrice: '2499',
  salePrice: '1999',
  stockQuantity: '25',
  lowStockThreshold: '8',
  primaryImage: PRESET_PRODUCT_IMAGES[0].url,
  colorsText: 'Forest Green, Cream',
  sizesText: 'S, M, L, XL',
  tagsText: 'bestseller, premium',
  isFeatured: true,
  isBestseller: false,
  isNewArrival: true,
  isTrending: false,
  isActive: true,
  seoTitle: '',
  seoDescription: '',
};

export function AdminProductsTab() {
  const { showToast } = useStore();
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const [saving, setSaving] = useState(false);

  // Stock modal
  const [stockProduct, setStockProduct] = useState<AdminProductRow | null>(null);
  const [newStockValue, setNewStockValue] = useState('0');
  const [stockReason, setStockReason] = useState('Warehouse restock');

  // Inventory logs
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<InventoryLogRow[]>([]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (lowStockOnly) params.set('lowStock', 'true');
      const data = await apiRequest<{
        products: AdminProductRow[];
        categories: Category[];
        brands: Brand[];
      }>(`/api/admin/products?${params.toString()}`);
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setBrands(data.brands || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load products.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, lowStockOnly, showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadLogs = async () => {
    try {
      const data = await apiRequest<{ logs: InventoryLogRow[] }>('/api/admin/inventory-logs');
      setLogs(data.logs || []);
      setShowLogs(true);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load inventory logs.', 'error');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...emptyProductForm,
      categoryId: categories[0]?.id ? String(categories[0].id) : '',
      brandId: brands[0]?.id ? String(brands[0].id) : '',
      sku: `SC-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setModalOpen(true);
  };

  const openEditModal = (p: AdminProductRow) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku,
      categoryId: p.categoryId ? String(p.categoryId) : '',
      subcategory: p.subcategory || '',
      brandId: p.brandId ? String(p.brandId) : '',
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      materials: p.materials || '',
      dimensions: p.dimensions || '',
      regularPrice: String(p.regularPrice),
      salePrice: String(p.salePrice),
      stockQuantity: String(p.stockQuantity),
      lowStockThreshold: String(p.lowStockThreshold),
      primaryImage: p.primaryImage,
      colorsText: (p.colors || []).join(', '),
      sizesText: (p.sizes || []).join(', '),
      tagsText: (p.tags || []).join(', '),
      isFeatured: p.isFeatured,
      isBestseller: p.isBestseller,
      isNewArrival: p.isNewArrival,
      isTrending: p.isTrending,
      isActive: p.isActive,
      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || '',
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        subcategory: form.subcategory.trim(),
        brandId: form.brandId ? Number(form.brandId) : null,
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim(),
        materials: form.materials.trim(),
        dimensions: form.dimensions.trim(),
        regularPrice: Number(form.regularPrice),
        salePrice: Number(form.salePrice),
        stockQuantity: Number(form.stockQuantity),
        lowStockThreshold: Number(form.lowStockThreshold),
        primaryImage: form.primaryImage.trim(),
        colors: form.colorsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        sizes: form.sizesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: form.tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isFeatured: form.isFeatured,
        isBestseller: form.isBestseller,
        isNewArrival: form.isNewArrival,
        isTrending: form.isTrending,
        isActive: form.isActive,
        seoTitle: form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
      };

      if (editingId) {
        await apiRequest(`/api/admin/products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Product updated successfully.');
      } else {
        await apiRequest('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('New product added to SHAIKCART catalog.');
      }
      setModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      showToast(err?.message || 'Unable to save product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    try {
      await apiRequest(`/api/admin/products/${id}`, { method: 'DELETE' });
      showToast(`Deleted "${name}"`, 'info');
      await loadProducts();
    } catch (err: any) {
      showToast(err?.message || 'Unable to delete product.', 'error');
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;
    try {
      await apiRequest(`/api/admin/products/${stockProduct.id}/stock`, {
        method: 'POST',
        body: JSON.stringify({
          newStock: Number(newStockValue),
          reason: stockReason.trim(),
        }),
      });
      showToast(`Stock updated for ${stockProduct.sku}`);
      setStockProduct(null);
      await loadProducts();
    } catch (err: any) {
      showToast(err?.message || 'Unable to update stock.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-[#0F0D2E]/40 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU, or category..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-[#E6EAF2] focus:outline-none focus:border-[#1E1B4B]"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white rounded-lg border border-[#E6EAF2] focus:outline-none focus:border-[#1E1B4B]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0F0D2E] bg-white px-3 py-2 rounded-lg border border-[#E6EAF2] cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            Low Stock Only
          </label>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadLogs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6EAF2] bg-white hover:bg-[#F8F9FC] text-xs font-semibold text-[#0F0D2E] cursor-pointer"
          >
            <History className="w-4 h-4" />
            Stock History
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] hover:bg-[#0F0D2E] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FC]/70 text-[11px] uppercase tracking-wider text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Price (INR)</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2]/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#0F0D2E]/50">
                    Loading catalog inventory...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#0F0D2E]/50">
                    No matching products found.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.stockQuantity <= p.lowStockThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-[#F8F9FC]/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.primaryImage}
                            alt={p.name}
                            className="w-11 h-11 rounded-lg object-cover bg-[#E6EAF2] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0F0D2E] truncate max-w-[230px]">{p.name}</p>
                            <p className="text-[11px] text-[#0F0D2E]/55">{p.brandName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#0F0D2E]/80">{p.sku}</td>
                      <td className="py-3 px-4 text-xs text-[#0F0D2E]/80">{p.categoryName}</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <div className="font-semibold text-[#0F0D2E]">{formatINR(p.salePrice)}</div>
                        {p.regularPrice > p.salePrice && (
                          <div className="text-[11px] text-[#0F0D2E]/45 line-through">
                            {formatINR(p.regularPrice)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <button
                          type="button"
                          onClick={() => {
                            setStockProduct(p);
                            setNewStockValue(String(p.stockQuantity));
                            setStockReason('Inventory cycle count');
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                            isLow
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-[#F8F9FC] text-[#1E1B4B]'
                          }`}
                          title="Adjust stock"
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          {p.stockQuantity}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-medium ${
                            p.isActive ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-md hover:bg-[#F8F9FC] text-[#1E1B4B] cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-600 cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-[#E6EAF2]">
            <div className="flex items-center justify-between border-b border-[#E6EAF2] pb-3">
              <h3 className="text-lg font-bold text-[#0F0D2E]">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#0F0D2E]/60 hover:text-[#0F0D2E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Product Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">SKU *</label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Brand</label>
                  <select
                    value={form.brandId}
                    onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Regular MRP (₹) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.regularPrice}
                    onChange={(e) => setForm({ ...form, regularPrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Sale Price (₹) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.salePrice}
                    onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.lowStockThreshold}
                    onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Primary Image URL *</label>
                <input
                  required
                  value={form.primaryImage}
                  onChange={(e) => setForm({ ...form, primaryImage: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] text-xs font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_PRODUCT_IMAGES.map((img) => (
                    <button
                      type="button"
                      key={img.url}
                      onClick={() => setForm({ ...form, primaryImage: img.url })}
                      className={`text-[11px] px-2 py-1 rounded border cursor-pointer ${
                        form.primaryImage === img.url
                          ? 'bg-[#1E1B4B] text-white border-[#1E1B4B]'
                          : 'bg-[#F8F9FC] text-[#0F0D2E] border-[#E6EAF2]'
                      }`}
                    >
                      {img.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Colors (comma separated)</label>
                  <input
                    value={form.colorsText}
                    onChange={(e) => setForm({ ...form, colorsText: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Sizes (comma separated)</label>
                  <input
                    value={form.sizesText}
                    onChange={(e) => setForm({ ...form, sizesText: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Short Summary</label>
                <input
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Full Description *</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-xs">
                {(
                  [
                    ['isFeatured', 'Featured'],
                    ['isBestseller', 'Best Seller'],
                    ['isNewArrival', 'New Arrival'],
                    ['isTrending', 'Trending'],
                    ['isActive', 'Published Active'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#E6EAF2]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E6EAF2] text-xs font-semibold text-[#0F0D2E]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#1E1B4B] hover:bg-[#0F0D2E] text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E6EAF2]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F0D2E]">Adjust Inventory Stock</h3>
              <button type="button" onClick={() => setStockProduct(null)}>
                <X className="w-5 h-5 text-[#0F0D2E]/60" />
              </button>
            </div>
            <p className="text-xs text-[#0F0D2E]/70">
              {stockProduct.name} (<span className="font-mono">{stockProduct.sku}</span>) — Current stock:{' '}
              <strong>{stockProduct.stockQuantity}</strong>
            </p>
            <form onSubmit={handleStockUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#0F0D2E] mb-1">New Stock Quantity</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newStockValue}
                  onChange={(e) => setNewStockValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Audit Reason</label>
                <input
                  type="text"
                  required
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="e.g. Supplier shipment #402 received"
                  className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockProduct(null)}
                  className="px-4 py-2 rounded-lg border border-[#E6EAF2] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory History Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4 border border-[#E6EAF2]">
            <div className="flex items-center justify-between border-b border-[#E6EAF2] pb-3">
              <h3 className="text-base font-bold text-[#0F0D2E] flex items-center gap-2">
                <Archive className="w-4 h-4 text-[#1E1B4B]" />
                Inventory Adjustment History
              </h3>
              <button type="button" onClick={() => setShowLogs(false)}>
                <X className="w-5 h-5 text-[#0F0D2E]/60" />
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-[#0F0D2E]/60 py-6 text-center">No stock adjustments logged yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E6EAF2] text-[#0F0D2E]/60">
                  <tr>
                    <th className="py-2">Product</th>
                    <th className="py-2 text-right">Change</th>
                    <th className="py-2 text-right">New Stock</th>
                    <th className="py-2 pl-4">Reason</th>
                    <th className="py-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAF2]/60">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5">
                        <div className="font-medium text-[#0F0D2E]">{l.productName}</div>
                        <div className="font-mono text-[10px] text-[#0F0D2E]/50">{l.productSku}</div>
                      </td>
                      <td
                        className={`py-2.5 text-right font-semibold tabular-nums ${
                          l.changeAmount >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {l.changeAmount >= 0 ? `+${l.changeAmount}` : l.changeAmount}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{l.newStock}</td>
                      <td className="py-2.5 pl-4 text-[#0F0D2E]/75">{l.reason}</td>
                      <td className="py-2.5 text-right text-[#0F0D2E]/55">
                        {new Date(l.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminCategoriesTab() {
  const { showToast } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImage, setCatImage] = useState(PRESET_PRODUCT_IMAGES[0].url);
  const [brandName, setBrandName] = useState('');
  const [brandDesc, setBrandDesc] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [cData, bData] = await Promise.all([
        apiRequest<{ categories: Category[] }>('/api/admin/categories'),
        apiRequest<{ brands: Brand[] }>('/api/admin/brands'),
      ]);
      setCategories(cData.categories || []);
      setBrands(bData.brands || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load categories and brands.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: catName,
          description: catDesc,
          imageUrl: catImage,
          bannerUrl: catImage,
          sortOrder: categories.length + 1,
        }),
      });
      setCatName('');
      setCatDesc('');
      showToast('Category created.');
      await loadAll();
    } catch (err: any) {
      showToast(err?.message || 'Unable to create category.', 'error');
    }
  };

  const handleToggleCategory = async (c: Category) => {
    try {
      await apiRequest(`/api/admin/categories/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      await loadAll();
    } catch (err: any) {
      showToast(err?.message || 'Unable to update category.', 'error');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await apiRequest(`/api/admin/categories/${id}`, { method: 'DELETE' });
      showToast('Category removed.', 'info');
      await loadAll();
    } catch (err: any) {
      showToast(err?.message || 'Unable to delete category.', 'error');
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/brands', {
        method: 'POST',
        body: JSON.stringify({ name: brandName, description: brandDesc }),
      });
      setBrandName('');
      setBrandDesc('');
      showToast('Brand created.');
      await loadAll();
    } catch (err: any) {
      showToast(err?.message || 'Unable to create brand.', 'error');
    }
  };

  const handleDeleteBrand = async (id: number) => {
    try {
      await apiRequest(`/api/admin/brands/${id}`, { method: 'DELETE' });
      showToast('Brand removed.', 'info');
      await loadAll();
    } catch (err: any) {
      showToast(err?.message || 'Unable to delete brand.', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Categories */}
      <div className="lg:col-span-7 space-y-5">
        <form
          onSubmit={handleAddCategory}
          className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-[#0F0D2E]">Add New Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category Name (e.g. Footwear)"
              className="px-3 py-2 text-sm rounded-lg border border-[#E6EAF2]"
            />
            <input
              value={catImage}
              onChange={(e) => setCatImage(e.target.value)}
              placeholder="Image URL"
              className="px-3 py-2 text-xs font-mono rounded-lg border border-[#E6EAF2]"
            />
          </div>
          <input
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            placeholder="Short category description..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#E6EAF2]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category
          </button>
        </form>

        <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E6EAF2] text-sm font-bold text-[#0F0D2E]">
            Storefront Categories ({categories.length})
          </div>
          <div className="divide-y divide-[#E6EAF2]/70">
            {categories.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={c.imageUrl || PRESET_PRODUCT_IMAGES[0].url}
                    alt={c.name}
                    className="w-10 h-10 rounded-full object-cover bg-[#E6EAF2] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#0F0D2E] truncate">{c.name}</div>
                    <div className="text-[11px] font-mono text-[#0F0D2E]/50">/{c.slug}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCategory(c)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      c.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.isActive ? 'Visible' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Brands */}
      <div className="lg:col-span-5 space-y-5">
        <form
          onSubmit={handleAddBrand}
          className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-[#0F0D2E]">Add Partner Brand</h3>
          <input
            required
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Brand Name"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#E6EAF2]"
          />
          <input
            value={brandDesc}
            onChange={(e) => setBrandDesc(e.target.value)}
            placeholder="Short brand tagline..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#E6EAF2]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Brand
          </button>
        </form>

        <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E6EAF2] text-sm font-bold text-[#0F0D2E]">
            Registered Brands ({brands.length})
          </div>
          <div className="divide-y divide-[#E6EAF2]/70">
            {brands.map((b) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#0F0D2E]">{b.name}</div>
                  <div className="text-[11px] text-[#0F0D2E]/55">{b.description || b.slug}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBrand(b.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                  title="Delete brand"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
