// One page-wide checkout status, so surfaces outside the plan card (the phone dock on /pricing)
// never invite a second payment while one is being confirmed, after money may have moved, or
// once Pro is active. Written by RazorpayPaymentButton, read with useSyncExternalStore.
//   'open'        nothing in progress
//   'confirming'  payment taken by the checkout, verification running
//   'hold'        an error after the checkout took a payment: do not pay again
//   'active'      Pro is active on this account
let status = 'open';
const listeners = new Set();

export function setCheckoutStatus(next) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function subscribeCheckoutStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readCheckoutStatus() {
  return status;
}

export function readCheckoutStatusOnServer() {
  return 'open';
}
