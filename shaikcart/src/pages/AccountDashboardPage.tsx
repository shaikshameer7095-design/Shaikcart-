import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  CreditCard,
  Heart,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Package,
  Plus,
  Star,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import type { Address, Order } from '../types';

type TabKey =
  | 'overview'
  | 'profile'
  | 'orders'
  | 'tracking'
  | 'wishlist'
  | 'addresses'
  | 'payments'
  | 'reviews'
  | 'notifications'
  | 'password';

export function AccountDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, authLoading, wishlist, logout, refreshUser, showToast } = useStore();

  const tab = (searchParams.get('tab') as TabKey) || 'overview';
  const setTab = (next: TabKey) => setSearchParams({ tab: next });

  const [overview, setOverview] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Address Form
  const [addrForm, setAddrForm] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: true,
  });

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useSeo({ title: 'My Account Dashboard — SHAIKCART' });

  const loadAccountData = async () => {
    try {
      setLoading(true);
      const [ov, ord] = await Promise.all([
        apiRequest('/api/account/overview'),
        apiRequest<{ orders: Order[] }>('/api/orders'),
      ]);
      setOverview(ov);
      setOrders(ord.orders || []);
    } catch {
      // handled cleanly
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || '');
      setAddrForm((prev) => ({
        ...prev,
        fullName: prev.fullName || user.fullName,
        phone: prev.phone || user.phone || '',
      }));
      loadAccountData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  if (!authLoading && !user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-2xl border border-[#E6EAF2] p-10 space-y-4">
          <h1 className="text-2xl font-bold text-[#0F0D2E]">Sign in to access My Account</h1>
          <p className="text-sm text-[#0F0D2E]/65">
            View your SHAIKCART order history, delivery tracking, saved addresses, and wishlist.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/login" className="px-6 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-medium">
              Sign In
            </Link>
            <Link to="/signup" className="px-6 py-2.5 rounded-lg border border-[#E6EAF2] text-sm font-medium">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, phone, avatarUrl }),
      });
      await refreshUser();
      showToast('Profile updated cleanly.');
    } catch (err: any) {
      showToast(err?.message || 'Unable to update profile.', 'error');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/account/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...addrForm, country: 'India' }),
      });
      showToast('Delivery address saved.');
      setAddrForm({
        label: 'Home',
        fullName: user?.fullName || '',
        phone: user?.phone || '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        isDefault: false,
      });
      loadAccountData();
    } catch (err: any) {
      showToast(err?.message || 'Unable to save address.', 'error');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await apiRequest(`/api/account/addresses/${id}`, { method: 'DELETE' });
      showToast('Address removed', 'info');
      loadAccountData();
    } catch {
      showToast('Unable to remove address', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password changed successfully.');
    } catch (err: any) {
      showToast(err?.message || 'Password update failed.', 'error');
    }
  };

  const menuItems: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { key: 'profile', label: 'My Profile', icon: User },
    { key: 'orders', label: 'My Orders', icon: Package },
    { key: 'tracking', label: 'Order Tracking', icon: Truck },
    { key: 'wishlist', label: 'My Wishlist', icon: Heart },
    { key: 'addresses', label: 'Saved Addresses', icon: MapPin },
    { key: 'payments', label: 'Payment Information', icon: CreditCard },
    { key: 'reviews', label: 'My Reviews', icon: Star },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'password', label: 'Change Password', icon: Lock },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-[#E6EAF2] p-4 space-y-1">
          <div className="px-3 py-3 mb-2 border-b border-[#E6EAF2]">
            <p className="text-sm font-bold text-[#0F0D2E] truncate">{user?.fullName}</p>
            <p className="text-xs text-[#0F0D2E]/55 truncate">{user?.email}</p>
          </div>
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                tab === item.key
                  ? 'bg-[#1E1B4B] text-white'
                  : 'text-[#0F0D2E]/75 hover:bg-[#F8F9FC]'
              }`}
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 transition-colors mt-2"
          >
            <LogOut size={15} /> Logout
          </button>
        </aside>

        {/* Main Account Content */}
        <div className="lg:col-span-9 space-y-6">
          {tab === 'overview' && (
            <>
              <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
                <h1 className="text-2xl font-bold text-[#0F0D2E]">
                  Welcome back, {user?.fullName?.split(' ')[0]}
                </h1>
                <p className="text-sm text-[#0F0D2E]/65 mt-1">
                  Manage your orders, tracking milestones, delivery addresses, and saved pieces from one place.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  {[
                    { label: 'Total Orders', val: overview?.stats?.totalOrders ?? 0 },
                    { label: 'Pending Orders', val: overview?.stats?.pendingOrders ?? 0 },
                    { label: 'Delivered Orders', val: overview?.stats?.deliveredOrders ?? 0 },
                    { label: 'Wishlist Items', val: wishlist.length },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-xl bg-[#F8F9FC]/70 border border-[#E6EAF2]">
                      <p className="text-xs text-[#0F0D2E]/60">{s.label}</p>
                      <p className="text-2xl font-bold text-[#1E1B4B] mt-1 tabular-nums">{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-[#0F0D2E]">Recent Orders</h2>
                  <button
                    type="button"
                    onClick={() => setTab('orders')}
                    className="text-xs font-medium text-[#1E1B4B] hover:underline"
                  >
                    View All
                  </button>
                </div>
                {loading ? (
                  <p className="text-sm text-[#0F0D2E]/50 py-6">Loading orders...</p>
                ) : orders.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[#0F0D2E]/65 mb-3">You have not placed an order yet.</p>
                    <Link to="/shop" className="px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-medium">
                      Explore SHAIKCART
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E6EAF2]">
                    {orders.slice(0, 4).map((o) => (
                      <div key={o.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-mono font-semibold text-[#0F0D2E]">{o.orderNumber}</p>
                          <p className="text-xs text-[#0F0D2E]/55">
                            {new Date(o.createdAt).toLocaleDateString('en-IN')} · {o.items?.length || 0} item(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs capitalize text-[#1E1B4B] font-medium">
                            {o.orderStatus.replace(/_/g, ' ')}
                          </span>
                          <span className="font-bold text-[#0F0D2E] tabular-nums">{formatINR(o.totalAmount)}</span>
                          <Link
                            to={`/track-order?orderNumber=${encodeURIComponent(o.orderNumber)}`}
                            className="text-xs font-medium text-[#1E1B4B] hover:underline"
                          >
                            Track
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'profile' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F0D2E] mb-5">My Profile</h2>
              <form onSubmit={handleProfileSave} className="max-w-lg space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] bg-[#F8F9FC]/60 text-sm text-[#0F0D2E]/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Profile Image URL (Optional)</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E]"
                >
                  Save Profile
                </button>
              </form>
            </div>
          )}

          {tab === 'orders' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F0D2E] mb-5">My Orders</h2>
              {orders.length === 0 ? (
                <p className="text-sm text-[#0F0D2E]/60 py-6">No orders recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {orders.map((o) => (
                    <div key={o.id} className="p-5 rounded-xl border border-[#E6EAF2] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E6EAF2]">
                        <div>
                          <span className="font-mono font-bold text-sm text-[#0F0D2E]">{o.orderNumber}</span>
                          <span className="text-xs text-[#0F0D2E]/55 ml-2">
                            {new Date(o.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="capitalize font-medium text-[#1E1B4B]">
                            Order: {o.orderStatus.replace(/_/g, ' ')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize text-[#0F0D2E]/70">
                            Payment: {o.paymentStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(o.items || []).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="text-[#0F0D2E]">
                              {item.productNameSnapshot} × {item.quantity}
                            </span>
                            <span className="font-semibold tabular-nums">{formatINR(item.lineTotal)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-[#E6EAF2] flex items-center justify-between text-sm">
                        <span className="font-bold text-[#1E1B4B] tabular-nums">
                          Total: {formatINR(o.totalAmount)}
                        </span>
                        <Link
                          to={`/track-order?orderNumber=${encodeURIComponent(o.orderNumber)}`}
                          className="text-xs font-semibold text-[#1E1B4B] hover:underline"
                        >
                          View Tracking Timeline →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'tracking' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8 space-y-4">
              <h2 className="text-xl font-bold text-[#0F0D2E]">Order Tracking</h2>
              {orders.length === 0 ? (
                <p className="text-sm text-[#0F0D2E]/60">No active shipments yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div key={o.id} className="p-4 rounded-xl bg-[#F8F9FC]/50 border border-[#E6EAF2] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono font-semibold text-sm text-[#0F0D2E]">{o.orderNumber}</p>
                        <p className="text-xs text-[#0F0D2E]/60 mt-0.5">
                          Current status: <strong className="capitalize">{o.orderStatus.replace(/_/g, ' ')}</strong>
                          {o.shipment?.trackingNumber ? ` · AWB ${o.shipment.trackingNumber}` : ''}
                        </p>
                      </div>
                      <Link
                        to={`/track-order?orderNumber=${encodeURIComponent(o.orderNumber)}`}
                        className="px-4 py-2 rounded-lg bg-[#1E1B4B] text-white text-xs font-medium"
                      >
                        Open Live Timeline
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'wishlist' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#0F0D2E]">Saved Wishlist ({wishlist.length})</h2>
                <Link to="/wishlist" className="text-xs font-semibold text-[#1E1B4B] hover:underline">
                  Manage Full Wishlist →
                </Link>
              </div>
              {wishlist.length === 0 ? (
                <p className="text-sm text-[#0F0D2E]/60">No items saved in your wishlist.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wishlist.map((w) => (
                    <Link
                      key={w.id}
                      to={`/product/${w.slug}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#E6EAF2] hover:bg-[#F8F9FC]/50"
                    >
                      <img src={w.primaryImage} alt={w.name} className="w-14 h-14 rounded-lg object-cover bg-[#E6EAF2]" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F0D2E] truncate">{w.name}</p>
                        <p className="text-xs font-bold text-[#1E1B4B] tabular-nums">{formatINR(w.salePrice)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'addresses' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
                <h2 className="text-xl font-bold text-[#0F0D2E] mb-4">Saved Delivery Addresses</h2>
                {(overview?.addresses || []).length === 0 ? (
                  <p className="text-sm text-[#0F0D2E]/60">No saved addresses yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(overview.addresses as Address[]).map((a) => (
                      <div key={a.id} className="p-4 rounded-xl border border-[#E6EAF2] bg-[#F8F9FC]/40 relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#1E1B4B]">
                            {a.label} {a.isDefault ? '· Default' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(a.id)}
                            className="text-[#0F0D2E]/45 hover:text-red-700"
                            aria-label="Delete address"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-[#0F0D2E]">{a.fullName}</p>
                        <p className="text-xs text-[#0F0D2E]/75 mt-1">
                          {a.addressLine1}
                          {a.addressLine2 ? `, ${a.addressLine2}` : ''}
                        </p>
                        <p className="text-xs text-[#0F0D2E]/75">
                          {a.city}, {a.state} — {a.pincode}
                        </p>
                        <p className="text-xs text-[#0F0D2E]/60 mt-1">{a.phone}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
                <h3 className="text-base font-bold text-[#0F0D2E] mb-4 flex items-center gap-1.5">
                  <Plus size={16} /> Add New Address
                </h3>
                <form onSubmit={handleAddAddress} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    value={addrForm.label}
                    onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                    placeholder="Label (Home / Office)"
                    className="h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={addrForm.fullName}
                    onChange={(e) => setAddrForm({ ...addrForm, fullName: e.target.value })}
                    placeholder="Recipient Full Name"
                    className="h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                  <input
                    type="tel"
                    required
                    value={addrForm.phone}
                    onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                    placeholder="Phone Number"
                    className="h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={addrForm.pincode}
                    onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value.replace(/\D/g, '') })}
                    placeholder="6-digit PIN Code"
                    className="h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm tabular-nums"
                  />
                  <input
                    type="text"
                    required
                    value={addrForm.addressLine1}
                    onChange={(e) => setAddrForm({ ...addrForm, addressLine1: e.target.value })}
                    placeholder="House / Flat / Street Address"
                    className="sm:col-span-2 h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={addrForm.city}
                    onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                    placeholder="City"
                    className="h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={addrForm.state}
                    onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                    placeholder="State"
                    className="h-10 px-3 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                  <label className="sm:col-span-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={addrForm.isDefault}
                      onChange={(e) => setAddrForm({ ...addrForm, isDefault: e.target.checked })}
                      className="accent-[#1E1B4B]"
                    />
                    Set as default shipping address
                  </label>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-xs font-semibold"
                    >
                      Save Address
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {tab === 'payments' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F0D2E] mb-4">Payment History</h2>
              {(overview?.payments || []).length === 0 ? (
                <p className="text-sm text-[#0F0D2E]/60">
                  No payment transactions yet. Card/UPI details are handled directly by Razorpay and never stored on SHAIKCART servers.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E6EAF2] text-[#0F0D2E]/60">
                      <tr>
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 pr-4">Gateway</th>
                        <th className="py-2.5 pr-4">Transaction ID</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6EAF2]">
                      {overview.payments.map((p: any) => (
                        <tr key={p.id}>
                          <td className="py-3 pr-4">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="py-3 pr-4 uppercase">{p.gateway}</td>
                          <td className="py-3 pr-4 font-mono">{p.razorpayPaymentId || p.razorpayOrderId || 'COD'}</td>
                          <td className="py-3 pr-4 capitalize font-medium text-[#1E1B4B]">{p.status}</td>
                          <td className="py-3 text-right font-semibold tabular-nums">{formatINR(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F0D2E] mb-4">My Product Reviews</h2>
              {(overview?.reviews || []).length === 0 ? (
                <p className="text-sm text-[#0F0D2E]/60">You have not submitted any product reviews yet.</p>
              ) : (
                <div className="divide-y divide-[#E6EAF2]">
                  {overview.reviews.map((r: any) => (
                    <div key={r.id} className="py-4">
                      <Link to={`/product/${r.productSlug}`} className="text-sm font-semibold text-[#1E1B4B] hover:underline">
                        {r.productName}
                      </Link>
                      <p className="text-xs font-medium text-[#0F0D2E] mt-1">
                        {r.rating}★ · {r.title}
                      </p>
                      <p className="text-xs text-[#0F0D2E]/70 mt-1">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F0D2E] mb-4">Notifications</h2>
              {(overview?.notifications || []).length === 0 ? (
                <p className="text-sm text-[#0F0D2E]/60">You are all caught up.</p>
              ) : (
                <div className="divide-y divide-[#E6EAF2]">
                  {overview.notifications.map((n: any) => (
                    <div key={n.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#0F0D2E]">{n.title}</p>
                        <p className="text-xs text-[#0F0D2E]/70 mt-0.5">{n.message}</p>
                        <p className="text-[11px] text-[#0F0D2E]/45 mt-1">
                          {new Date(n.createdAt).toLocaleString('en-IN')}
                        </p>
                      </div>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/account/notifications/${n.id}/read`, { method: 'PATCH' });
                            loadAccountData();
                          }}
                          className="text-xs font-medium text-[#1E1B4B] hover:underline shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'password' && (
            <div className="bg-white rounded-2xl border border-[#E6EAF2] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#0F0D2E] mb-4">Change Password</h2>
              <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Current Password (if set)</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">New Password (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold"
                >
                  Update Password
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
