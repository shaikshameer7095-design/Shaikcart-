import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Headphones,
  RefreshCcw,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { SafeImage } from '../components/BrandLogo';
import type { Category, Product, WebsiteBanner } from '../types';

interface HomePayload {
  categories: Category[];
  banners: WebsiteBanner[];
  featured: Product[];
  newArrivals: Product[];
  bestSellers: Product[];
  trending: Product[];
  deals: Product[];
  recommended: Product[];
  cms: Record<string, any>;
}

const TESTIMONIALS = [
  {
    name: 'Ananya Deshmukh',
    location: 'Mumbai, Maharashtra',
    item: 'Emerald Silk-Linen Midi Dress',
    quote:
      'The silk-linen drape feels genuinely boutique quality. Arrived neatly boxed in two days with zero plastic waste.',
  },
  {
    name: 'Rohan Kulkarni',
    location: 'Bengaluru, Karnataka',
    item: 'Aurora ANC Studio Headphones',
    quote:
      'Clear soundstage, comfortable memory cushions on long flights, and the matte forest green finish looks extraordinary.',
  },
  {
    name: 'Meera Nair',
    location: 'Kochi, Kerala',
    item: 'Speckled Ivory Stoneware Set',
    quote:
      'Every plate arrived intact in honeycomb packaging. We use the set daily and guests always ask where it is from.',
  },
];

export function HomePage() {
  const [data, setData] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'newArrivals' | 'bestSellers' | 'trending' | 'deals' | 'recommended'>(
    'newArrivals'
  );

  useSeo({
    title: 'SHAIKCART — Style Your Life. Shop Smarter.',
    description:
      'Discover thoughtfully curated fashion, home & living, beauty, electronics, sports, kids, accessories, and luxury gifts on SHAIKCART.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SHAIKCART',
      url: window.location.origin,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${window.location.origin}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  });

  useEffect(() => {
    let active = true;
    const loadHome = async (attempt = 0) => {
      try {
        const res = await apiRequest<HomePayload>('/api/storefront/home');
        if (!active) return;
        setData(res && typeof res === 'object' ? res : null);
        setError('');
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        if (attempt < 1) {
          window.setTimeout(() => loadHome(attempt + 1), 1200);
          return;
        }
        setError(err?.message || 'Unable to load storefront.');
        setLoading(false);
      }
    };
    loadHome();
    return () => {
      active = false;
    };
  }, []);

  const bannersList = Array.isArray(data?.banners) ? data.banners : [];
  const heroBanner = bannersList.find((b) => b.slot === 'hero');
  const homePromo = bannersList.find((b) => b.slot === 'promo_home');
  const beautyPromo = bannersList.find((b) => b.slot === 'promo_beauty');
  const sections = (data?.cms?.homepage_sections || {}) as Record<string, boolean>;

  const activeCollectionProducts =
    data && Array.isArray(data[activeTab]) ? data[activeTab] : [];

  return (
    <div>
      {/* 1. High-Contrast Editorial Split Hero Banner */}
      <section className="bg-[#F8F9FC] border-b border-[#E6EAF2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch bg-[#0F0D2E] rounded-2xl overflow-hidden shadow-xl">
            {/* Left Copy — Midnight Indigo Luxury Surface */}
            <div className="lg:col-span-6 p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-gradient-to-br from-[#0F0D2E] via-[#1E1B4B] to-[#312E81] text-white">
              <p className="text-xs font-bold tracking-[0.16em] uppercase text-[#FB7185] mb-4">
                {heroBanner?.badgeText || 'New Season · Luxury Edit'}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white leading-[1.14] tracking-tight mb-5">
                {heroBanner?.title || 'Style Your Life. Shop Smarter with SHAIKCART.'}
              </h1>
              <p className="text-base text-white/80 leading-relaxed max-w-lg mb-8">
                {heroBanner?.subtitle ||
                  'Discover thoughtfully selected products for everyday living, fashion, beauty, electronics and more.'}
              </p>
              <div className="flex flex-wrap items-center gap-3.5">
                <Link
                  to={heroBanner?.ctaLink || '/shop'}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#E11D48] text-white text-sm font-semibold hover:bg-[#F43F5E] transition-colors shadow-md whitespace-nowrap"
                >
                  {heroBanner?.ctaText || 'Shop Now'} <ArrowRight size={16} />
                </Link>
                <Link
                  to="/shop?bestseller=true"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  Explore Collections
                </Link>
              </div>
            </div>

            {/* Right Lifestyle Photography */}
            <div className="lg:col-span-6 relative min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-[#1E1B4B]">
              <SafeImage
                src={heroBanner?.imageUrl || '/src/assets/images/hero_lifestyle_shopping_1795671294438.jpg'}
                alt="SHAIKCART curated modern Indian lifestyle shopping"
                className="w-full h-full object-cover lg:absolute lg:inset-0"
              />
            </div>
          </div>

          {/* 3 Trust Indicators directly below Hero */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-xl border border-[#E6EAF2] px-5 py-4 flex items-center gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-[#1E1B4B] text-white flex items-center justify-center shrink-0">
                <Award size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F0D2E]">Quality Products</p>
                <p className="text-xs text-[#0F0D2E]/60">Curated Indian &amp; artisanal brands</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E6EAF2] px-5 py-4 flex items-center gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-[#E11D48] text-white flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F0D2E]">Secure Payments</p>
                <p className="text-xs text-[#0F0D2E]/60">Razorpay UPI, Cards, Net Banking &amp; COD</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E6EAF2] px-5 py-4 flex items-center gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-[#1E1B4B] text-white flex items-center justify-center shrink-0">
                <RefreshCcw size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F0D2E]">Easy Returns</p>
                <p className="text-xs text-[#0F0D2E]/60">15-day hassle-free doorstep returns</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* 2. Horizontal Circular Category Strip */}
      {sections.showCategories !== false && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F0D2E]">Shop by Category</h2>
              <p className="text-sm text-[#0F0D2E]/60 mt-1">Explore thoughtfully curated departments</p>
            </div>
            <Link
              to="/shop"
              className="text-sm font-medium text-[#1E1B4B] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              View All <ArrowRight size={15} />
            </Link>
          </div>

          <div className="flex items-start gap-5 overflow-x-auto pb-4 -mx-1 px-1">
            {(loading ? Array.from({ length: 10 }) : data?.categories || []).map((cat: any, idx) =>
              loading ? (
                <div key={idx} className="flex flex-col items-center gap-2 shrink-0 w-24 animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-[#E6EAF2]" />
                  <div className="h-3 w-16 bg-[#E6EAF2] rounded" />
                </div>
              ) : (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className="group flex flex-col items-center gap-2.5 shrink-0 w-24 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-[#E6EAF2] border-2 border-transparent group-hover:border-[#1E1B4B] overflow-hidden transition-all duration-200 shadow-xs">
                    <SafeImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <span className="text-xs font-medium text-[#0F0D2E] group-hover:text-[#1E1B4B] leading-tight">
                    {cat.name}
                  </span>
                </Link>
              )
            )}
          </div>
        </section>
      )}

      {/* 3. Featured Products Grid */}
      {sections.showFeatured !== false && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F0D2E]">Featured Products</h2>
              <p className="text-sm text-[#0F0D2E]/60 mt-1">Signature picks selected by SHAIKCART curators</p>
            </div>
            <Link
              to="/shop?featured=true"
              className="text-sm font-medium text-[#1E1B4B] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              Shop Featured <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : (data?.featured || []).slice(0, 12).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* 4. Dual Editorial Promotional Banners: Refresh Your Space + Glow Naturally */}
      {(sections.showHomePromo !== false || sections.showBeautyPromo !== false) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sections.showHomePromo !== false && (
              <div className="relative rounded-2xl overflow-hidden bg-[#1E1B4B] min-h-[300px] sm:min-h-[340px] flex items-end">
                <SafeImage
                  src={homePromo?.imageUrl || '/src/assets/images/promo_refresh_space_1795671295471.jpg'}
                  alt="Refresh Your Space Home & Living"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0D2E]/90 via-[#0F0D2E]/40 to-transparent" />
                <div className="relative z-10 p-7 sm:p-9 text-white max-w-md">
                  <p className="text-xs font-bold tracking-wider uppercase text-[#FB7185] mb-2">
                    {homePromo?.badgeText || 'Home & Living Edit'}
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2">
                    {homePromo?.title || 'Refresh Your Space'}
                  </h3>
                  <p className="text-sm text-white/85 mb-5 leading-relaxed">
                    {homePromo?.subtitle ||
                      'Handcrafted stoneware, solid oak accents, and calm lighting designed for warm Indian homes.'}
                  </p>
                  <Link
                    to={homePromo?.ctaLink || '/category/home-living'}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-[#0F0D2E] text-sm font-semibold hover:bg-[#F8F9FC] transition-colors"
                  >
                    {homePromo?.ctaText || 'Explore Home & Living'} <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            )}

            {sections.showBeautyPromo !== false && (
              <div className="relative rounded-2xl overflow-hidden bg-[#1E1B4B] min-h-[300px] sm:min-h-[340px] flex items-end">
                <SafeImage
                  src={beautyPromo?.imageUrl || '/src/assets/images/promo_glow_naturally_1795671296221.jpg'}
                  alt="Glow Naturally Botanical Skincare"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0D2E]/90 via-[#0F0D2E]/40 to-transparent" />
                <div className="relative z-10 p-7 sm:p-9 text-white max-w-md">
                  <p className="text-xs font-bold tracking-wider uppercase text-[#FB7185] mb-2">
                    {beautyPromo?.badgeText || 'Clean Botanical Skincare'}
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2">
                    {beautyPromo?.title || 'Glow Naturally'}
                  </h3>
                  <p className="text-sm text-white/85 mb-5 leading-relaxed">
                    {beautyPromo?.subtitle ||
                      'Botanical serums and barrier-first hydration blending Kashmiri saffron with clean clinical actives.'}
                  </p>
                  <Link
                    to={beautyPromo?.ctaLink || '/category/beauty'}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-[#0F0D2E] text-sm font-semibold hover:bg-[#F8F9FC] transition-colors"
                  >
                    {beautyPromo?.ctaText || 'Shop Beauty'} <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. Curated Merchandising Collections (New Arrivals / Best Sellers / Trending / Special Offers / Recommended) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F0D2E]">Curated Collections</h2>
            <p className="text-sm text-[#0F0D2E]/60 mt-1">
              Live selections dynamically powered by the SHAIKCART catalog
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-[#E6EAF2]/80 rounded-lg overflow-x-auto">
            {(
              [
                ['newArrivals', 'New Arrivals'],
                ['bestSellers', 'Best Sellers'],
                ['trending', 'Trending'],
                ['deals', 'Special Offers'],
                ['recommended', 'Recommended'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === key
                    ? 'bg-white text-[#1E1B4B] shadow-xs'
                    : 'text-[#0F0D2E]/70 hover:text-[#0F0D2E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : activeCollectionProducts.slice(0, 12).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* 6. Why Shop With Us */}
      {sections.showWhyShop !== false && (
        <section className="bg-white border-y border-[#E6EAF2] py-14 mt-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-2xl font-bold text-[#0F0D2E]">Why Shop With SHAIKCART</h2>
              <p className="text-sm text-[#0F0D2E]/65 mt-2">
                Built for calm, transparent, reliable shopping across India.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                {
                  icon: Truck,
                  title: 'Free Shipping',
                  desc: 'Complimentary tracked delivery on orders above ₹1,499 across India.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Secure Payments',
                  desc: 'Razorpay UPI, Cards, Net Banking, Wallets & Cash on Delivery.',
                },
                {
                  icon: RefreshCcw,
                  title: 'Easy Returns',
                  desc: '15-day doorstep returns and verified refunds to original source.',
                },
                {
                  icon: Award,
                  title: 'Quality Products',
                  desc: 'Every product vetted for material honesty and durability.',
                },
                {
                  icon: Headphones,
                  title: 'Customer Support',
                  desc: 'Responsive ticket & order assistance 6 days a week.',
                },
              ].map((item) => (
                <div key={item.title} className="p-5 rounded-xl bg-[#F8F9FC]/60 border border-[#E6EAF2]">
                  <item.icon size={22} className="text-[#1E1B4B] mb-3" />
                  <h3 className="text-sm font-semibold text-[#0F0D2E] mb-1.5">{item.title}</h3>
                  <p className="text-xs text-[#0F0D2E]/65 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. Customer Testimonials */}
      {sections.showTestimonials !== false && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F0D2E]">Loved by Indian Homes</h2>
              <p className="text-sm text-[#0F0D2E]/60 mt-1">Stories from customers across the country</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="bg-white rounded-xl border border-[#E6EAF2] p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-0.5 text-[#F59E0B] mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-sm text-[#0F0D2E]/80 leading-relaxed mb-5">“{t.quote}”</p>
                </div>
                <div className="pt-4 border-t border-[#E6EAF2] text-xs">
                  <p className="font-semibold text-[#0F0D2E]">{t.name}</p>
                  <p className="text-[#0F0D2E]/55 mt-0.5">
                    {t.location} · {t.item}
                  </p>
                </div>
              </blockquote>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
