"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lock, Mail, UserRound } from 'lucide-react';
import { Input } from './Input';
import { LiquidGlassButton } from './LiquidGlassButton';
import { useAuth } from '@/components/AuthProvider';

export function SignupCard() {
  const { signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [googleLoading, setGoogleLoading] = useState(false);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setStatus('idle');

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match yet.');
      return;
    }

    setStatus('success');
  };

  const handleGoogleUi = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await signInWithGoogle();
      if (oauthError) {
        setError(oauthError.message || 'Google sign-in failed.');
      }
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="glass w-full max-w-md border border-white/10 bg-[rgba(255,255,255,0.02)] p-6 md:p-7">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="eyebrow mb-2">Display Name</label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. rank_chaser_07"
              className="pl-10"
              autoComplete="name"
            />
          </div>
        </div>

        <div>
          <label className="eyebrow mb-2">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="you@example.com"
              className="pl-10"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="eyebrow mb-2">Password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="Minimum 8 characters"
              className="pl-10"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <label className="eyebrow mb-2">Confirm Password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              placeholder="Re-enter password"
              className="pl-10"
              autoComplete="new-password"
            />
          </div>
        </div>

        <LiquidGlassButton type="submit" size="lg" className="mt-1 w-full">
          Create account
          <ArrowRight className="h-4 w-4" />
        </LiquidGlassButton>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10"></div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">or</div>
        <div className="h-px flex-1 bg-white/10"></div>
      </div>

      <LiquidGlassButton variant="ghost" size="lg" className="w-full" onClick={handleGoogleUi} disabled={googleLoading}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
        </svg>
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </LiquidGlassButton>

      <div className="mt-4 min-h-5 text-xs">
        {error ? <p className="text-red-400">{error}</p> : null}
        {status === 'success' && !error ? (
          <p className="text-volt">UI ready. We can connect real auth next.</p>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-volt transition-colors hover:text-[#e8ff4a]">
          Log in
        </Link>
      </p>
    </div>
  );
}
