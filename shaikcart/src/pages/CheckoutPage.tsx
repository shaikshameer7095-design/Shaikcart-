import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR, loadRazorpayCheckoutScript } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { SafeImage } from '../components/BrandLogo';
import type { Address } from '../types';

interface PaymentConfig {
  razorpayConfigured: boolean;
  razorpayMode: 'test' | 'live';
  razorpayKeyId: string | null;
  razorpayEnabled: boolean;
  codEnabled: boolean;
  codMaxOrderAmount: number;
  gstRatePercent: number;
  freeShippingThreshold: number;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, cart, refreshCart, showToast } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);

  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  const [notes, setNotes] = useState('');

  const [zoneInfo, setZoneInfo] = useState<{
    serviceable: boolean;
    shippingCharge: number;
    freeShippingThreshold: number;
    estimatedDays: string;
    codEnabled: boolean;
    regionName?: string;
  } | null>(null);

  const [couponCode, setCouponCode] = useState(searchParams.get('coupon') || '');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('cod');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const idempotencyKeyRef = useRef(
    `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  );

  useSeo({
    title: 'Secure Checkout — SHAIKCART',
    description: 'Complete your SHAIKCART order securely with Razorpay UPI, Cards, Net Banking, or Cash on Delivery.',
  });

  useEffect(() => {
    apiRequest<PaymentConfig>('/api/payments/config')
      .then((cfg) => {
        setPaymentConfig(cfg);
        if (cfg.razorpayConfigured && cfg.razorpayEnabled) {
          setPaymentMethod('razorpay');
        } else {
          setPaymentMethod('cod');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.fullName);
      if (!customerEmail) setCustomerEmail(user.email);
      if (!customerPhone) setCustomerPhone(user.phone);
      apiRequest<{ addresses: Address[] }>('/api/account/addresses')
        .then((res) => {
          setSavedAddresses(res.addresses || []);
          const def = res.addresses?.find((a) => a.isDefault) || res.addresses?.[0];
          if (def && !addressLine1) {
            setAddressLine1(def.addressLine1);
            setAddressLine2(def.addressLine2 || '');
            setCity(def.city);
            setStateName(def.state);
            setPincode(def.pincode);
            setCountry(def.country || 'India');
            if (!customerPhone && def.phone) setCustomerPhone(def.phone);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (/^[1-9][0-9]{5}$/.test(pincode)) {
      apiRequest<any>(`/api/shipping/check-pincode?pincode=${pincode}`)
        .then((res) => setZoneInfo(res))
        .catch(() => setZoneInfo(null));
    } else {
      setZoneInfo(null);
    }
  }, [pincode]);

  useEffect(() => {
    if (couponCode && cart.subtotal > 0) {
      apiRequest<{ discountAmount: number; code: string; description: string }>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode,
          subtotal: cart.subtotal,
          categorySlugs: cart.items.map((i) => i.categorySlug).filter(Boolean),
        }),
      })
        .then((res) => {
          setDiscountAmount(res.discountAmount);
          setCouponMessage(`Applied ${res.code} (-${formatINR(res.discountAmount)})`);
        })
        .catch(() => {
          setDiscountAmount(0);
          setCouponMessage('');
        });
    }
  }, [couponCode, cart.subtotal]);

  const gstRate = paymentConfig?.gstRatePercent ?? 12;
  const freeThreshold = zoneInfo?.freeShippingThreshold ?? paymentConfig?.freeShippingThreshold ?? 1499;
  const baseShipping = zoneInfo?.shippingCharge ?? 99;
  const discountedSubtotal = Math.max(0, cart.subtotal - discountAmount);
  const shippingFee = discountedSubtotal >= freeThreshold ? 0 : baseShipping;
  const taxAmount = Math.round((discountedSubtotal * gstRate) / 100);
  const finalTotal = discountedSubtotal + shippingFee + taxAmount;

  const validateStep1 = () => {
    if (customerName.trim().length < 2) return 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) return 'Please enter a valid email address.';
    if (customerPhone.replace(/\D/g, '').length < 10) return 'Please enter a valid 10-digit Indian phone number.';
    return '';
  };

  const validateStep2 = () => {
    if (addressLine1.trim().length < 4) return 'Please enter your street address.';
    if (!/^[1-9][0-9]{5}$/.test(pincode.trim())) return 'Please enter a valid 6-digit Indian PIN code.';
    if (city.trim().length < 2) return 'Please enter your city.';
    if (stateName.trim().length < 2) return 'Please enter your state.';
    if (zoneInfo && !zoneInfo.serviceable) return 'This PIN code is currently not serviceable.';
    return '';
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await apiRequest<{ discountAmount: number; code: string }>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotal: cart.subtotal,
          categorySlugs: cart.items.map((i) => i.categorySlug).filter(Boolean),
        }),
      });
      setDiscountAmount(res.discountAmount);
      setCouponMessage(`Applied ${res.code} (-${formatINR(res.discountAmount)})`);
      showToast(`Coupon ${res.code} applied`);
    } catch (err: any) {
      setDiscountAmount(0);
      setCouponMessage(err?.message || 'Invalid coupon.');
    }
  };

  const handlePlaceOrder = async () => {
    setError('');
    const err1 = validateStep1();
    if (err1) {
      setStep(1);
      setError(err1);
      return;
    }
    const err2 = validateStep2();
    if (err2) {
      setStep(2);
      setError(err2);
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the SHAIKCART Terms & Conditions to place your order.');
      return;
    }

    try {
      setPlacing(true);
      const response = await apiRequest<{
        order: { orderNumber: string; totalAmount: number; paymentMethod: string };
        razorpayOrder: { id: string; amount: number; currency: string; keyId: string } | null;
      }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          addressLine1,
          addressLine2,
          city,
          state: stateName,
          pincode,
          country,
          paymentMethod,
          couponCode: discountAmount > 0 ? couponCode.trim().toUpperCase() : null,
          idempotencyKey: idempotencyKeyRef.current,
          notes,
          acceptedTerms: true,
        }),
      });

      if (paymentMethod === 'cod') {
        await refreshCart();
        navigate(
          `/payment-status/success?orderNumber=${encodeURIComponent(response.order.orderNumber)}&method=cod`
        );
        return;
      }

      // Razorpay Flow — Strictly verify via Razorpay Checkout + Server HMAC Verification
      if (!response.razorpayOrder?.id || !response.razorpayOrder?.keyId) {
        navigate(
          `/payment-status/pending?orderNumber=${encodeURIComponent(response.order.orderNumber)}`
        );
        return;
      }

      const loaded = await loadRazorpayCheckoutScript();
      if (!loaded || !(window as any).Razorpay) {
        setError('Unable to load Razorpay Checkout SDK. Check your internet connection and retry.');
        setPlacing(false);
        return;
      }

      const rzp = new (window as any).Razorpay({
        key: response.razorpayOrder.keyId,
        amount: response.razorpayOrder.amount,
        currency: response.razorpayOrder.currency,
        name: 'SHAIKCART',
        description: `Order ${response.order.orderNumber}`,
        order_id: response.razorpayOrder.id,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: { color: '#1E1B4B' },
        handler: async (rzpRes: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await apiRequest('/api/payments/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                orderNumber: response.order.orderNumber,
                ...rzpRes,
              }),
            });
            await refreshCart();
            navigate(
              `/payment-status/success?orderNumber=${encodeURIComponent(
                response.order.orderNumber
              )}&paymentId=${encodeURIComponent(rzpRes.razorpay_payment_id)}&method=razorpay`
            );
          } catch (verifyErr: any) {
            navigate(
              `/payment-status/failed?orderNumber=${encodeURIComponent(
                response.order.orderNumber
              )}&reason=${encodeURIComponent(verifyErr?.message || 'Verification failed')}`
            );
          }
        },
        modal: {
          ondismiss: async () => {
            setPlacing(false);
            navigate(
              `/payment-status/pending?orderNumber=${encodeURIComponent(response.order.orderNumber)}`
            );
          },
        },
      });

      rzp.on('payment.failed', async (failEvent: any) => {
        const reason = failEvent?.error?.description || 'Payment declined by bank/UPI';
        await apiRequest('/api/payments/razorpay/failed', {
          method: 'POST',
          body: JSON.stringify({ orderNumber: response.order.orderNumber, reason }),
        }).catch(() => {});
        navigate(
          `/payment-status/failed?orderNumber=${encodeURIComponent(
            response.order.orderNumber
          )}&reason=${encodeURIComponent(reason)}`
        );
      });

      rzp.open();
    } catch (err: any) {
      setError(err?.message || 'Unable to place order right now.');
      // Generate fresh idempotency key on retryable validation/config error
      idempotencyKeyRef.current = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      setPlacing(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-2xl border border-[#E6EAF2] p-10">
          <h1 className="text-2xl font-bold text-[#0F0D2E] mb-2">Your cart is empty</h1>
          <p className="text-sm text-[#0F0D2E]/65 mb-6">
            Add products to your bag before proceeding to checkout.
          </p>
          <Link
            to="/shop"
            className="inline-block px-6 py-3 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium"
          >
            Browse Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F0D2E]">Secure Checkout</h1>
          <p className="text-xs text-[#0F0D2E]/60 mt-1 flex items-center gap-1.5">
            <Lock size={13} className="text-[#1E1B4B]" /> Totals verified on server · Razorpay &amp; COD supported
          </p>
        </div>

        {/* 4-Step Progress Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {[
            [1, 'Contact'],
            [2, 'Shipping'],
            [3, 'Review'],
            [4, 'Payment'],
          ].map(([num, label]) => {
            const active = step === num;
            const done = step > Number(num);
            return (
              <button
                key={String(num)}
                type="button"
                onClick={() => setStep(num as 1 | 2 | 3 | 4)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#1E1B4B] text-white font-semibold'
                    : done
                    ? 'bg-[#E6EAF2] text-[#1E1B4B] font-medium'
                    : 'bg-white border border-[#E6EAF2] text-[#0F0D2E]/60'
                }`}
              >
                {done ? <Check size={12} /> : <span className="tabular-nums">{num}.</span>}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Multi-step Checkout Forms */}
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Customer Information */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#0F0D2E]">1. Customer Information</h2>
                {!user && (
                  <Link to="/login" className="text-xs font-medium text-[#1E1B4B] hover:underline">
                    Have an account? Sign In
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const msg = validateStep1();
                    if (msg) setError(msg);
                    else {
                      setError('');
                      setStep(2);
                    }
                  }}
                  className="px-6 py-3 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E]"
                >
                  Continue to Shipping
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Shipping Address */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-5">
              <h2 className="text-lg font-bold text-[#0F0D2E]">2. Delivery Address</h2>

              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#0F0D2E]/65">Choose a Saved Address</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setCustomerName(addr.fullName);
                          setCustomerPhone(addr.phone);
                          setAddressLine1(addr.addressLine1);
                          setAddressLine2(addr.addressLine2 || '');
                          setCity(addr.city);
                          setStateName(addr.state);
                          setPincode(addr.pincode);
                          setCountry(addr.country || 'India');
                        }}
                        className="text-left p-3.5 rounded-xl border border-[#E6EAF2] hover:border-[#1E1B4B] bg-[#F8F9FC]/40 text-xs"
                      >
                        <p className="font-semibold text-[#0F0D2E]">{addr.label} · {addr.fullName}</p>
                        <p className="text-[#0F0D2E]/70 mt-0.5">
                          {addr.addressLine1}, {addr.city}, {addr.state} — {addr.pincode}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Address Line 1 *</label>
                  <input
                    type="text"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="House / Flat No., Building, Street"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Address Line 2 / Landmark</label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Apartment, Area, Landmark (optional)"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">PIN Code (6 digits) *</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="560038"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">State *</label>
                  <input
                    type="text"
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="Karnataka"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm bg-[#F8F9FC]/40"
                  />
                </div>
              </div>

              {zoneInfo && (
                <div className="p-3.5 rounded-xl bg-[#F8F9FC] text-xs text-[#1E1B4B] flex items-center gap-2">
                  <Truck size={15} />
                  {zoneInfo.serviceable ? (
                    <span>
                      <strong>{zoneInfo.regionName}</strong> · Est. {zoneInfo.estimatedDays} ·{' '}
                      {zoneInfo.codEnabled ? 'COD Eligible' : 'Prepaid Only'}
                    </span>
                  ) : (
                    <span className="text-red-700">This PIN code is not serviceable.</span>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-lg border border-[#E6EAF2] text-sm font-medium text-[#0F0D2E]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const msg = validateStep2();
                    if (msg) setError(msg);
                    else {
                      setError('');
                      setStep(3);
                    }
                  }}
                  className="px-6 py-3 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E]"
                >
                  Review Order
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Order Review */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-5">
              <h2 className="text-lg font-bold text-[#0F0D2E]">3. Review Your Order</h2>

              <div className="p-4 rounded-xl bg-[#F8F9FC]/60 border border-[#E6EAF2] text-xs space-y-1">
                <p className="font-semibold text-[#0F0D2E] flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#1E1B4B]" /> Delivering to {customerName}
                </p>
                <p className="text-[#0F0D2E]/75">
                  {addressLine1}
                  {addressLine2 ? `, ${addressLine2}` : ''}, {city}, {stateName} — {pincode}, {country}
                </p>
                <p className="text-[#0F0D2E]/60">
                  {customerEmail} · {customerPhone}
                </p>
              </div>

              <div className="divide-y divide-[#E6EAF2]">
                {cart.items.map((item) => (
                  <div key={item.id} className="py-3 flex items-center gap-4">
                    <SafeImage
                      src={item.primaryImage}
                      alt={item.name}
                      className="w-14 h-14 rounded-lg object-cover bg-[#E6EAF2] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F0D2E] truncate">{item.name}</p>
                      <p className="text-xs text-[#0F0D2E]/55">
                        Qty {item.quantity}
                        {item.selectedColor ? ` · ${item.selectedColor}` : ''}
                        {item.selectedSize ? ` · ${item.selectedSize}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#1E1B4B] tabular-nums">
                      {formatINR(item.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">
                  Delivery Note / Gift Message (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional instructions for delivery executive..."
                  className="w-full h-10 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-lg border border-[#E6EAF2] text-sm font-medium text-[#0F0D2E]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-6 py-3 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E]"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Payment Methods (Razorpay + COD) */}
          {step === 4 && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-5">
              <h2 className="text-lg font-bold text-[#0F0D2E]">4. Select Payment Method</h2>

              <div className="space-y-3">
                {/* Razorpay Option */}
                <label
                  className={`block p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    paymentMethod === 'razorpay'
                      ? 'border-[#1E1B4B] bg-[#F8F9FC]/50'
                      : 'border-[#E6EAF2] hover:border-[#1E1B4B]/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="razorpay"
                      checked={paymentMethod === 'razorpay'}
                      onChange={() => setPaymentMethod('razorpay')}
                      className="mt-1 accent-[#1E1B4B]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#0F0D2E] flex items-center gap-2">
                          <CreditCard size={16} className="text-[#1E1B4B]" />
                          Razorpay — UPI, Cards, Net Banking &amp; Wallets
                        </span>
                        <span className="text-[11px] font-medium text-[#1E1B4B]">
                          {paymentConfig?.razorpayConfigured
                            ? paymentConfig.razorpayMode === 'live'
                              ? 'Live Mode'
                              : 'Test Mode Active'
                            : 'Requires Server Keys'}
                        </span>
                      </div>
                      <p className="text-xs text-[#0F0D2E]/65 mt-1">
                        Pay securely via Google Pay, PhonePe, Paytm UPI, Visa, Mastercard, RuPay, or Indian Net Banking with server-side Razorpay signature verification.
                      </p>
                      {paymentConfig && !paymentConfig.razorpayConfigured && (
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2.5">
                          Razorpay Test/Live API keys (<code className="font-mono">RAZORPAY_KEY_ID</code> &amp;{' '}
                          <code className="font-mono">RAZORPAY_KEY_SECRET</code>) are not set in environment secrets yet. Add them to enable online Razorpay Checkout, or choose Cash on Delivery below.
                        </p>
                      )}
                    </div>
                  </div>
                </label>

                {/* Cash on Delivery Option */}
                {paymentConfig?.codEnabled !== false && (
                  <label
                    className={`block p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      paymentMethod === 'cod'
                        ? 'border-[#1E1B4B] bg-[#F8F9FC]/50'
                        : 'border-[#E6EAF2] hover:border-[#1E1B4B]/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="mt-1 accent-[#1E1B4B]"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-[#0F0D2E] flex items-center gap-2">
                          <Truck size={16} className="text-[#1E1B4B]" />
                          Cash on Delivery (COD)
                        </span>
                        <p className="text-xs text-[#0F0D2E]/65 mt-1">
                          Pay in cash or UPI upon doorstep delivery across serviceable Indian PIN codes (orders up to{' '}
                          {formatINR(paymentConfig?.codMaxOrderAmount || 25000)}).
                        </p>
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {/* Terms Acceptance */}
              <label className="flex items-start gap-2.5 text-xs text-[#0F0D2E]/80 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 accent-[#1E1B4B]"
                />
                <span>
                  I confirm my order details and agree to the SHAIKCART{' '}
                  <Link to="/terms" className="text-[#1E1B4B] underline">
                    Terms &amp; Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/return-policy" className="text-[#1E1B4B] underline">
                    Return &amp; Refund Policy
                  </Link>
                  .
                </span>
              </label>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2.5 rounded-lg border border-[#E6EAF2] text-sm font-medium text-[#0F0D2E]"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={placing}
                  onClick={handlePlaceOrder}
                  className="px-7 py-3.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E] disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <ShieldCheck size={17} />
                  {placing
                    ? 'Processing Order...'
                    : paymentMethod === 'razorpay'
                    ? `Pay ${formatINR(finalTotal)} with Razorpay`
                    : `Place Order (${formatINR(finalTotal)})`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Persistent Order Summary Sidebar */}
        <aside className="lg:col-span-4 bg-white rounded-2xl border border-[#E6EAF2] p-6 space-y-5 sticky top-28">
          <h2 className="text-base font-bold text-[#0F0D2E]">Order Summary ({cart.itemCount})</h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Coupon code (WELCOME10)"
              className="flex-1 h-9 px-3 rounded-lg border border-[#E6EAF2] text-xs font-mono uppercase"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="px-3.5 h-9 rounded-lg bg-[#F8F9FC] text-[#1E1B4B] text-xs font-semibold hover:bg-[#E6EAF2]"
            >
              Apply
            </button>
          </div>
          {couponMessage && (
            <p className="text-xs text-[#1E1B4B] flex items-center gap-1.5">
              <CheckCircle2 size={13} /> {couponMessage}
            </p>
          )}

          <div className="space-y-2.5 pt-3 border-t border-[#E6EAF2] text-sm">
            <div className="flex justify-between text-[#0F0D2E]/75">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium">{formatINR(cart.subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#1E1B4B]">
                <span>Coupon Discount</span>
                <span className="tabular-nums font-medium">-{formatINR(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#0F0D2E]/75">
              <span>Shipping</span>
              <span className="tabular-nums font-medium">
                {shippingFee === 0 ? 'Free' : formatINR(shippingFee)}
              </span>
            </div>
            <div className="flex justify-between text-[#0F0D2E]/75">
              <span>GST ({gstRate}%)</span>
              <span className="tabular-nums font-medium">{formatINR(taxAmount)}</span>
            </div>
            <div className="pt-3 border-t border-[#E6EAF2] flex justify-between text-base font-bold text-[#0F0D2E]">
              <span>Final Payable</span>
              <span className="tabular-nums text-[#1E1B4B]">{formatINR(finalTotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
