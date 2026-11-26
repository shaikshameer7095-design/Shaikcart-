import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { apiRequest } from '../lib/api';
import { useStore } from '../context/StoreContext';

export function Footer() {
  const { showToast } = useStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      setSubmitting(true);
      await apiRequest('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSubscribed(true);
      setEmail('');
      showToast('Subscribed to SHAIKCART updates');
    } catch (err: any) {
      showToast(err?.message || 'Unable to subscribe.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#0F0D2E] text-[#F8F9FC] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Brand Summary */}
          <div className="lg:col-span-4 space-y-4">
            <Link to="/">
              <BrandLogo light size="md" />
            </Link>
            <p className="text-sm text-[#F8F9FC]/75 leading-relaxed max-w-sm">
              Thoughtfully selected fashion, homeware, botanical skincare, electronics, and gifts crafted for contemporary Indian living.
            </p>
            <div className="space-y-2 pt-2 text-xs text-[#F8F9FC]/70">
              <p className="flex items-center gap-2">
                <Mail size={14} className="text-[#E11D48] shrink-0" />
                support@shaikcart.example
              </p>
              <p className="flex items-center gap-2">
                <Phone size={14} className="text-[#E11D48] shrink-0" />
                +91 80 4123 8900 (Mon–Sat, 9:30 AM – 7:00 PM IST)
              </p>
              <p className="flex items-start gap-2">
                <MapPin size={14} className="text-[#E11D48] shrink-0 mt-0.5" />
                <span>100 Feet Road, Indiranagar, Bengaluru 560038, India</span>
              </p>
            </div>
          </div>

          {/* Column 1: Shop */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Shop</h3>
            <ul className="space-y-2.5 text-sm text-[#F8F9FC]/75">
              <li><Link to="/shop" className="hover:text-[#E11D48] transition-colors">All Products</Link></li>
              <li><Link to="/shop?newArrival=true" className="hover:text-[#E11D48] transition-colors">New Arrivals</Link></li>
              <li><Link to="/shop?bestseller=true" className="hover:text-[#E11D48] transition-colors">Best Sellers</Link></li>
              <li><Link to="/shop?deals=true" className="hover:text-[#E11D48] transition-colors">Special Deals</Link></li>
              <li><Link to="/category/home-living" className="hover:text-[#E11D48] transition-colors">Home &amp; Living</Link></li>
              <li><Link to="/category/beauty" className="hover:text-[#E11D48] transition-colors">Beauty</Link></li>
            </ul>
          </div>

          {/* Column 2: Customer Help */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Customer Help</h3>
            <ul className="space-y-2.5 text-sm text-[#F8F9FC]/75">
              <li><Link to="/track-order" className="hover:text-[#E11D48] transition-colors">Track Order</Link></li>
              <li><Link to="/return-policy" className="hover:text-[#E11D48] transition-colors">Returns &amp; Refunds</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-[#E11D48] transition-colors">Shipping Information</Link></li>
              <li><Link to="/cancellation-policy" className="hover:text-[#E11D48] transition-colors">Cancellations</Link></li>
              <li><Link to="/faq" className="hover:text-[#E11D48] transition-colors">FAQ</Link></li>
              <li><Link to="/support" className="hover:text-[#E11D48] transition-colors">Customer Support</Link></li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2.5 text-sm text-[#F8F9FC]/75">
              <li><Link to="/about" className="hover:text-[#E11D48] transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-[#E11D48] transition-colors">Contact Us</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-[#E11D48] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-[#E11D48] transition-colors">Terms of Service</Link></li>
              <li>
                <Link to="/admin/login" className="inline-flex items-center gap-1.5 hover:text-[#E11D48] transition-colors">
                  <ShieldCheck size={14} /> Admin Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Stay in the Loop</h3>
            <p className="text-xs text-[#F8F9FC]/70 mb-3 leading-relaxed">
              Early access to seasonal collections and member-only savings.
            </p>
            {subscribed ? (
              <div className="flex items-center gap-2 text-xs text-[#E11D48] py-2">
                <CheckCircle2 size={16} /> Subscribed cleanly.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  aria-label="Newsletter email address"
                  className="w-full h-9 px-3 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/50 focus:bg-white/15 focus:border-[#E11D48] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-9 px-3 rounded-lg bg-[#E11D48] text-white text-xs font-semibold hover:bg-[#F43F5E] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Joining...' : 'Subscribe'} <ArrowRight size={14} />
                </button>
              </form>
            )}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[11px] text-[#F8F9FC]/60">SHAIKCART Mobile App — Coming soon on iOS &amp; Android</p>
            </div>
          </div>
        </div>

        {/* Bottom Payment Methods & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#F8F9FC]/60">
          <p>© {new Date().getFullYear()} SHAIKCART Retail Pvt. Ltd. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] tracking-wide text-[#F8F9FC]/75">
            <span>Razorpay Secured</span>
            <span aria-hidden="true">·</span>
            <span>UPI</span>
            <span aria-hidden="true">·</span>
            <span>Visa / Mastercard / RuPay</span>
            <span aria-hidden="true">·</span>
            <span>Net Banking</span>
            <span aria-hidden="true">·</span>
            <span>Cash on Delivery</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/shipping-policy" className="hover:text-white transition-colors">Shipping</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
