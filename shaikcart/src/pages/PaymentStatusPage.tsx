import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, RefreshCcw, XCircle } from 'lucide-react';
import { useSeo } from '../hooks/useSeo';

export function PaymentStatusPage() {
  const { status = 'success' } = useParams<{ status: string }>();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber') || '';
  const paymentId = searchParams.get('paymentId') || '';
  const method = searchParams.get('method') || '';
  const reason = searchParams.get('reason') || '';

  const configs: Record<
    string,
    { title: string; subtitle: string; icon: React.ReactNode; tone: string }
  > = {
    success: {
      title: method === 'cod' ? 'Order Confirmed' : 'Payment Successful',
      subtitle:
        method === 'cod'
          ? 'Your Cash on Delivery order has been confirmed and queued for packing.'
          : 'Your Razorpay payment has been cryptographically verified and your order is confirmed.',
      icon: <CheckCircle2 size={40} className="text-[#1E1B4B]" />,
      tone: 'bg-[#F8F9FC]',
    },
    failed: {
      title: 'Payment Failed',
      subtitle:
        reason ||
        'The payment was declined or could not be verified by Razorpay. No amount was captured for this order.',
      icon: <XCircle size={40} className="text-red-600" />,
      tone: 'bg-red-50',
    },
    pending: {
      title: 'Payment Pending Verification',
      subtitle:
        'Your order has been created, but payment confirmation from Razorpay has not completed yet. Do not place a duplicate order until you check status.',
      icon: <Clock size={40} className="text-amber-600" />,
      tone: 'bg-amber-50',
    },
    refund: {
      title: 'Refund Status',
      subtitle:
        'Approved Razorpay refunds are processed back to your original payment instrument within 5–7 business days.',
      icon: <RefreshCcw size={40} className="text-[#1E1B4B]" />,
      tone: 'bg-[#F8F9FC]',
    },
  };

  const cfg = configs[status] || configs.pending;

  useSeo({ title: `${cfg.title} — SHAIKCART` });

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-8 sm:p-10 text-center space-y-5">
        <div className={`w-20 h-20 rounded-full ${cfg.tone} flex items-center justify-center mx-auto`}>
          {cfg.icon}
        </div>
        <h1 className="text-2xl font-bold text-[#0F0D2E]">{cfg.title}</h1>
        <p className="text-sm text-[#0F0D2E]/70 leading-relaxed">{cfg.subtitle}</p>

        {(orderNumber || paymentId) && (
          <div className="bg-[#F8F9FC]/70 rounded-xl border border-[#E6EAF2] p-4 text-xs text-left space-y-1.5">
            {orderNumber && (
              <div className="flex justify-between">
                <span className="text-[#0F0D2E]/60">Order Number</span>
                <span className="font-mono font-semibold text-[#0F0D2E]">{orderNumber}</span>
              </div>
            )}
            {paymentId && (
              <div className="flex justify-between">
                <span className="text-[#0F0D2E]/60">Razorpay Transaction ID</span>
                <span className="font-mono font-semibold text-[#1E1B4B]">{paymentId}</span>
              </div>
            )}
            {method && (
              <div className="flex justify-between">
                <span className="text-[#0F0D2E]/60">Payment Method</span>
                <span className="font-medium uppercase text-[#0F0D2E]">{method}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          {orderNumber && (
            <Link
              to={`/track-order?orderNumber=${encodeURIComponent(orderNumber)}`}
              className="px-5 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium hover:bg-[#0F0D2E]"
            >
              Track Order
            </Link>
          )}
          {status === 'failed' ? (
            <Link
              to="/checkout"
              className="px-5 py-2.5 rounded-lg border border-[#1E1B4B] text-[#1E1B4B] text-sm font-medium hover:bg-[#F8F9FC]"
            >
              Retry Payment
            </Link>
          ) : (
            <Link
              to="/shop"
              className="px-5 py-2.5 rounded-lg border border-[#E6EAF2] text-[#0F0D2E] text-sm font-medium hover:bg-[#F8F9FC]"
            >
              Continue Shopping
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
