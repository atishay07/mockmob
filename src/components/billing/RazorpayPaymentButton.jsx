'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';

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

export function RazorpayPaymentButton({
  planId,
  amount,
  label = 'Go Pro',
  initialIsPremium = false,
}) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isPremium, setIsPremium] = useState(initialIsPremium);

  async function handlePayment() {
    try {
      setStatus('loading');
      setMessage('');

      const authResponse = await fetch('/api/auth/me');
      if (authResponse.status === 401) {
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

      const { keyId, subscription, plan } = await postJson('/create-subscription', {
        userId: user.id,
        planId,
        amount,
      });

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
