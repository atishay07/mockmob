// The wallet's one client purchase function. Every "Add for" key on the Wallet page, and any later surface that sells a
// pack, calls startWalletPurchase(pack). It posts { packId } to ONE route (POST /api/wallet/order), opens Razorpay checkout for
// the order the server made, and on payment posts the three Razorpay fields to POST /api/wallet/verify. The price is never sent:
// the server reads it from its own catalog.
//
// Returns { status, message, granted?, balance? } and never throws:
//   'closed'    top-ups are not open (WALLET_COMMERCE_OPEN is not "true"); no order was created
//   'signin'    the session ended
//   'paid'      the server verified the payment and granted the credits (idempotent: a repeat says so)
//   'dismissed' the student closed checkout
//   'failed'    anything else; `message` says what, in plain words
// Dependencies are injectable so a test runs the whole flow with no network and no Razorpay script.

export const PURCHASE_COPY = Object.freeze({
  closed: 'Top-ups open soon.',
  signin: 'Sign in again to add credits.',
  dismissed: 'Checkout closed. Nothing was charged.',
  failed: 'Could not start the payment. Nothing was charged. Try again.',
  verifyFailed: 'We could not confirm the payment. If money was taken, the credits are added within a few minutes; check your wallet.',
});

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject(new Error('no window')); return; }
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Checkout could not load. Try again.'));
    document.body.appendChild(script);
  });
}

async function postJson(fetchImpl, url, payload) {
  const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

const creditsAdded = (pool, n) => `${n} ${pool === 'practice' ? 'practice credits' : 'AI credits'} added.`;

/**
 * @param {{ packId: string, pool?: string, label?: string }} pack
 * @param {{ prefill?: {name?: string, email?: string}, fetchImpl?: typeof fetch, loadCheckout?: () => Promise<unknown>, openCheckout?: Function }} [options]
 */
export async function startWalletPurchase(pack, options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const loadCheckout = options.loadCheckout || loadRazorpayScript;
  if (!pack?.packId || !fetchImpl) return { status: 'failed', message: PURCHASE_COPY.failed };
  try {
    const made = await postJson(fetchImpl, '/api/wallet/order', { packId: pack.packId });
    if (made.status === 401) return { status: 'signin', message: PURCHASE_COPY.signin };
    if (made.status === 503 && made.data?.error === 'WALLET_COMMERCE_CLOSED') return { status: 'closed', message: PURCHASE_COPY.closed };
    if (!made.ok || !made.data?.order?.id) return { status: 'failed', message: made.data?.message || PURCHASE_COPY.failed };
    const { keyId, order, pack: served } = made.data;

    await loadCheckout();
    const open = options.openCheckout || ((config, on) => {
      const checkout = new window.Razorpay(config);
      checkout.on('payment.failed', (response) => on.failed(response?.error?.description));
      checkout.open();
    });

    return await new Promise((resolve) => {
      let settled = false;
      const done = (result) => { if (!settled) { settled = true; resolve(result); } };
      open({
        key: keyId,
        name: 'MockMob',
        description: served?.label || pack.label || 'Credits',
        order_id: order.id,
        amount: served?.pricePaise ?? order.amount,
        currency: 'INR',
        prefill: { name: options.prefill?.name || '', email: options.prefill?.email || '' },
        theme: { color: '#d2f000' },
        handler: async (response) => {
          try {
            const verified = await postJson(fetchImpl, '/api/wallet/verify', {
              razorpay_order_id: response?.razorpay_order_id,
              razorpay_payment_id: response?.razorpay_payment_id,
              razorpay_signature: response?.razorpay_signature,
            });
            if (!verified.ok) { done({ status: 'failed', message: PURCHASE_COPY.verifyFailed }); return; }
            const granted = Number(verified.data?.granted) || 0;
            done({
              status: 'paid',
              granted,
              balance: verified.data?.balance ?? null,
              message: verified.data?.idempotent || verified.data?.alreadyCaptured ? 'Credits already added.' : creditsAdded(served?.pool || pack.pool, granted || served?.credits || 0),
            });
          } catch {
            done({ status: 'failed', message: PURCHASE_COPY.verifyFailed });
          }
        },
        modal: { ondismiss: () => done({ status: 'dismissed', message: PURCHASE_COPY.dismissed }) },
      }, { failed: (description) => done({ status: 'failed', message: description || 'The payment did not go through. Nothing was charged.' }) });
    });
  } catch (error) {
    return { status: 'failed', message: error?.message || PURCHASE_COPY.failed };
  }
}
