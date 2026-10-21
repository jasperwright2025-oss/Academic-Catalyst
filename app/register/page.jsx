'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, login } from '../../lib/api/client';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { fullName, email, password, confirmPassword } = formData;

    // --- FRONTEND VALIDATION CHECKS ---
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      // 1. Dispatch registration request payload to our backend auth route
      await register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });

      try {
        // 2. Attempt immediate automatic sign-in for seamless onboarding
        await login({ email: email.trim(), password });
        router.push('/dashboard');
        router.refresh();
      } catch (loginErr) {
        // If auto-login fails, it usually means Supabase requires email validation activation links
        setEmailConfirmationRequired(true);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  if (emailConfirmationRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 font-sans text-slate-100">
        <div className="w-full max-w-md space-y-6 text-center bg-slate-800 p-8 rounded-xl shadow-xl border border-slate-700">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            ✉️
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Account Created!</h2>
          <p className="text-sm text-slate-400">
            We have sent an authentication link to <span className="text-slate-200 font-medium">{formData.email}</span>. 
            Kindly check your inbox and confirm your email address, then proceed to log in.
          </p>
          <div className="pt-2">
            <Link href="/login" className="text-sm font-semibold text-amber-500 hover:text-amber-400 transition-colors">
              Return to Login Page &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 font-sans text-slate-100">
      <div className="w-full max-w-md space-y-8 bg-slate-800 p-8 rounded-xl shadow-xl border border-slate-700">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Academic Catalyst</h2>
          <p className="mt-2 text-sm text-slate-400">Create an elite agency account to get started</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm" role="alert">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
            <input
              name="fullName"
              type="text"
              autoComplete="name"
              required
              disabled={loading}
              value={formData.fullName}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="consultant@agency.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Password</label>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              disabled={loading}
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Confirm Password</label>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={loading}
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Re-enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Sign Up As Consultant'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-amber-500 hover:text-amber-400 transition-colors">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
