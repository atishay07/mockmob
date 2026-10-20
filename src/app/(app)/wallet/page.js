import WalletPageClient from './WalletPageClient';
import { publicOffer } from '@/lib/payments/offer';
import { AppViewNotice } from '@/components/AppViewNotice';

export const metadata = {
  title: 'Wallet | MockMob',
  description: 'One credits balance for practice and Mobi’s written answers: what you hold, what is free this month, and what you used.',
};

// What /pricing sells today, read on the server (the monthly plan id is server-only), so the bridge to Pro names the real price.
function proOfferNow() {
  const offer = publicOffer();
  return offer.purchasable === 'monthly'
    ? { rupees: offer.monthly.rupees, cycle: 'month', expires: null }
    : { rupees: offer.oneTime.rupees, cycle: 'once', expires: offer.oneTime.expires };
}

// Opened from the Android app (?from=app): no packs or plans, a plain notice (src/app/app-view.css). The wrapper adds no box.
export default function WalletPage() {
  return (
    <>
      <AppViewNotice />
      <div data-commerce-page>
        <WalletPageClient proOffer={proOfferNow()} />
      </div>
    </>
  );
}
