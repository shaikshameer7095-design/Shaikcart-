import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Package, Search, Truck } from 'lucide-react';
import { apiRequest, formatINR } from '../lib/api';
import { useStore } from '../context/StoreContext';
import { useSeo } from '../hooks/useSeo';
import type { Order, OrderItem, Shipment } from '../types';

const TRACKING_STAGES = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

export function OrderTrackingPage() {
  const [searchParams] = useSearchParams();
  const { user } = useStore();

  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderNumber') || '');
  const [email, setEmail] = useState(user?.email || '');
  const [result, setResult] = useState<{
    order: Order;
    items: OrderItem[];
    shipment: Shipment | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useSeo({
    title: 'Track Your Order — SHAIKCART',
    description: 'Track your SHAIKCART order shipment milestones and delivery status in real time.',
  });

  const fetchTracking = async (ordNo: string, em: string) => {
    if (!ordNo.trim()) return;
    try {
      setLoading(true);
      setError('');
      const qs = new URLSearchParams({ orderNumber: ordNo.trim() });
      if (em.trim()) qs.set('email', em.trim());
      const data = await apiRequest<{ order: Order; items: OrderItem[]; shipment: Shipment | null }>(
        `/api/orders/track?${qs.toString()}`
      );
      setResult(data);
    } catch (err: any) {
      setResult(null);
      setError(err?.message || 'Unable to locate order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const prefill = searchParams.get('orderNumber');
    if (prefill) {
      setOrderNumber(prefill);
      if (user) {
        fetchTracking(prefill, user.email);
      }
    }
  }, [searchParams, user]);

  const currentStageIndex = result
    ? Math.max(
        0,
        TRACKING_STAGES.findIndex((s) => s.key === result.order.orderStatus)
      )
    : -1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <Truck size={22} className="text-[#1E1B4B]" />
          <h1 className="text-2xl font-bold text-[#0F0D2E]">Track Your Order</h1>
        </div>
        <p className="text-sm text-[#0F0D2E]/65 mb-6">
          Enter your SHAIKCART Order Number and registered email address to view authentic fulfillment status.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchTracking(orderNumber, email);
          }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <input
            type="text"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="Order Number (e.g. SC261125-A1B2C3)"
            className="sm:col-span-5 h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm font-mono"
          />
          <input
            type="email"
            required={!user}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={user ? `${user.email} (signed in)` : 'Registered Email Address'}
            className="sm:col-span-5 h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 h-11 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E] inline-flex items-center justify-center gap-1.5"
          >
            <Search size={15} /> {loading ? '...' : 'Track'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E6EAF2]">
            <div>
              <p className="text-xs text-[#0F0D2E]/55">Order Number</p>
              <h2 className="text-xl font-bold font-mono text-[#0F0D2E]">{result.order.orderNumber}</h2>
              <p className="text-xs text-[#0F0D2E]/60 mt-1">
                Placed on {new Date(result.order.createdAt).toLocaleString('en-IN')} · Payment:{' '}
                <strong className="capitalize">{result.order.paymentStatus.replace(/_/g, ' ')}</strong> (
                {result.order.paymentMethod.toUpperCase()})
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#0F0D2E]/55">Order Total</p>
              <p className="text-xl font-bold text-[#1E1B4B] tabular-nums">
                {formatINR(result.order.totalAmount)}
              </p>
              {result.shipment?.estimatedDelivery && (
                <p className="text-xs text-[#0F0D2E]/65 mt-0.5">
                  Est. Delivery: {result.shipment.estimatedDelivery}
                </p>
              )}
            </div>
          </div>

          {/* 6-Stage Progress Timeline */}
          {['cancelled', 'returned'].includes(result.order.orderStatus) ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 font-medium capitalize">
              This order status is currently: {result.order.orderStatus}.
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-[#0F0D2E] mb-5">Delivery Progress</h3>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {TRACKING_STAGES.map((st, idx) => {
                  const completed = idx <= currentStageIndex;
                  return (
                    <div key={st.key} className="flex flex-col items-center text-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          completed
                            ? 'bg-[#1E1B4B] text-white'
                            : 'bg-[#F8F9FC] border border-[#E6EAF2] text-[#0F0D2E]/45'
                        }`}
                      >
                        {completed ? <Check size={15} /> : idx + 1}
                      </div>
                      <span
                        className={`text-xs leading-tight ${
                          completed ? 'font-semibold text-[#0F0D2E]' : 'text-[#0F0D2E]/45'
                        }`}
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Courier Details (Only shown if actually entered by admin) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E6EAF2]">
            <div className="p-4 rounded-xl bg-[#F8F9FC]/60 border border-[#E6EAF2] text-xs space-y-1.5">
              <p className="font-semibold text-[#0F0D2E]">Shipping Destination</p>
              <p className="text-[#0F0D2E]/80">{result.order.shippingAddress.fullName}</p>
              <p className="text-[#0F0D2E]/70">
                {result.order.shippingAddress.addressLine1}
                {result.order.shippingAddress.addressLine2
                  ? `, ${result.order.shippingAddress.addressLine2}`
                  : ''}
              </p>
              <p className="text-[#0F0D2E]/70">
                {result.order.shippingAddress.city}, {result.order.shippingAddress.state} —{' '}
                {result.order.shippingAddress.pincode}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F8F9FC]/60 border border-[#E6EAF2] text-xs space-y-1.5">
              <p className="font-semibold text-[#0F0D2E] flex items-center gap-1.5">
                <Package size={14} className="text-[#1E1B4B]" /> Courier &amp; AWB Details
              </p>
              {result.shipment?.trackingNumber ? (
                <>
                  <p>
                    Courier: <strong>{result.shipment.courierName || 'Assigned Partner'}</strong>
                  </p>
                  <p className="font-mono">Tracking #: {result.shipment.trackingNumber}</p>
                  {result.shipment.trackingUrl && (
                    <a
                      href={result.shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1E1B4B] underline inline-block mt-1"
                    >
                      Open Courier Tracking Link
                    </a>
                  )}
                </>
              ) : (
                <p className="text-[#0F0D2E]/65">
                  Courier partner and tracking number will appear here as soon as your parcel is dispatched from our fulfillment center.
                </p>
              )}
            </div>
          </div>

          {/* Recorded Milestones Log */}
          {result.shipment?.timeline && result.shipment.timeline.length > 0 && (
            <div className="pt-4 border-t border-[#E6EAF2]">
              <h3 className="text-sm font-semibold text-[#0F0D2E] mb-3">Shipment Activity</h3>
              <ul className="space-y-3">
                {result.shipment.timeline.map((ev, i) => (
                  <li key={i} className="text-xs flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#0F0D2E]">{ev.label}</p>
                      {ev.note && <p className="text-[#0F0D2E]/65 mt-0.5">{ev.note}</p>}
                    </div>
                    <span className="text-[#0F0D2E]/50 whitespace-nowrap tabular-nums">
                      {new Date(ev.timestamp).toLocaleString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Items */}
          <div className="pt-4 border-t border-[#E6EAF2]">
            <h3 className="text-sm font-semibold text-[#0F0D2E] mb-3">Items in Order</h3>
            <div className="divide-y divide-[#E6EAF2]">
              {result.items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                  <span>
                    {item.productNameSnapshot} × {item.quantity}
                  </span>
                  <span className="font-semibold tabular-nums">{formatINR(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
