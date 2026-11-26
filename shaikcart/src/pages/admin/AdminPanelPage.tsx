import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Palette,
  RotateCcw,
  ShoppingBag,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../../context/StoreContext';
import { apiRequest, formatINR, getAuthToken } from '../../lib/api';
import { useSeo } from '../../hooks/useSeo';
import { BrandLogo } from '../../components/BrandLogo';
import { AdminCategoriesTab, AdminProductsTab } from './AdminCatalogTabs';
import {
  AdminAnalyticsTab,
  AdminCmsTab,
  AdminCouponsTab,
  AdminCustomersTab,
  AdminOrdersTab,
  AdminPaymentsTab,
  AdminShippingTab,
  AdminSupportTab,
} from './AdminOpsTabs';

type AdminSection =
  | 'overview'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'coupons'
  | 'shipping'
  | 'payments'
  | 'cms'
  | 'support'
  | 'analytics';

interface NavItem {
  id: AdminSection;
  label: string;
  path: string;
  permission: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', path: '/admin', permission: 'dashboard:view', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & Shipments', path: '/admin/orders', permission: 'orders:manage', icon: ShoppingBag },
  { id: 'products', label: 'Products & Stock', path: '/admin/products', permission: 'products:manage', icon: Package },
  { id: 'categories', label: 'Categories & Brands', path: '/admin/categories', permission: 'categories:manage', icon: FolderTree },
  { id: 'customers', label: 'Customers & Roles', path: '/admin/customers', permission: 'customers:view', icon: Users },
  { id: 'coupons', label: 'Coupons & Offers', path: '/admin/coupons', permission: 'coupons:manage', icon: Tag },
  { id: 'shipping', label: 'Shipping Zones', path: '/admin/shipping', permission: 'shipping:manage', icon: Truck },
  { id: 'payments', label: 'Payments & Refunds', path: '/admin/payments', permission: 'payments:manage', icon: CreditCard },
  { id: 'cms', label: 'Website CMS', path: '/admin/cms', permission: 'cms:manage', icon: Palette },
  { id: 'support', label: 'Reviews & Support', path: '/admin/support', permission: 'support:manage', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics & Audit', path: '/admin/analytics', permission: 'analytics:view', icon: BarChart3 },
];

export function AdminPanelPage() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { user, authLoading, logout, showToast } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dashboard state
  const [dateRange, setDateRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(false);

  const activeSection: AdminSection = useMemo(() => {
    const valid = ADMIN_NAV.find((n) => n.id === section);
    return valid ? valid.id : 'overview';
  }, [section]);

  useSeo({
    title: `${ADMIN_NAV.find((n) => n.id === activeSection)?.label || 'Admin'} — SHAIKCART Admin`,
  });

  const canAccess = useCallback(
    (perm: string) => {
      if (!user) return false;
      if (user.permissions.includes('*')) return true;
      return user.permissions.includes(perm);
    },
    [user]
  );

  const visibleNav = useMemo(
    () => ADMIN_NAV.filter((item) => canAccess(item.permission)),
    [canAccess]
  );

  const loadDashboard = useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      setDashLoading(true);
      const params = new URLSearchParams({ range: dateRange });
      if (dateRange === 'custom') {
        if (customFrom) params.set('from', customFrom);
        if (customTo) params.set('to', customTo);
      }
      const data = await apiRequest<any>(`/api/admin/dashboard?${params.toString()}`);
      setDashboard(data);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load dashboard metrics.', 'error');
    } finally {
      setDashLoading(false);
    }
  }, [user, dateRange, customFrom, customTo, showToast]);

  useEffect(() => {
    if (activeSection === 'overview' && user?.isAdmin) {
      loadDashboard();
    }
  }, [activeSection, user, loadDashboard]);

  const handleExportOrdersCsv = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/admin/export/orders.csv', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Unable to export CSV report.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shaikcart-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Orders CSV report downloaded.');
    } catch (err: any) {
      showToast(err?.message || 'CSV export failed.', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center text-sm text-[#0F0D2E]/70">
        Verifying administrator session...
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  const activeNavObj = ADMIN_NAV.find((n) => n.id === activeSection) || ADMIN_NAV[0];

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex text-[#0F0D2E]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Deep Green Fixed Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0F0D2E] text-[#F8F9FC] flex flex-col justify-between transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
            <Link to="/admin" className="flex items-center gap-2">
              <BrandLogo light size="sm" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#E11D48]">
                Admin
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-[#F8F9FC]/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeSection;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1E1B4B] text-white border-l-2 border-[#E11D48]'
                      : 'text-[#F8F9FC]/75 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#E11D48]' : 'text-[#F8F9FC]/60'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-2.5">
          <div className="px-2">
            <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
            <p className="text-[11px] text-[#E11D48] capitalize">{user.role.replace(/_/g, ' ')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/"
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-medium text-[#F8F9FC]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Store
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/admin/login');
              }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-red-500/20 text-[11px] font-medium text-[#F8F9FC] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#E6EAF2] px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-[#F8F9FC] text-[#0F0D2E]"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base lg:text-lg font-bold text-[#0F0D2E]">
                {activeNavObj.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canAccess('orders:manage') && (
              <button
                type="button"
                onClick={handleExportOrdersCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#E6EAF2] hover:bg-[#F8F9FC] text-xs font-semibold text-[#1E1B4B] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Orders CSV
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Date Range Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['today', 'Today'],
                      ['7d', 'Last 7 Days'],
                      ['30d', 'Last 30 Days'],
                      ['month', 'This Month'],
                      ['year', 'This Year'],
                      ['custom', 'Custom'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDateRange(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        dateRange === val
                          ? 'bg-[#1E1B4B] text-white'
                          : 'bg-white border border-[#E6EAF2] text-[#0F0D2E]/75 hover:bg-[#F8F9FC]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {dateRange === 'custom' && (
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6EAF2] bg-white"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6EAF2] bg-white"
                    />
                  </div>
                )}
              </div>

              {dashLoading && !dashboard ? (
                <div className="py-16 text-center text-sm text-[#0F0D2E]/55">
                  Loading live SHAIKCART metrics...
                </div>
              ) : (
                dashboard && (
                  <>
                    {/* 8 KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        {
                          label: 'Total Revenue',
                          value: formatINR(dashboard.kpis.totalRevenue),
                          sub: `AOV ${formatINR(dashboard.kpis.averageOrderValue)}`,
                          icon: CreditCard,
                        },
                        {
                          label: 'Total Orders',
                          value: String(dashboard.kpis.totalOrders),
                          sub: 'In selected period',
                          icon: ShoppingBag,
                        },
                        {
                          label: 'Customers',
                          value: String(dashboard.kpis.totalCustomers),
                          sub: 'Registered shoppers',
                          icon: Users,
                        },
                        {
                          label: 'Catalog Products',
                          value: String(dashboard.kpis.totalProducts),
                          sub: 'Active SKUs',
                          icon: Boxes,
                        },
                        {
                          label: 'Pending Fulfillment',
                          value: String(dashboard.kpis.pendingOrders),
                          sub: 'Require dispatch',
                          icon: Truck,
                        },
                        {
                          label: 'Delivered Orders',
                          value: String(dashboard.kpis.deliveredOrders),
                          sub: 'Completed deliveries',
                          icon: CheckCircle2,
                        },
                        {
                          label: 'Low Stock Alerts',
                          value: String(dashboard.kpis.lowStockCount),
                          sub: 'Below threshold',
                          icon: AlertTriangle,
                        },
                        {
                          label: 'Refund Requests',
                          value: String(dashboard.kpis.refundRequests),
                          sub: 'Pending action',
                          icon: RotateCcw,
                        },
                      ].map((kpi) => {
                        const Icon = kpi.icon;
                        return (
                          <div
                            key={kpi.label}
                            className="bg-white rounded-xl border border-[#E6EAF2] p-4 lg:p-5 flex items-start justify-between gap-3"
                          >
                            <div>
                              <p className="text-xs font-medium text-[#0F0D2E]/60">{kpi.label}</p>
                              <p className="text-xl lg:text-2xl font-bold text-[#0F0D2E] mt-1 tabular-nums">
                                {kpi.value}
                              </p>
                              <p className="text-[11px] text-[#0F0D2E]/50 mt-1">{kpi.sub}</p>
                            </div>
                            <div className="w-9 h-9 rounded-lg bg-[#F8F9FC] text-[#1E1B4B] flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-7 bg-white rounded-xl border border-[#E6EAF2] p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-sm font-bold text-[#0F0D2E]">Revenue Trend (INR)</h3>
                            <p className="text-xs text-[#0F0D2E]/55">Daily validated sales performance</p>
                          </div>
                        </div>
                        {dashboard.salesSeries?.length > 0 ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={dashboard.salesSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF2" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#0F0D2E' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#0F0D2E' }} />
                                <Tooltip
                                  formatter={(value: any) => [formatINR(Number(value)), 'Revenue']}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="revenue"
                                  stroke="#1E1B4B"
                                  fill="#1E1B4B"
                                  fillOpacity={0.14}
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-xs text-[#0F0D2E]/50">
                            No completed orders in this date window yet — chart updates live as orders arrive.
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-5 bg-white rounded-xl border border-[#E6EAF2] p-5">
                        <div className="mb-4">
                          <h3 className="text-sm font-bold text-[#0F0D2E]">Category Performance</h3>
                          <p className="text-xs text-[#0F0D2E]/55">Sales revenue by storefront category</p>
                        </div>
                        {dashboard.categoryPerformance?.length > 0 ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dashboard.categoryPerformance.slice(0, 6)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF2" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#0F0D2E' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#0F0D2E' }} />
                                <Tooltip
                                  formatter={(value: any) => [formatINR(Number(value)), 'Sales']}
                                />
                                <Bar dataKey="revenue" fill="#E11D48" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-xs text-[#0F0D2E]/50">
                            Category sales breakdown will populate once customer orders are placed.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lower Operational Grids */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Recent Orders */}
                      <div className="lg:col-span-7 bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-[#E6EAF2] flex items-center justify-between">
                          <h3 className="text-sm font-bold text-[#0F0D2E]">Recent Orders</h3>
                          <Link
                            to="/admin/orders"
                            className="text-xs font-semibold text-[#1E1B4B] hover:underline"
                          >
                            View All
                          </Link>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#F8F9FC]/70 text-[#0F0D2E]/65 border-b border-[#E6EAF2]">
                              <tr>
                                <th className="py-2.5 px-4">Order #</th>
                                <th className="py-2.5 px-4">Customer</th>
                                <th className="py-2.5 px-4 text-right">Amount</th>
                                <th className="py-2.5 px-4 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E6EAF2]/70">
                              {dashboard.recentOrders?.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-[#0F0D2E]/50">
                                    No orders placed yet.
                                  </td>
                                </tr>
                              ) : (
                                dashboard.recentOrders.map((o: any) => (
                                  <tr key={o.id}>
                                    <td className="py-2.5 px-4 font-mono font-semibold text-[#1E1B4B]">
                                      {o.orderNumber}
                                    </td>
                                    <td className="py-2.5 px-4">{o.customerName}</td>
                                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                                      {formatINR(o.totalAmount)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right capitalize">
                                      {o.orderStatus.replace(/_/g, ' ')}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Low Stock & Admin Alerts */}
                      <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-[#E6EAF2] flex items-center justify-between">
                            <h3 className="text-sm font-bold text-[#0F0D2E] flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              Low Stock Alerts
                            </h3>
                            <Link
                              to="/admin/products"
                              className="text-xs font-semibold text-[#1E1B4B] hover:underline"
                            >
                              Restock
                            </Link>
                          </div>
                          <div className="divide-y divide-[#E6EAF2]/70 text-xs">
                            {dashboard.lowStockAlerts?.length === 0 ? (
                              <p className="p-5 text-center text-[#0F0D2E]/50">
                                All products are currently above low-stock thresholds.
                              </p>
                            ) : (
                              dashboard.lowStockAlerts.map((p: any) => (
                                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[#0F0D2E] truncate">{p.name}</p>
                                    <p className="font-mono text-[10px] text-[#0F0D2E]/50">{p.sku}</p>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold tabular-nums shrink-0">
                                    {p.stockQuantity} left
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-[#E6EAF2] flex items-center gap-1.5 text-sm font-bold text-[#0F0D2E]">
                            <Bell className="w-4 h-4 text-[#1E1B4B]" />
                            Admin Notifications
                          </div>
                          <div className="divide-y divide-[#E6EAF2]/70 text-xs max-h-52 overflow-y-auto">
                            {dashboard.notifications?.length === 0 ? (
                              <p className="p-5 text-center text-[#0F0D2E]/50">
                                No new administrative alerts.
                              </p>
                            ) : (
                              dashboard.notifications.map((n: any) => (
                                <div key={n.id} className="px-5 py-3">
                                  <p className="font-semibold text-[#0F0D2E]">{n.title}</p>
                                  <p className="text-[#0F0D2E]/65 mt-0.5">{n.message}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          {activeSection === 'products' && <AdminProductsTab />}
          {activeSection === 'categories' && <AdminCategoriesTab />}
          {activeSection === 'orders' && <AdminOrdersTab />}
          {activeSection === 'customers' && <AdminCustomersTab />}
          {activeSection === 'coupons' && <AdminCouponsTab />}
          {activeSection === 'shipping' && <AdminShippingTab />}
          {activeSection === 'payments' && <AdminPaymentsTab />}
          {activeSection === 'cms' && <AdminCmsTab />}
          {activeSection === 'support' && <AdminSupportTab />}
          {activeSection === 'analytics' && <AdminAnalyticsTab />}
        </main>
      </div>
    </div>
  );
}
