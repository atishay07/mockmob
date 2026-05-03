'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, Loader2, ShieldCheck, Tag } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';

const REF_STORAGE_KEY = 'mm_ref';
const CODE_PATTERN = /^[a-z0-9._-]{1,64}$/;

function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Payment request failed');
  }
  return data;
}

function readRefFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || params.get('code') || '';
  } catch {
    return '';
  }
}

function readRefFromStorage() {
  try {
    return localStorage.getItem(REF_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function readRefFromCookie() {
  try {
    const match = document.cookie.match(/(?:^|;\s*)mm_ref=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

function persistRef(value) {
  try {
    if (value) localStorage.setItem(REF_STORAGE_KEY, value);
  } catch {
    /* localStorage may be disabled */
  }
}

function normalizeCodeInput(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function RazorpayPaymentButton({
  planId,
  amount,
  label = 'Go Pro',
  initialIsPremium = false,
}) {
  const { refreshSession } = useAuth();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState(null); // { code, offerId } once subscription created

  // Prefill on mount: URL ?ref= wins, then localStorage. URL also writes
  // through to localStorage so the code persists across navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = normalizeCodeInput(readRefFromUrl());
    if (fromUrl && CODE_PATTERN.test(fromUrl)) {
      persistRef(fromUrl);
      const id = window.setTimeout(() => setCode(fromUrl), 0);
      return () => window.clearTimeout(id);
    }
    const fromStorage = normalizeCodeInput(readRefFromStorage());
    if (fromStorage && CODE_PATTERN.test(fromStorage)) {
      const id = window.setTimeout(() => setCode(fromStorage), 0);
      return () => window.clearTimeout(id);
    }
    const fromCookie = normalizeCodeInput(readRefFromCookie());
    if (fromCookie && CODE_PATTERN.test(fromCookie)) {
      const id = window.setTimeout(() => setCode(fromCookie), 0);
      return () => window.clearTimeout(id);
    }
  }, []);

  async function handlePayment() {
    try {
      setStatus('loading');
      setMessage('');

      const authResponse = await fetch('/api/auth/me');
      if (authResponse.status === 401) {
        // Preserve the code the user entered so they don't have to retype
        // it after sign-in.
        if (code) persistRef(normalizeCodeInput(code));
        window.location.href = '/login';
        return;
      }

      const authData = await authResponse.json();
      const user = authData?.user;
      if (!user?.id) {
        throw new Error('Login required before payment');
      }

      if (user.isPremium) {
        setIsPremium(true);
        setStatus('success');
        setMessage('You are already subscribed to premium.');
        return;
      }

      await loadRazorpayCheckout();

      const normalized = normalizeCodeInput(code);
      const codeForServer = normalized && CODE_PATTERN.test(normalized) ? normalized : undefined;

      const { keyId, subscription, plan, applied } = await postJson('/create-subscription', {
        userId: user.id,
        planId,
        amount,
        code: codeForServer,
      });

      if (applied?.code) {
        setAppliedCode(applied);
      } else if (codeForServer) {
        // Server silently dropped the code (unknown / inactive). Don't
        // block checkout — just tell the user it didn't apply.
        setMessage('Code not recognised — continuing without discount.');
      }

      const checkout = new window.Razorpay({
        key: keyId,
        name: 'MockMob',
        description: plan.name,
        subscription_id: subscription.id,
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        notes: {
          userId: user.id,
          planId,
          ...(applied?.code ? { creatorCode: applied.code } : {}),
        },
        theme: {
          color: '#d2f000',
        },
        handler: async (response) => {
          try {
            setStatus('loading');
            await postJson('/verify-payment', {
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: user.id,
            });
            await refreshSession({ silent: false });
            setIsPremium(true);
            setStatus('success');
            setMessage('Subscription verified. Pro is active.');
          } catch (error) {
            setStatus('error');
            setMessage(error.message);
          }
        },
        modal: {
          ondismiss: () => {
            setStatus('idle');
            setMessage('Payment cancelled.');
          },
        },
      });

      checkout.on('payment.failed', (response) => {
        setStatus('error');
        setMessage(response?.error?.description || 'Payment failed. Please try again.');
      });

      checkout.open();
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Payment failed. Please try again.');
    }
  }

  const isLoading = status === 'loading';

  if (isPremium) {
    return (
      <div className="w-full rounded-xl border border-volt/25 bg-volt/10 px-4 py-3 text-sm font-semibold text-volt">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span>You are already subscribed to premium</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label className="mb-3 block">
        <span className="mono-label mb-1.5 flex items-center gap-1.5 !text-zinc-400">
          <Tag className="h-3 w-3" />
          Have a referral / discount code?
        </span>
        <input
          className="input w-full"
          type="text"
          autoComplete="off"
          inputMode="text"
          value={code}
          onChange={(event) => {
            setAppliedCode(null);
            setMessage('');
            setCode(event.target.value);
          }}
          placeholder="creator code"
          maxLength={64}
          disabled={isLoading}
        />
        {appliedCode ? (
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-volt">
            <BadgeCheck className="h-3.5 w-3.5" />
            Code <strong className="font-semibold">{appliedCode.code}</strong> applied
          </span>
        ) : null}
      </label>

      <LiquidGlassButton
        type="button"
        size="lg"
        variant="volt"
        className="w-full"
        disabled={isLoading}
        onClick={handlePayment}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isLoading ? 'Processing' : label}
      </LiquidGlassButton>

      {message ? (
        <div className={`mt-3 flex items-center gap-2 text-xs ${status === 'success' ? 'text-volt' : 'text-zinc-400'}`}>
          {status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
