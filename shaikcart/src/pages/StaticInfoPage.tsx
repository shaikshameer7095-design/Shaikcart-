import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Mail, MapPin, Phone } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { useStore } from '../context/StoreContext';

type StaticSlug =
  | 'about'
  | 'contact'
  | 'faq'
  | 'privacy'
  | 'terms'
  | 'shipping'
  | 'returns'
  | 'cancellation'
  | 'support';

export function StaticInfoPage({ pageKey }: { pageKey: StaticSlug }) {
  const { user, showToast } = useStore();
  const [pagesData, setPagesData] = useState<any>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Contact / Support Ticket Form
  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [category, setCategory] = useState<'order' | 'payment' | 'returns' | 'product' | 'general'>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState('');

  useEffect(() => {
    Promise.all([
      apiRequest<{ value: any }>('/api/cms/static_pages'),
      apiRequest<{ value: any }>('/api/cms/business_info'),
    ])
      .then(([p, b]) => {
        setPagesData(p.value);
        setBusinessInfo(b.value);
      })
      .catch(() => {});
  }, []);

  const titleMap: Record<StaticSlug, string> = {
    about: 'About SHAIKCART',
    contact: 'Contact Us',
    faq: 'Frequently Asked Questions',
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    shipping: 'Shipping Policy',
    returns: 'Return & Refund Policy',
    cancellation: 'Cancellation Policy',
    support: 'Customer Support',
  };

  useSeo({
    title: `${titleMap[pageKey]} — SHAIKCART`,
    description: `${titleMap[pageKey]} for SHAIKCART modern Indian e-commerce platform.`,
  });

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await apiRequest<{ ticketNumber: string; message: string }>('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, category, subject, message }),
      });
      setSubmittedTicket(res.ticketNumber);
      setSubject('');
      setMessage('');
      showToast(res.message);
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit enquiry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageKey === 'contact' || pageKey === 'support') {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 bg-[#0F0D2E] text-[#F8F9FC] rounded-2xl p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#E11D48] mb-2">
                SHAIKCART Concierge
              </p>
              <h1 className="text-2xl font-bold text-white">{titleMap[pageKey]}</h1>
              <p className="text-sm text-[#F8F9FC]/75 mt-2 leading-relaxed">
                Questions about an order, Razorpay payment, PIN code delivery, or return? Raise a tracked support ticket below.
              </p>
            </div>
            <div className="space-y-3 text-sm pt-2 border-t border-white/10">
              <p className="flex items-center gap-2.5">
                <Mail size={16} className="text-[#E11D48]" />
                {businessInfo?.supportEmail || 'support@shaikcart.example'}
              </p>
              <p className="flex items-center gap-2.5">
                <Phone size={16} className="text-[#E11D48]" />
                {businessInfo?.supportPhone || '+91 80 4123 8900'}
              </p>
              <p className="flex items-start gap-2.5">
                <MapPin size={16} className="text-[#E11D48] shrink-0 mt-1" />
                <span>{businessInfo?.address || 'Indiranagar, Bengaluru 560038, India'}</span>
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
            <h2 className="text-lg font-bold text-[#0F0D2E] mb-4">Submit a Support Enquiry</h2>
            {submittedTicket ? (
              <div className="p-6 rounded-xl bg-[#F8F9FC] border border-[#E6EAF2] space-y-2">
                <div className="flex items-center gap-2 text-[#1E1B4B] font-semibold">
                  <CheckCircle2 size={18} /> Ticket {submittedTicket} Created
                </div>
                <p className="text-xs text-[#0F0D2E]/75">
                  Your message has been logged in our support desk and assigned to our customer care team.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedTicket('')}
                  className="text-xs font-semibold text-[#1E1B4B] underline pt-2"
                >
                  Submit another enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm bg-white"
                    >
                      <option value="general">General Enquiry</option>
                      <option value="order">Order &amp; Delivery</option>
                      <option value="payment">Payment &amp; Billing</option>
                      <option value="returns">Returns &amp; Refunds</option>
                      <option value="product">Product Information</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of your request"
                    className="w-full h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Message *</label>
                  <textarea
                    required
                    rows={4}
                    minLength={10}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your order number or question details..."
                    className="w-full p-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E]"
                >
                  {submitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (pageKey === 'faq') {
    const faqs: { q: string; a: string }[] = pagesData?.faq || [];
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-[#0F0D2E] mb-2">Frequently Asked Questions</h1>
        <p className="text-sm text-[#0F0D2E]/65 mb-8">
          Answers on SHAIKCART shipping, Razorpay payments, cancellations, and 15-day returns.
        </p>
        <div className="bg-white rounded-2xl border border-[#E6EAF2] divide-y divide-[#E6EAF2]">
          {faqs.map((item, idx) => (
            <div key={idx} className="p-5">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between text-left gap-4"
              >
                <span className="text-sm font-semibold text-[#0F0D2E]">{item.q}</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-[#1E1B4B] transition-transform ${
                    openFaq === idx ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <p className="text-sm text-[#0F0D2E]/75 leading-relaxed mt-3">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const content = pagesData?.[pageKey];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-8 sm:p-10 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#1E1B4B]">SHAIKCART Policies &amp; Story</p>
        <h1 className="text-3xl font-bold text-[#0F0D2E]">{content?.title || titleMap[pageKey]}</h1>
        {content?.subtitle && <p className="text-base text-[#0F0D2E]/65">{content.subtitle}</p>}
        <div className="pt-4 border-t border-[#E6EAF2] text-sm text-[#0F0D2E]/80 leading-relaxed whitespace-pre-line">
          {content?.body || 'Loading policy details...'}
        </div>
      </div>
    </div>
  );
}
