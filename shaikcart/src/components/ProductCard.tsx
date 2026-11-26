import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import type { Product } from '../types';
import { formatINR } from '../lib/api';
import { useStore } from '../context/StoreContext';
import { SafeImage } from './BrandLogo';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, wishlistIds } = useStore();
  const [adding, setAdding] = useState(false);
  const isWishlisted = wishlistIds.has(product.id);
  const outOfStock = product.stockQuantity <= 0;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || adding) return;
    setAdding(true);
    await addToCart(
      product.id,
      1,
      product.colors?.[0] || '',
      product.sizes?.[0] || '',
      true
    );
    setAdding(false);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(product.id);
  };

  return (
    <article className="group bg-white rounded-xl border border-[#E6EAF2] overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[#1E1B4B]/20">
      <div className="relative aspect-[4/3] bg-[#EEF2F7] overflow-hidden">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          <SafeImage
            src={product.primaryImage}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        {/* Discount Offer Tag */}
        {product.discountPercent > 0 && (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-[#E11D48] text-white text-[11px] font-bold tracking-wide tabular-nums shadow-xs">
            -{product.discountPercent}%
          </span>
        )}

        {/* Wishlist Toggle */}
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-white/95 backdrop-blur-sm shadow-xs transition-colors cursor-pointer ${
            isWishlisted
              ? 'text-[#E11D48]'
              : 'text-[#1E1B4B]/70 hover:text-[#E11D48]'
          }`}
        >
          <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {/* Clean Unboxed Metadata */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#0F0D2E]/55 mb-1 truncate">
          <span className="truncate font-medium text-[#1E1B4B]/75">{product.brandName}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{product.categoryName}</span>
        </div>

        <Link
          to={`/product/${product.slug}`}
          className="text-sm font-semibold text-[#0F0D2E] hover:text-[#E11D48] transition-colors line-clamp-2 leading-snug min-h-[2.5rem]"
        >
          {product.name}
        </Link>

        {/* Star Rating */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#0F0D2E]/65">
          <Star size={13} className="text-[#F59E0B] fill-[#F59E0B]" />
          <span className="font-semibold text-[#0F0D2E] tabular-nums">{product.ratingAvg.toFixed(1)}</span>
          <span className="text-[#0F0D2E]/45 tabular-nums">({product.reviewCount})</span>
          {outOfStock && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#E11D48] font-medium">Out of stock</span>
            </>
          )}
        </div>

        {/* Price + Action */}
        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-[#0F0D2E] tabular-nums">
                {formatINR(product.salePrice)}
              </span>
              {product.regularPrice > product.salePrice && (
                <span className="text-xs text-[#0F0D2E]/45 line-through tabular-nums">
                  {formatINR(product.regularPrice)}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={outOfStock || adding}
            onClick={handleQuickAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#1E1B4B] text-white hover:bg-[#E11D48] disabled:bg-[#E6EAF2] disabled:text-[#0F0D2E]/45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag size={14} />
            {adding ? 'Adding...' : outOfStock ? 'Sold Out' : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-[#E6EAF2]" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 w-28 bg-[#E6EAF2] rounded" />
        <div className="h-4 w-full bg-[#E6EAF2] rounded" />
        <div className="h-3 w-20 bg-[#E6EAF2] rounded" />
        <div className="pt-2 flex items-center justify-between">
          <div className="h-5 w-16 bg-[#E6EAF2] rounded" />
          <div className="h-8 w-16 bg-[#E6EAF2] rounded-lg" />
        </div>
      </div>
    </div>
  );
}
