import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/api';
import { SafeImage } from './BrandLogo';

const FREE_SHIPPING_THRESHOLD = 1499;

export function MiniCartDrawer() {
  const { cart, miniCartOpen, setMiniCartOpen, updateCartQty, removeCartItem } = useStore();

  if (!miniCartOpen) return null;

  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - cart.subtotal);
  const progressPct = Math.min(100, Math.round((cart.subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#0F0D2E]/45 backdrop-blur-[2px]"
        onClick={() => setMiniCartOpen(false)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Bag"
        className="relative z-10 w-full max-w-md bg-white h-full flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={19} className="text-[#1E1B4B]" />
            <h2 className="text-base font-semibold text-[#0F0D2E]">
              Shopping Bag <span className="text-[#0F0D2E]/50 font-normal tabular-nums">({cart.itemCount})</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setMiniCartOpen(false)}
            aria-label="Close shopping bag"
            className="p-2 rounded-lg text-[#0F0D2E]/60 hover:text-[#0F0D2E] hover:bg-[#F8F9FC] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Free Shipping Progress */}
        {cart.items.length > 0 && (
          <div className="px-6 py-3 bg-[#F8F9FC] border-b border-[#E6EAF2]">
            <div className="flex items-center gap-2 text-xs text-[#1E1B4B] mb-1.5">
              <Truck size={14} className="shrink-0" />
              {remainingForFreeShipping === 0 ? (
                <span className="font-medium">Complimentary pan-India shipping unlocked</span>
              ) : (
                <span>
                  Add <strong className="tabular-nums">{formatINR(remainingForFreeShipping)}</strong> more for free shipping
                </span>
              )}
            </div>
            <div className="h-1.5 w-full bg-[#E6EAF2] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1E1B4B] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#F8F9FC] flex items-center justify-center text-[#1E1B4B]/60 mb-4">
                <ShoppingBag size={28} strokeWidth={1.5} />
              </div>
              <p className="text-base font-semibold text-[#0F0D2E] mb-1">Your shopping bag is empty</p>
              <p className="text-sm text-[#0F0D2E]/60 max-w-xs mb-6">
                Explore curated fashion, homeware, clean beauty, and everyday essentials.
              </p>
              <Link
                to="/shop"
                onClick={() => setMiniCartOpen(false)}
                className="px-5 py-2.5 bg-[#1E1B4B] text-white text-sm font-medium rounded-lg hover:bg-[#0F0D2E] transition-colors"
              >
                Explore Collection
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E6EAF2]">
              {cart.items.map((item) => (
                <div key={item.id} className="py-4 flex gap-4">
                  <Link
                    to={`/product/${item.slug}`}
                    onClick={() => setMiniCartOpen(false)}
                    className="w-20 h-20 rounded-lg bg-[#E6EAF2] overflow-hidden shrink-0"
                  >
                    <SafeImage
                      src={item.primaryImage}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/product/${item.slug}`}
                        onClick={() => setMiniCartOpen(false)}
                        className="text-sm font-medium text-[#0F0D2E] hover:text-[#1E1B4B] line-clamp-2 leading-snug"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="p-1 text-[#0F0D2E]/40 hover:text-red-700 transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {(item.selectedColor || item.selectedSize) && (
                      <p className="text-xs text-[#0F0D2E]/55 mt-0.5">
                        {[item.selectedColor, item.selectedSize].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center border border-[#E6EAF2] rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="w-7 h-7 flex items-center justify-center text-[#0F0D2E]/70 hover:bg-[#F8F9FC]"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-8 text-center text-xs font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="w-7 h-7 flex items-center justify-center text-[#0F0D2E]/70 hover:bg-[#F8F9FC]"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-[#1E1B4B] tabular-nums">
                        {formatINR(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Totals */}
        {cart.items.length > 0 && (
          <div className="p-6 border-t border-[#E6EAF2] bg-[#F8F9FC]/40 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#0F0D2E]/70">Subtotal</span>
              <span className="text-base font-bold text-[#0F0D2E] tabular-nums">
                {formatINR(cart.subtotal)}
              </span>
            </div>
            {cart.savings > 0 && (
              <p className="text-xs text-[#1E1B4B]">
                You save <span className="font-semibold tabular-nums">{formatINR(cart.savings)}</span> off MRP
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link
                to="/cart"
                onClick={() => setMiniCartOpen(false)}
                className="py-2.5 px-4 text-center text-sm font-medium border border-[#1E1B4B] text-[#1E1B4B] rounded-lg hover:bg-[#1E1B4B]/5 transition-colors whitespace-nowrap"
              >
                View Cart
              </Link>
              <Link
                to="/checkout"
                onClick={() => setMiniCartOpen(false)}
                className="py-2.5 px-4 text-center text-sm font-medium bg-[#1E1B4B] text-white rounded-lg hover:bg-[#0F0D2E] transition-colors whitespace-nowrap"
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
