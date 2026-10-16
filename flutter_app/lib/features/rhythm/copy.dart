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
  static const String rhythmOffTitle = 'Rhythm is off';
  static const String rhythmOffBody = 'Your records stay. You can turn it back on any time.';
  static const String turnOnRhythm = 'Turn on rhythm';

  static String asOf(DateTime fetchedAt) => 'As of ${formatTime12(fetchedAt)}';

  /// "2 of 4 study days, as of 3:45 PM": the count line of a cached week.
  static String countAsOf(String count, DateTime fetchedAt) => '$count, as of ${formatTime12(fetchedAt)}';

  // Screen-reader labels of the loading states and the ring.
  static const String loadingWeek = 'Loading this week';
  static const String loadingRhythm = 'Loading your rhythm';
  static const String loadingMilestones = 'Loading your milestones';
  static const String loadingMarks = 'Loading your marks';

  /// Read for the ring of a met week only.
  static const String weekDoneLabel = 'Week done';

  // The key under the week strip: one word per mark that is on the strip.
  static const String keyCounted = 'Counted';
  static const String keyPlanned = 'Planned';
  static const String keyRest = 'Rest';
  static const String keyOpen = 'Not counted';
  static const String setStudyDays = 'Set your study days';
  static const String noPlanYet = 'No study days chosen yet. Every day you study still counts.';

  static String stripOpen(int days, int goal) => '$days of ${plural(goal, 'study day')}';

  static String stripMet(int days, int goal) => '$days of ${plural(goal, 'study day')}. This week is done.';

  static String ofGoal(int goal) => 'of ${plural(goal, 'study day')}';
  static String dialCountsLabel(int done, int goal) =>
      goal == 0 ? 'No study days chosen' : '$done of ${plural(goal, 'study day')} this week';

  static const String goalMet = 'Goal met.';

  static String stripExtra(int days) => '$days days this week';

  static String paused(String? untilDate) => untilDate == null ? 'Rhythm is paused.' : 'Rhythm is paused until $untilDate.';

  static const String pausedKeepsRun = 'Paused weeks do not break your run.';

  /// "Your goal is 4 study days." One plain line; the week strip already shows which days rest.
  /// [hasPlan] is kept for callers that pass it.
  static String goalSentence(int goal, {bool hasPlan = false}) => 'Your goal is ${plural(goal, 'study day')}.';

  /// Under the count while the week is open: what is left, from the server's own count.
  static String toGo(int left) => left == 1 ? '1 more study day to reach your goal.' : '$left more study days to reach your goal.';

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
  static const String goalLabel = 'Weekly goal';
  static String goalValue(int days) => days == 1 ? '1 day a week' : '$days days a week';
  static const String studyDaysLabel = 'Study days';
  static const String studyDaysNotSet = 'Not set';
  static const String everyDay = 'Every day';
  static String statWeeks(int weeks) => weeks == 1 ? 'week in rhythm' : 'weeks in rhythm';
  static const String statBest = 'best run, weeks';

  // Mobi beside the week (one line per kind per run, plain and short).
  static const String mobiPaused = 'Paused. Your run is kept.';
  static const String mobiResumed = 'Back on. Your run is kept.';
  static const String mobiSleep = 'Sleep well. Tomorrow counts.';
  static const String mobiOneShort = 'One more day, and today is on your plan.';
  static const String mobiOutOfReach = 'Every study day still counts.';
  static const String mobiReturning = 'Welcome back. Nothing was lost.';

  // Study days editor, live.
  static const String presetThree = '3 days';
  static const String presetFour = '4 days';
  static const String presetFive = '5 days';
  static const String presetWeekdays = 'Weekdays';
  static const String presetsLabel = 'Quick choices';

  // Pause options and the day the run comes back.
  static String backOn(String date) => 'Back on $date.';
  static const String pauseKey = 'Pause now';

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
  /// The longest pause the server accepts is 100 days, so the row says so plainly.
  static const String pauseUntilOn = 'About 3 months';
  /// The chip label; the date it ends on is said under it, so "about" is not needed.
  static const String pauseThreeMonths = '3 months';
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

  // The run ribbon.
  static const String runTitle = 'Your run';
  static const String ribbonNow = 'Now';
  static String ribbonSummary(int met, int total) => 'Goal met in $met of the last $total weeks.';
  static const String planTitle = 'Plan';

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
  static const String milestonesTitle = 'Badges';
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
    'first_week_met' => 'First week in rhythm on $date',
    'weeks_met_4' => '4 weeks met on $date',
    'first_nta' => 'First NTA mode paper on $date',
    'full_mocks_5' => '5 full mocks finished on $date',
    'first_hold' => 'First repair that held on $date',
    'run_weeks_3' => '3 weeks in a row on $date',
    'clean_set' => 'Clean set on $date',
    'four_subjects' => 'Four subjects on $date',
    'new_best' => 'New best on $date',
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
  static const String tokenBestEmpty = 'Lands with a clean set, four subjects or a new best';
  static String tokenEarned(String name, String date) => '$name, earned on $date';
  static String tokenWaiting(String name, String hint) => '$name, not earned yet. $hint';
  static const String timelineTitle = 'Every milestone, newest first';
  static const String milestonesNone = 'Nothing yet. Your first one is dated the day it happens.';

  // Personal bests.
  static const String bestsTitle = 'Personal bests';
  static const String otherBests = 'Other mock types';
  static const String bestsEmptyTitle = 'Nothing to compare yet';
  static const String bestsEmptyBody =
      'Once a full mock is saved on the server, its marks show here. A second one of the same type shows your change.';
  static const String bestsLoadFailedTitle = 'We could not load your marks';
  static const String bestsFootnote =
      'These are marks from your own mocks of the same type. A retake of a paper you have seen does not count.';

  static const String bestMockTitle = 'Best mock';
  static const String bestSetTitle = 'Best set';
  static const String bestRunTitle = 'Longest run at your goal';
  static String bestRunContext(int now, int goal) =>
      'Now: ${plural(now, 'week')} in a row. Goal: ${plural(goal, 'study day')} a week.';
  static const String bestRunFirst = 'Your first week at your goal starts the count.';
  static const String fastestTitle = 'Fastest right answer';
  static String fastestContext(String subject, int question, String date) => '$subject, question $question, $date';
  static const String fastestFootnote = 'Answers under 3 seconds are not counted.';
  static const String fastestNone = 'No timed answers yet. Timings are kept from your next paper.';
  static const String openThatQuestion = 'Open that question';
  static const String bestsEmptyLine = 'Your bests show after your first scored set.';
  static const String startQuick = 'Start a quick practice';

  static String bestFormat(String mode, String subject, int questions) => '$mode, $subject, ${plural(questions, 'question')}';

  static String bestFirst(String modeNoun) => 'First $modeNoun saved. A second one will show your change.';

  static String bestPair(String best, String latest) => 'Best on this mock type: $best. Latest: $latest.';

  static String outOf(int max) => 'of $max';

  static String latestLine(String marks) => 'Latest: $marks.';

  static const String barBest = 'Best';
  static const String barLatest = 'Latest';
  static String bestMarks(String marks, int outOf) => '$marks of $outOf marks';

  static String bestDates(String bestDate, String latestDate) => 'Best on $bestDate. Latest on $latestDate.';

  static String bestSingleDate(String date) => 'Saved on $date.';

  // Weekly ending (6.9).
  static String endingMet(int days) => 'You finished ${plural(days, 'study day')} last week. That met your goal.';

  static String endingNotMet(int days, int goal) =>
      'You finished $days of $goal study days. Nothing is lost. Your record is as you left it.';

  static const String endingTitle = 'Last week';
  static String keep(int goal) => 'Keep ${plural(goal, 'day')} a week';

  /// The goal-changing keys say what changes: the new number of days, not a verb.
  static String aimFor(int goal) => 'Aim for ${plural(goal, 'day')}';
  static String tryMore(int goal) => aimFor(goal);
  static String lighterWeek(int goal) => aimFor(goal);
  static String makeIt(int goal) => aimFor(goal);
  static const String restWeek = 'Take a rest week';
  static const String shareWeek = 'Share this week';
  static const String dismiss = 'Dismiss';
  static const String endingActionFailed = 'We could not save that. Try again.';
  static String endingGoalNow(int goal) => 'Goal is now ${plural(goal, 'day')} a week.';
  static String endingRestWeek(String untilDate) => 'Rhythm is paused until $untilDate.';

  // Returning (6.7).
  static const String welcomeBack = 'Welcome back.';
  static const String nothingLost = 'Nothing was lost.';
  static String reviewMistakes(int n) => n == 1 ? 'Review your mistake' : 'Review your $n mistakes';

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
  static const String howDayCounts = 'How a day counts';
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

  /// The receipt after the server acknowledged the goal. The days themselves stay on this phone
  /// until the account can hold them.
  static String studyDaysSaved(int n) => 'Goal saved: ${plural(n, 'study day')} a week. Your days are kept on this phone.';
  static String studyDaysRow(List<String> weekdays) =>
      weekdays.length == 7 ? 'Study days: every day' : 'Study days: ${joinWithAnd(weekdays)}';
  static const String editStudyDays = 'Edit days';

  // Milestone tracks.
  static const String trackPapers = 'Papers';
  static const String trackRepairs = 'Repairs';
  static const String trackRhythm = 'Weeks at your goal';
  static const String trackBest = 'Your best work';
  static const String trackBestLink = 'See your bests';
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
  static const String stepFirstNta = 'Exam-day rehearsal';
  static const String stepFiveMocks = '5 full mocks';
  static const String stepFirstHold = 'It held';
  static const String stepRunThree = '3 weeks in a row';
  static const String stepCleanSet = 'Clean set';
  static const String stepFourSubjects = 'Four subjects';
  static const String stepNewBest = 'New best';
  static const String condFirstNta = 'Lands when you finish a paper in NTA mode.';
  static const String condFiveMocks = 'Lands with your 5th scored full mock or NTA paper.';
  static const String condFirstHold = 'Lands when a mistake you repaired is answered right on a fresh question.';
  static const String condRunThree = 'Lands when 3 weeks in a row reach your goal.';
  static const String condCleanSet = 'Lands when every answer is right in a scored set of 10 or more questions.';
  static const String condFourSubjects = 'Lands when you have a scored set in 4 different subjects.';
  static const String condNewBest = 'Lands when you beat your own marks on the same kind of mock.';
  static const String stepActionNta = 'Open NTA mode';

  // Badges on You (app-you-1016 A.2).
  static const String badgesTitle = 'Badges';
  static String badgesSeeAll(int total) => 'See all $total';
  static String badgesEarned(int earned, int total) => earned == 0 ? 'None earned yet' : '$earned of $total earned';
  static String badgeNext(String name, String condition) => 'Next: $name. $condition';
  static String badgeNextCounted(String name, int count, int target) => 'Next: $name. $count of $target so far.';
  static String badgeCoinEarned(String name, String date) => '$name, earned $date';
  static String badgeCoinNotYet(String name, String condition) => '$name, not yet. $condition';
  static const String badgesLoadFailed = 'Could not load your badges.';
  static const String trackComplete = 'Every step on this path has landed.';
  static String trackCount(int earned, int total) => earned == 0 ? 'None earned yet' : '$earned of $total earned';
  static String soFar(int count, int target) => '$count of $target so far';
  static String stepEarned(String name, String date) => '$name, landed on $date';
  static String stepNext(String name, String condition) => 'Next: $name. $condition';
  static String stepLater(String name) => '$name, after that';
  static String trackCountOf(int landed, int total) => '$landed of $total landed';
  static String ofLanded(int total) => 'of $total earned';
  static String landedSummary(int landed, int total) => '$landed of $total badges earned';

  // Mobi on the milestones screen.
  static const String milestonesMobiEmpty = 'Your first one lands with a scored set.';
  static const String startSet = 'Start a quick practice';
  static const String milestonesMobiComplete = 'Every path has landed. They stay dated here for good.';
  static String stepJustLanded(String name) => '$name just landed.';

  /// The small volt line under the achievement headline of a path that just landed a step.
  static const String justLanded = 'Just landed';

  // A badge opened in its sheet (app-you-1016 Screen C).
  static String badgeEarnedOn(String date) => 'Earned on $date';
  static const String badgeNotYet = 'Not yet';
  static String badgeLanded(String name) => '$name landed.';
  static String badgePathStep(String path, int step, int of) => '$path, step $step of $of.';
  static String badgeNoSequence(String path) => '$path. Any of these can come first.';
  static const String openThatPaper = 'Open that paper';
  static const String badgeDone = 'Done';
  static String badgeFromPaper(String subject, String kind, String date, String marks, {String? before}) =>
      'From your $subject $kind, $date: $marks${before == null ? '' : ' (before: $before)'}';
  static String paperKind(String mode) => switch (mode) {
        'full' => 'full mock',
        'nta' => 'NTA mode paper',
        _ => 'practice set',
      };

  // A step opened in its sheet.
  static String stepLandedOn(String date) => 'Landed on $date.';
  static String stepAfter(String previous) => 'Comes after $previous.';
  static const String stepActionFullMock = 'Start a full mock';
  static const String stepActionRepair = 'Open your mistakes';
  static const String stepActionRhythm = 'See your week';
  static const String close = 'Close';
  static String trackLanded(String track, int earned, int total) => '$track, $earned of $total earned';

  // The receipt for milestones that landed while the app was away (more than 48 hours ago).
  static const String seeMilestones = 'See your milestones';

  static String? _landedName(String id) => switch (id) {
    'first_scored_session' => 'Your first scored set',
    'first_full_mock' => 'Your first full mock',
    'sessions_10' => 'Your 10th scored set',
    'first_repair' => 'Your first repair',
    'repairs_5' => 'Your 5th finished repair',
    'repairs_10' => 'Your 10th finished repair',
    'repairs_25' => 'Your 25th finished repair',
    'first_week_met' => 'Your first week in rhythm',
    'weeks_met_4' => 'Your fourth week at your goal',
    'first_nta' => 'Your exam-day rehearsal',
    'full_mocks_5' => 'Your 5th full mock',
    'first_hold' => 'Your first repair that held',
    'run_weeks_3' => 'Your 3 weeks in a row',
    'clean_set' => 'Your clean set',
    'four_subjects' => 'Your fourth subject',
    'new_best' => 'Your new best',
    _ => null,
  };

  /// True for a milestone id this app version has words for.
  static bool knowsMilestone(String id) => _landedName(id) != null;

  /// "Your first repair landed on 11 October." and, when others landed too, how many.
  static String milestoneReceipt(String id, String date, {int others = 0}) {
    final head = '${_landedName(id) ?? 'A milestone'} landed on $date.';
    if (others <= 0) return head;
    return '$head ${others == 1 ? '1 more milestone' : '$others more milestones'} landed while you were away.';
  }
}
