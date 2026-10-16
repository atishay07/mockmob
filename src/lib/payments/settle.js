import { Database } from '@/../data/db';
import { resolveUserEntitlement } from './entitlements';

/**
 * Writes the user's plan fields after a subscription event. It reads the user's other paid access
 * first, so a failed, halted or cancelled subscription never shortens a one-time pass or a
 * different subscription the user also holds.
 *
 * ownStatus        status this event implies ('active', 'past_due', 'cancelled', 'free')
 * ownAccessUntil   paid-through date of this subscription, or null when it never paid
 * subscriptionId   the subscription the event is about
 * paymentId        the payment in the event, excluded from "other" evidence
 * ownPaid          whether this subscription has paid evidence
 * forceOwnId       true on a grant: this subscription becomes the user's current one
 */
export async function settleUserEntitlement({
  userId,
  ownStatus,
  ownAccessUntil = null,
  subscriptionId,
  paymentId = null,
  ownPaid = Boolean(ownAccessUntil),
  forceOwnId = false,
  nowMs = Date.now(),
}) {
  const [other, user] = await Promise.all([
    Database.getOtherPaidAccess({ userId, excludingSubscriptionId: subscriptionId, excludingPaymentId: paymentId }),
    Database.getUserById(userId),
  ]);

  const entitlement = resolveUserEntitlement({
    ownStatus,
    ownAccessUntil: ownPaid ? ownAccessUntil : null,
    otherAccessUntil: other.accessUntil,
    hasOtherPaid: other.hasOtherPaid,
    userPremiumUntil: user?.premiumUntil || null,
    nowMs,
  });

  const patch = {
    subscriptionStatus: entitlement.subscriptionStatus,
    isPremium: entitlement.isPremium,
    premiumUntil: entitlement.premiumUntil,
  };

  if (ownPaid && (forceOwnId || entitlement.ownWins)) {
    patch.razorpaySubscriptionId = subscriptionId;
  } else if (!ownPaid && !other.hasOtherPaid) {
    patch.razorpaySubscriptionId = null;
  }
  // Otherwise the user's subscription id stays as it is: another paid plan is the current one.

  return Database.updateUser(userId, patch);
}
