'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, Loader2, ShieldCheck, Tag } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const REF_STORAGE_KEY = 'mm_ref';
const CODE_PATTERN = /^(offer_[A-Za-z0-9]{6,64}|[a-z0-9._-]{1,64})$/;
const OFFER_ID_PATTERN = /^offer_[A-Za-z0-9]{6,64}$/;

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
  const trimmed = String(raw || '').trim();
  if (OFFER_ID_PATTERN.test(trimmed)) return trimmed;
  return trimmed.toLowerCase().replace(/\s+/g, '');
}

function formatCheckoutAmount(paise, currency = 'INR') {
  const amount = Number(paise);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (currency === 'INR') return `Rs ${Math.round(amount / 100)}`;
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

export function RazorpayPaymentButton({
  planId,
  amount,
  label = 'Go Pro',
  initialIsPremium = false,
  billing = 'once',
}) {
  const { refreshSession } = useAuth();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState(null);

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
        setMessage('Pro is already active on this account.');
        return;
      }

      await loadRazorpayCheckout();

      const normalized = normalizeCodeInput(code);
      const codeForServer = normalized && CODE_PATTERN.test(normalized) ? normalized : undefined;

      if (billing === 'monthly') {
        const { keyId, subscription, plan, referral } = await postJson('/create-monthly-subscription', {
          userId: user.id,
          planId,
          amount,
          code: codeForServer,
        });
        if (referral?.code) setMessage(`Referral ${referral.code} tracked. The monthly price does not change.`);
        const monthly = new window.Razorpay({
          key: keyId,
          name: 'MockMob',
          description: `${plan.name} · ₹${Math.round(plan.amount / 100)} a month, cancel anytime`,
          subscription_id: subscription.id,
          prefill: { name: user.name || '', email: user.email || '' },
          notes: { userId: user.id, planId },
          theme: { color: '#d2f000' },
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
              setMessage('Payment verified. Pro is active and renews monthly until you cancel in Account.');
            } catch (error) {
              setStatus('error');
              setMessage(error.message);
            }
          },
          modal: { ondismiss: () => { setStatus('idle'); setMessage('Checkout closed. Nothing was charged.'); } },
        });
        monthly.on('payment.failed', (response) => {
          setStatus('error');
          setMessage(response?.error?.description || 'Payment failed. Please try again.');
        });
        monthly.open();
        return;
      }

      const { keyId, order, plan, applied, referral } = await postJson('/create-order', {
        userId: user.id,
        planId,
        amount,
        code: codeForServer,
      });

      if (applied?.code) {
        setAppliedCode(applied);
        const checkoutAmount = formatCheckoutAmount(plan?.amount, plan?.currency);
        setMessage(
          applied.status === 'offer_attached'
            ? `Discount code ${applied.code} applied. Checkout price: ${checkoutAmount || 'discounted amount'}.`
            : `Referral ${applied.code} tracked for this access purchase.`
        );
      } else if (codeForServer) {
        setMessage(referral?.reason || 'Code not recognised. Continuing without discount.');
      }

      const checkout = new window.Razorpay({
        key: keyId,
        name: 'MockMob',
        description: plan.name,
        order_id: order.id,
        amount: plan.amount,
        currency: plan.currency,
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        notes: {
          userId: user.id,
          planId,
          ...(applied?.code ? { creatorCode: applied.code, referralStatus: applied.status } : {}),
          ...(referral?.code ? { referralCodeAttempted: referral.code } : {}),
        },
        theme: {
          color: '#d2f000',
        },
        handler: async (response) => {
          try {
            setStatus('loading');
            await postJson('/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: user.id,
            });
            await refreshSession({ silent: false });
            setIsPremium(true);
            setStatus('success');
            setMessage('Payment verified. Pro is active.');
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
      <div className="mm-checkout__active">
        <ShieldCheck aria-hidden="true" />
        <span>Pro is already active on this account</span>
      </div>
    );
  }

  return (
    <div className="mm-checkout">
      <label className="mm-checkout__field">
        <span className="mm-checkout__label">
          <Tag aria-hidden="true" />
          Referral or discount code
          <em>optional</em>
        </span>
        <input
          className="mm-checkout__input"
          type="text"
          autoComplete="off"
          inputMode="text"
          value={code}
          onChange={(event) => {
            setAppliedCode(null);
            setMessage('');
            setCode(event.target.value);
          }}
          placeholder="Paste a creator code"
          maxLength={64}
          disabled={isLoading}
        />
        {appliedCode ? (
          <span className="mm-checkout__applied">
            <BadgeCheck aria-hidden="true" />
            {appliedCode.status === 'tracked_no_offer' ? 'Referral' : 'Code'}{' '}
            <strong>{appliedCode.code}</strong>{' '}
            {appliedCode.status === 'tracked_no_offer' ? 'tracked' : 'applied'}
          </span>
        ) : null}
      </label>

      <button
        type="button"
        className="mm-btn mm-btn--primary mm-checkout__submit"
        disabled={isLoading}
        onClick={handlePayment}
      >
        {isLoading ? <Loader2 className="mm-checkout__spin" aria-hidden="true" /> : null}
        {isLoading ? 'Opening secure checkout' : label}
      </button>

      {message ? (
        <p className="mm-checkout__msg" data-tone={status === 'success' ? 'ok' : status === 'error' ? 'bad' : 'info'} role="status">
          {status === 'success' ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <AlertCircle aria-hidden="true" />
          )}
          <span>
            {message}
            {status === 'error' ? ' Nothing has been charged — you can try again.' : ''}
          </span>
        </p>
      ) : null}

      <p className="mm-checkout__trust">
        <ShieldCheck aria-hidden="true" />
        Secured by Razorpay · UPI, cards, netbanking ·{' '}
        <a href="/refunds">Refund policy</a>
      </p>
    </div>
  );
}
