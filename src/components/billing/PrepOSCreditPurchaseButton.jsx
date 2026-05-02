'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, WalletCards } from 'lucide-react';
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
  if (!response.ok) throw new Error(data.error || 'Payment request failed');
  return data;
}

export function PrepOSCreditPurchaseButton({ pack, className = '', onSuccess }) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handlePurchase() {
    try {
      setStatus('loading');
      setMessage('');

      const authResponse = await fetch('/api/auth/me');
      if (authResponse.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent('/pricing/prepos')}`;
        return;
      }

      const authData = await authResponse.json().catch(() => ({}));
      const user = authData?.user;
      if (!user?.id) throw new Error('Login required before buying PrepOS credits');

      await loadRazorpayCheckout();

      const { keyId, order, pack: serverPack } = await postJson('/api/ai/credits/order', {
        packKey: pack.key,
      });

      const checkout = new window.Razorpay({
        key: keyId,
        name: 'MockMob PrepOS',
        description: `${serverPack.credits} PrepOS credits`,
        order_id: order.id,
        amount: serverPack.amountPaise,
        currency: 'INR',
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        notes: {
          userId: user.id,
          packKey: serverPack.key,
          credits: String(serverPack.credits),
        },
        theme: {
          color: '#d2f000',
        },
        handler: async (response) => {
          try {
            setStatus('loading');
            const verified = await postJson('/api/ai/credits/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setStatus('success');
            setMessage(
              verified.idempotent || verified.alreadyCaptured
                ? 'PrepOS credits already added.'
                : `${verified.granted ?? serverPack.credits} PrepOS credits added.`
            );
            onSuccess?.(verified);
          } catch (error) {
            setStatus('error');
            setMessage(error.message || 'Could not verify payment.');
          }
        },
        modal: {
          ondismiss: () => {
            setStatus('idle');
            setMessage('Checkout closed.');
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
      setMessage(error.message || 'Could not start checkout.');
    }
  }

  const loading = status === 'loading';
  const success = status === 'success';

  return (
    <div className={className}>
      <LiquidGlassButton
        type="button"
        variant={pack.featured ? 'volt' : 'ghost'}
        size="md"
        className="w-full"
        disabled={loading}
        onClick={handlePurchase}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <CheckCircle2 className="h-4 w-4" /> : <WalletCards className="h-4 w-4" />}
        {loading ? 'Opening checkout' : success ? 'Credits added' : `Buy for ₹${pack.amountInr}`}
      </LiquidGlassButton>
      {message ? (
        <div className={`mt-3 flex items-center gap-2 text-xs ${success ? 'text-volt' : 'text-zinc-400'}`}>
          {success ? <ShieldCheck className="h-4 w-4" /> : null}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
