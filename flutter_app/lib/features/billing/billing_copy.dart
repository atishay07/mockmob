/// Every word of the Get Pro sheet and the AI credit packs (Google Play Billing, behind the
/// `PLAY_BILLING` flag). Plain, sentence case, no exclamation marks, no emoji, no hype.
///
/// Two rules the words keep (owner, 18 Oct 2026, and Google's anti-steering rule):
/// * a price is only ever Google Play's own string, passed in by the caller. No price is written
///   here and nothing says what it costs anywhere else. Pro is a monthly subscription that Google
///   Play renews; it is managed and cancelled in Google Play.
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

  /// Pro on Play is a monthly subscription (owner D135/D136). Google Play's own price string goes in
  /// front of the period, for example "₹149.00 a month"; no price is written here.
  static const perMonth = 'a month';
  static String pricePer(String price, String? period) => period == null ? price : '$price $period';

  /// The period words for Google Play's billing period (ISO 8601). Unknown periods say nothing.
  static String? periodWords(String? isoPeriod) => switch (isoPeriod) {
        'P1W' => 'a week',
        'P1M' || null => perMonth,
        'P3M' => 'every 3 months',
        'P6M' => 'every 6 months',
        'P1Y' => 'a year',
        _ => null,
      };

  static const proTerms = 'Renews monthly. Cancel anytime in Google Play.';
  static const manageSubscription = 'Manage subscription';
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
  static const pending =
      'Google Play is still processing your payment. We add it to your account as soon as Google Play confirms it, so you can close this.';

  /// The same wait for Pro: a subscription is not "added", it turns on.
  static const pendingPro = 'Google Play is still processing your payment. Pro turns on as soon as Google Play confirms it, so you can close this.';
  static const verifying = 'Confirming your payment with MockMob. This takes a moment.';
  static const cancelled = 'No payment was made.';
  static const restoring = 'Checking Google Play for your purchases';
  static const nothingToRestore = 'Google Play shows no purchase to restore for this account.';

  /// Restore pressed while Google Play is not ready. Short, because the line above it already says
  /// how to make Google Play ready.
  static const restoreNotReady = 'Your purchases can be checked once Google Play is ready on this phone.';

  // Success: only ever shown after the server confirmed.
  static const proOnTitle = 'Pro is on';
  static const proOnBody = 'Your plan is up to date. Everything Pro includes is open.';

  // A monthly subscription, as Google Play holds it. Dates are "12 November".
  static String subRenews(String date) => 'Everything Pro includes is open. Your subscription renews on $date. Cancel anytime in Google Play.';
  static const subRenewsNoDate = 'Everything Pro includes is open. Your subscription renews every month. Cancel anytime in Google Play.';
  static String subRenewalOff(String date) => 'Renewal is off, so nothing more will be charged. Pro stays on until $date.';
  static const subRenewalOffNoDate = 'Renewal is off, so nothing more will be charged. Pro stays on until the end of this billing month.';
  static String subGrace(String date) =>
      "Google Play could not take this month's payment. Pro stays on until $date while Google Play tries again. Update your payment method in Google Play to keep it.";
  static const subGraceNoDate =
      "Google Play could not take this month's payment and is trying again. Update your payment method in Google Play to keep Pro.";
  static const subOnHold = 'Google Play could not take your monthly payment, so Pro is paused. Update your payment method in Google Play and Pro comes back.';

  // The headings of the views that need the student in Google Play: warnings, never a success.
  static const subGraceTitle = 'Your payment did not go through';
  static const subOnHoldTitle = 'Your Pro is paused';
  static const subPausedTitle = 'Your subscription is paused';
  static const subPaused ='Your subscription is paused in Google Play. Resume it there to turn Pro back on.';
  static const subEnded = 'This subscription has ended, so it does not include Pro any more. You can subscribe again.';
  static const manageOpenFailed = 'Google Play did not open. Open the Play Store, then Payments and subscriptions, then Subscriptions.';
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
  static const failEnded = 'This plan or pack can no longer be bought, so nothing was added. Google Play refunds a payment that is not confirmed within three days.';
  static const failRefused = 'We could not accept this purchase, so nothing was added. If you were charged, Google Play refunds you within three days.';

  // The Pro page (owner I6, 19 Oct: a full screen of its own, "like you are getting everything in the
  // world"). Every line is something Pro does in the app today; the price is only Google Play's.
  static const proPageLabel = 'MockMob Pro';
  static const proPageTitle = 'Practise without limits';
  static const proPageLede =
      'Unlimited mocks from one central bank, every one new. Smart practice on the chapters you miss. The exam-day screen, as you will meet it.';
  static const proPageClose = 'Close';
  static const proPageUnlocksHeading = 'Everything Pro unlocks';
  static const proPageCompareHeading = 'Free and Pro, side by side';
  static const proPagePriceHeading = 'One plan, everything in it';
  static const proPageForYouHeading = 'Built around your prep';

  /// Under Google Play's price on the Pro page (the owner's words for it, 20 Oct).
  static const proRenews = 'Renews every month. Cancel anytime in Google Play.';

  /// What each part of Pro does, as the page's showcase: a title and one line.
  static const List<(String, String)> proFeatures = [
    ('Unlimited mocks', 'Sit as many Full mocks as you want. Each one is built fresh from one central question bank, so every paper is new.'),
    ('Smart practice', 'Every set leans toward the chapters you miss, so each one fixes something.'),
    ('The exam-day screen', 'NTA mode: 50 questions in 60 minutes, laid out as you will meet it on the day.'),
    ('Easy, Medium and Hard', 'Choose how hard each set is, and step up when you are ready.'),
    ('Insights in detail', 'See where you changed answers and how your pace held up across a paper.'),
  ];

  /// The Mob's part of Pro, shown only when the Mob is on (its own words, MobV3Copy.proList).
  static const proFeatureMob = ('Host your Mob', 'Start as many games as you like, open live rooms and start up to 3 Mobs.');

  static const compareFree = 'Free';
  static const comparePro = 'Pro';
  static const compareUnlimited = 'Unlimited';
  static const compareIncluded = 'Included';
  static const compareNotIncluded = 'Not included';

  /// The comparison rows: what, then Free's cell and Pro's cell. A null cell is a tick (included);
  /// an empty one is a dash (not included).
  static const List<(String, String?, String?)> compareRows = [
    ('Fresh papers from one central bank', null, null),
    ('Full mocks', '50 credits each', compareUnlimited),
    ('Quick practice', 'Uses credits', compareUnlimited),
    ('Smart practice', '', null),
    ('NTA mode on the exam-day screen', '', null),
    ('Easy, Medium and Hard', '', null),
    ('Changed answers and pace in Insights', '', null),
  ];

  /// The Mob's rows, only when the Mob is on.
  static const List<(String, String?, String?)> compareMobRows = [
    ('Play every game in your Mob', null, null),
    ('Start games in a Mob', 'One a week', 'As many as you like'),
  ];

  static const proWelcome = 'Welcome to Pro';

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
