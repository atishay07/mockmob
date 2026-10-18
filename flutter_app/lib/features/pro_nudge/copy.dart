/// Every word of the Pro nudges, the Upgrade sheet and the first-session pop-up, in one place so the
/// owner can tune it (owner, 18 Oct 2026, D79 to D84).
///
/// Voice (D84, 7:12 pm): proper marketing English, punchy and benefit-led, written for a CUET
/// aspirant (unlimited mocks, momentum, the college goal). It still has to be TRUE:
/// * no invented numbers, no fake scarcity, no countdowns, no "only today";
/// * a line about the student ("You have taken 3 mocks") is built only from what the app holds,
///   and only when it is true (see `data/pro_benefits.dart`);
/// * no exclamation marks and no emoji.
///
/// Rules of the store (Google Play's anti-steering rule), which no copy may bend:
/// * nothing here names a price. A price is only ever Google Play's own string, drawn by the
///   Upgrade sheet from the billing controller;
/// * nothing mentions the website, its pricing page or checkout, or says it is cheaper elsewhere.
///
/// Headline options for the sheet (the first is live; swap [ProNudgeCopy.sheetTitle] to try another):
/// 1. "Unlimited mocks. No credits to count."
/// 2. "Mock until it clicks."
/// 3. "Every mock you want. None you have to ration."
library;

/// Why the Upgrade sheet is open: the feature that asked for Pro, or the first-session moment.
enum ProReason {
  /// The first-session pop-up, after the student's first set or mock.
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

  /// Any other Pro-only thing.
  general,
}

/// The places an inline nudge can stand. Each remembers on its own that it was dismissed.
enum ProNudgeSurface {
  /// A practice set's cost line, on the set's setup sheet.
  practiceCost('practice-cost'),

  /// The credits-low state of a set that cannot start.
  creditsLow('credits-low'),

  /// The result after a scored set or mock.
  result('result'),

  /// Review's "practise this chapter" action.
  reviewPractise('review-practise'),

  /// The Practice tab's mock rows.
  practiceMocks('practice-mocks');

  const ProNudgeSurface(this.key);

  /// The stored name. It never changes once shipped.
  final String key;
}

abstract final class ProNudgeCopy {
  // The sheet.
  static const sheetTitle = 'Unlimited mocks. No credits to count.';
  static const headlineB = 'Mock until it clicks.';
  static const headlineC = 'Every mock you want. None you have to ration.';

  /// The screen-reader name of the sheet, whatever the headline says.
  static const sheetLabel = 'Upgrade to Pro';

  /// Over the student's own lines, and over the plain list when there are none.
  static const forYouHeading = 'Built around your prep';
  static const includesHeading = 'What you get with Pro';
  static const notNow = 'Not now';

  /// One line above the benefits: what asked for Pro, and why it is worth having.
  static String reasonLine(ProReason reason) => switch (reason) {
        ProReason.firstSession => 'Good start. Here is what Pro would do for the next stretch of your prep.',
        ProReason.ntaMode => 'NTA mode puts you on the exam-day screen before the exam does. It comes with Pro.',
        ProReason.smartPractice => 'Smart practice goes after the chapters costing you marks. It comes with Pro.',
        ProReason.difficulty => 'Pick Easy, Medium or Hard and train at the level you choose. It comes with Pro.',
        ProReason.unlimitedMocks => 'Mock as often as your prep needs. With Pro, nothing runs out.',
        ProReason.practiceCredits => 'Practise without counting credits. That is Pro.',
        ProReason.reviewChapter => 'Go back at a weak chapter as many times as it takes. No credits with Pro.',
        ProReason.insightsChanges => 'See which answers you changed under pressure. Changed-answer detail comes with Pro.',
        ProReason.insightsPace => 'See where the clock beats you. Pace detail comes with Pro.',
        ProReason.insightsChapters => 'See every chapter, ranked by the marks it costs you. The full list comes with Pro.',
        ProReason.general => 'This comes with Pro, and it is built to move your score.',
      };

  /// What Pro includes, the plain list the sheet falls back to when it has nothing of the student's
  /// own to say. Every line is something the app does today.
  static const List<String> plainBenefits = [
    'Unlimited mocks, each one built fresh from one central question bank.',
    'Smart practice that goes after the chapters you miss.',
    'NTA mode: the exam-day screen, before exam day.',
    'Easy, Medium and Hard sets, your pick.',
    'Changed-answer and pace detail in Insights.',
  ];

  // The inline rows. One quiet line and one action each.
  static const nudgeAction = 'Get Pro';

  /// The key on a Pro gate that stands shut.
  static const gateAction = 'Upgrade to Pro';
  static const nudgeDismiss = 'Not now';
  static const unlimitedMocks = 'Mock as much as you want. Unlimited with Pro.';
  static const noCreditsForPractice = 'Practise as much as you want. No credits with Pro.';
  static const noCreditsForChapter = 'Drill this chapter as much as you like. No credits with Pro.';
  static const afterResult = 'Ready for the next one? Pro mocks are unlimited.';
  static const creditsRunLow = 'Running low? Practice with Pro never needs credits.';

  static String lineFor(ProNudgeSurface surface) => switch (surface) {
        ProNudgeSurface.practiceCost => noCreditsForPractice,
        ProNudgeSurface.creditsLow => creditsRunLow,
        ProNudgeSurface.result => afterResult,
        ProNudgeSurface.reviewPractise => noCreditsForChapter,
        ProNudgeSurface.practiceMocks => unlimitedMocks,
      };

  static ProReason reasonFor(ProNudgeSurface surface) => switch (surface) {
        ProNudgeSurface.practiceCost => ProReason.practiceCredits,
        ProNudgeSurface.creditsLow => ProReason.practiceCredits,
        ProNudgeSurface.result => ProReason.unlimitedMocks,
        ProNudgeSurface.reviewPractise => ProReason.reviewChapter,
        ProNudgeSurface.practiceMocks => ProReason.unlimitedMocks,
      };

  // The student's own lines. Each is shown only when the figure behind it is known and true.
  static String weakestChapter(String chapter) => '$chapter is costing you the most marks. Smart practice leans toward it.';
  static String weakestSubject(String subject) => 'Smart practice leans toward the chapters you keep missing in $subject.';
  static String mocksTaken(int n) =>
      'You have ${n == 1 ? '1 mock' : '$n mocks'} behind you. With Pro, every one after that needs no credits.';
  static String creditsUsed(int n, {required bool atLeast}) {
    final credits = n == 1 ? '1 practice credit' : '$n practice credits';
    return atLeast ? 'You have used at least $credits so far. Pro practice needs none.' : 'You have used $credits so far. Pro practice needs none.';
  }

  static String creditsLeft(int n) {
    final left = n <= 0 ? 'no practice credits' : (n == 1 ? 'just 1 practice credit' : 'only $n practice credits');
    return 'You have $left left. Pro practice needs none.';
  }

  static String subjects(int n) => 'Unlimited practice across all $n of your subjects.';
  static String colleges(int n) =>
      'Pro projects your score from your practice, so you can see how close you are to ${n == 1 ? 'your target college' : 'your $n target colleges'}.';
}
