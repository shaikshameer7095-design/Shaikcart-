import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiRequest } from '../../lib/api';
import { useSeo } from '../../hooks/useSeo';
import { BrandLogo } from '../../components/BrandLogo';
import type { UserProfile } from '../../types';

interface BootstrapStatus {
  passcodeConfigured: boolean;
  needsFirstRunSetup: boolean;
  googleAdminEmailHint: string;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, authLoading, signInWithGoogle, setSessionUser, showToast } = useStore();

  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null);
  const [mode, setMode] = useState<'login' | 'claim'>('login');

  const [fullName, setFullName] = useState('SHAIKCART Super Admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useSeo({
    title: 'Admin Portal Sign In — SHAIKCART',
    description: 'Secure role-based administration portal for SHAIKCART e-commerce operations.',
  });

  useEffect(() => {
    if (!authLoading && user?.isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    apiRequest<BootstrapStatus>('/api/admin/auth/bootstrap-status')
      .then((data) => {
        setBootstrap(data);
        if (data.needsFirstRunSetup) {
          setMode('claim');
          if (data.googleAdminEmailHint) {
            setEmail(data.googleAdminEmailHint);
          }
        }
      })
      .catch(() => {
        setBootstrap({
          passcodeConfigured: false,
          needsFirstRunSetup: false,
          googleAdminEmailHint: '',
        });
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setSessionUser(data.token, data.user);
      showToast(`Signed in to Admin Portal as ${data.user.role.replace('_', ' ')}`);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Unable to authenticate administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 10) {
      setError('Super Admin password must be at least 10 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      setSubmitting(true);
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/admin/auth/claim', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password }),
      });
      await setSessionUser(data.token, data.user);
      showToast('Initial Super Admin account created and locked.');
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Unable to complete first-run setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAdmin = async () => {
    setError('');
    const profile = await signInWithGoogle();
    if (!profile) return;
    if (profile.isAdmin) {
      navigate('/admin', { replace: true });
    } else {
      setError(
        `Signed in as ${profile.email}, which currently has the "customer" role. An administrator must grant admin permissions, or sign in with the authorized owner account.`
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0D2E] flex flex-col justify-between">
      <div className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <BrandLogo light />
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-[#F8F9FC]/80 hover:text-[#E11D48] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Storefront
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#1E1B4B]/20">
          {/* Left Executive Brand Column */}
          <div className="lg:col-span-5 bg-[#1E1B4B] text-[#F8F9FC] p-8 lg:p-10 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-[#E11D48]">
                <ShieldCheck className="w-4 h-4" />
                Restricted Operations Console
              </div>
              <div className="space-y-3">
                <h1 className="text-2xl lg:text-3xl font-bold leading-tight text-white">
                  SHAIKCART Command Center
                </h1>
                <p className="text-sm text-[#F8F9FC]/75 leading-relaxed">
                  Manage catalog inventory, GST orders, Razorpay settlements, shipping zones, CMS storefronts, and role-based team access from one auditable console.
                </p>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 space-y-3 text-xs text-[#F8F9FC]/75">
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <span>Every admin login, inventory edit, order change, and refund is recorded in the audit log.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <span>
                  Authorized roles: Super Admin, Admin, Manager, Inventory Manager, and Order Manager.
                </span>
              </div>
            </div>
          </div>

          {/* Right Form Column */}
          <div className="lg:col-span-7 p-8 lg:p-10 space-y-6 bg-white">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#0F0D2E]">
                {mode === 'claim' ? 'First-Run Super Admin Setup' : 'Administrator Sign In'}
              </h2>
              <p className="text-xs text-[#0F0D2E]/65">
                {mode === 'claim'
                  ? 'No admin password has been claimed yet. Claim the initial Super Admin account below or sign in with Google.'
                  : 'Sign in with your authorized SHAIKCART administrator credentials.'}
              </p>
            </div>

            {bootstrap?.needsFirstRunSetup && (
              <div className="flex rounded-lg bg-[#F8F9FC] p-1 border border-[#E6EAF2]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('claim');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                    mode === 'claim'
                      ? 'bg-[#1E1B4B] text-white'
                      : 'text-[#0F0D2E]/70 hover:text-[#0F0D2E]'
                  }`}
                >
                  First-Run Setup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                    mode === 'login'
                      ? 'bg-[#1E1B4B] text-white'
                      : 'text-[#0F0D2E]/70 hover:text-[#0F0D2E]'
                  }`}
                >
                  Existing Admin Sign In
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleAdmin}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-[#E6EAF2] hover:bg-[#F8F9FC] text-sm font-medium text-[#0F0D2E] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              Continue with Google (Authorized Admin)
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#E6EAF2] w-full" />
              <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-[#0F0D2E]/50 whitespace-nowrap">
                or use email &amp; password
              </span>
              <div className="border-t border-[#E6EAF2] w-full" />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
                {error}
              </div>
            )}

            {mode === 'claim' ? (
              <form onSubmit={handleClaim} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Shameer Shaik"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF2] text-sm focus:outline-none focus:border-[#1E1B4B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Admin Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#0F0D2E]/40 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@shaikcart.in"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-[#E6EAF2] text-sm focus:outline-none focus:border-[#1E1B4B]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#0F0D2E] mb-1">
                      Password (min 10 chars)
                    </label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={10}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create strong password"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF2] text-sm focus:outline-none focus:border-[#1E1B4B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0F0D2E] mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={10}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF2] text-sm focus:outline-none focus:border-[#1E1B4B]"
                    />
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-[#0F0D2E]/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPass}
                    onChange={(e) => setShowPass(e.target.checked)}
                    className="rounded border-[#E6EAF2]"
                  />
                  Show password
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1E1B4B] hover:bg-[#0F0D2E] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  {submitting ? 'Claiming Super Admin...' : 'Claim Initial Super Admin & Enter'}
                </button>
                <p className="text-[11px] text-[#0F0D2E]/55 leading-relaxed">
                  One-time bootstrap: Once claimed, this setup form permanently disables itself and future administrators can only be promoted inside the Customers &amp; Roles module.
                </p>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Admin Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#0F0D2E]/40 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@shaikcart.in"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-[#E6EAF2] text-sm focus:outline-none focus:border-[#1E1B4B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0F0D2E] mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#0F0D2E]/40 absolute left-3.5 top-3" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-[#E6EAF2] text-sm focus:outline-none focus:border-[#1E1B4B]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-2.5 text-[#0F0D2E]/50 hover:text-[#0F0D2E]"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1E1B4B] hover:bg-[#0F0D2E] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Verifying Credentials...' : 'Sign In to Admin Panel'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-[11px] text-[#F8F9FC]/50">
        © {new Date().getFullYear()} SHAIKCART Commerce Operations · Protected by Role-Based Access Control
      </footer>
    </div>
  );
}
