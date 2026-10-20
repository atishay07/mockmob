/// Every word of the Pro nudges, the Upgrade sheet and the first-session pop-up, in one place so the
/// owner can tune it (owner, 18 Oct 2026, D79 to D84). The words are the website's
/// (`src/lib/proNudge.mjs`), said for the app, so a student hears one voice on both.
///
/// Voice (D84, 7:12 pm): persuasive marketing English, punchy and benefit-led, written for a CUET
/// aspirant (unlimited mocks, momentum, the exam-day screen). It still has to be TRUE:
/// * every claim is something Pro does in the app today; no invented numbers, no fake scarcity, no
///   countdowns, no "only today";
/// * a line about the student ("You have sat 3 full mocks") is built only from what the app holds,
///   and only when it is true (see `data/pro_benefits.dart`);
/// * no exclamation marks and no emoji.
///
/// Rules of the store (Google Play's anti-steering rule), which no copy may bend:
/// * nothing here names a price. A price is only ever Google Play's own string (Pro is Rs 150 on Google
///   Play), drawn by the Upgrade sheet from the billing controller; the website's price never appears;
/// * nothing mentions the website, its pricing page or checkout, or says it is cheaper elsewhere.
///
/// Headline options for the general sheet (the first is live, as on the website; set
/// [ProNudgeCopy.sheetTitle] to another to try it):
/// 1. "Practise without limits"
/// 2. "Every mock you need. No credits, no cap."
/// 3. "Rehearse CUET until it feels familiar"
library;

/// Why the Upgrade sheet is open: the feature that asked for Pro, or the first-session moment.
enum ProReason {
  /// The first-session upgrade sheet (D181): it waits for a real limit (10 credits or fewer) or the
  /// student's second return to a tab root after a result, never the first result itself.
  firstSession,
  ntaMode,
  smartPractice,
  difficulty,
  unlimitedMocks,
  practiceCredits,
  reviewChapter,
  insightsChanges,
  insightsPace,
  insightsChapters,

  /// A Pro part of the Mob: the full side-by-side, past weeks, extra papers.
  mob,

  /// A Mob limit of Free the student just met: one Mob started, or one Mob paper a week.
  mobLimit,

  /// The Mob's Free and Pro sheet (P4): Pro adds hosting games, never marks.
  mobHosting,

  /// Full mock together (D174, D175): Pro starts it and sits every one free; Free sits one a friend starts for credits.
  mobFullMock,

  /// Any other Pro-only thing.
  general,
}

/// The places an inline nudge can stand. Each remembers on its own that it was dismissed.
enum ProNudgeSurface {
  /// A practice set's cost line, on the set's setup sheet.
  practiceCost('practice-cost'),

  /// The credits-low state of a set that cannot start.
  creditsLow('credits-low'),

  /// The result after a scored set or mock. Never on the student's very first result (D181).
  result('result'),

  /// Review's "practise this chapter" action.
  reviewPractise('review-practise'),

  /// The Practice tab's mock rows.
  practiceMocks('practice-mocks');

  const ProNudgeSurface(this.key);

  /// The stored name. It never changes once shipped.
  final String key;
}

/// The Upgrade sheet's headline and the line under it, for one reason.
class ProSheetHead {
  const ProSheetHead(this.title, this.lede);

  final String title;
  final String lede;
}

abstract final class ProNudgeCopy {
  /// An NTA paper, as the app sets it (practice_starter.dart, quick_start.dart): 50 questions, 60 minutes.
  static const int ntaQuestions = 50;
  static const int ntaMinutes = 60;

  /// What a Full mock costs a Free student, in credits (D78).
  static const int fullMockCredits = 50;

  // The sheet.
  /// The general sheet's headline.
  static const sheetTitle = 'Practise without limits';
  static const List<String> headlineOptions = [
    sheetTitle,
    'Every mock you need, with no credits and no cap.',
    'Rehearse CUET until it feels familiar',
  ];

  /// The screen-reader name of the sheet, whatever the headline says.
  static const sheetLabel = 'Upgrade to Pro';

  /// Over the student's own lines, and over the plain list when there are none.
  static const forYouHeading = 'Built around your prep';
  static const includesHeading = 'Everything Pro unlocks';
  static const notNow = 'Not now';

  static const ProSheetHead _general = ProSheetHead(
    sheetTitle,
    'Unlimited mocks, NTA mode on the exam-day screen, and Smart practice that hunts down your weak chapters, all for one monthly price, with no credits to count.',
  );

  /// The headline and the line under it: what asked for Pro, and why it is worth having.
  static ProSheetHead head(ProReason reason) => switch (reason) {
        ProReason.firstSession => const ProSheetHead(
            'Keep practising without limits',
            'Pro takes the cap off: unlimited mocks, NTA mode and Smart practice, for one monthly price.',
          ),
        ProReason.ntaMode => const ProSheetHead(
            'Sit the exam before the exam',
            'Rehearse on the exam-day screen, against the clock, as many times as you want. These are original practice papers, not official ones.',
          ),
        ProReason.smartPractice => const ProSheetHead(
            'Stop guessing what to practise',
            'Smart practice reads your record and aims every set at the chapters you miss.',
          ),
        ProReason.difficulty => const ProSheetHead(
            'Train at the level you choose',
            'Pick easy, medium or hard for your sets. Warm up, or push where it is hardest.',
          ),
        ProReason.unlimitedMocks => const ProSheetHead(
            'Every mock you need, with no credits and no cap.',
            'A fresh Full mock whenever your prep calls for one. With Pro, not one of them costs a credit.',
          ),
        ProReason.practiceCredits => const ProSheetHead(
            'Never ration practice again',
            'With Pro, Quick practice and Full mocks use no credits. Take the set you need, when you need it.',
          ),
        ProReason.reviewChapter => const ProSheetHead(
            'Hit your weak chapters until they stick',
            'Pro aims Smart practice at the chapters costing you marks, as often as it takes, with no credits to spend.',
          ),
        ProReason.insightsChanges => const ProSheetHead(
            'See the answers you changed',
            'Changed-answer detail shows where second thoughts helped you and where they cost you.',
          ),
        ProReason.insightsPace => const ProSheetHead(
            'See where the clock beats you',
            'Pace detail shows where your time goes, so you know where to speed up.',
          ),
        ProReason.insightsChapters => const ProSheetHead(
            'See every chapter that costs you marks',
            'Full chapter review ranks every chapter, with your pace and the answers you changed.',
          ),
        // The Mob's own words for what Pro adds (social/copy.dart proLine, freeUsed, the MOB_LIMIT sentence).
        ProReason.mob => const ProSheetHead(
            'See your whole Mob, every week',
            'Pro opens the full side-by-side after every paper: who picked what, who changed an answer and how long each question took. Plus past weeks, extra papers on a chapter you choose, and up to 3 Mobs you start.',
          ),
        ProReason.mobLimit => const ProSheetHead(
            'Start up to 3 Mobs, one for each subject',
            "Free lets you start one Mob and sit one Mob paper a week. With Pro, start up to 3 Mobs and sit every Mob's weekly paper, with the full side-by-side after each one.",
          ),
        ProReason.mobHosting => const ProSheetHead(
            'Host games for your Mob',
            'Start any game, pass the mic and run up to 3 Mobs.',
          ),
        ProReason.mobFullMock => const ProSheetHead(
            'Start a full mock for your Mob',
            'Start one any time. Sit every full mock free.',
          ),
        ProReason.general => _general,
      };

  /// The line that leads the benefits when the sheet opened on a part the plain list does not name
  /// (the Mob), so the first thing it says answers what the student tapped. Null for every other reason.
  static String? leadBenefit(ProReason reason) => switch (reason) {
        ProReason.mob => 'The full side-by-side after every Mob paper, past weeks, and extra papers on a chapter you choose.',
        ProReason.mobLimit => "Up to 3 Mobs you start, and every Mob's weekly paper, not one a week.",
        ProReason.mobHosting => 'Start as many Mob games as you like, live or anytime, and pass the mic to a friend.',
        ProReason.mobFullMock => 'Start a full mock together, and sit every full mock your Mob starts with no credits.',
        _ => null,
      };

  /// What Pro includes, the plain lines the sheet falls back to when it has nothing of the student's
  /// own to say. Every line is something the app does today.
  static const List<String> plainBenefits = [
    'Unlimited Quick practice and Full mocks, a fresh paper every time.',
    'Zero credits to count: every set and every mock is included.',
    'NTA mode: rehearse on the exam-day screen, $ntaQuestions questions in $ntaMinutes minutes.',
    'Smart practice aims every set at the chapters you miss.',
  ];

  // The first-session bottom sheet (D185): the art leads, then one short headline and at most three rows, each one
  // line at 360 dp at text 1.0. A fact about the student, then what Pro does about it. At larger text a row that no
  // longer fits goes on two lines broken where it reads best, never with one word left alone.

  /// The longest headline that stays on one line in the sheet at 360 dp.
  static const int sheetHeadlineMax = 24;

  /// The sheet's one-line headline: the reason's own when it is short enough, otherwise the website's general one.
  static String sheetHeadline(ProReason reason) {
    final own = head(reason).title;
    return own.length <= sheetHeadlineMax ? own : sheetTitle;
  }

  /// While Google Play cannot sell, the sheet says why in one line with Try again (D185); the full guidance is read
  /// aloud, and the Pro page shows it.
  static const storeUnavailableShort = 'Google Play is not ready on this phone.';
  static const storeUnreachableShort = 'We could not reach Google Play.';
  static const productUnavailableShort = 'Pro is not available to buy just now.';

  /// The longest chapter name a short line names; a longer one gives the plain line instead.
  static const int shortChapterMax = 20;

  static String weakestChapterShort(String chapter) => 'Sets aimed at $chapter';
  static const weakestShort = 'Sets aimed at your weak chapters';
  static String creditsLeftShort(int n) => n <= 0 ? 'No credits left. Pro uses none.' : '${_n(n, 'credit')} left. Pro uses none.';
  static String creditsUsedShort(int n, {required bool atLeast}) => atLeast ? '$n+ credits used. Pro uses none.' : '${_n(n, 'credit')} used. Pro uses none.';
  static String mocksTakenShort(int n) => '${_n(n, 'mock')} done. Unlimited on Pro.';
  static String subjectsShort(int n) => 'NTA mode in your $n subjects';
  static String collegesShort(int n) => n == 1 ? 'Compass Pro for your college' : 'Compass Pro for your $n colleges';

  /// The short form of [leadBenefit], for the Mob's reasons.
  static String? leadBenefitShort(ProReason reason) => switch (reason) {
        ProReason.mob => 'The full side-by-side, every week',
        ProReason.mobLimit => 'Up to 3 Mobs, every weekly paper',
        ProReason.mobHosting => 'Host Mob games, pass the mic',
        _ => null,
      };

  /// [plainBenefits] in short, in the same order (unlimited, credits, NTA, Smart).
  static const List<String> plainBenefitsShort = [
    'Unlimited mocks, fresh every time',
    'Sets and mocks use no credits',
    'NTA mode, the exam-day screen',
    'Smart practice on weak chapters',
  ];

  // The inline rows. One line and one action each; the action opens the Upgrade sheet.
  /// The key on a Pro gate that stands shut.
  static const gateAction = 'Upgrade to Pro';
  static const nudgeDismiss = 'Not now';
  static const goUnlimited = 'Go unlimited';
  static const seePro = 'Get Pro';

  static const unlimitedMocks = 'Get unlimited mocks with Pro, a fresh paper every time.';
  static const noCreditsForPractice = 'No credits needed for practice with Pro. Every set and every mock is included.';
  static const noCreditsForChapter = 'Pro aims Smart practice at chapters like this one, with no credits to spend.';
  static const afterResult = 'Keep the momentum. With Pro, your next mock and every one after it cost no credits.';
  static const creditsRunLow = 'Running low on credits? With Pro, practice never runs out.';

  static String lineFor(ProNudgeSurface surface) => switch (surface) {
        ProNudgeSurface.practiceCost => noCreditsForPractice,
        ProNudgeSurface.creditsLow => creditsRunLow,
        ProNudgeSurface.result => afterResult,
        ProNudgeSurface.reviewPractise => noCreditsForChapter,
        ProNudgeSurface.practiceMocks => unlimitedMocks,
      };

  /// The row's action word, as the website's inline nudges say it.
  static String actionFor(ProNudgeSurface surface) => switch (surface) {
        ProNudgeSurface.practiceCost || ProNudgeSurface.creditsLow || ProNudgeSurface.result => goUnlimited,
        ProNudgeSurface.reviewPractise || ProNudgeSurface.practiceMocks => seePro,
      };

  static ProReason reasonFor(ProNudgeSurface surface) => switch (surface) {
        ProNudgeSurface.practiceCost => ProReason.practiceCredits,
        ProNudgeSurface.creditsLow => ProReason.practiceCredits,
        ProNudgeSurface.result => ProReason.unlimitedMocks,
        ProNudgeSurface.reviewPractise => ProReason.reviewChapter,
        ProNudgeSurface.practiceMocks => ProReason.unlimitedMocks,
      };

  // The student's own lines. Each is shown only when the figure behind it is known and true.
  static String _n(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  static String weakestChapter(String chapter) => '$chapter cost you the most. Smart practice aims your sets at chapters like it.';
  static String weakestSubject(String subject) => 'Smart practice aims your $subject sets at the chapters you keep missing.';
  static String mocksTaken(int n) => 'You have sat ${_n(n, 'full mock')}. With Pro, sit as many as it takes.';
  static String creditsUsed(int n, {required bool atLeast}) =>
      'You have spent ${atLeast ? 'at least ' : ''}${_n(n, 'credit')} on practice so far. On Pro, that is 0.';

  static String creditsLeft(int n) => n <= 0
      ? 'No credits left for practice. On Pro, it never runs out.'
      : 'Only ${_n(n, 'credit')} left, not enough for a Full mock. On Pro, practice never runs out.';

  static String subjects(int n) => 'NTA mode in all $n of your subjects: the exam-day screen, $ntaQuestions questions in $ntaMinutes minutes.';
  static String colleges(int n) =>
      'Compass Pro projects your practice against ${n == 1 ? 'your target college' : 'your $n target colleges'}. A projection, not a prediction.';
}
