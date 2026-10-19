import { Database } from '@/../data/db';
import { isFutureIso, resolveUserEntitlement } from './entitlements';

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

/**
 * After a Razorpay refund that leaves Pro on for other paid access (another Pro payment, a Google Play Pro or subscription
 * in force): the refunded payment's own date must not live on in users.premium_until. Lower it to the latest date the
 * other access runs to, the same rule mm_play_revoke_purchase follows for a voided Play pass (review 19 Oct night).
 * Never raises a date, and never touches a user whose other access includes a legacy payment with no end date.
 * The status word is left alone: it belongs to the subscription that set it.
 */
export async function shrinkPremiumToOtherPaidAccess({ userId, excludingSubscriptionId = null, excludingPaymentId = null, nowMs = Date.now() }) {
  const [other, user] = await Promise.all([
    Database.getOtherPaidAccess({ userId, excludingSubscriptionId, excludingPaymentId }),
    Database.getUserById(userId),
  ]);
  if (!user?.premiumUntil || !other?.accessUntil || other.hasUndatedPaid) return null;
  if (!(Date.parse(user.premiumUntil) > Date.parse(other.accessUntil))) return null;
  return Database.updateUser(userId, { premiumUntil: other.accessUntil, isPremium: isFutureIso(other.accessUntil, nowMs) });
}
