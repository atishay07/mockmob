// Every user-facing string of the rhythm feature (spec 6, 5.11). Sentence case, no middle dots,
// no emoji, no exclamation successes, no "mastered", no prices. "Saved" always means the server
// acknowledged it; local pending work is "On this phone".
import '../../core/copy/copy.dart';

abstract final class RhythmCopy {
  // Week sheet and strip.
  static const String weekTitle = 'This week';
  static const String weekLoadFailed = 'We could not load this week.';
  static const String tryAgain = 'Try again';
  static const String seeRhythm = 'See rhythm and goal';
  static const String restDays = 'The other days are rest days.';
  static const String rhythmOffTitle = 'Rhythm is off';
  static const String rhythmOffBody = 'Your records stay. You can turn it back on any time.';
  static const String turnOnRhythm = 'Turn on rhythm';

  static String asOf(DateTime fetchedAt) => 'As of ${formatTime12(fetchedAt)}';

  static String stripOpen(int days, int goal) => '$days of ${plural(goal, 'study day')}';

  static String stripMet(int days, int goal) => '$days of ${plural(goal, 'study day')}. This week is done.';

  static String ofGoal(int goal) => 'of ${plural(goal, 'study day')}';

  static const String goalMet = 'Goal met.';

  static String stripExtra(int days) => '$days days this week';

  static String paused(String? untilDate) => untilDate == null ? 'Rhythm is paused.' : 'Rhythm is paused until $untilDate.';

  static const String pausedKeepsRun = 'Paused weeks do not break your run.';

  static String goalSentence(int goal) => goal >= 7 ? 'Your goal is 7 study days.' : 'Your goal is ${plural(goal, 'study day')}. $restDays';

  /// "2 mocks, 7 mistakes repaired", from `mocksThisWeek` and `repairsThisWeek`. Null when both
  /// are unknown or zero.
  static String? weekCounts({int? mocks, int? repairs}) {
    final parts = <String>[
      if (mocks != null && mocks > 0) plural(mocks, 'mock'),
      if (repairs != null && repairs > 0) '${plural(repairs, 'mistake')} repaired',
    ];
    if (parts.isEmpty) return null;
    return '${parts.join(', ')} this week.';
  }

  // You rhythm screen.
  static const String rhythmTitle = 'Rhythm';
  static const String rhythmLoadFailedTitle = 'We could not load your rhythm';
  static const String rhythmLoadFailedBody = 'Your record is as you left it.';

  static String weeksInRhythm(int weeks) => weeks == 1 ? '1 week in rhythm' : '$weeks weeks in rhythm';
  static const String weeksInRhythmNone = 'A run starts the week you reach your goal.';

  static String bestRun(int weeks) => 'Best run: ${plural(weeks, 'week')}';

  /// Run ended or not started yet: never "0", never "you lost".
  static String newRun(int best) => 'A new run starts this week. Your best is still ${plural(best, 'week')}.';

  static String goalRow(int days) => 'Goal: $days ${days == 1 ? 'day' : 'days'} a week';
  static const String editGoal = 'Edit goal';

  // Goal editor.
  static const String goalTitle = 'Weekly goal';
  static const String goalPrompt = 'Study days a week';
  static const String saveGoal = 'Save goal';
  static const String goalSaveFailed = 'We could not save your goal. Try again.';
  static String goalSaved(int days) => 'Goal saved: $days ${days == 1 ? 'day' : 'days'} a week.';

  // Pause.
  static const String pauseTitle = 'Pause rhythm';
  static const String pauseThisWeek = 'This week';
  static const String pauseTwoWeeks = '2 weeks';
  static const String pauseUntilOn = 'Until I turn it on';
  static const String resume = 'Resume rhythm';
  static const String pauseFailed = 'We could not change the pause. Try again.';

  // Turn off.
  static const String turnOff = 'Turn off rhythm';
  static const String turnOffConfirmTitle = 'Turn off rhythm?';
  static const String turnOffConfirmBody = 'The week strip is hidden everywhere. Your records stay, and you can turn it back on here.';
  static const String turnOffConfirm = 'Turn off';
  static const String cancel = 'Cancel';

  // Closed weeks.
  static const String closedWeeks = 'Closed weeks';

  static String closedWeekRow(String weekOf, int days, int goal) => 'Week of $weekOf, $days of $goal days.';

  // Celebrations setting.
  static const String celebrationsTitle = 'Celebrations';
  static const String celebrationsFull = 'Full';
  static const String celebrationsQuiet = 'Quiet';
  static const String celebrationsOff = 'Off';
  static const String celebrationsFullHint = 'A short moment when a repair or a week is finished.';
  static const String celebrationsQuietHint = 'Plain text only, with no movement.';
  static const String celebrationsOffHint = 'Nothing is shown.';

  // Milestones.
  static const String milestonesTitle = 'Milestones';
  static const String milestonesEmptyTitle = 'No milestones yet';
  static const String milestonesEmptyBody = 'They appear here as plain dated rows when they happen.';
  static const String milestonesLoadFailedTitle = 'We could not load your milestones';

  /// Null for an id this app version does not know, so a raw id is never printed.
  static String? milestoneRow(String id, String date) => switch (id) {
    'first_scored_session' => 'First scored session on $date',
    'first_full_mock' => 'First full mock on $date',
    'first_repair' => 'First repair finished on $date',
    'repairs_5' => '5 repairs finished on $date',
    'repairs_10' => '10 repairs finished on $date',
    'repairs_25' => '25 repairs finished on $date',
    'sessions_10' => '10 sessions finished on $date',
    'first_week_met' => 'First week met on $date',
    'weeks_met_4' => '4 weeks met on $date',
    _ => null,
  };

  // Milestone tokens (the brass shelf).
  static const String shelfTitle = 'Your shelf';
  static const String tokenFirstMock = 'First mock';
  static const String tokenFirstRepair = 'First repair';
  static const String tokenFirstWeek = 'First week in rhythm';
  static const String tokenFirstMockEmpty = 'Lands with your first scored set';
  static const String tokenFirstRepairEmpty = 'Lands when a repair is finished';
  static const String tokenFirstWeekEmpty = 'Lands when a week meets your goal';
  static String tokenEarned(String name, String date) => '$name, earned on $date';
  static String tokenWaiting(String name, String hint) => '$name, not earned yet. $hint';
  static const String timelineTitle = 'Every milestone, newest first';
  static const String milestonesNone = 'Nothing yet. Your first one is dated the day it happens.';

  // Personal bests.
  static const String bestsTitle = 'Personal bests';
  static const String bestsEmptyTitle = 'Nothing to compare yet';
  static const String bestsEmptyBody =
      'Once a full mock is saved on the server, its marks show here. A second one of the same type shows your change.';
  static const String bestsLoadFailedTitle = 'We could not load your marks';
  static const String bestsFootnote =
      'These are marks from your own mocks of the same type. A retake of a paper you have seen does not count.';

  static String bestFormat(String mode, String subject, int questions) => '$mode, $subject, ${plural(questions, 'question')}';

  static String bestFirst(String modeNoun) => 'First $modeNoun saved. A second one will show your change.';

  static String bestPair(String best, String latest) => 'Best on this mock type: $best. Latest: $latest.';

  static String outOf(int max) => 'of $max';

  static String latestLine(String marks) => 'Latest: $marks.';

  static String bestMarks(String marks, int outOf) => '$marks of $outOf marks';

  static String bestDates(String bestDate, String latestDate) => 'Best on $bestDate. Latest on $latestDate.';

  static String bestSingleDate(String date) => 'Saved on $date.';

  // Weekly ending (6.9).
  static String endingMet(int days) => 'You finished ${plural(days, 'study day')} last week. That met your goal.';

  static String endingNotMet(int days, int goal) =>
      'You finished $days of $goal study days. Nothing is lost. Your record is as you left it.';

  static const String endingTitle = 'Last week';
  static String keep(int goal) => 'Keep $goal';
  static String tryMore(int goal) => 'Try $goal';
  static const String lighterWeek = 'Take a lighter week';
  static String makeIt(int goal) => 'Make it $goal';
  static const String restWeek = 'Take a rest week';
  static const String dismiss = 'Dismiss';
  static const String endingActionFailed = 'We could not save that. Try again.';
  static String endingGoalNow(int goal) => 'Goal is now ${plural(goal, 'day')} a week.';
  static String endingRestWeek(String untilDate) => 'Rhythm is paused until $untilDate.';

  // Returning (6.7).
  static const String welcomeBack = 'Welcome back. Pick up with a small next step.';
  static const String nothingLost = 'Nothing was lost.';

  static String lastNight(int repaired, int waiting) =>
      'Last night: ${plural(repaired, 'mistake')} repaired. $waiting ${pluralWord(waiting, 'is', pluralForm: 'are')} waiting.';

  // Late-night line (6.8).
  static const String lateNightStop = 'That is a good place to stop for tonight.';
  static const String lateNightDismiss = 'Dismiss';

  // Celebrations.
  static const String firstRepairSentence = 'That was your first repair.';
  static const String weekDoneSentence = 'This week is done.';
  static const String firstWeekSentence = 'Your first week in rhythm is done.';

  static String weekReceipt(int days, int goal) => '$days of ${plural(goal, 'study day')}. ${StateWords.savedOnServer}.';

  // The rest of the week (week sheet and Today's week row).
  static const String outlookMetShort = 'Goal met';
  static const String outlookPausedShort = 'Paused';
  static String moreBySunday(int n) => '$n more by Sunday';
  static const String everyDayCounts = 'Every day still counts';
  static String moreBySundaySentence(int needed, int daysLeft) =>
      '${needed == 1 ? 'One more study day meets' : '$needed more study days meet'} your goal, '
      'with ${plural(daysLeft, 'day')} left this week.';
  static const String todayPlanned = 'Today is one of your study days.';
  static String nextPlanned(String weekday) => 'Your next study day is $weekday.';
  static const String outOfReach =
      'This week cannot reach your goal now, and that is all right. Every study day still counts, '
      'and pausing the week keeps your run.';
  static const String studyDayRule = 'A day counts when you finish a scored set of 5 or more answers, or a repair.';
  static String weekRange(DateTime monday) {
    final sunday = monday.add(const Duration(days: 6));
    return monday.month == sunday.month
        ? '${monday.day} to ${formatDayMonth(sunday)}'
        : '${formatDayMonth(monday)} to ${formatDayMonth(sunday)}';
  }

  static const String changeStudyDays = 'Change study days';
  static const String pauseThisWeekKey = 'Pause this week';
  static String restOn(List<String> weekdays) => 'Rest on ${joinWithAnd(weekdays)}.';

  // Study days editor.
  static const String daysTitle = 'Your study days';
  static const String daysPrompt = 'Tap the days you plan to study.';
  static String daysSummary(int n) => n == 7 ? 'Every day of the week.' : '${plural(n, 'study day')} a week.';
  static const String daysNone = 'Choose at least one day.';
  static const String restIsPlan = 'Rest is part of the plan. Studying on a rest day still counts.';
  static const String daysWhere = 'The number of days is your goal, saved to your account. Which days stays on this phone.';
  static const String saveDays = 'Save study days';
  static String daysSaved(int n) => 'Saved: ${plural(n, 'study day')} a week.';

  // Milestone tracks.
  static const String trackPapers = 'Papers';
  static const String trackRepairs = 'Repairs';
  static const String trackRhythm = 'Weeks in rhythm';
  static const String trackPapersLink = 'See your papers';
  static const String trackRepairsLink = 'See your repair record';
  static const String trackRhythmLink = 'See your rhythm';
  static const String stepFirstSet = 'First scored set';
  static const String stepFirstMock = 'First full mock';
  static const String stepTenSets = '10 scored sets';
  static const String stepFirstRepair = 'First repair';
  static const String stepRepairs5 = '5 repairs';
  static const String stepRepairs10 = '10 repairs';
  static const String stepRepairs25 = '25 repairs';
  static const String stepFirstWeek = 'First week at your goal';
  static const String stepFourWeeks = '4 weeks at your goal';
  static const String condFirstSet = 'Lands when a set with 5 or more answers is scored.';
  static const String condFirstMock = 'Lands when a 50-question full mock is scored.';
  static const String condTenSets = 'Lands with your 10th scored set of 5 or more answers.';
  static const String condFirstRepair = 'Lands when you finish your first repair.';
  static const String condRepairs5 = 'Lands with your 5th finished repair.';
  static const String condRepairs10 = 'Lands with your 10th finished repair.';
  static const String condRepairs25 = 'Lands with your 25th finished repair.';
  static const String condFirstWeek = 'Lands when a week reaches your goal.';
  static const String condFourWeeks = 'Lands when a fourth week reaches its goal. They need not be in a row.';
  static const String nextLabel = 'Next';
  static const String trackComplete = 'Every step on this path has landed.';
  static String trackCount(int earned, int total) => earned == 0 ? 'Nothing landed yet' : '$earned of $total landed';
  static String soFar(int count, int target) => '$count of $target so far';
  static String stepEarned(String name, String date) => '$name, landed on $date';
  static String stepNext(String name, String condition) => 'Next: $name. $condition';
  static String stepLater(String name) => '$name, after that';
  static const String milestonesIntro = 'Each one is dated by the server the day it happens. Nothing expires.';
}
