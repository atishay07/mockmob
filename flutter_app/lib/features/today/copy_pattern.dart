// What the smart layer says (SMART-LAYER-1019PM 2.5), in Mobi's voice ("I"). Every line is a
// template filled from numbers the StudyPattern computed from the student's own log; a line whose
// rule does not hold is never built. Full sentences, read aloud (R6, D84).
import '../../core/copy/formatters.dart';
import 'logic/study_pattern.dart';

/// One thing the layer says, and the facts "Not quite right?" can forget for it.
class PatternLine {
  const PatternLine(this.text, {this.facts = const {}});

  final String text;

  /// Fact keys ([PatternFact]); empty for a plain count (goal progress) that nothing can forget.
  final Set<String> facts;

  bool get correctable => facts.isNotEmpty;

  @override
  String toString() => text;
}

abstract final class PatternCopy {
  // Goal.
  static const String goalMetOverline = 'Goal met. Keep going?';
  static String goalMet(int done) => 'You have done ${_min(done)} today. Every extra paper still counts.';
  static String goalProgress(int done, int goal) => '$done of ${_min(goal)} done today. ${goal - done} to go.';

  // Thin data.
  static String learningGoal(int goal, String when) => "I'm still learning how you study. For now, $when's plan follows your $goal-minute goal.";
  static String learningGoalStart(int goal, int chip, String when) =>
      "I'm still learning how you study. For now, $when's plan starts with ${_min(chip)} toward your $goal-minute goal.";
  static String learningSessions(int n) => "I'm still learning how you study. After $n more ${n == 1 ? 'session' : 'sessions'}, I'll plan around your real times.";
  static String learningDays(int n) => "I'm still learning how you study. After you practise on $n more ${n == 1 ? 'day' : 'days'}, I'll plan around your real times.";
  static String mixedGoal(int goal, String when) => "You have studied at different times lately, so $when's plan follows your $goal-minute goal.";
  static String mixedGoalStart(int goal, int chip, String when) =>
      "You have studied at different times lately, so $when's plan starts with ${_min(chip)} toward your $goal-minute goal.";

  // Length and time.
  static String usualBoth(int m, String t, String when) => 'You usually practise about ${_min(m)} after $t, so $when\'s plan is ${_min(m)}.';
  static String usualBothStart(int m, String t, int chip, String when) =>
      'You usually practise about ${_min(m)} after $t, so $when\'s plan starts with ${_min(chip)} and you can keep going.';
  static String usualLength(int m, String when) => "You usually practise about ${_min(m)} at a time, so $when's plan is ${_min(m)}.";
  static String usualLengthStart(int m, int chip, String when) =>
      "You usually practise about ${_min(m)} at a time, so $when's plan starts with ${_min(chip)} and you can keep going.";
  static String range(int a, int b, int chip, String when) => "Your sessions run between $a and ${_min(b)}, so $when's plan starts with $chip and you can keep going.";
  static String twoBlocks(int m, int goal) => 'You usually practise about ${_min(m)} at a time, so your $goal-minute goal is planned as two sittings.';
  static const String irregular = "Your study times change a lot, so I'll keep each plan short and easy to start.";
  static String shift(String windows) => 'Lately you practise in the $windows, so the plan now fits around that.';
  static String fullMockLead(int goal, String when) => "Your $goal-minute goal has room for a full mock, so $when's plan leads with one.";
  static String longer(int chip, String when) => "You often choose a longer session than I suggest, so $when's plan is ${_min(chip)}.";
  static String stated(int m, int chip, String when) => chip == m
      ? "You told me your sittings run about ${_min(m)}, so $when's plan is ${_min(m)}."
      : "You told me your sittings run about ${_min(m)}, so $when's plan starts with ${_min(chip)} and you can keep going.";

  // Modes and kinds (the Why sheet).
  static String preferredMode(String mode) => 'You pick $mode most often, so it comes first when nothing else is more urgent.';
  static String ignoredKind(String kind) => "You have passed on $kind a few times this fortnight, so I've moved it to the back.";

  // Deck cards.
  static String raiseTitle(int m) => 'Make $m minutes your daily goal?';
  static String raiseLine(int m, int n, int outOf) => 'You have done about ${_min(m)} on $n of your last $outOf study days.';
  static String fitTitle(int m) => 'Try a $m-minute goal for now?';
  static String fitLine(int goal) =>
      'Your $goal-minute goal has been hard to reach lately. A smaller goal you meet beats a big one you miss. You can raise it again any time.';
  static const String keepMyGoal = 'Keep my goal';
  static const String useThisGoal = 'Use this goal';
  static String untouchedTitle(String subject, int days) => '$subject has been waiting $days days.';
  static String untouchedLine(String subject, int days, int questions) =>
      'You chose $subject for CUET but have not practised it for $days days. ${questions == 10 ? 'Ten' : '$questions'} questions keep it fresh.';
  static String goalCost(int m) => 'Your daily goal, $m minutes';
  static String goalSaved(int m) => 'Your daily goal is now ${_min(m)}.';

  // Correction.
  static const String notQuiteRight = 'Not quite right?';
  static const String correctTitle = "Tell me what's true and I'll forget this.";
  static const String correctTime = 'I usually study at another time';
  static const String correctLength = 'My sessions are longer or shorter';
  static const String correctForget = 'Forget it and learn again';
  static const String done = 'Done';
  static const String askTime = 'When do you usually study?';
  static const String askLength = 'About how long is one sitting for you?';
  static const String forgotTime = "Thanks. I've forgotten that, and I'll learn your times again from your next sessions.";
  static String forgotLength(int m) => "Thanks. I'll plan around ${_min(m)} sittings until I learn them again.";
  static const String forgotAll = "Thanks. I've forgotten that, and I'll learn it again from your next sessions.";

  static String windows(StudyWindow w) => switch (w) {
        StudyWindow.early => 'mornings',
        StudyWindow.afternoon => 'afternoons',
        StudyWindow.evening => 'evenings',
        StudyWindow.late => 'late nights',
      };

  static String windowName(StudyWindow w) => switch (w) {
        StudyWindow.early => 'Mornings',
        StudyWindow.afternoon => 'Afternoons',
        StudyWindow.evening => 'Evenings',
        StudyWindow.late => 'Late nights',
      };

  static String modeName(String mode) => switch (mode) {
        'quick' => 'quick practice',
        'chapter' => 'chapter practice',
        'smart' => 'smart practice',
        'full' => 'full mocks',
        'nta' => 'NTA-style mocks',
        'repair' => 'repairs',
        'revise' => 'Revise',
        'mob' => 'Mob papers',
        _ => mode,
      };

  /// What a deck kind is called in a sentence, or null for a kind the sentence cannot name.
  static String? kindName(String kind) => switch (kind) {
        'repair' => 'repairs',
        'revise' => 'Revise',
        'weakest' => 'your weakest chapter',
        'mock' => 'the full mock',
        'mob' => 'the Mob',
        'other' => 'another subject',
        _ => null,
      };

  /// "9:30 PM" for minutes after midnight.
  static String time(int minuteOfDay) => formatTime12(DateTime.utc(2026, 1, 1, minuteOfDay ~/ 60, minuteOfDay % 60));

  static String _min(int m) => m == 1 ? '1 minute' : '$m minutes';
}

/// The line under the length panel's title: why the plan is this long. [chip] is the minutes of
/// the length the plan picked; [when] is "tonight" or "today". Null when nothing true can be said.
PatternLine? lengthLine(StudyPattern p, LengthAdvice advice, {required int chip, required String when}) {
  final goal = p.goalMinutes;
  final remaining = p.remainingMinutes;
  const both = {PatternFact.length, PatternFact.time};
  final aimed = goal == null ? null : (remaining == null || remaining <= 0 ? goal : (remaining < goal ? remaining : goal));
  final usual = p.length;
  if (usual != null && usual.stated) return PatternLine(PatternCopy.stated(usual.minutes, chip, when), facts: const {PatternFact.length});
  if (p.learning) {
    if (p.sessions28 == 0 && goal != null) {
      return PatternLine(chip == aimed ? PatternCopy.learningGoal(goal, when) : PatternCopy.learningGoalStart(goal, chip, when), facts: both);
    }
    if (p.sessionsNeeded > 0) return PatternLine(PatternCopy.learningSessions(p.sessionsNeeded), facts: both);
    return PatternLine(PatternCopy.learningDays(p.daysNeeded), facts: both);
  }
  if (p.shiftWindow != null && usual != null && usual.lately) return PatternLine(PatternCopy.shift(PatternCopy.windows(p.shiftWindow!)), facts: both);
  if (advice.longer && p.longerWhenCan) return PatternLine(PatternCopy.longer(chip, when), facts: const {PatternFact.longer});
  if (usual != null && usual.ranged) return PatternLine(PatternCopy.range(usual.low!, usual.high!, chip, when), facts: const {PatternFact.length});
  if (usual != null) {
    final m = usual.minutes;
    if (advice.twoBlocks && goal != null && chip == m && remaining != null && remaining <= 2 * m + 5) {
      return PatternLine(PatternCopy.twoBlocks(m, goal), facts: const {PatternFact.length});
    }
    final t = p.time;
    if (t != null && p.timeShape == TimeShape.known) {
      final at = PatternCopy.time(t.afterMinute);
      return PatternLine(chip == m ? PatternCopy.usualBoth(m, at, when) : PatternCopy.usualBothStart(m, at, chip, when), facts: both);
    }
    return PatternLine(chip == m ? PatternCopy.usualLength(m, when) : PatternCopy.usualLengthStart(m, chip, when), facts: const {PatternFact.length});
  }
  if (p.timeShape == TimeShape.irregular && advice.short) return const PatternLine(PatternCopy.irregular, facts: {PatternFact.time});
  if (goal != null) {
    return PatternLine(chip == aimed ? PatternCopy.mixedGoal(goal, when) : PatternCopy.mixedGoalStart(goal, chip, when), facts: both);
  }
  return null;
}

/// Today's progress toward the daily goal, or null with no goal or nothing done yet.
PatternLine? goalLine(StudyPattern p) {
  final goal = p.goalMinutes;
  if (goal == null || goal <= 0) return null;
  if (p.goalMet) return PatternLine(PatternCopy.goalMet(p.doneTodayMinutes));
  if (p.doneTodayMinutes <= 0) return null;
  return PatternLine(PatternCopy.goalProgress(p.doneTodayMinutes, goal));
}

/// The Why sheet's learned lines: the mode he picks most and the kinds he keeps passing on.
List<PatternLine> whyLines(StudyPattern p) => [
      if (p.preferredMode != null) PatternLine(PatternCopy.preferredMode(PatternCopy.modeName(p.preferredMode!)), facts: const {PatternFact.mode}),
      for (final k in p.ignoredKinds)
        if (PatternCopy.kindName(k) != null) PatternLine(PatternCopy.ignoredKind(PatternCopy.kindName(k)!), facts: {PatternFact.kind(k)}),
    ];
