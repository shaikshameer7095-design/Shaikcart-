import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { SafeImage } from '../components/BrandLogo';

export function WishlistPage() {
  const { user, wishlist, toggleWishlist, addToCart } = useStore();

  useSeo({
    title: 'My Wishlist — SHAIKCART',
    description: 'View and manage your saved favourite products on SHAIKCART.',
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-2xl border border-[#E6EAF2] p-10">
          <div className="w-14 h-14 rounded-full bg-[#F8F9FC] text-[#1E1B4B] flex items-center justify-center mx-auto mb-4">
            <Heart size={24} />
          </div>
          <h1 className="text-2xl font-bold text-[#0F0D2E] mb-2">Sign in to view your Wishlist</h1>
          <p className="text-sm text-[#0F0D2E]/65 mb-6">
            Save favourite pieces across devices and move them to your shopping bag anytime.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="px-6 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium hover:bg-[#0F0D2E]"
            >
              Sign In
            </Link>
            <Link
              to="/shop"
              className="px-6 py-2.5 rounded-lg border border-[#E6EAF2] text-sm font-medium text-[#0F0D2E] hover:bg-[#F8F9FC]"
            >
              Browse Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F0D2E]">My Wishlist</h1>
          <p className="text-sm text-[#0F0D2E]/60 mt-1 tabular-nums">
            {wishlist.length} saved item{wishlist.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/shop" className="text-sm font-medium text-[#1E1B4B] hover:underline">
          Continue Shopping
        </Link>
      </div>

      {wishlist.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6EAF2] p-14 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F8F9FC] text-[#1E1B4B]/60 flex items-center justify-center mx-auto mb-4">
            <Heart size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-[#0F0D2E] mb-1">Your wishlist is empty</h2>
          <p className="text-sm text-[#0F0D2E]/60 max-w-sm mx-auto mb-6">
            Tap the heart icon on any SHAIKCART product to bookmark it here.
          </p>
          <Link
            to="/shop"
            className="inline-block px-6 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium"
          >
            Discover Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {wishlist.map((item) => {
            const outOfStock = item.stockQuantity <= 0;
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden flex flex-col"
              >
                <Link to={`/product/${item.slug}`} className="aspect-[4/3] bg-[#E6EAF2] block overflow-hidden">
                  <SafeImage
                    src={item.primaryImage}
                    alt={item.name}
                    className="w-full h-full object-cover hover:scale-[1.03] transition-transform"
                  />
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <Link
                    to={`/product/${item.slug}`}
                    className="text-sm font-semibold text-[#0F0D2E] hover:text-[#1E1B4B] line-clamp-2"
                  >
                    {item.name}
                  </Link>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-base font-bold text-[#1E1B4B] tabular-nums">
                      {formatINR(item.salePrice)}
                    </span>
                    {item.regularPrice > item.salePrice && (
                      <span className="text-xs text-[#0F0D2E]/45 line-through tabular-nums">
                        {formatINR(item.regularPrice)}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${outOfStock ? 'text-red-700' : 'text-[#1E1B4B]/80'}`}>
                    {outOfStock ? 'Out of Stock' : 'In Stock'}
                  </p>
                  <div className="mt-auto pt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={async () => {
                        await addToCart(
                          item.productId,
                          1,
                          item.colors?.[0] || '',
                          item.sizes?.[0] || '',
                          true
                        );
                        await toggleWishlist(item.productId);
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#1E1B4B] text-white text-xs font-medium hover:bg-[#0F0D2E] disabled:bg-[#E6EAF2] disabled:text-[#0F0D2E]/45 inline-flex items-center justify-center gap-1.5"
                    >
                      <ShoppingBag size={14} /> Move to Bag
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(item.productId)}
                      aria-label="Remove from wishlist"
                      className="p-2 rounded-lg border border-[#E6EAF2] text-[#0F0D2E]/60 hover:text-red-700 hover:border-red-200"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
