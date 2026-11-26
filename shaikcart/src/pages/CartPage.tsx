import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { SafeImage } from '../components/BrandLogo';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '../types';

const FREE_SHIPPING_THRESHOLD = 1499;

export function CartPage() {
  const navigate = useNavigate();
  const { cart, updateCartQty, removeCartItem, showToast } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    description: string;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [recommended, setRecommended] = useState<Product[]>([]);

  useSeo({
    title: 'Shopping Cart — SHAIKCART',
    description: 'Review your SHAIKCART shopping bag, apply promo codes, and proceed to secure checkout.',
  });

  useEffect(() => {
    apiRequest<{ products: Product[] }>('/api/products?featured=true&limit=4')
      .then((d) => setRecommended(d.products || []))
      .catch(() => {});
  }, []);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    try {
      setValidatingCoupon(true);
      setCouponError('');
      const res = await apiRequest<{ valid: boolean; code: string; discountAmount: number; description: string }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({
            code: couponInput.trim(),
            subtotal: cart.subtotal,
            categorySlugs: cart.items.map((i) => i.categorySlug).filter(Boolean),
          }),
        }
      );
      setAppliedCoupon(res);
      showToast(`Coupon ${res.code} applied — you save ${formatINR(res.discountAmount)}`);
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err?.message || 'Invalid coupon code.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const discount = appliedCoupon ? Math.min(appliedCoupon.discountAmount, cart.subtotal) : 0;
  const discountedSubtotal = Math.max(0, cart.subtotal - discount);
  const shippingFee = discountedSubtotal === 0 || discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 99;
  const estimatedTax = Math.round(discountedSubtotal * 0.12);
  const finalTotal = discountedSubtotal + shippingFee + estimatedTax;
  const remainingFree = Math.max(0, FREE_SHIPPING_THRESHOLD - discountedSubtotal);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F0D2E]">Shopping Bag</h1>
          <p className="text-sm text-[#0F0D2E]/60 mt-1 tabular-nums">
            {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} in your bag
          </p>
        </div>
        <Link to="/shop" className="text-sm font-medium text-[#1E1B4B] hover:underline">
          Continue Shopping
        </Link>
      </div>

      {cart.items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6EAF2] p-14 text-center mb-14">
          <div className="w-16 h-16 rounded-full bg-[#F8F9FC] text-[#1E1B4B]/60 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold text-[#0F0D2E] mb-2">Your shopping cart is empty</h2>
          <p className="text-sm text-[#0F0D2E]/65 max-w-md mx-auto mb-6">
            Add curated fashion, stoneware, clean skincare, or electronics to begin checkout.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium hover:bg-[#0F0D2E]"
          >
            Start Shopping <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Left: Cart Items */}
          <div className="lg:col-span-8 space-y-4">
            {/* Free Shipping Progress */}
            <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
              <div className="flex items-center gap-2 text-xs text-[#1E1B4B] mb-2">
                <Truck size={15} />
                {remainingFree === 0 ? (
                  <span className="font-semibold">You have unlocked Free Standard Shipping across India</span>
                ) : (
                  <span>
                    Add <strong className="tabular-nums">{formatINR(remainingFree)}</strong> more to unlock complimentary shipping
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-[#E6EAF2] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1E1B4B] transition-all"
                  style={{ width: `${Math.min(100, Math.round((discountedSubtotal / FREE_SHIPPING_THRESHOLD) * 100))}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6EAF2] divide-y divide-[#E6EAF2]">
              {cart.items.map((item) => (
                <div key={item.id} className="p-5 flex flex-col sm:flex-row gap-5">
                  <Link
                    to={`/product/${item.slug}`}
                    className="w-full sm:w-28 h-36 sm:h-28 rounded-xl bg-[#E6EAF2] overflow-hidden shrink-0"
                  >
                    <SafeImage
                      src={item.primaryImage}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          to={`/product/${item.slug}`}
                          className="text-base font-semibold text-[#0F0D2E] hover:text-[#1E1B4B]"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-[#0F0D2E]/55 mt-1">
                          {[item.selectedColor, item.selectedSize, `SKU ${item.sku}`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="p-1.5 text-[#0F0D2E]/45 hover:text-red-700 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="inline-flex items-center border border-[#E6EAF2] rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-[#F8F9FC]"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-[#F8F9FC]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-base font-bold text-[#1E1B4B] tabular-nums">
                          {formatINR(item.lineTotal)}
                        </p>
                        {item.regularPrice > item.salePrice && (
                          <p className="text-xs text-[#0F0D2E]/45 line-through tabular-nums">
                            {formatINR(item.regularPrice * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Order Summary & Coupon */}
          <aside className="lg:col-span-4 bg-white rounded-2xl border border-[#E6EAF2] p-6 space-y-5 sticky top-28">
            <h2 className="text-lg font-bold text-[#0F0D2E]">Order Summary</h2>

            {/* Coupon Code */}
            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <label className="text-xs font-medium text-[#0F0D2E]/70 flex items-center gap-1.5">
                <Tag size={13} /> Promo / Coupon Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Try WELCOME10 or SHAIK250"
                  className="flex-1 h-10 px-3 rounded-lg border border-[#E6EAF2] bg-[#F8F9FC]/40 text-xs font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={validatingCoupon || !couponInput.trim()}
                  className="px-4 h-10 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold hover:bg-[#0F0D2E] disabled:opacity-45"
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="text-xs text-red-700">{couponError}</p>}
              {appliedCoupon && (
                <div className="flex items-center justify-between text-xs text-[#1E1B4B] bg-[#F8F9FC] px-3 py-2 rounded-lg">
                  <span>
                    <strong>{appliedCoupon.code}</strong> applied (-{formatINR(appliedCoupon.discountAmount)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponInput('');
                    }}
                    className="underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </form>

            {/* Totals Breakdown */}
            <div className="space-y-2.5 pt-3 border-t border-[#E6EAF2] text-sm">
              <div className="flex justify-between text-[#0F0D2E]/75">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium">{formatINR(cart.subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#1E1B4B]">
                  <span>Coupon Discount ({appliedCoupon?.code})</span>
                  <span className="tabular-nums font-medium">-{formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#0F0D2E]/75">
                <span>Shipping</span>
                <span className="tabular-nums font-medium">
                  {shippingFee === 0 ? 'Free' : formatINR(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between text-[#0F0D2E]/75">
                <span>Estimated GST (12%)</span>
                <span className="tabular-nums font-medium">{formatINR(estimatedTax)}</span>
              </div>
              <div className="pt-3 border-t border-[#E6EAF2] flex justify-between text-base font-bold text-[#0F0D2E]">
                <span>Total Payable</span>
                <span className="tabular-nums text-[#1E1B4B]">{formatINR(finalTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  appliedCoupon ? `/checkout?coupon=${encodeURIComponent(appliedCoupon.code)}` : '/checkout'
                )
              }
              className="w-full h-12 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E] transition-colors inline-flex items-center justify-center gap-2"
            >
              Proceed to Checkout <ArrowRight size={16} />
            </button>

            <p className="text-[11px] text-center text-[#0F0D2E]/55">
              Final taxes &amp; zone shipping are verified securely on checkout.
            </p>
          </aside>
        </div>
      )}

      {/* Recommended Products */}
      {recommended.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-[#0F0D2E] mb-5">You Might Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recommended.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
