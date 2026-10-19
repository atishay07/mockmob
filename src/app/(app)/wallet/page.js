import WalletPageClient from './WalletPageClient';
import { publicOffer } from '@/lib/payments/offer';

export const metadata = {
  title: 'Wallet | MockMob',
  description: 'One credits balance for every practice question and Ask Mobi reply: what you hold, what is free this month, and what you used.',
};

// What /pricing sells today, read on the server (the monthly plan id is server-only), so the bridge to Pro names the real price.
function proOfferNow() {
  const offer = publicOffer();
  return offer.purchasable === 'monthly'
    ? { rupees: offer.monthly.rupees, cycle: 'month', expires: null }
    : { rupees: offer.oneTime.rupees, cycle: 'once', expires: offer.oneTime.expires };
}

export default function WalletPage() {
  return <WalletPageClient proOffer={proOfferNow()} />;
}
