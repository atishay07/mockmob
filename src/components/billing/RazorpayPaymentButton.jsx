'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, Loader2, ShieldCheck, Tag } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { setCheckoutStatus } from '@/lib/payments/checkoutStatus';
import { shownName } from '@/lib/displayName.mjs';

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
    script.onerror = () => reject(new Error('Checkout could not load. Try again.'));
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
    const error = new Error(data.error || 'Could not start the payment. Try again.');
    error.code = data.code || null;
    throw error;
  }
  return data;
}

// A server message may lack its full stop; the line that follows it must start a new sentence.
const asSentence = (text) => {
  const value = String(text || '').trim();
  return value && !/[.!?]$/.test(value) ? `${value}.` : value;
};
// These refusals mean "you already have Pro or an open plan": trying again cannot help, so no retry line follows.
const NO_RETRY_CODES = new Set(['already_active', 'subscription_open']);

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
  // Once Razorpay's window has taken a payment, an error no longer means "nothing was charged".
  const [afterPayment, setAfterPayment] = useState(false);
  const [noRetry, setNoRetry] = useState(false);
  // The code field stays folded behind one quiet link (version 13: one dominant key), and opens by itself when a code is prefilled.
  const [codeOpen, setCodeOpen] = useState(false);

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

  // Tell the rest of the page (the phone dock) where checkout stands.
  useEffect(() => {
    setCheckoutStatus(isPremium ? 'active' : status === 'confirming' ? 'confirming' : status === 'error' && afterPayment ? 'hold' : 'open');
  }, [isPremium, status, afterPayment]);
  useEffect(() => () => setCheckoutStatus('open'), []);

  async function handlePayment() {
    try {
      setStatus('loading');
      setMessage('');
      setAfterPayment(false);
      setNoRetry(false);

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
        throw new Error('Sign in before paying.');
      }

      if (user.isPremium) {
        // The green "already active" box says it; a second line would repeat it.
        setIsPremium(true);
        setStatus('idle');
        setMessage('');
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
          description: `${plan.name}, ₹${Math.round(plan.amount / 100)} a month, cancel anytime`,
          subscription_id: subscription.id,
          prefill: { name: shownName(user.name, user.email) || '', email: user.email || '' },
          notes: { userId: user.id, planId },
          theme: { color: '#d2f000' },
          handler: async (response) => {
            try {
              setStatus('loading');
              setAfterPayment(true);
              const verified = await postJson('/verify-payment', {
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.id,
              });
              if (verified?.pending) {
                setStatus('confirming');
                setMessage(verified.message || 'Your payment is being confirmed. Pro turns on within a few minutes.');
                return;
              }
              await refreshSession({ silent: false });
              setIsPremium(true);
              setStatus('success');
              setMessage('Payment verified. Pro is active and renews every month until you cancel in Account, where the date of your next payment is shown.');
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
          name: shownName(user.name, user.email) || '',
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
            setAfterPayment(true);
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
            setMessage('Checkout closed. Nothing was charged.');
          },
        },
      });

      checkout.on('payment.failed', (response) => {
        setStatus('error');
        setMessage(response?.error?.description || 'Payment failed. Please try again.');
      });

      checkout.open();
    } catch (error) {
      setNoRetry(NO_RETRY_CODES.has(error?.code));
      setStatus('error');
      setMessage(error.message || 'Payment failed. Please try again.');
    }
  }

  const isLoading = status === 'loading';
  const isConfirming = status === 'confirming';

  if (isPremium) {
    return (
      <div className="mm-checkout__done">
        <div className="mm-checkout__active">
          <ShieldCheck aria-hidden="true" />
          <span>Pro is already active on this account</span>
        </div>
        {status === 'success' && message ? (
          <p className="mm-checkout__msg" data-tone="ok" role="status">
            <CheckCircle2 aria-hidden="true" />
            <span>{message}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mm-checkout">
      {codeOpen || code ? (
      <label className="mm-checkout__field">
        <span className="mm-checkout__label">
          <Tag aria-hidden="true" />
          {billing === 'monthly' ? 'Referral code' : 'Referral or discount code'}
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
            setCodeOpen(true);
            setCode(event.target.value);
          }}
          placeholder="Paste a creator code"
          maxLength={64}
          disabled={isLoading || isConfirming}
        />
        {billing === 'monthly' ? <span className="mm-checkout__hint">A referral code does not change the price.</span> : null}
        {appliedCode ? (
          <span className="mm-checkout__applied">
            <BadgeCheck aria-hidden="true" />
            {appliedCode.status === 'tracked_no_offer' ? 'Referral' : 'Code'}{' '}
            <strong>{appliedCode.code}</strong>{' '}
            {appliedCode.status === 'tracked_no_offer' ? 'tracked' : 'applied'}
          </span>
        ) : null}
      </label>
      ) : null}

      <button
        type="button"
        className="mm-btn mm-btn--primary mm-checkout__submit"
        disabled={isLoading || isConfirming}
        onClick={handlePayment}
      >
        {isLoading ? <Loader2 className="mm-checkout__spin" aria-hidden="true" /> : null}
        {isLoading ? 'Opening secure checkout' : isConfirming ? 'Confirming your payment' : label}
      </button>

      {codeOpen || code ? null : (
        <button type="button" className="mm-checkout__codelink" onClick={() => setCodeOpen(true)} disabled={isLoading || isConfirming}>
          {billing === 'monthly' ? 'Have a referral code?' : 'Have a referral or discount code?'}
        </button>
      )}

      {message ? (
        <p className="mm-checkout__msg" data-tone={status === 'success' ? 'ok' : status === 'error' ? 'bad' : 'info'} role="status">
          {status === 'success' ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <AlertCircle aria-hidden="true" />
          )}
          <span>
            {status === 'error' ? asSentence(message) : message}
            {status === 'error' && !noRetry
              ? (afterPayment
                ? ' If money left your account, do not pay again. Pro turns on once Razorpay confirms it, or write to support.'
                : ' Nothing has been charged. You can try again.')
              : ''}
          </span>
        </p>
      ) : null}

      <p className="mm-checkout__trust">
        <ShieldCheck aria-hidden="true" />
        Secured by Razorpay. Pay by UPI, card or netbanking.{' '}
        <a href="/refunds">Refund policy</a>
      </p>
    </div>
  );
}
