import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Info,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Star,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { apiRequest, formatINR } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import type { Order, WebsiteBanner } from '../../types';

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
] as const;

// ======================= 1. ORDERS & FULFILLMENT =======================
export function AdminOrdersTab() {
  const { showToast } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printMode, setPrintMode] = useState(false);

  // Fulfillment form
  const [nextStatus, setNextStatus] = useState('confirmed');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const data = await apiRequest<{ orders: Order[] }>(`/api/admin/orders${q}`);
      setOrders(data.orders || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrder = (o: Order) => {
    setSelectedOrder(o);
    setPrintMode(false);
    setNextStatus(o.orderStatus);
    setCourierName(o.shipment?.courierName || 'BlueDart Express');
    setTrackingNumber(o.shipment?.trackingNumber || '');
    setTrackingUrl(o.shipment?.trackingUrl || '');
    setEstimatedDelivery(o.shipment?.estimatedDelivery || '3-5 business days');
    setNote('');
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      setSaving(true);
      await apiRequest(`/api/admin/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          orderStatus: nextStatus,
          courierName,
          trackingNumber,
          trackingUrl,
          estimatedDelivery,
          note,
        }),
      });
      showToast(`Order ${selectedOrder.orderNumber} updated to ${nextStatus.replace('_', ' ')}`);
      setSelectedOrder(null);
      await loadOrders();
    } catch (err: any) {
      showToast(err?.message || 'Unable to update order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            statusFilter === ''
              ? 'bg-[#1E1B4B] text-white'
              : 'bg-white border border-[#E6EAF2] text-[#0F0D2E]/75 hover:bg-[#F8F9FC]'
          }`}
        >
          All Orders
        </button>
        {ORDER_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
              statusFilter === st
                ? 'bg-[#1E1B4B] text-white'
                : 'bg-white border border-[#E6EAF2] text-[#0F0D2E]/75 hover:bg-[#F8F9FC]'
            }`}
          >
            {st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FC]/70 text-[11px] uppercase tracking-wider text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Total (INR)</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Fulfillment</th>
                <th className="py-3 px-4 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2]/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#0F0D2E]/50">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#0F0D2E]/50">
                    No orders found for this filter.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F8F9FC]/30">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-[#1E1B4B]">
                        {o.orderNumber}
                      </div>
                      <div className="text-[11px] text-[#0F0D2E]/50">
                        {new Date(o.createdAt).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#0F0D2E] text-xs">{o.customerName}</div>
                      <div className="text-[11px] text-[#0F0D2E]/55">{o.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#0F0D2E]/75">
                      {o.items?.reduce((s, i) => s + i.quantity, 0) || 0} item(s)
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#0F0D2E]">
                      {formatINR(o.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="uppercase font-medium text-[#0F0D2E]">{o.paymentMethod}</div>
                      <div
                        className={`text-[11px] capitalize ${
                          o.paymentStatus === 'paid'
                            ? 'text-emerald-700'
                            : o.paymentStatus === 'failed'
                              ? 'text-red-600'
                              : 'text-amber-700'
                        }`}
                      >
                        {o.paymentStatus}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-1 rounded text-[11px] font-semibold capitalize bg-[#F8F9FC] text-[#1E1B4B]">
                        {o.orderStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openOrder(o)}
                        className="px-3 py-1.5 rounded-lg border border-[#1E1B4B] text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Inspect / Ship
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail & Invoice Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 border border-[#E6EAF2]">
            <div className="flex items-center justify-between border-b border-[#E6EAF2] pb-3 print:hidden">
              <div>
                <h3 className="text-lg font-bold text-[#0F0D2E] font-mono">
                  {selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-[#0F0D2E]/60">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrintMode(true);
                    window.setTimeout(() => window.print(), 120);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EAF2] hover:bg-[#F8F9FC] text-xs font-semibold text-[#0F0D2E] cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Tax Invoice
                </button>
                <button type="button" onClick={() => setSelectedOrder(null)}>
                  <X className="w-5 h-5 text-[#0F0D2E]/60" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Header */}
            <div className={printMode ? 'block' : 'block'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8F9FC]/50 p-4 rounded-xl text-xs">
                <div>
                  <p className="font-bold text-[#1E1B4B] uppercase tracking-wider text-[10px] mb-1">
                    Shipping Destination
                  </p>
                  <p className="font-semibold text-[#0F0D2E]">{selectedOrder.shippingAddress?.fullName}</p>
                  <p className="text-[#0F0D2E]/75">{selectedOrder.shippingAddress?.addressLine1}</p>
                  {selectedOrder.shippingAddress?.addressLine2 && (
                    <p className="text-[#0F0D2E]/75">{selectedOrder.shippingAddress.addressLine2}</p>
                  )}
                  <p className="text-[#0F0D2E]/75">
                    {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} —{' '}
                    <span className="font-mono">{selectedOrder.shippingAddress?.pincode}</span>
                  </p>
                  <p className="text-[#0F0D2E]/75 mt-1">Phone: {selectedOrder.customerPhone}</p>
                </div>
                <div className="sm:text-right">
                  <p className="font-bold text-[#1E1B4B] uppercase tracking-wider text-[10px] mb-1">
                    SHAIKCART GST Tax Summary
                  </p>
                  <p>Subtotal: {formatINR(selectedOrder.subtotal)}</p>
                  {selectedOrder.discountAmount > 0 && (
                    <p className="text-emerald-700">
                      Discount ({selectedOrder.couponCode}): −{formatINR(selectedOrder.discountAmount)}
                    </p>
                  )}
                  <p>Shipping: {formatINR(selectedOrder.shippingFee)}</p>
                  <p>GST Included: {formatINR(selectedOrder.taxAmount)}</p>
                  <p className="text-base font-bold text-[#0F0D2E] mt-1">
                    Grand Total: {formatINR(selectedOrder.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div className="mt-4 border border-[#E6EAF2] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FC]/70 text-[#0F0D2E]/65">
                    <tr>
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EAF2]/70">
                    {(selectedOrder.items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-medium text-[#0F0D2E]">
                          {item.productNameSnapshot}
                          {(item.selectedColor || item.selectedSize) && (
                            <span className="text-[#0F0D2E]/55 ml-1">
                              ({[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#0F0D2E]/65">
                          {item.productSkuSnapshot}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatINR(item.unitPriceSnapshot)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                          {formatINR(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fulfillment Update Form */}
            <form
              onSubmit={handleUpdateOrder}
              className="border-t border-[#E6EAF2] pt-4 space-y-4 print:hidden"
            >
              <h4 className="text-sm font-bold text-[#0F0D2E] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#1E1B4B]" />
                Update Fulfillment &amp; Shipment Tracking
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-[#0F0D2E] mb-1">Order Status</label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] capitalize"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#0F0D2E] mb-1">Courier Partner</label>
                  <input
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="BlueDart / Delhivery / DTDC"
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#0F0D2E] mb-1">AWB / Tracking Number</label>
                  <input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. BD772948102IN"
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#0F0D2E] mb-1">Estimated Delivery</label>
                  <input
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                    placeholder="e.g. 28 Nov 2026"
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-[#0F0D2E] mb-1">Tracking URL (optional)</label>
                  <input
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://track.delhivery.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-[#0F0D2E] mb-1">Timeline Note</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Dispatched from Hyderabad fulfillment hub"
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 rounded-lg border border-[#E6EAF2] text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#1E1B4B] hover:bg-[#0F0D2E] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Updating...' : 'Save Fulfillment Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================= 2. CUSTOMERS & RBAC ROLES =======================
export function AdminCustomersTab() {
  const { user, showToast } = useStore();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = user?.role === 'super_admin';

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ customers: any[] }>('/api/admin/customers');
      setCustomers(data.customers || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load customers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleToggleStatus = async (c: any) => {
    const nextStatus = c.status === 'suspended' ? 'active' : 'suspended';
    try {
      await apiRequest(`/api/admin/customers/${c.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`Account ${c.email} marked ${nextStatus}.`);
      await loadCustomers();
    } catch (err: any) {
      showToast(err?.message || 'Unable to update status.', 'error');
    }
  };

  const handleRoleChange = async (id: number, role: string) => {
    try {
      await apiRequest(`/api/admin/customers/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      showToast(`Role updated to ${role.replace(/_/g, ' ')}.`);
      await loadCustomers();
    } catch (err: any) {
      showToast(err?.message || 'Unable to change user role.', 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#0F0D2E]">Customers &amp; Admin Team Access</h3>
          <p className="text-xs text-[#0F0D2E]/55">
            {isSuperAdmin
              ? 'As Super Admin, you can assign RBAC roles and suspend/reactivate accounts.'
              : 'View registered customers, order counts, and lifetime spending.'}
          </p>
        </div>
        <span className="text-xs font-semibold text-[#1E1B4B]">{customers.length} Users</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8F9FC]/70 text-[11px] uppercase tracking-wider text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4 text-right">Orders</th>
              <th className="py-3 px-4 text-right">Lifetime Spend</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6EAF2]/70">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-xs text-[#0F0D2E]/50">
                  Loading accounts...
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8F9FC]/30">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#0F0D2E] text-xs">{c.fullName}</div>
                    <div className="text-[11px] text-[#0F0D2E]/55">{c.email}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#0F0D2E]/75">{c.phone || '—'}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-xs">{c.orderCount}</td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-xs text-[#0F0D2E]">
                    {formatINR(c.totalSpent)}
                  </td>
                  <td className="py-3 px-4">
                    {isSuperAdmin ? (
                      <select
                        value={c.role}
                        onChange={(e) => handleRoleChange(c.id, e.target.value)}
                        className="px-2.5 py-1 rounded border border-[#E6EAF2] text-xs bg-white capitalize"
                      >
                        <option value="customer">Customer</option>
                        <option value="order_manager">Order Manager</option>
                        <option value="inventory_manager">Inventory Manager</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    ) : (
                      <span className="text-xs capitalize font-medium text-[#1E1B4B]">
                        {c.role.replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      disabled={c.id === user?.id}
                      onClick={() => handleToggleStatus(c)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer disabled:opacity-40 ${
                        c.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {c.status === 'active' ? 'Active' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======================= 3. COUPONS & DISCOUNTS =======================
export function AdminCouponsTab() {
  const { showToast } = useStore();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderValue, setMinOrderValue] = useState('999');
  const [maxDiscountLimit, setMaxDiscountLimit] = useState('500');
  const [usageLimit, setUsageLimit] = useState('250');

  const loadCoupons = useCallback(async () => {
    try {
      const data = await apiRequest<{ coupons: any[] }>('/api/admin/coupons');
      setCoupons(data.coupons || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load coupons.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          description,
          discountType,
          discountValue: Number(discountValue),
          minOrderValue: Number(minOrderValue) || 0,
          maxDiscountLimit: maxDiscountLimit ? Number(maxDiscountLimit) : null,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          status: 'active',
        }),
      });
      setCode('');
      setDescription('');
      showToast('Coupon created.');
      await loadCoupons();
    } catch (err: any) {
      showToast(err?.message || 'Unable to create coupon.', 'error');
    }
  };

  const handleToggle = async (c: any) => {
    const next = c.status === 'active' ? 'disabled' : 'active';
    try {
      await apiRequest(`/api/admin/coupons/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await loadCoupons();
    } catch (err: any) {
      showToast(err?.message || 'Unable to update coupon.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      showToast('Coupon removed.', 'info');
      await loadCoupons();
    } catch (err: any) {
      showToast(err?.message || 'Unable to delete coupon.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-[#0F0D2E]">Create Promotional Coupon</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code (e.g. FESTIVE15)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2] font-mono uppercase"
          />
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Flat INR Off (₹)</option>
          </select>
          <input
            type="number"
            min={1}
            required
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder="Value"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
          <input
            type="number"
            min={0}
            value={minOrderValue}
            onChange={(e) => setMinOrderValue(e.target.value)}
            placeholder="Min Order (₹)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
          <input
            type="number"
            min={0}
            value={maxDiscountLimit}
            onChange={(e) => setMaxDiscountLimit(e.target.value)}
            placeholder="Max Discount Cap (₹)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
          <input
            type="number"
            min={1}
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Usage Limit"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. 15% off festive orders)"
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Publish Coupon
        </button>
      </form>

      <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FC]/70 uppercase tracking-wider text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Offer</th>
                <th className="py-3 px-4 text-right">Min Order</th>
                <th className="py-3 px-4 text-right">Used</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2]/70">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-mono font-bold text-[#1E1B4B]">{c.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#0F0D2E]">
                      {c.discountType === 'percentage'
                        ? `${c.discountValue}% OFF`
                        : `${formatINR(c.discountValue)} OFF`}
                    </div>
                    <div className="text-[#0F0D2E]/55">{c.description}</div>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatINR(c.minOrderValue)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {c.usedCount} / {c.usageLimit || '∞'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleToggle(c)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize cursor-pointer ${
                        c.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {c.status}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ======================= 4. SHIPPING ZONES =======================
export function AdminShippingTab() {
  const { showToast } = useStore();
  const [zones, setZones] = useState<any[]>([]);
  const [regionName, setRegionName] = useState('');
  const [pincodePrefix, setPincodePrefix] = useState('');
  const [baseCharge, setBaseCharge] = useState('99');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('1499');
  const [estimatedDays, setEstimatedDays] = useState('3-5 business days');
  const [codEnabled, setCodEnabled] = useState(true);

  const loadZones = useCallback(async () => {
    try {
      const data = await apiRequest<{ zones: any[] }>('/api/admin/shipping-zones');
      setZones(data.zones || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load shipping zones.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/shipping-zones', {
        method: 'POST',
        body: JSON.stringify({
          regionName,
          pincodePrefix,
          baseCharge: Number(baseCharge),
          freeShippingThreshold: Number(freeShippingThreshold),
          estimatedDays,
          codEnabled,
        }),
      });
      setRegionName('');
      setPincodePrefix('');
      showToast('Shipping zone saved.');
      await loadZones();
    } catch (err: any) {
      showToast(err?.message || 'Unable to save shipping zone.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/admin/shipping-zones/${id}`, { method: 'DELETE' });
      showToast('Shipping zone deleted.', 'info');
      await loadZones();
    } catch (err: any) {
      showToast(err?.message || 'Unable to delete zone.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAdd}
        className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-[#0F0D2E]">Add Indian PIN Code Shipping Zone</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <input
            required
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            placeholder="Region Name (e.g. Telangana & AP)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
          <input
            required
            maxLength={6}
            value={pincodePrefix}
            onChange={(e) => setPincodePrefix(e.target.value.replace(/\D/g, ''))}
            placeholder="PIN Prefix (e.g. 50)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2] font-mono"
          />
          <input
            type="number"
            min={0}
            required
            value={baseCharge}
            onChange={(e) => setBaseCharge(e.target.value)}
            placeholder="Base Fee (₹)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
          <input
            type="number"
            min={0}
            required
            value={freeShippingThreshold}
            onChange={(e) => setFreeShippingThreshold(e.target.value)}
            placeholder="Free Over (₹)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
          <input
            required
            value={estimatedDays}
            onChange={(e) => setEstimatedDays(e.target.value)}
            placeholder="ETA (e.g. 2-4 days)"
            className="px-3 py-2 rounded-lg border border-[#E6EAF2]"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-[#0F0D2E] cursor-pointer">
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
            />
            Allow Cash on Delivery (COD) in this zone
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Zone
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8F9FC]/70 uppercase tracking-wider text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
            <tr>
              <th className="py-3 px-4">Region</th>
              <th className="py-3 px-4">PIN Prefix</th>
              <th className="py-3 px-4 text-right">Shipping Fee</th>
              <th className="py-3 px-4 text-right">Free Above</th>
              <th className="py-3 px-4">Delivery ETA</th>
              <th className="py-3 px-4">COD</th>
              <th className="py-3 px-4 text-right">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6EAF2]/70">
            {zones.map((z) => (
              <tr key={z.id}>
                <td className="py-3 px-4 font-semibold text-[#0F0D2E]">{z.regionName}</td>
                <td className="py-3 px-4 font-mono text-[#1E1B4B]">{z.pincodePrefix}*</td>
                <td className="py-3 px-4 text-right tabular-nums">{formatINR(z.baseCharge)}</td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatINR(z.freeShippingThreshold)}
                </td>
                <td className="py-3 px-4">{z.estimatedDays}</td>
                <td className="py-3 px-4">
                  <span className={z.codEnabled ? 'text-emerald-700 font-medium' : 'text-[#0F0D2E]/50'}>
                    {z.codEnabled ? 'Enabled' : 'Prepaid Only'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(z.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======================= 5. PAYMENTS & RAZORPAY REFUNDS =======================
export function AdminPaymentsTab() {
  const { showToast } = useStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState('Customer return approved');

  const loadPayments = useCallback(async () => {
    try {
      const data = await apiRequest<{ payments: any[]; refunds: any[] }>('/api/admin/payments');
      setPayments(data.payments || []);
      setRefunds(data.refunds || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load payment records.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleRefund = async (paymentId: number) => {
    try {
      await apiRequest(`/api/admin/payments/${paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: refundReason }),
      });
      showToast('Razorpay refund processed and order updated.');
      setRefundingId(null);
      await loadPayments();
    } catch (err: any) {
      showToast(err?.message || 'Refund failed.', 'error');
    }
  };

  const filtered =
    statusFilter === 'all' ? payments : payments.filter((p) => p.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="bg-[#F8F9FC] border border-[#E11D48]/40 rounded-xl p-4 flex items-start gap-3 text-xs text-[#0F0D2E]">
        <CreditCard className="w-4 h-4 text-[#1E1B4B] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Razorpay Gateway &amp; Webhook Security</p>
          <p className="text-[#0F0D2E]/75 leading-relaxed">
            Configure <code className="font-mono bg-white px-1 rounded">RAZORPAY_KEY_ID</code>,{' '}
            <code className="font-mono bg-white px-1 rounded">RAZORPAY_KEY_SECRET</code>, and{' '}
            <code className="font-mono bg-white px-1 rounded">RAZORPAY_WEBHOOK_SECRET</code> in your server
            environment secrets to process live or test UPI, Card, Net Banking, Wallet payments, and
            one-click gateway refunds. Webhook endpoint:{' '}
            <code className="font-mono bg-white px-1 rounded">/api/payments/razorpay/webhook</code>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'captured', 'pending', 'failed', 'refunded'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
              statusFilter === st
                ? 'bg-[#1E1B4B] text-white'
                : 'bg-white border border-[#E6EAF2] text-[#0F0D2E]/75'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FC]/70 uppercase tracking-wider text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Gateway / Reference</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2]/70">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#0F0D2E]/50">
                    No payment transactions yet.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-[#1E1B4B]">
                      {p.orderNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#0F0D2E]">{p.customerName}</div>
                      <div className="text-[#0F0D2E]/55">{p.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="uppercase font-medium">{p.gateway}</div>
                      <div className="font-mono text-[10px] text-[#0F0D2E]/55">
                        {p.razorpayPaymentId || p.razorpayOrderId || 'COD'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">
                      {formatINR(p.amount)}
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold">{p.status}</td>
                    <td className="py-3 px-4 text-right">
                      {p.status === 'captured' && p.gateway === 'razorpay' ? (
                        refundingId === p.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              value={refundReason}
                              onChange={(e) => setRefundReason(e.target.value)}
                              className="px-2 py-1 border border-[#E6EAF2] rounded text-[11px] w-40"
                            />
                            <button
                              type="button"
                              onClick={() => handleRefund(p.id)}
                              className="px-2.5 py-1 rounded bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setRefundingId(null)}
                              className="p-1 text-[#0F0D2E]/60"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRefundingId(p.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Refund
                          </button>
                        )
                      ) : (
                        <span className="text-[#0F0D2E]/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {refunds.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-3">
          <h4 className="text-sm font-bold text-[#0F0D2E]">Processed Refunds ({refunds.length})</h4>
          <div className="divide-y divide-[#E6EAF2]/70 text-xs">
            {refunds.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-[#1E1B4B]">
                    {r.razorpayRefundId || `REF-${r.id}`}
                  </span>
                  <span className="text-[#0F0D2E]/60 ml-2">{r.reason}</span>
                </div>
                <div className="font-semibold tabular-nums">{formatINR(r.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ======================= 6. WEBSITE CMS & STORE SETTINGS =======================
export function AdminCmsTab() {
  const { showToast } = useStore();
  const [banners, setBanners] = useState<WebsiteBanner[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [savingKey, setSavingKey] = useState('');

  const loadCms = useCallback(async () => {
    try {
      const [bData, sData] = await Promise.all([
        apiRequest<{ banners: WebsiteBanner[] }>('/api/admin/banners'),
        apiRequest<{ settings: Record<string, any> }>('/api/admin/cms'),
      ]);
      setBanners(bData.banners || []);
      setSettings(sData.settings || {});
    } catch (err: any) {
      showToast(err?.message || 'Unable to load CMS data.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadCms();
  }, [loadCms]);

  const handleSaveBanner = async (b: WebsiteBanner) => {
    try {
      setSavingKey(`banner-${b.id}`);
      await apiRequest(`/api/admin/banners/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: b.title,
          subtitle: b.subtitle,
          ctaText: b.ctaText,
          ctaLink: b.ctaLink,
          isActive: b.isActive,
        }),
      });
      showToast(`Saved banner "${b.slot}"`);
    } catch (err: any) {
      showToast(err?.message || 'Unable to save banner.', 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleSaveSetting = async (key: string, value: Record<string, any>) => {
    try {
      setSavingKey(key);
      await apiRequest(`/api/admin/cms/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
      showToast(`Saved ${key.replace(/_/g, ' ')} settings.`);
    } catch (err: any) {
      showToast(err?.message || 'Unable to save settings.', 'error');
    } finally {
      setSavingKey('');
    }
  };

  const paymentConfig = settings.payment_config || {
    codEnabled: true,
    codMaxAmount: 15000,
    gstRatePercent: 12,
  };
  const announcement = settings.announcement_bar || {
    messages: [
      'Free Pan-India Shipping on Orders Above ₹1,499',
      'Easy 14-Day Hassle-Free Returns & Exchanges',
      'Use Code WELCOME10 for 10% Off Your First Order',
    ],
  };

  return (
    <div className="space-y-6">
      {/* Banners */}
      <div className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-4">
        <h3 className="text-sm font-bold text-[#0F0D2E]">Homepage Hero &amp; Promotional Banners</h3>
        <div className="space-y-4">
          {banners.map((b, idx) => (
            <div key={b.id} className="p-4 rounded-xl border border-[#E6EAF2] bg-[#F8F9FC]/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-semibold text-[#1E1B4B]">
                  Slot: {b.slot}
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={b.isActive}
                    onChange={(e) => {
                      const next = [...banners];
                      next[idx] = { ...b, isActive: e.target.checked };
                      setBanners(next);
                    }}
                  />
                  Active
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <input
                  value={b.title}
                  onChange={(e) => {
                    const next = [...banners];
                    next[idx] = { ...b, title: e.target.value };
                    setBanners(next);
                  }}
                  placeholder="Headline"
                  className="px-3 py-2 rounded-lg border border-[#E6EAF2] bg-white"
                />
                <input
                  value={b.subtitle}
                  onChange={(e) => {
                    const next = [...banners];
                    next[idx] = { ...b, subtitle: e.target.value };
                    setBanners(next);
                  }}
                  placeholder="Subtitle"
                  className="px-3 py-2 rounded-lg border border-[#E6EAF2] bg-white"
                />
                <input
                  value={b.ctaText}
                  onChange={(e) => {
                    const next = [...banners];
                    next[idx] = { ...b, ctaText: e.target.value };
                    setBanners(next);
                  }}
                  placeholder="Button Text"
                  className="px-3 py-2 rounded-lg border border-[#E6EAF2] bg-white"
                />
                <input
                  value={b.ctaLink}
                  onChange={(e) => {
                    const next = [...banners];
                    next[idx] = { ...b, ctaLink: e.target.value };
                    setBanners(next);
                  }}
                  placeholder="Link URL (e.g. /category/beauty)"
                  className="px-3 py-2 rounded-lg border border-[#E6EAF2] bg-white font-mono"
                />
              </div>
              <button
                type="button"
                disabled={savingKey === `banner-${b.id}`}
                onClick={() => handleSaveBanner(b)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Banner
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Store Payment, GST & Announcement Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#0F0D2E]">Checkout, COD &amp; GST Configuration</h3>
          <div className="space-y-3 text-xs">
            <label className="inline-flex items-center gap-2 font-medium text-[#0F0D2E] cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(paymentConfig.codEnabled)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payment_config: { ...paymentConfig, codEnabled: e.target.checked },
                  })
                }
              />
              Enable Cash on Delivery (COD) globally
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#0F0D2E]/70 mb-1">Max COD Order Limit (₹)</label>
                <input
                  type="number"
                  value={paymentConfig.codMaxAmount ?? 15000}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payment_config: {
                        ...paymentConfig,
                        codMaxAmount: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                />
              </div>
              <div>
                <label className="block text-[#0F0D2E]/70 mb-1">GST Tax Rate (%)</label>
                <input
                  type="number"
                  value={paymentConfig.gstRatePercent ?? 12}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payment_config: {
                        ...paymentConfig,
                        gstRatePercent: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2]"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={savingKey === 'payment_config'}
              onClick={() => handleSaveSetting('payment_config', paymentConfig)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Payment &amp; Tax Settings
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6EAF2] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#0F0D2E]">Top Announcement Bar Messages</h3>
          <textarea
            rows={4}
            value={(announcement.messages || []).join('\n')}
            onChange={(e) =>
              setSettings({
                ...settings,
                announcement_bar: {
                  messages: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
            placeholder="One announcement per line..."
            className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] text-xs"
          />
          <button
            type="button"
            disabled={savingKey === 'announcement_bar'}
            onClick={() => handleSaveSetting('announcement_bar', announcement)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Update Announcement Bar
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================= 7. REVIEWS & SUPPORT TICKETS =======================
export function AdminSupportTab() {
  const { showToast } = useStore();
  const [subTab, setSubTab] = useState<'tickets' | 'reviews'>('tickets');
  const [tickets, setTickets] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('in_progress');

  const loadData = useCallback(async () => {
    try {
      const [tData, rData] = await Promise.all([
        apiRequest<{ tickets: any[] }>('/api/admin/tickets'),
        apiRequest<{ reviews: any[] }>('/api/admin/reviews'),
      ]);
      setTickets(tData.tickets || []);
      setReviews(rData.reviews || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load support and reviews.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleModerateReview = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiRequest(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Review marked ${status}.`);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Moderation failed.', 'error');
    }
  };

  const handleReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    try {
      const res = await apiRequest<{ ticket: any }>(`/api/admin/tickets/${activeTicket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText.trim(), status: replyStatus }),
      });
      setReplyText('');
      setActiveTicket(res.ticket);
      showToast('Reply sent to customer.');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Unable to send reply.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSubTab('tickets')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
            subTab === 'tickets'
              ? 'bg-[#1E1B4B] text-white'
              : 'bg-white border border-[#E6EAF2] text-[#0F0D2E]'
          }`}
        >
          Support Tickets ({tickets.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('reviews')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
            subTab === 'reviews'
              ? 'bg-[#1E1B4B] text-white'
              : 'bg-white border border-[#E6EAF2] text-[#0F0D2E]'
          }`}
        >
          Customer Reviews ({reviews.length})
        </button>
      </div>

      {subTab === 'tickets' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#E6EAF2] divide-y divide-[#E6EAF2]/70 max-h-[540px] overflow-y-auto">
            {tickets.length === 0 ? (
              <p className="p-6 text-xs text-center text-[#0F0D2E]/50">No support tickets yet.</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTicket(t);
                    setReplyStatus(t.status);
                  }}
                  className={`w-full text-left p-4 hover:bg-[#F8F9FC]/50 cursor-pointer ${
                    activeTicket?.id === t.id ? 'bg-[#F8F9FC]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-mono font-semibold text-[#1E1B4B]">{t.ticketNumber}</span>
                    <span className="capitalize font-semibold text-[#0F0D2E]/70">{t.status}</span>
                  </div>
                  <p className="text-xs font-bold text-[#0F0D2E] truncate">{t.subject}</p>
                  <p className="text-[11px] text-[#0F0D2E]/60 truncate">
                    {t.customerName} · {t.customerEmail}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E6EAF2] p-5">
            {!activeTicket ? (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-[#0F0D2E]/50 gap-2">
                <MessageSquare className="w-6 h-6 text-[#1E1B4B]/40" />
                Select a customer support ticket to inspect and respond.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-b border-[#E6EAF2] pb-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#0F0D2E] text-sm">{activeTicket.subject}</h4>
                    <span className="font-mono text-xs text-[#1E1B4B]">
                      {activeTicket.ticketNumber}
                    </span>
                  </div>
                  <p className="text-xs text-[#0F0D2E]/60 mt-0.5">
                    {activeTicket.customerName} ({activeTicket.customerEmail}) · Category:{' '}
                    {activeTicket.category}
                  </p>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  <div className="p-3 rounded-lg bg-[#F8F9FC]/70 text-xs text-[#0F0D2E]">
                    <p className="font-semibold mb-1">{activeTicket.customerName}</p>
                    <p className="leading-relaxed">{activeTicket.message}</p>
                  </div>
                  {(activeTicket.replies || []).map((rep: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg text-xs ${
                        rep.senderRole === 'admin'
                          ? 'bg-[#1E1B4B] text-white ml-6'
                          : 'bg-[#F8F9FC]/70 text-[#0F0D2E] mr-6'
                      }`}
                    >
                      <p className="font-semibold mb-1">{rep.senderName}</p>
                      <p className="leading-relaxed">{rep.message}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleReplyTicket} className="space-y-3 pt-2 border-t border-[#E6EAF2]">
                  <textarea
                    required
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your official support response..."
                    className="w-full px-3 py-2 rounded-lg border border-[#E6EAF2] text-xs"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <select
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-[#E6EAF2] text-xs"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Reply
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E6EAF2] divide-y divide-[#E6EAF2]/70">
          {reviews.length === 0 ? (
            <p className="p-8 text-center text-xs text-[#0F0D2E]/50">No customer reviews submitted yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#0F0D2E]">{r.productName}</span>
                    <span className="inline-flex items-center gap-0.5 text-[#E11D48] font-semibold">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {r.rating}
                    </span>
                    {r.isVerifiedPurchase && (
                      <span className="text-[11px] text-emerald-700 font-medium">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#0F0D2E]">{r.title}</p>
                  <p className="text-xs text-[#0F0D2E]/70">{r.comment}</p>
                  <p className="text-[11px] text-[#0F0D2E]/50">
                    By {r.userName} ({r.userEmail}) · Status: <strong className="capitalize">{r.status}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleModerateReview(r.id, 'approved')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerateReview(r.id, 'rejected')}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ======================= 8. ANALYTICS, AUDIT & EMAIL LOGS =======================
export function AdminAnalyticsTab() {
  const { showToast } = useStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      apiRequest<any>('/api/admin/analytics').catch(() => null),
      apiRequest<{ activityLogs: any[]; emailLogs: any[] }>('/api/admin/activity-logs').catch(() => ({
        activityLogs: [],
        emailLogs: [],
      })),
    ])
      .then(([a, logs]) => {
        setAnalytics(a);
        setActivityLogs(logs.activityLogs || []);
        setEmailLogs(logs.emailLogs || []);
      })
      .catch((err) => showToast(err?.message || 'Unable to load analytics.', 'error'));
  }, [showToast]);

  return (
    <div className="space-y-6">
      {analytics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#E6EAF2] p-5">
              <p className="text-xs text-[#0F0D2E]/60">Net Validated Sales</p>
              <p className="text-2xl font-bold text-[#0F0D2E] mt-1 tabular-nums">
                {formatINR(analytics.totalSales)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[#E6EAF2] p-5">
              <p className="text-xs text-[#0F0D2E]/60">Average Order Value (AOV)</p>
              <p className="text-2xl font-bold text-[#0F0D2E] mt-1 tabular-nums">
                {formatINR(analytics.averageOrderValue)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[#E6EAF2] p-5">
              <p className="text-xs text-[#0F0D2E]/60">Repeat Customer Rate</p>
              <p className="text-2xl font-bold text-[#1E1B4B] mt-1 tabular-nums">
                {analytics.repeatRate}%
              </p>
              <p className="text-[11px] text-[#0F0D2E]/50 mt-0.5">
                {analytics.repeatCustomers} repeat buyers
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[#E6EAF2] p-5">
              <p className="text-xs text-[#0F0D2E]/60">Processed Refunds</p>
              <p className="text-2xl font-bold text-[#0F0D2E] mt-1 tabular-nums">
                {formatINR(analytics.refundSummary?.processedAmount || 0)}
              </p>
              <p className="text-[11px] text-[#0F0D2E]/50 mt-0.5">
                {analytics.refundSummary?.totalCount || 0} total refund records
              </p>
            </div>
          </div>

          {!analytics.conversionTrackingConfigured && (
            <div className="bg-[#F8F9FC] border border-[#E6EAF2] rounded-xl p-4 flex items-start gap-2.5 text-xs text-[#0F0D2E]/80">
              <Info className="w-4 h-4 text-[#1E1B4B] shrink-0 mt-0.5" />
              <span>
                All revenue, AOV, repeat-buyer, refund, and coupon figures above are computed directly
                from PostgreSQL order records. Storefront visitor-to-checkout conversion funnel tracking
                is not configured yet (no synthetic visit ratios are fabricated).
              </span>
            </div>
          )}

          {/* Coupon Performance */}
          <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E6EAF2] text-sm font-bold text-[#0F0D2E]">
              Coupon Usage &amp; Discount Impact
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FC]/70 text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
                <tr>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4 text-right">Redemptions</th>
                  <th className="py-2.5 px-4 text-right">Total Discount Given</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF2]/70">
                {(analytics.couponStats || []).map((c: any) => (
                  <tr key={c.code}>
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#1E1B4B]">{c.code}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{c.usedCount}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                      {formatINR(c.totalDiscountGiven)}
                    </td>
                    <td className="py-2.5 px-4 text-right capitalize">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Audit & Email Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E6EAF2] flex items-center gap-2 text-sm font-bold text-[#0F0D2E]">
            <ShieldAlert className="w-4 h-4 text-[#1E1B4B]" />
            Admin Audit Trail ({activityLogs.length})
          </div>
          <div className="divide-y divide-[#E6EAF2]/70 max-h-80 overflow-y-auto text-xs">
            {activityLogs.length === 0 ? (
              <p className="p-6 text-center text-[#0F0D2E]/50">No audit entries recorded yet.</p>
            ) : (
              activityLogs.map((l) => (
                <div key={l.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0F0D2E] font-mono text-[11px]">{l.action}</p>
                    <p className="text-[#0F0D2E]/65">
                      {l.actorEmail} · {l.entityType} #{l.entityId}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#0F0D2E]/50 shrink-0">
                    {new Date(l.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E6EAF2] flex items-center gap-2 text-sm font-bold text-[#0F0D2E]">
            <Mail className="w-4 h-4 text-[#1E1B4B]" />
            Transactional Email Dispatch Log ({emailLogs.length})
          </div>
          <div className="divide-y divide-[#E6EAF2]/70 max-h-80 overflow-y-auto text-xs">
            {emailLogs.length === 0 ? (
              <p className="p-6 text-center text-[#0F0D2E]/50">No emails triggered yet.</p>
            ) : (
              emailLogs.map((e) => (
                <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0F0D2E]">{e.subject}</p>
                    <p className="text-[#0F0D2E]/65">
                      To: {e.recipientEmail} · Template: <span className="font-mono">{e.template}</span>
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase shrink-0 ${
                      e.status === 'sent' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
