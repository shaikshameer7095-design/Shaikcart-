import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Filter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { SafeImage } from '../components/BrandLogo';
import type { Brand, Category, Product } from '../types';

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  facets: { colors: string[]; sizes: string[] };
}

export function ShopPage() {
  const { slug: categorySlugParam } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [result, setResult] = useState<ProductsResponse>({
    products: [],
    total: 0,
    page: 1,
    totalPages: 1,
    facets: { colors: [], sizes: [] },
  });
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filter state derived cleanly from URL params
  const selectedCategory = categorySlugParam || searchParams.get('category') || '';
  const selectedSubcategory = searchParams.get('subcategory') || '';
  const selectedBrand = searchParams.get('brand') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const selectedColor = searchParams.get('color') || '';
  const selectedSize = searchParams.get('size') || '';
  const minRating = searchParams.get('minRating') || '';
  const minDiscount = searchParams.get('minDiscount') || '';
  const inStockOnly = searchParams.get('inStock') === 'true';
  const featured = searchParams.get('featured') === 'true';
  const bestseller = searchParams.get('bestseller') === 'true';
  const newArrival = searchParams.get('newArrival') === 'true';
  const deals = searchParams.get('deals') === 'true';
  const sort = searchParams.get('sort') || 'featured';
  const page = Number(searchParams.get('page') || '1');
  const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');

  useEffect(() => {
    Promise.all([
      apiRequest<{ categories: Category[] }>('/api/categories'),
      apiRequest<{ brands: Brand[] }>('/api/brands'),
    ])
      .then(([cRes, bRes]) => {
        setCategories(cRes.categories || []);
        setBrands(bRes.brands || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (categorySlugParam) {
      apiRequest<{ category: Category }>(`/api/categories/${categorySlugParam}`)
        .then((d) => setCurrentCategory(d.category))
        .catch(() => setCurrentCategory(null));
    } else {
      setCurrentCategory(null);
    }
  }, [categorySlugParam]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (selectedCategory) qs.set('category', selectedCategory);
    if (selectedSubcategory) qs.set('subcategory', selectedSubcategory);
    if (selectedBrand) qs.set('brand', selectedBrand);
    if (minPrice) qs.set('minPrice', minPrice);
    if (maxPrice) qs.set('maxPrice', maxPrice);
    if (selectedColor) qs.set('color', selectedColor);
    if (selectedSize) qs.set('size', selectedSize);
    if (minRating) qs.set('minRating', minRating);
    if (minDiscount) qs.set('minDiscount', minDiscount);
    if (inStockOnly) qs.set('inStock', 'true');
    if (featured) qs.set('featured', 'true');
    if (bestseller) qs.set('bestseller', 'true');
    if (newArrival) qs.set('newArrival', 'true');
    if (deals) qs.set('deals', 'true');
    if (searchParams.get('search')) qs.set('search', searchParams.get('search')!);
    qs.set('sort', sort);
    qs.set('page', String(page));
    qs.set('limit', '12');

    apiRequest<ProductsResponse>(`/api/products?${qs.toString()}`)
      .then((res) => {
        setResult(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [
    selectedCategory,
    selectedSubcategory,
    selectedBrand,
    minPrice,
    maxPrice,
    selectedColor,
    selectedSize,
    minRating,
    minDiscount,
    inStockOnly,
    featured,
    bestseller,
    newArrival,
    deals,
    sort,
    page,
    searchParams,
  ]);

  const pageTitle = currentCategory
    ? currentCategory.name
    : newArrival
    ? 'New Arrivals'
    : bestseller
    ? 'Best Sellers'
    : deals
    ? 'Special Deals'
    : featured
    ? 'Featured Products'
    : 'Shop All Products';

  useSeo({
    title: `${pageTitle} — SHAIKCART`,
    description:
      currentCategory?.description ||
      `Browse ${pageTitle} on SHAIKCART with instant filters, verified reviews, and fast delivery across India.`,
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setLocalSearch('');
    setSearchParams({});
  };

  const handleSearchForm = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', localSearch.trim() || null);
  };

  const filterSidebarContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-[#E6EAF2]">
        <span className="text-sm font-semibold text-[#0F0D2E] flex items-center gap-2">
          <Filter size={15} /> Filters
        </span>
        <button
          type="button"
          onClick={clearAllFilters}
          className="text-xs font-medium text-[#1E1B4B] hover:underline inline-flex items-center gap-1"
        >
          <RotateCcw size={12} /> Clear All
        </button>
      </div>

      {/* Category Filter */}
      {!categorySlugParam && (
        <div>
          <h3 className="text-xs font-semibold text-[#0F0D2E] mb-2.5">Category</h3>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => updateParam('category', null)}
              className={`block w-full text-left text-xs py-1 px-2 rounded ${
                !selectedCategory ? 'bg-[#1E1B4B] text-white font-medium' : 'text-[#0F0D2E]/75 hover:bg-[#F8F9FC]'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateParam('category', cat.slug)}
                className={`block w-full text-left text-xs py-1 px-2 rounded ${
                  selectedCategory === cat.slug
                    ? 'bg-[#1E1B4B] text-white font-medium'
                    : 'text-[#0F0D2E]/75 hover:bg-[#F8F9FC]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div>
        <h3 className="text-xs font-semibold text-[#0F0D2E] mb-2.5">Price Range (₹)</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min ₹"
            value={minPrice}
            onChange={(e) => updateParam('minPrice', e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-[#E6EAF2] bg-[#F8F9FC]/40 text-xs tabular-nums"
          />
          <input
            type="number"
            min={0}
            placeholder="Max ₹"
            value={maxPrice}
            onChange={(e) => updateParam('maxPrice', e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-[#E6EAF2] bg-[#F8F9FC]/40 text-xs tabular-nums"
          />
        </div>
      </div>

      {/* Brand */}
      <div>
        <h3 className="text-xs font-semibold text-[#0F0D2E] mb-2.5">Brand</h3>
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {brands.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-xs text-[#0F0D2E]/80 cursor-pointer">
              <input
                type="radio"
                name="brandFilter"
                checked={selectedBrand === b.slug}
                onChange={() => updateParam('brand', selectedBrand === b.slug ? null : b.slug)}
                className="accent-[#1E1B4B]"
              />
              <span>{b.name}</span>
            </label>
          ))}
          {selectedBrand && (
            <button
              type="button"
              onClick={() => updateParam('brand', null)}
              className="text-[11px] text-[#1E1B4B] hover:underline pt-1"
            >
              Reset Brand
            </button>
          )}
        </div>
      </div>

      {/* Color */}
      {result.facets.colors.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#0F0D2E] mb-2.5">Color</h3>
          <div className="flex flex-wrap gap-1.5">
            {result.facets.colors.slice(0, 10).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateParam('color', selectedColor === c ? null : c)}
                className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                  selectedColor === c
                    ? 'bg-[#1E1B4B] text-white border-[#1E1B4B]'
                    : 'bg-white text-[#0F0D2E]/75 border-[#E6EAF2] hover:border-[#1E1B4B]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size */}
      {result.facets.sizes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#0F0D2E] mb-2.5">Size</h3>
          <div className="flex flex-wrap gap-1.5">
            {result.facets.sizes.slice(0, 12).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateParam('size', selectedSize === s ? null : s)}
                className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                  selectedSize === s
                    ? 'bg-[#1E1B4B] text-white border-[#1E1B4B]'
                    : 'bg-white text-[#0F0D2E]/75 border-[#E6EAF2] hover:border-[#1E1B4B]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ratings */}
      <div>
        <h3 className="text-xs font-semibold text-[#0F0D2E] mb-2.5">Customer Rating</h3>
        <div className="space-y-1.5">
          {['4.5', '4.0', '3.5'].map((r) => (
            <label key={r} className="flex items-center gap-2 text-xs text-[#0F0D2E]/80 cursor-pointer">
              <input
                type="radio"
                name="ratingFilter"
                checked={minRating === r}
                onChange={() => updateParam('minRating', r)}
                className="accent-[#1E1B4B]"
              />
              <span>{r}★ &amp; above</span>
            </label>
          ))}
        </div>
      </div>

      {/* Discount & Availability */}
      <div className="space-y-2.5 pt-2 border-t border-[#E6EAF2]">
        <label className="flex items-center gap-2 text-xs text-[#0F0D2E]/85 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : null)}
            className="accent-[#1E1B4B]"
          />
          <span>In Stock Only</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-[#0F0D2E]/85 cursor-pointer">
          <input
            type="checkbox"
            checked={minDiscount === '20'}
            onChange={(e) => updateParam('minDiscount', e.target.checked ? '20' : null)}
            className="accent-[#1E1B4B]"
          />
          <span>20% Off or More</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#0F0D2E]/60 mb-5">
        <Link to="/" className="hover:text-[#1E1B4B]">Home</Link>
        <ChevronRight size={13} />
        <Link to="/shop" className="hover:text-[#1E1B4B]">Shop</Link>
        {currentCategory && (
          <>
            <ChevronRight size={13} />
            <span className="text-[#0F0D2E] font-medium">{currentCategory.name}</span>
          </>
        )}
      </nav>

      {/* Dedicated Category Hero Banner */}
      {currentCategory && (
        <div className="relative rounded-2xl overflow-hidden bg-[#1E1B4B] mb-8 min-h-[200px] flex items-end">
          <SafeImage
            src={currentCategory.bannerUrl || currentCategory.imageUrl}
            alt={currentCategory.name}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F0D2E]/90 via-[#0F0D2E]/60 to-transparent" />
          <div className="relative z-10 p-7 sm:p-10 text-white max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{currentCategory.name}</h1>
            <p className="text-sm text-white/85 leading-relaxed">{currentCategory.description}</p>
            {currentCategory.subcategories && currentCategory.subcategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => updateParam('subcategory', null)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    !selectedSubcategory
                      ? 'bg-white text-[#0F0D2E] font-semibold'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  All {currentCategory.name}
                </button>
                {currentCategory.subcategories.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => updateParam('subcategory', selectedSubcategory === sub ? null : sub)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      selectedSubcategory === sub
                        ? 'bg-white text-[#0F0D2E] font-semibold'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header & Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E6EAF2]">
        <div>
          {!currentCategory && <h1 className="text-2xl sm:text-3xl font-bold text-[#0F0D2E]">{pageTitle}</h1>}
          <p className="text-xs text-[#0F0D2E]/60 mt-1 tabular-nums">
            Showing {result.products.length} of {result.total} product{result.total === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchForm} className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F0D2E]/45" />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter in catalog..."
              className="h-9 pl-9 pr-3 rounded-lg bg-white border border-[#E6EAF2] text-xs w-48 sm:w-56"
            />
          </form>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-[#E6EAF2] text-xs font-medium text-[#0F0D2E]"
          >
            <SlidersHorizontal size={14} /> Filters
          </button>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="h-9 px-3 rounded-lg bg-white border border-[#E6EAF2] text-xs font-medium text-[#0F0D2E]"
          >
            <option value="featured">Sort: Featured</option>
            <option value="newest">Sort: Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="top_rated">Sort: Top Rated</option>
            <option value="best_selling">Sort: Best Selling</option>
          </select>
        </div>
      </div>

      {/* Main Content Split: Sidebar + Product Grid */}
      <div className="mt-7 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="hidden lg:block lg:col-span-3">
          <div className="bg-white rounded-xl border border-[#E6EAF2] p-5 sticky top-28">
            {filterSidebarContent}
          </div>
        </aside>

        <div className="lg:col-span-9">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : result.products.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E6EAF2] p-12 text-center">
              <p className="text-base font-semibold text-[#0F0D2E] mb-1">No matching products found</p>
              <p className="text-sm text-[#0F0D2E]/60 mb-5">
                Try adjusting your price range, color, size, or category filters.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-5 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium hover:bg-[#0F0D2E]"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {result.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {result.totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => updateParam('page', String(page - 1))}
                    className="px-3.5 py-2 rounded-lg border border-[#E6EAF2] bg-white text-xs font-medium disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[#0F0D2E]/70 px-3 tabular-nums">
                    Page {page} of {result.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= result.totalPages}
                    onClick={() => updateParam('page', String(page + 1))}
                    className="px-3.5 py-2 rounded-lg border border-[#E6EAF2] bg-white text-xs font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filters Modal */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="relative z-10 w-80 max-w-[85vw] bg-white h-full p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-[#0F0D2E]">Filter Catalog</span>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="p-1">
                <X size={18} />
              </button>
            </div>
            {filterSidebarContent}
          </div>
        </div>
      )}
    </div>
  );
}
