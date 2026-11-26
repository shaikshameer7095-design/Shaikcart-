import React, { useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { StorefrontLayout } from './components/StorefrontLayout';
import { ToastContainer } from './components/ToastContainer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { SearchPage } from './pages/SearchPage';
import { WishlistPage } from './pages/WishlistPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { PaymentStatusPage } from './pages/PaymentStatusPage';
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
  VerifyEmailPage,
} from './pages/AuthPages';
import { AccountDashboardPage } from './pages/AccountDashboardPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { StaticInfoPage } from './pages/StaticInfoPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminPanelPage } from './pages/admin/AdminPanelPage';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, search]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#E11D48]">Error 404</p>
      <h1 className="text-3xl font-bold text-[#0F0D2E]">Page Not Found</h1>
      <p className="text-sm text-[#0F0D2E]/70">
        The SHAIKCART page or collection you are looking for could not be located.
      </p>
      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-lg bg-[#1E1B4B] hover:bg-[#0F0D2E] text-white text-sm font-semibold transition-colors"
        >
          Return Home
        </Link>
        <Link
          to="/shop"
          className="px-5 py-2.5 rounded-lg border border-[#1E1B4B] text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-white text-sm font-semibold transition-colors"
        >
          Browse Catalog
        </Link>
      </div>
    </div>
  );
}

function withStorefront(node: React.ReactNode) {
  return <StorefrontLayout>{node}</StorefrontLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ScrollToTop />
        <Routes>
          {/* Separate Secure Admin Portal Routes */}
          <Route
            path="/admin/login"
            element={
              <>
                <AdminLoginPage />
                <ToastContainer />
              </>
            }
          />
          <Route
            path="/admin"
            element={
              <>
                <AdminPanelPage />
                <ToastContainer />
              </>
            }
          />
          <Route
            path="/admin/:section"
            element={
              <>
                <AdminPanelPage />
                <ToastContainer />
              </>
            }
          />

          {/* Customer Storefront Routes */}
          <Route path="/" element={withStorefront(<HomePage />)} />
          <Route path="/shop" element={withStorefront(<ShopPage />)} />
          <Route path="/category/:slug" element={withStorefront(<ShopPage />)} />
          <Route path="/product/:slug" element={withStorefront(<ProductDetailPage />)} />
          <Route path="/search" element={withStorefront(<SearchPage />)} />
          <Route path="/wishlist" element={withStorefront(<WishlistPage />)} />
          <Route path="/cart" element={withStorefront(<CartPage />)} />
          <Route path="/checkout" element={withStorefront(<CheckoutPage />)} />
          <Route path="/payment-status/:status" element={withStorefront(<PaymentStatusPage />)} />

          {/* Customer Authentication & Account */}
          <Route path="/login" element={withStorefront(<LoginPage />)} />
          <Route path="/signup" element={withStorefront(<SignupPage />)} />
          <Route path="/forgot-password" element={withStorefront(<ForgotPasswordPage />)} />
          <Route path="/reset-password" element={withStorefront(<ResetPasswordPage />)} />
          <Route path="/verify-email" element={withStorefront(<VerifyEmailPage />)} />
          <Route path="/account" element={withStorefront(<AccountDashboardPage />)} />
          <Route path="/track-order" element={withStorefront(<OrderTrackingPage />)} />

          {/* Static, Legal & Customer Support Pages */}
          <Route path="/about" element={withStorefront(<StaticInfoPage pageKey="about" />)} />
          <Route path="/contact" element={withStorefront(<StaticInfoPage pageKey="contact" />)} />
          <Route path="/faq" element={withStorefront(<StaticInfoPage pageKey="faq" />)} />
          <Route path="/privacy-policy" element={withStorefront(<StaticInfoPage pageKey="privacy" />)} />
          <Route path="/terms" element={withStorefront(<StaticInfoPage pageKey="terms" />)} />
          <Route path="/shipping-policy" element={withStorefront(<StaticInfoPage pageKey="shipping" />)} />
          <Route path="/return-policy" element={withStorefront(<StaticInfoPage pageKey="returns" />)} />
          <Route
            path="/cancellation-policy"
            element={withStorefront(<StaticInfoPage pageKey="cancellation" />)}
          />
          <Route path="/support" element={withStorefront(<StaticInfoPage pageKey="support" />)} />

          {/* Fallback */}
          <Route path="*" element={withStorefront(<NotFoundPage />)} />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
}
