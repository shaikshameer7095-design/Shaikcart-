import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import type { Category, Product } from '../types';

const POPULAR_TERMS = [
  'Silk Linen Dress',
  'Vitamin C Serum',
  'ANC Headphones',
  'Leather Tote',
  'Stoneware Lamp',
  'Gift Hamper',
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'featured';

  const [inputVal, setInputVal] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: initialQuery ? `Search: ${initialQuery} — SHAIKCART` : 'Search Catalog — SHAIKCART',
    description: 'Search across SHAIKCART fashion, homeware, beauty, electronics, sports, kids, and gifts.',
  });

  useEffect(() => {
    setInputVal(initialQuery);
    if (initialQuery.trim()) {
      setRecentSearches((prev) => [initialQuery.trim(), ...prev.filter((x) => x !== initialQuery.trim())].slice(0, 5));
    }

    setLoading(true);
    Promise.all([
      apiRequest<{ products: Product[] }>(
        `/api/products?search=${encodeURIComponent(initialQuery)}&sort=${encodeURIComponent(sort)}&limit=24`
      ),
      apiRequest<{ categories: Category[] }>('/api/categories'),
      apiRequest<{ products: Product[] }>('/api/products?featured=true&limit=4'),
    ])
      .then(([pRes, cRes, recRes]) => {
        setProducts(pRes.products || []);
        setCategories(cRes.categories || []);
        setRecommended(recRes.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [initialQuery, sort]);

  const runSearch = (term: string) => {
    const next = new URLSearchParams(searchParams);
    if (term.trim()) next.set('q', term.trim());
    else next.delete('q');
    setSearchParams(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 mb-8">
        <h1 className="text-2xl font-bold text-[#0F0D2E] mb-4">Search SHAIKCART</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(inputVal);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0F0D2E]/45" />
            <input
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search by product name, brand, category, or material..."
              className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#F8F9FC]/60 border border-[#E6EAF2] text-sm focus:bg-white focus:border-[#1E1B4B]"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-6 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium hover:bg-[#0F0D2E]"
          >
            Search
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="font-semibold text-[#0F0D2E]/60">Popular:</span>
          {POPULAR_TERMS.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => runSearch(term)}
              className="text-[#1E1B4B] hover:underline"
            >
              {term}
            </button>
          ))}
        </div>

        {recentSearches.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-semibold text-[#0F0D2E]/60">Recent:</span>
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => runSearch(term)}
                className="text-[#0F0D2E]/75 hover:text-[#1E1B4B] hover:underline"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Matching Categories */}
      {initialQuery && categories.some((c) => c.name.toLowerCase().includes(initialQuery.toLowerCase())) && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#0F0D2E] mb-3">Matching Categories</h2>
          <div className="flex flex-wrap gap-3">
            {categories
              .filter((c) => c.name.toLowerCase().includes(initialQuery.toLowerCase()))
              .map((c) => (
                <Link
                  key={c.id}
                  to={`/category/${c.slug}`}
                  className="px-4 py-2 rounded-lg bg-white border border-[#E6EAF2] text-sm font-medium text-[#1E1B4B] hover:border-[#1E1B4B]"
                >
                  Explore {c.name}
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[#0F0D2E]/70 tabular-nums">
          {initialQuery
            ? `${products.length} result${products.length === 1 ? '' : 's'} for “${initialQuery}”`
            : `Showing ${products.length} catalog products`}
        </p>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-[#0F0D2E]/50" />
          <select
            value={sort}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              next.set('sort', e.target.value);
              setSearchParams(next);
            }}
            className="h-9 px-3 rounded-lg bg-white border border-[#E6EAF2] text-xs font-medium"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="top_rated">Top Rated</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="space-y-12">
          <div className="bg-white rounded-2xl border border-[#E6EAF2] p-10 text-center">
            <h2 className="text-lg font-bold text-[#0F0D2E] mb-2">
              No products matched “{initialQuery}”
            </h2>
            <p className="text-sm text-[#0F0D2E]/65 mb-5">
              Try searching a broader term like Linen, Serum, Leather, Stoneware, or Headphones.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {POPULAR_TERMS.slice(0, 4).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => runSearch(term)}
                  className="px-4 py-2 rounded-lg bg-[#F8F9FC] text-xs font-medium text-[#1E1B4B] hover:bg-[#E6EAF2]"
                >
                  Try “{term}”
                </button>
              ))}
            </div>
          </div>

          {recommended.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-[#0F0D2E] mb-5">Recommended For You</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recommended.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
