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
  static const storeUnavailable = 'Google Play is not available on this phone, so this cannot be bought here.';
  static const storeUnreachable = 'We could not reach Google Play. Nothing was charged.';
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
  static String creditsAddedTitle(int? credits) => credits == null ? 'AI credits added' : '${credits == 1 ? '1 AI credit' : '$credits AI credits'} added';
  static const creditsAddedBody = 'Your balance is up to date. Purchased credits do not expire.';

  // Failures, each with a way out.
  static const failStore = 'Google Play could not complete this purchase. Try again, or use Restore purchases if you were charged.';
  static const failCouldNotConfirm =
      'Your payment went through with Google Play, but we could not confirm it with MockMob yet. Try again. We also check each time you open the app.';
  static const failOffline = 'Your payment went through with Google Play. Connect to the internet to confirm it with MockMob, then try again.';
  static const failNotOpenYet =
      'Your payment went through with Google Play, but MockMob cannot confirm purchases just now. It stays with Google Play and we check again each time you open the app.';

  // AI credit packs.
  static const packsTitle = 'Add AI credits';
  static const packsBody = 'For Ask Mobi and repair explanations. Purchased credits do not expire.';
  static const getCredits = 'Get AI credits';
  static String packLabel(int credits) => credits == 1 ? '1 AI credit' : '$credits AI credits';
  static String packSemantics(int credits, String? price) => price == null ? packLabel(credits) : '${packLabel(credits)}, $price';
  static const packsSheetTitle = 'AI credits';
}
