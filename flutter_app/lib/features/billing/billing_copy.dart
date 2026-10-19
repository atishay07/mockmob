/// Every word of the Get Pro sheet and the AI credit packs (Google Play Billing, behind the
/// `PLAY_BILLING` flag). Plain, sentence case, no exclamation marks, no emoji, no hype.
///
/// Two rules the words keep (owner, 18 Oct 2026, and Google's anti-steering rule):
/// * a price is only ever Google Play's own string, passed in by the caller. No price is written
///   here and nothing says what it costs anywhere else.
/// * nothing mentions the website's price, checkout or pricing page, or says it is cheaper
///   somewhere else.
library;

import '../../core/copy/copy.dart';

abstract final class BillingCopy {
  // The Pro sheet.
  static const proTitle = 'Get Pro';
  static const proIncludesHeading = 'Pro includes';

  /// What Pro includes, in the app's own existing words (practice, mocks and Insights copy).
  static final List<String> proIncludes = [
    PlanCopy.bankPro,
    'Smart practice, which leans toward the chapters you miss.',
    'The exam-day screen, as you will meet it.',
    'Easy, Medium and Hard sets.',
    'Changed-answer and pace detail in Insights.',
  ];

  static const proTerms = 'One payment for the CUET 2027 cycle. It does not renew.';
  static const getPro = 'Get Pro';
  static const googlePlayNote = 'Payment is handled by Google Play.';
  static const restore = 'Restore purchases';
  static const tryAgain = 'Try again';
  static const done = 'Done';
  static const close = 'Close';

  /// Said under "Practice credits" screens that are out: Pro is what removes the limit.
  static const proRemovesLimit = 'Pro includes unlimited practice.';

  // Loading and availability.
  static const checkingStore = 'Checking Google Play';
  // "Not ready" rather than "not on this phone": the usual cause is a Play Store that is signed out
  // or out of date, which the student can fix.
  static const storeUnavailable =
      'Google Play is not ready on this phone, so nothing can be bought here just now. Open the Play Store, check that you are signed in, then try again.';
  static const storeUnreachable = 'We could not reach Google Play. Nothing was charged. Check your connection and try again.';
  static const productUnavailable = 'This is not available to buy just now. Nothing was charged.';

  // The purchase.
  static const opening = 'Opening Google Play';
  static const pending = 'Google Play is still processing your payment. It is added once Google Play confirms it. You can close this.';
  static const verifying = 'Confirming your payment with MockMob. This takes a moment.';
  static const cancelled = 'No payment was made.';
  static const restoring = 'Checking Google Play for your purchases';
  static const nothingToRestore = 'Google Play shows no purchase to restore for this account.';

  // Success: only ever shown after the server confirmed.
  static const proOnTitle = 'Pro is on';
  static const proOnBody = 'Your plan is up to date. Everything Pro includes is open.';
  static String creditsAddedTitle(int? credits) => credits == null ? 'Credits added' : '$credits ${credits == 1 ? 'credit' : 'credits'} added';
  static const creditsAddedBody = 'Your balance is up to date.';

  // Failures, each with a way out.
  static const failStore = 'Google Play could not complete this purchase. Try again, or use Restore purchases if you were charged.';
  static const failCouldNotConfirm =
      'Your payment went through with Google Play, but we could not confirm it with MockMob yet. Try again. We also check each time you open the app.';
  static const failOffline = 'Your payment went through with Google Play. Connect to the internet to confirm it with MockMob, then try again.';
  static const failNotOpenYet =
      'Your payment went through with Google Play, but MockMob cannot confirm purchases just now. We check again each time you open the app, and if it is still not confirmed after three days, Google Play refunds it.';
  static const failRateLimited =
      'Your payment is safe with Google Play. We have checked it several times in the last few minutes, so wait a few minutes, then try again.';

  // Final answers: trying again cannot change them, so these offer no Try again.
  static const failOtherAccount =
      'This purchase was made while you were signed in to a different MockMob account, so it cannot be added here. Sign in to that account to use it.';
  static const failRefunded = 'Google Play says this purchase was cancelled or refunded, so nothing was added.';
  static const failEnded = 'Pro for CUET 2027 can no longer be bought, so nothing was added. Google Play refunds a payment that is not confirmed within three days.';
  static const failRefused = 'We could not accept this purchase, so nothing was added. If you were charged, Google Play refunds you within three days.';

  // Top-ups on the Wallet: one set of packs for the one credits balance.
  static const topUpsTitle = 'Top up';
  static const topUpsSoon = 'Top-ups open soon.';
  static const topUpsNote = 'Held credits do not expire.';

  /// The server says new packs are paused (`/api/ai/credits` `checkout.open` false). The packs stay
  /// listed but cannot be bought (never hidden, D101).
  static const topUpsPaused = 'New credit packs are paused just now. Your credits are kept and still work.';
  static const getCredits = 'Add credits';
  static String packLabel(int credits) => credits == 1 ? '1 credit' : '$credits credits';
  static String packSemantics(int credits, String? price) => price == null ? packLabel(credits) : '${packLabel(credits)}, $price';
}
