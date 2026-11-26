import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { BrandLogo } from '../components/BrandLogo';
import type { UserProfile } from '../types';

export function LoginPage() {
  const navigate = useNavigate();
  const { signInWithGoogle, setSessionUser, showToast } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useSeo({ title: 'Customer Sign In — SHAIKCART' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setSessionUser(data.token, data.user);
      showToast(`Welcome back, ${data.user.fullName}`);
      navigate('/account');
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const profile = await signInWithGoogle();
    if (profile) {
      navigate(profile.isAdmin ? '/admin' : '/account');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <BrandLogo />
          </div>
          <h1 className="text-2xl font-bold text-[#0F0D2E]">Welcome Back</h1>
          <p className="text-xs text-[#0F0D2E]/60">Sign in to access orders, wishlist, and saved addresses.</p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full h-11 rounded-lg border border-[#E6EAF2] bg-[#F8F9FC]/50 hover:bg-[#F8F9FC] text-sm font-medium text-[#0F0D2E] transition-colors flex items-center justify-center gap-2.5"
        >
          <span className="font-bold text-[#1E1B4B]">G</span> Continue with Google
        </button>

        <div className="relative text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E6EAF2]" />
          </div>
          <span className="relative bg-white px-3 text-xs text-[#0F0D2E]/50">or sign in with email</span>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#0F0D2E]">Password</label>
              <Link to="/forgot-password" className="text-xs text-[#1E1B4B] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-11 pl-3.5 pr-10 rounded-lg border border-[#E6EAF2] text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0D2E]/50 hover:text-[#0F0D2E]"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E] disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-[#0F0D2E]/65">
          New to SHAIKCART?{' '}
          <Link to="/signup" className="font-semibold text-[#1E1B4B] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { signInWithGoogle, setSessionUser, showToast } = useStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useSeo({ title: 'Create Account — SHAIKCART' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const data = await apiRequest<{ token: string; user: UserProfile; verificationHint?: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ fullName, email, phone, password }),
        }
      );
      await setSessionUser(data.token, data.user);
      showToast(data.verificationHint || 'Account created cleanly!');
      navigate('/account');
    } catch (err: any) {
      setError(err?.message || 'Unable to register account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <BrandLogo />
          </div>
          <h1 className="text-2xl font-bold text-[#0F0D2E]">Create Customer Account</h1>
          <p className="text-xs text-[#0F0D2E]/60">
            Track orders, manage addresses, and save favourite pieces across devices.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            const p = await signInWithGoogle();
            if (p) navigate('/account');
          }}
          className="w-full h-11 rounded-lg border border-[#E6EAF2] bg-[#F8F9FC]/50 hover:bg-[#F8F9FC] text-sm font-medium text-[#0F0D2E] flex items-center justify-center gap-2.5"
        >
          <span className="font-bold text-[#1E1B4B]">G</span> Sign up with Google
        </button>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Aarav Sharma"
              className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Phone Number (Optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F0D2E] mb-1.5">Password (Min 8 characters)</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full h-11 pl-3.5 pr-10 rounded-lg border border-[#E6EAF2] text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0D2E]/50"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold hover:bg-[#0F0D2E]"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-[#0F0D2E]/65">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-[#1E1B4B] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useSeo({ title: 'Forgot Password — SHAIKCART' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
    } catch (err: any) {
      setMessage(err?.message || 'Unable to process request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-8 space-y-5">
        <div className="w-12 h-12 rounded-xl bg-[#F8F9FC] text-[#1E1B4B] flex items-center justify-center">
          <Mail size={22} />
        </div>
        <h1 className="text-2xl font-bold text-[#0F0D2E]">Reset Your Password</h1>
        <p className="text-xs text-[#0F0D2E]/65">
          Enter your registered SHAIKCART email address to generate a secure password reset token.
        </p>
        {message && (
          <div className="p-3.5 rounded-lg bg-[#F8F9FC] border border-[#E6EAF2] text-xs text-[#0F0D2E]">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold"
          >
            {loading ? 'Sending...' : 'Request Reset Link'}
          </button>
        </form>
        <div className="flex justify-between text-xs pt-2">
          <Link to="/reset-password" className="text-[#1E1B4B] hover:underline">
            Already have a reset token?
          </Link>
          <Link to="/login" className="text-[#0F0D2E]/65 hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<{ ok?: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useSeo({ title: 'Set New Password — SHAIKCART' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setStatus({ ok: true, text: res.message });
    } catch (err: any) {
      setStatus({ ok: false, text: err?.message || 'Reset failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-8 space-y-5">
        <div className="w-12 h-12 rounded-xl bg-[#F8F9FC] text-[#1E1B4B] flex items-center justify-center">
          <Lock size={22} />
        </div>
        <h1 className="text-2xl font-bold text-[#0F0D2E]">Set New Password</h1>
        {status && (
          <div
            className={`p-3.5 rounded-lg text-xs border ${
              status.ok
                ? 'bg-[#F8F9FC] border-[#1E1B4B]/30 text-[#1E1B4B]'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {status.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste reset token"
            className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm font-mono"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        <Link to="/login" className="block text-center text-xs text-[#1E1B4B] hover:underline">
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [result, setResult] = useState<{ ok?: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useSeo({ title: 'Verify Email — SHAIKCART' });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiRequest<{ message: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setResult({ ok: true, text: res.message });
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || 'Verification failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white rounded-2xl border border-[#E6EAF2] p-8 space-y-5">
        <div className="w-12 h-12 rounded-xl bg-[#F8F9FC] text-[#1E1B4B] flex items-center justify-center">
          <CheckCircle2 size={22} />
        </div>
        <h1 className="text-2xl font-bold text-[#0F0D2E]">Verify Email Address</h1>
        {result && (
          <div
            className={`p-3.5 rounded-lg text-xs border ${
              result.ok
                ? 'bg-[#F8F9FC] border-[#1E1B4B]/30 text-[#1E1B4B]'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {result.text}
          </div>
        )}
        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter verification token"
            className="w-full h-11 px-3.5 rounded-lg border border-[#E6EAF2] text-sm font-mono"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[#1E1B4B] text-white text-sm font-semibold"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
      </div>
    </div>
  );
}
