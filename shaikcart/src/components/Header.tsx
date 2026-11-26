import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { BrandLogo, SafeImage } from './BrandLogo';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import type { Category } from '../types';

interface SuggestionResult {
  products: {
    id: number;
    name: string;
    slug: string;
    salePrice: number;
    regularPrice: number;
    primaryImage: string;
  }[];
  categories: Category[];
  popularSearches: string[];
}

export function Header() {
  const { user, cart, wishlist, unreadNotifications, setMiniCartOpen } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [announcementOpen, setAnnouncementOpen] = useState(true);
  const [announcements, setAnnouncements] = useState<string[]>([
    'Free Shipping on Orders Above ₹1,499',
    '15-Day Easy Returns',
    'Exclusive Offers · Code WELCOME10',
  ]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResult | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiRequest<{ categories: Category[] }>('/api/categories')
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
    apiRequest<{ value: { enabled?: boolean; messages?: string[] } }>('/api/cms/announcement_bar')
      .then((d) => {
        if (d.value?.enabled === false) setAnnouncementOpen(false);
        if (Array.isArray(d.value?.messages) && d.value.messages.length > 0) {
          setAnnouncements(d.value.messages);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setCatDropdownOpen(false);
    setSearchFocused(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!searchFocused) return;
    const timer = window.setTimeout(() => {
      apiRequest<SuggestionResult>(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`)
        .then(setSuggestions)
        .catch(() => {});
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchFocused]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchFocused(false);
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E6EAF2]">
      {/* Slim Announcement Bar */}
      {announcementOpen && (
        <div className="bg-[#0F0D2E] text-[#F8F9FC] text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar whitespace-nowrap text-[11px] sm:text-xs tracking-wide">
              {announcements.map((msg, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-[#E11D48]/60" aria-hidden="true">·</span>}
                  <span>{msg}</span>
                </React.Fragment>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAnnouncementOpen(false)}
              aria-label="Dismiss announcement bar"
              className="text-[#F8F9FC]/70 hover:text-white transition-colors shrink-0 p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 lg:gap-8">
        {/* Left: Mobile Menu + Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 -ml-2 text-[#1E1B4B] hover:bg-[#F8F9FC] rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to="/" aria-label="SHAIKCART Home">
            <BrandLogo />
          </Link>
        </div>

        {/* Center: Search Bar with Instant Suggestions */}
        <div ref={searchWrapRef} className="hidden md:block flex-1 max-w-xl relative">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1E1B4B]/50 pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dresses, stoneware, saffron serum, headphones..."
              aria-label="Search products"
              className="w-full h-10 pl-10 pr-20 rounded-lg bg-[#F8F9FC]/80 border border-[#E6EAF2] text-sm text-[#0F0D2E] placeholder:text-[#0F0D2E]/45 focus:bg-white focus:border-[#1E1B4B] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium bg-[#1E1B4B] text-white rounded-md hover:bg-[#0F0D2E] transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </form>

          {searchFocused && suggestions && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#E6EAF2] rounded-xl shadow-xl overflow-hidden z-50">
              {suggestions.products.length > 0 && (
                <div className="p-3 border-b border-[#E6EAF2]">
                  <p className="text-[11px] font-medium text-[#0F0D2E]/55 mb-2 px-2">Matching Products</p>
                  <div className="space-y-1">
                    {suggestions.products.map((p) => (
                      <Link
                        key={p.id}
                        to={`/product/${p.slug}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F8F9FC] transition-colors"
                      >
                        <SafeImage
                          src={p.primaryImage}
                          alt={p.name}
                          className="w-10 h-10 rounded-md object-cover bg-[#E6EAF2] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#0F0D2E] truncate">{p.name}</p>
                          <p className="text-xs text-[#1E1B4B] font-semibold tabular-nums">
                            {formatINR(p.salePrice)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.categories.length > 0 && (
                <div className="p-3 border-b border-[#E6EAF2]">
                  <p className="text-[11px] font-medium text-[#0F0D2E]/55 mb-2 px-2">Categories</p>
                  <div className="flex flex-wrap gap-2 px-2">
                    {suggestions.categories.map((c) => (
                      <Link
                        key={c.id}
                        to={`/category/${c.slug}`}
                        className="text-xs font-medium text-[#1E1B4B] hover:underline"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-[#F8F9FC]/50">
                <p className="text-[11px] font-medium text-[#0F0D2E]/55 mb-2 px-2">Popular Searches</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-2">
                  {suggestions.popularSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setSearchQuery(term);
                        setSearchFocused(false);
                        navigate(`/search?q=${encodeURIComponent(term)}`);
                      }}
                      className="text-xs text-[#0F0D2E]/80 hover:text-[#1E1B4B] hover:underline"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link
            to="/search"
            aria-label="Search"
            className="md:hidden p-2 text-[#1E1B4B] hover:bg-[#F8F9FC] rounded-lg transition-colors"
          >
            <Search size={20} />
          </Link>

          <Link
            to={user?.isAdmin ? '/admin' : '/admin/login'}
            title="SHAIKCART Admin Panel"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E1B4B] hover:bg-[#E11D48] rounded-lg transition-colors whitespace-nowrap shadow-xs"
          >
            <ShieldCheck size={14} />
            Admin Panel
          </Link>

          <Link
            to={user ? '/account' : '/login'}
            aria-label={user ? 'My Account' : 'Sign In'}
            className="inline-flex items-center gap-1.5 p-2 text-[#1E1B4B] hover:bg-[#F8F9FC] rounded-lg transition-colors"
          >
            <User size={20} />
            <span className="hidden xl:inline text-xs font-medium max-w-[90px] truncate">
              {user ? user.fullName.split(' ')[0] : 'Account'}
            </span>
          </Link>

          <Link
            to="/wishlist"
            aria-label="Wishlist"
            className="relative p-2 text-[#1E1B4B] hover:bg-[#F8F9FC] rounded-lg transition-colors"
          >
            <Heart size={20} />
            {wishlist.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {wishlist.length}
              </span>
            )}
          </Link>

          <Link
            to={user ? '/account?tab=notifications' : '/login'}
            aria-label="Notifications"
            className="hidden sm:inline-flex relative p-2 text-[#1E1B4B] hover:bg-[#F8F9FC] rounded-lg transition-colors"
          >
            <Bell size={20} />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#1E1B4B] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotifications}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMiniCartOpen(true)}
            aria-label="Open Shopping Bag"
            className="relative inline-flex items-center gap-2 pl-2.5 pr-3 py-2 text-[#1E1B4B] hover:bg-[#F8F9FC] rounded-lg transition-colors"
          >
            <ShoppingBag size={20} />
            <span className="text-xs font-semibold tabular-nums">{cart.itemCount}</span>
          </button>
        </div>
      </div>

      {/* Desktop Category & Storefront Navigation */}
      <nav
        aria-label="Primary Navigation"
        className="hidden lg:block border-t border-[#E6EAF2]/80 bg-white"
      >
        <div className="max-w-7xl mx-auto px-6 h-11 flex items-center justify-between">
          <div className="flex items-center gap-7 text-[13px] font-medium text-[#0F0D2E]/80">
            <Link to="/" className="hover:text-[#1E1B4B] transition-colors whitespace-nowrap">
              Home
            </Link>
            <Link to="/shop" className="hover:text-[#1E1B4B] transition-colors whitespace-nowrap">
              Shop
            </Link>
            <Link
              to="/shop?newArrival=true"
              className="hover:text-[#1E1B4B] transition-colors whitespace-nowrap"
            >
              New Arrivals
            </Link>
            <Link
              to="/shop?bestseller=true"
              className="hover:text-[#1E1B4B] transition-colors whitespace-nowrap"
            >
              Best Sellers
            </Link>
            <Link
              to="/shop?deals=true"
              className="hover:text-[#1E1B4B] transition-colors whitespace-nowrap"
            >
              Deals
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setCatDropdownOpen((v) => !v)}
                className="inline-flex items-center gap-1 hover:text-[#1E1B4B] transition-colors whitespace-nowrap"
              >
                Categories <ChevronDown size={14} />
              </button>
              {catDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-[540px] bg-white border border-[#E6EAF2] rounded-xl shadow-xl p-4 grid grid-cols-2 gap-2 z-50">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/category/${cat.slug}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F8F9FC] transition-colors"
                    >
                      <SafeImage
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-10 h-10 rounded-full object-cover bg-[#E6EAF2] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F0D2E] truncate">{cat.name}</p>
                        <p className="text-[11px] text-[#0F0D2E]/55 truncate">
                          {(cat.subcategories || []).slice(0, 2).join(' · ')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link to="/contact" className="hover:text-[#1E1B4B] transition-colors whitespace-nowrap">
              Contact Us
            </Link>
          </div>

          <div className="flex items-center gap-5 text-xs text-[#0F0D2E]/65">
            <Link to="/track-order" className="hover:text-[#E11D48] transition-colors whitespace-nowrap">
              Track Order
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/faq" className="hover:text-[#E11D48] transition-colors whitespace-nowrap">
              Help &amp; FAQ
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to={user?.isAdmin ? '/admin' : '/admin/login'}
              className="font-semibold text-[#1E1B4B] hover:text-[#E11D48] transition-colors whitespace-nowrap"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E6EAF2] bg-white px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E1B4B]/50" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SHAIKCART..."
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-[#F8F9FC] border border-[#E6EAF2] text-sm"
            />
          </form>

          <div className="grid grid-cols-2 gap-2 text-sm font-medium text-[#0F0D2E]">
            <Link to="/" className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">Home</Link>
            <Link to="/shop" className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">All Products</Link>
            <Link to="/shop?newArrival=true" className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">New Arrivals</Link>
            <Link to="/shop?bestseller=true" className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">Best Sellers</Link>
            <Link to="/shop?deals=true" className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">Deals</Link>
            <Link to="/track-order" className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">Track Order</Link>
            <Link to="/contact" className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">Contact Us</Link>
            <Link to={user ? '/account' : '/login'} className="py-2 px-3 rounded-lg hover:bg-[#F8F9FC]">
              {user ? 'My Account' : 'Sign In'}
            </Link>
            <Link
              to={user?.isAdmin ? '/admin' : '/admin/login'}
              className="col-span-2 py-2.5 px-3 rounded-lg bg-[#1E1B4B] text-white text-center font-semibold inline-flex items-center justify-center gap-2"
            >
              <ShieldCheck size={15} />
              Open Admin Panel
            </Link>
          </div>

          <div className="pt-3 border-t border-[#E6EAF2]">
            <p className="text-xs font-semibold text-[#0F0D2E]/55 mb-2">Shop by Category</p>
            <div className="grid grid-cols-2 gap-1.5">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className="text-xs py-1.5 px-2 rounded hover:bg-[#F8F9FC] text-[#1E1B4B]"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
