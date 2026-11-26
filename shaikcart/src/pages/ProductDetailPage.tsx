import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Heart,
  MapPin,
  Minus,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  ZoomIn,
  X,
} from 'lucide-react';
import { apiRequest, formatINR } from '../lib/api';
import { useStore } from '../context/StoreContext';
import { useSeo } from '../hooks/useSeo';
import { ProductCard } from '../components/ProductCard';
import { SafeImage } from '../components/BrandLogo';
import type { Product, ProductReview } from '../types';

interface ProductDetailPayload {
  product: Product;
  reviews: ProductReview[];
  related: Product[];
  frequentlyBoughtTogether: Product[];
}

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    user,
    addToCart,
    toggleWishlist,
    wishlistIds,
    recentlyViewed,
    recordRecentlyViewed,
    showToast,
  } = useStore();

  const [data, setData] = useState<ProductDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);

  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [pincode, setPincode] = useState('');
  const [pinResult, setPinResult] = useState<any>(null);
  const [pinChecking, setPinChecking] = useState(false);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    apiRequest<ProductDetailPayload>(`/api/products/${slug}`)
      .then((res) => {
        setData(res);
        setActiveImage(res.product.images?.[0]?.url || res.product.primaryImage);
        setSelectedColor(res.product.colors?.[0] || '');
        setSelectedSize(res.product.sizes?.[0] || '');
        setQuantity(1);
        recordRecentlyViewed(res.product);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [slug, recordRecentlyViewed]);

  const product = data?.product;

  useSeo({
    title: product ? product.seoTitle || `${product.name} | SHAIKCART` : 'Product Details | SHAIKCART',
    description: product?.seoDescription || product?.shortDescription,
    jsonLd: product
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            sku: product.sku,
            description: product.shortDescription || product.description,
            image: `${window.location.origin}${product.primaryImage}`,
            brand: { '@type': 'Brand', name: product.brandName },
            offers: {
              '@type': 'Offer',
              priceCurrency: 'INR',
              price: product.salePrice,
              availability:
                product.stockQuantity > 0
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            },
            aggregateRating:
              product.reviewCount > 0
                ? {
                    '@type': 'AggregateRating',
                    ratingValue: product.ratingAvg,
                    reviewCount: product.reviewCount,
                  }
                : undefined,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: window.location.origin },
              {
                '@type': 'ListItem',
                position: 2,
                name: product.categoryName,
                item: `${window.location.origin}/category/${product.categorySlug}`,
              },
              { '@type': 'ListItem', position: 3, name: product.name },
            ],
          },
        ]
      : undefined,
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 aspect-[4/3] bg-[#E6EAF2] rounded-2xl" />
          <div className="lg:col-span-6 space-y-4">
            <div className="h-4 w-40 bg-[#E6EAF2] rounded" />
            <div className="h-8 w-3/4 bg-[#E6EAF2] rounded" />
            <div className="h-6 w-32 bg-[#E6EAF2] rounded" />
            <div className="h-24 w-full bg-[#E6EAF2] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-[#0F0D2E] mb-2">Product not found</h1>
        <p className="text-sm text-[#0F0D2E]/65 mb-6">
          This product may have been archived or moved.
        </p>
        <Link
          to="/shop"
          className="px-6 py-3 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium"
        >
          Browse All Products
        </Link>
      </div>
    );
  }

  const isWishlisted = wishlistIds.has(product.id);
  const outOfStock = product.stockQuantity <= 0;

  const handleCheckPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPinChecking(true);
      const res = await apiRequest(`/api/shipping/check-pincode?pincode=${encodeURIComponent(pincode)}`);
      setPinResult(res);
    } catch (err: any) {
      setPinResult({ serviceable: false, message: err?.message || 'Invalid PIN code' });
    } finally {
      setPinChecking(false);
    }
  };

  const handleBuyNow = async () => {
    if (outOfStock) return;
    await addToCart(product.id, quantity, selectedColor, selectedSize, false);
    navigate('/checkout');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingReview(true);
      await apiRequest(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment,
        }),
      });
      showToast('Thank you! Your verified review has been published.');
      setReviewTitle('');
      setReviewComment('');
      const refreshed = await apiRequest<ProductDetailPayload>(`/api/products/${product.slug}`);
      setData(refreshed);
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const gallery = product.images && product.images.length > 0
    ? product.images
    : [{ id: 0, url: product.primaryImage, altText: product.name, sortOrder: 0 }];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#0F0D2E]/60 mb-6 flex-wrap">
        <Link to="/" className="hover:text-[#1E1B4B]">Home</Link>
        <ChevronRight size={13} />
        <Link to={`/category/${product.categorySlug}`} className="hover:text-[#1E1B4B]">
          {product.categoryName}
        </Link>
        <ChevronRight size={13} />
        <span className="text-[#0F0D2E] font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Split: Sticky Gallery + Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Product Image Gallery */}
        <div className="lg:col-span-6 lg:sticky lg:top-28 space-y-4">
          <div className="relative aspect-[4/3] bg-[#E6EAF2] rounded-2xl overflow-hidden border border-[#E6EAF2] group">
            <SafeImage
              src={activeImage || product.primaryImage}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label="Zoom product image"
              className="absolute bottom-4 right-4 px-3 py-2 rounded-lg bg-white/90 text-[#0F0D2E] text-xs font-medium inline-flex items-center gap-1.5 shadow-sm hover:bg-white"
            >
              <ZoomIn size={14} /> Zoom
            </button>
          </div>

          {gallery.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {gallery.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(img.url)}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 bg-[#E6EAF2] transition-all ${
                    activeImage === img.url ? 'border-[#1E1B4B]' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <SafeImage src={img.url} alt={img.altText || product.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#0F0D2E]/60 mb-2">
              <span className="font-semibold text-[#1E1B4B]">{product.brandName}</span>
              <span aria-hidden="true">·</span>
              <span>{product.categoryName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px]">{product.sku}</span>
              {product.isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#0F0D2E]/50">Demo Catalog</span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F0D2E] leading-tight">
              {product.name}
            </h1>

            <div className="mt-3 flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-[#E11D48]">
                <Star size={16} fill="currentColor" />
                <span className="font-semibold text-[#0F0D2E] tabular-nums">{product.ratingAvg.toFixed(1)}</span>
              </div>
              <a href="#reviews" className="text-xs text-[#1E1B4B] hover:underline tabular-nums">
                {product.reviewCount} customer review{product.reviewCount === 1 ? '' : 's'}
              </a>
              <span aria-hidden="true" className="text-[#0F0D2E]/30">|</span>
              <span
                className={`text-xs font-medium ${
                  outOfStock
                    ? 'text-red-700'
                    : product.stockQuantity <= product.lowStockThreshold
                    ? 'text-amber-700'
                    : 'text-[#1E1B4B]'
                }`}
              >
                {outOfStock
                  ? 'Currently Out of Stock'
                  : product.stockQuantity <= product.lowStockThreshold
                  ? `Only ${product.stockQuantity} left in stock`
                  : `In Stock (${product.stockQuantity} ready to ship)`}
              </span>
            </div>
          </div>

          {/* Pricing */}
          <div className="pb-5 border-b border-[#E6EAF2]">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-[#1E1B4B] tabular-nums">
                {formatINR(product.salePrice)}
              </span>
              {product.regularPrice > product.salePrice && (
                <>
                  <span className="text-base text-[#0F0D2E]/45 line-through tabular-nums">
                    {formatINR(product.regularPrice)}
                  </span>
                  <span className="text-sm font-semibold text-[#1E1B4B]">
                    Save {product.discountPercent}%
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-[#0F0D2E]/55 mt-1">
              Inclusive of MRP guidelines · GST itemized transparently at checkout
            </p>
          </div>

          <p className="text-sm text-[#0F0D2E]/80 leading-relaxed">{product.shortDescription}</p>

          {/* Color Selector */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#0F0D2E] mb-2">
                Color: <span className="font-normal text-[#0F0D2E]/70">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      selectedColor === color
                        ? 'border-[#1E1B4B] bg-[#1E1B4B] text-white'
                        : 'border-[#E6EAF2] bg-[#F8F9FC]/40 text-[#0F0D2E] hover:border-[#1E1B4B]'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#0F0D2E] mb-2">
                Size / Variant: <span className="font-normal text-[#0F0D2E]/70">{selectedSize}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[48px] px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      selectedSize === size
                        ? 'border-[#1E1B4B] bg-[#1E1B4B] text-white'
                        : 'border-[#E6EAF2] bg-white text-[#0F0D2E] hover:border-[#1E1B4B]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Primary Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-[#E6EAF2] rounded-lg bg-[#F8F9FC]/40">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-10 h-11 flex items-center justify-center text-[#0F0D2E] hover:bg-[#E6EAF2]/60"
                >
                  <Minus size={15} />
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stockQuantity), q + 1))}
                  aria-label="Increase quantity"
                  className="w-10 h-11 flex items-center justify-center text-[#0F0D2E] hover:bg-[#E6EAF2]/60"
                >
                  <Plus size={15} />
                </button>
              </div>

              <button
                type="button"
                disabled={outOfStock}
                onClick={() => addToCart(product.id, quantity, selectedColor, selectedSize, true)}
                className="flex-1 h-11 px-6 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E] disabled:bg-[#E6EAF2] disabled:text-[#0F0D2E]/45 transition-colors inline-flex items-center justify-center gap-2"
              >
                <ShoppingBag size={16} />
                {outOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Save to Wishlist"
                className={`w-11 h-11 rounded-lg border flex items-center justify-center transition-colors ${
                  isWishlisted
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-[#E6EAF2] text-[#1E1B4B] hover:bg-[#F8F9FC]'
                }`}
              >
                <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
            </div>

            {!outOfStock && (
              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full h-11 rounded-lg border border-[#1E1B4B] text-[#1E1B4B] text-sm font-semibold hover:bg-[#1E1B4B]/5 transition-colors"
              >
                Buy Now
              </button>
            )}
          </div>

          {/* Delivery PIN Code Checker */}
          <div className="p-4 rounded-xl bg-[#F8F9FC]/70 border border-[#E6EAF2] space-y-3">
            <p className="text-xs font-semibold text-[#0F0D2E] flex items-center gap-1.5">
              <MapPin size={14} className="text-[#1E1B4B]" /> Check Delivery &amp; COD Availability
            </p>
            <form onSubmit={handleCheckPincode} className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit Indian PIN code (e.g. 560038)"
                className="flex-1 h-9 px-3 rounded-lg bg-white border border-[#E6EAF2] text-xs tabular-nums"
              />
              <button
                type="submit"
                disabled={pinChecking || pincode.length !== 6}
                className="px-4 h-9 rounded-lg bg-[#1E1B4B] text-white text-xs font-medium disabled:opacity-45"
              >
                {pinChecking ? 'Checking...' : 'Check'}
              </button>
            </form>
            {pinResult && (
              <div className={`text-xs ${pinResult.serviceable ? 'text-[#1E1B4B]' : 'text-red-700'}`}>
                {pinResult.serviceable ? (
                  <p className="space-y-0.5">
                    <span className="font-semibold block">
                      Deliverable to {pinResult.pincode} ({pinResult.regionName})
                    </span>
                    <span className="block text-[#0F0D2E]/75">
                      Estimated delivery: {pinResult.estimatedDays} ·{' '}
                      {pinResult.codEnabled ? 'Cash on Delivery available' : 'Prepaid only'} · Free shipping above{' '}
                      {formatINR(pinResult.freeShippingThreshold)}
                    </span>
                  </p>
                ) : (
                  <p>{pinResult.message}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E6EAF2] text-[11px] text-[#0F0D2E]/70">
              <span className="flex items-center gap-1"><Truck size={13} className="text-[#1E1B4B]" /> Pan-India Ship</span>
              <span className="flex items-center gap-1"><RefreshCcw size={13} className="text-[#1E1B4B]" /> 15-Day Return</span>
              <span className="flex items-center gap-1"><ShieldCheck size={13} className="text-[#1E1B4B]" /> Genuine Quality</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Description, Highlights & Specifications */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0F0D2E] mb-3">Product Story &amp; Details</h2>
            <p className="text-sm text-[#0F0D2E]/80 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {product.highlights && product.highlights.length > 0 && (
            <div className="pt-5 border-t border-[#E6EAF2]">
              <h3 className="text-sm font-semibold text-[#0F0D2E] mb-3">Key Highlights</h3>
              <ul className="space-y-2">
                {product.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#0F0D2E]/80">
                    <Check size={15} className="text-[#1E1B4B] shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
          <h2 className="text-lg font-bold text-[#0F0D2E] mb-4">Specifications</h2>
          <dl className="divide-y divide-[#E6EAF2] text-sm">
            {product.materials && (
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#0F0D2E]/60">Materials</dt>
                <dd className="font-medium text-right text-[#0F0D2E]">{product.materials}</dd>
              </div>
            )}
            {product.dimensions && (
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#0F0D2E]/60">Dimensions</dt>
                <dd className="font-medium text-right text-[#0F0D2E]">{product.dimensions}</dd>
              </div>
            )}
            {Object.entries(product.specifications || {}).map(([k, v]) => (
              <div key={k} className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#0F0D2E]/60">{k}</dt>
                <dd className="font-medium text-right text-[#0F0D2E]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Frequently Bought Together */}
      {data?.frequentlyBoughtTogether && data.frequentlyBoughtTogether.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-[#0F0D2E] mb-5">Frequently Bought Together</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.frequentlyBoughtTogether.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Customer Reviews */}
      <section id="reviews" className="mt-14 bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-xl font-bold text-[#0F0D2E]">Customer Reviews</h2>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-[#1E1B4B] tabular-nums">
                {product.ratingAvg.toFixed(1)}
              </span>
              <div>
                <div className="flex items-center gap-0.5 text-[#E11D48]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={15}
                      fill={i < Math.round(product.ratingAvg) ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
                <p className="text-xs text-[#0F0D2E]/60 mt-0.5 tabular-nums">
                  Based on {product.reviewCount} ratings
                </p>
              </div>
            </div>

            {user ? (
              <form onSubmit={handleReviewSubmit} className="pt-4 border-t border-[#E6EAF2] space-y-3">
                <h3 className="text-sm font-semibold text-[#0F0D2E]">Write a Verified Review</h3>
                <p className="text-xs text-[#0F0D2E]/60">
                  Available to signed-in SHAIKCART customers who have purchased this product.
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 text-[#E11D48]"
                      aria-label={`Rate ${star} stars`}
                    >
                      <Star size={20} fill={star <= reviewRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Review headline"
                  className="w-full h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                />
                <textarea
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with material, fit, or quality..."
                  className="w-full p-3 rounded-lg border border-[#E6EAF2] text-sm"
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold hover:bg-[#0F0D2E]"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            ) : (
              <div className="pt-4 border-t border-[#E6EAF2]">
                <p className="text-xs text-[#0F0D2E]/65 mb-3">
                  Sign in to share a verified purchase review for this product.
                </p>
                <Link
                  to="/login"
                  className="inline-block px-4 py-2 rounded-lg border border-[#1E1B4B] text-[#1E1B4B] text-xs font-semibold hover:bg-[#F8F9FC]"
                >
                  Sign In to Review
                </Link>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 divide-y divide-[#E6EAF2]">
            {data?.reviews && data.reviews.length > 0 ? (
              data.reviews.map((rev) => (
                <div key={rev.id} className="py-4 first:pt-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#0F0D2E]">{rev.title}</span>
                      {rev.isVerifiedPurchase && (
                        <span className="text-[11px] text-[#1E1B4B] font-medium">· Verified Purchase</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 text-[#E11D48]">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-[#0F0D2E]/75 leading-relaxed mb-2">{rev.comment}</p>
                  <p className="text-xs text-[#0F0D2E]/50">
                    {rev.userName} · {new Date(rev.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-[#0F0D2E]/60">
                No written reviews yet for this product. Be the first verified buyer to share feedback.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      {data?.related && data.related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-[#0F0D2E] mb-5">Related Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed Products */}
      {recentlyViewed.filter((p) => p.id !== product.id).length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-[#0F0D2E] mb-5">Recently Viewed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentlyViewed
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      )}

      {/* Lightbox Image Zoom Modal */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            aria-label="Close zoom preview"
            className="absolute top-5 right-5 p-2 rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={22} />
          </button>
          <img
            src={activeImage || product.primaryImage}
            alt={product.name}
            className="max-h-[88vh] max-w-[92vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
