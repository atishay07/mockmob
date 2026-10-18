// Today 1018 (TODAY-1018 section 7, and the owner's 3:30 am words on the road): the lead card's
// value line and choices, the tappable week's readout, the three-layer Road to CUET, Change plan
// as a guided sentence, Weak chapters, Last paper, Repairs and Revise. Sentence case, no arrows,
// no exclamation marks, 12-hour times, real dates, every count with its denominator.
import '../../core/copy/formatters.dart';

abstract final class GlanceCopy {
  // The lead card.
  static String upNext(String? subject) => subject == null || subject.isEmpty ? 'Up next' : 'Up next, $subject';
  static String upNextPick(String? subject) => subject == null || subject.isEmpty ? 'Up next, your pick' : 'Up next, your pick, $subject';
  static const String doneOverline = 'Today';

  static const String titleRepair = 'Repair your last paper';
  static const String titleRevise = 'Revise what came back';
  static const String titleWeakest = 'Practise your weakest chapter';
  static const String titleStart = 'Find your starting point';
  static const String titleFooting = 'Find your footing again';
  static const String titleMock = 'A full mock instead';
  static const String titleFirstMock = 'Your first full mock';
  static const String titleDone = 'Done for tonight';
  static const String titleSmart = 'Smart practice';
  static const String titleRefresh = 'Practise to refresh';
  static const String titleCheck = 'Check this skill';
  static const String titleAnother = 'Practise another set';
  static const String titleMixed = 'Mixed practice';
  static const String titleOtherSubject = 'Another subject';

  /// "24 marks they cost you": the record's own arithmetic (5 not gained plus 1 taken per wrong
  /// answer), never a promise of marks to gain.
  static String stake(int marks) => '$marks marks they cost you';
  static String stakeThen(int marks) => '$marks marks they cost you then';
  static String stakeOpen(int marks, int papers) => '$marks marks open there, over ${plural(papers, 'paper')}';
  static String lengthToken(int minutes) => 'about $minutes min';
  static String lengthTokenSemantics(int minutes) => 'Length, about $minutes minutes. Change length.';
  /// The full mock is exactly its 60 minutes, so its token never says "about".
  static String lengthTokenExact(int minutes) => '$minutes min';
  static String lengthTokenExactSemantics(int minutes) => 'Length, $minutes minutes. Change length.';

  static String weakestLabel(String chapter) => 'questions on\n$chapter';
  static String weakestWhy(String chapter, int marks, int missed, int asked) =>
      '$chapter has $marks marks open in your record: $missed of $asked questions missed. Marked +5 and −1, the CUET way.';
  static const String mockLabel = 'questions in\n60 minutes';
  static const String mockWhy = 'A full paper, timed like the real one. It shows where the marks go across every chapter at once.';
  static String otherSubjectLabel(String subject) => 'questions in\n$subject';
  static String otherSubjectWhy(String subject, int? days) => days == null
      ? 'You have not practised $subject yet. Ten questions show where it stands.'
      : '$subject was last practised ${days == 1 ? 'yesterday' : '$days days ago'}. Ten questions keep it warm.';

  // The choices under the key.
  static const String suggested = 'Suggested';
  static const String moreWays = 'More ways to practise';
  static const String choiceRepair = 'Repair a mistake';
  static String choiceRepairLine(int open, String from) => '$open open from $from';
  static const String choiceRevise = 'Revise what is due';
  static String choiceReviseLine(int due, int minutes) => '$due due, about $minutes min';
  static const String choiceWeakest = 'Practise your weakest';
  static const String choiceMock = 'Full mock instead';
  static const String choiceMockLine = '50 questions, 60 min';
  static String choiceOtherLine(String subject) => '$subject, 10 questions';
  static const String choiceSeeRepairs = "See tonight's repairs";
  static String choiceSeeRepairsLine(int n) => '${plural(n, 'repair')} saved today';
  static String choiceSemantics(String title, String line, bool suggested) =>
      '${suggested ? 'Suggested. ' : ''}$title. $line. Shows it in the card.';

  // The cue.
  static const String cue = 'Your week, the road and weak chapters';

  // This week, the day readout.
  static const String todayWord = 'Today';
  static String dayTitle(DateTime d) => '${_weekday[d.weekday - 1]} ${d.day} ${_month[d.month - 1]}';
  static String todayTitle(DateTime d, {required bool planned}) => 'Today, ${dayTitle(d)}${planned ? ', planned' : ''}';
  static String upNextLine(String title, int? minutes) =>
      minutes == null ? 'Up next: ${_lowerFirst(title)}.' : 'Up next: ${_lowerFirst(title)}, about ${plural(minutes, 'minute')}.';
  static String paperLine(String label, String subject, int questions, int marks, int outOf, String time) =>
      '$label, $subject, $questions questions, $marks of $outOf, $time';
  static String noSession(int goal) => 'No session saved that day. The week still counts any $goal days.';
  static const String noSessionNoGoal = 'No session saved that day.';
  static const String restDay = 'A rest day in your plan. Anything you practise still counts.';
  static const String plannedAhead = 'Planned. Any day you practise counts.';
  static const String openAhead = 'Not planned. Anything you practise still counts.';
  static const String beforeFirst = 'Before your first paper.';
  static const String moveNotLoaded = 'Your move shows here once it loads.';
  static const String doneUpNext = 'Tonight is done. Anything more is extra.';
  static const String mocksUnknown = 'Full mocks load with your papers';
  static const String repairsUnknown = 'Your repairs load with your papers.';
  static String daySemantics(String title, bool selected) => '$title${selected ? ', selected' : ''}';

  // Road to CUET: three layers.
  static const String roadTitle = 'Road to CUET';
  static String weeksTo({required bool own}) => own ? 'weeks to your date' : 'weeks to CUET UG';
  static String daysTo({required bool own}) => own ? 'days to your date' : 'days to CUET UG';
  static String expectedFrom(DateTime d) => 'Expected from ${_dayLong(d)}';
  static String yourDate(DateTime d) => 'Your date, ${_dayLong(d)}';
  static const String layerToday = 'Due today';
  static const String layerWeek = 'Due this week';
  static const String layerGoal = 'Overall goal';
  static String doneOf(int done, int total) => '$done of $total done';
  static const String allDoneToday = 'Everything due today is done.';
  static String leftToday(String first, int more) => more <= 0 ? 'Left: ${_lowerFirst(first)}' : 'Left: ${_lowerFirst(first)}, and $more more';

  /// Due today's line: the next thing still open.
  static String nextToday(String first) => 'Next: ${_lowerFirst(first)}.';

  /// Due this week: what is left of the week's plan, by its last day.
  static String weekLeft({required int days, required int mocks, DateTime? by}) {
    final parts = <String>[
      if (days > 0) plural(days, 'study day'),
      if (mocks > 0) mocks == 1 ? 'a full mock' : '$mocks full mocks',
    ];
    final when = by == null ? '' : ' by ${_weekdayShort[by.weekday - 1]}';
    return 'Left: ${listJoin(parts)}$when.';
  }

  static const String weekPlanDone = "This week's plan is done.";
  static String weekPlanDoneNext(DateTime next) => "This week's plan is done. The next full mock is due ${_dayShort(next)}.";
  static String weekLeftNext(String left, DateTime next) => '$left Next full mock ${_dayShort(next)}.';
  static String weekFigure(int done, int planned) => '$done of $planned done';

  /// The overall goal's line: the pace that reaches the target, and the study days left.
  static String goalLine({required String pace, required bool suggested, required bool met, int? studyLeft, int? perWeek}) {
    final head = met ? 'Target met.' : (suggested ? 'Suggested: $pace.' : '${_upperFirst(pace)} to reach it.');
    if (studyLeft == null || perWeek == null) return head;
    return '$head ${plural(studyLeft, 'study day')} left at $perWeek a week.';
  }

  static String roadHeadSemantics(String figure, String date) => '$figure. $date. Change plan.';
  static String studyDaysOf(int done, int goal) => '$done of $goal study days';
  static String studyDaysNoGoal(int done) => plural(done, 'study day');
  static String plannedDone(int done, int planned) => '$done of $planned planned done';
  static const String setDaysHint = 'Set your days to plan the week.';
  static String mocksOf(int taken, int target) => '$taken of $target full mocks';
  static String weeksLeft(int weeks) => '${plural(weeks, 'week')} left';
  static String daysLeftShort(int days) => '${plural(days, 'day')} left';
  static const String suggestedTag = 'suggested';

  static const String itemStudyDay = 'Count today as a study day';
  static const String itemStudyDayDone = 'Today counted as a study day';
  static String itemRepair(int n, String source) => 'Repair ${plural(n, 'mistake')} from $source';
  static String itemRepaired(int n) => 'Repaired ${plural(n, 'mistake')}';
  static String itemRevise(int n) => 'Revise ${plural(n, 'question')}';
  static String itemStart(int n) => 'Answer $n questions to your starting point';
  static String itemMove(String title) => title;
  static String itemStudyWeek(int done, int goal) => 'Study days: $done of $goal';
  static String itemMockWeek(int done, int planned) => 'Full mocks this week: $done of $planned';
  static String itemMockWeekNone(String nextOn) => 'No full mock due this week. The next is due $nextOn.';
  static String itemCountedOn(List<String> days) => days.isEmpty ? 'Nothing counted yet this week.' : 'Counted: ${listJoin(days)}.';
  static String itemMocksTaken(int taken, int target, {required bool suggested}) =>
      'Full mocks: $taken of $target${suggested ? ', suggested' : ''}';
  static String itemStudyLeft(int days, int perWeek) => 'Study days left: $days at $perWeek a week';
  static String itemExamOn(DateTime d, {required bool own}) => own ? 'Your date: ${_dayLong(d)}' : 'CUET UG: ${_dayLong(d)}, expected';

  static String paceWords(int? everyDays) {
    if (everyDays == null) return 'target met';
    if (everyDays <= 8) return 'one a week';
    if (everyDays <= 17) return 'one a fortnight';
    if (everyDays >= 25 && everyDays <= 35) return 'one a month';
    return 'one every $everyDays days';
  }

  static String milestone(int days, String what, DateTime on) {
    final when = days >= 14 ? 'in ${days ~/ 7} weeks' : (days == 1 ? 'tomorrow' : 'in $days days');
    return 'Next, $when: $what, ${_dayShort(on)}.';
  }

  static const String milestoneRegistration = 'registration expected to open';
  static const String milestoneBoards = 'boards expected to begin';
  static const String milestoneExam = 'CUET UG expected to begin';
  static const String changePlan = 'Change plan';
  static String planSaved(DateTime at, int weeks, int perWeek, int mocks) =>
      'Plan saved at ${formatTime12(at)}: ${plural(weeks, 'week')}, $perWeek days a week, $mocks full mocks.';
  static String layerSemantics(String layer, String figure, String line, bool open) =>
      '$layer. $figure. $line. ${open ? 'Hide details' : 'Show details'}.';

  // Change plan.
  static const String planTitle = 'Change plan';
  static const String sentenceA = 'I sit CUET UG on ';
  static const String sentenceB = ', study ';
  static const String sentenceC = ' a week, and take ';
  static const String sentenceD = ' before it.';
  static String tokenDate(DateTime d, {required bool own}) => own ? _dayShortNoWeekdayComma(d) : '${_dayShortNoWeekdayComma(d)}, expected';
  static String tokenDays(int n) => plural(n, 'day');
  static String tokenMocks(int n) => '$n full mocks';
  static const String askDate = 'When do you sit CUET UG?';
  static const String askDays = 'Which days can you study?';
  static const String askMocks = 'How many full mocks before your exam?';
  static const String dateExpected = 'The expected start';
  static String dateExpectedNote(DateTime d) => '${_dayLong(d)}. NTA has not published the 2027 dates yet.';
  static String dateFigure(DateTime d) => '${d.day} ${_month[d.month - 1]} ${d.year}';
  static const String dateExpectedShort = 'NTA has not published the 2027 dates yet.';
  static const String pickADay = 'Pick a day';
  static const String dateOwn = 'My own date';
  static const String dateOwnNote = 'Once your admit card shows it.';
  static const String dateReadOnly = 'Set on the app for now';
  static const String daysHint = 'Board weeks, 15 Feb to 5 Apr, ease to 2 days. Any day you practise counts, planned or not.';
  static const String keepOneDay = 'Keep at least one day.';
  static const String paceFortnight = 'One a fortnight';
  static const String paceFortnightNote = 'Suggested. Steady practice alongside your chapters.';
  static const String paceFortnightWhy = 'Steady practice alongside your chapters: a fresh paper every other week.';
  static const String paceWeek = 'One a week';
  static const String paceWeekNote = 'The most practice: a full paper every week.';
  static const String paceMonth = 'One a month';
  static const String paceMonthNote = 'Lighter: more of your time on chapters.';
  static const String paceOwn = 'Your own number';
  static String paceOwnNote(int taken) => '$taken taken so far. A fresh paper from the bank each time.';
  static const String saving = 'Saving…';
  static const String saved = 'Saved.';
  static const String notSavedDate = 'Not saved. Your date is unchanged.';
  static const String notSavedDays = 'Not saved. Your days are unchanged.';
  static const String notSavedMocks = 'Not saved. Your target is unchanged.';
  static const String tryAgain = 'Try again';
  static const String next = 'Next';
  static const String back = 'Back';
  static const String done = 'Done';
  static const String fewer = 'One fewer';
  static const String more = 'One more';
  static String previewWeeks(bool own) => own ? 'weeks to your date' : 'weeks to CUET UG';
  static String previewStudy(int perWeek) => 'study days at $perWeek a week';
  static String previewMocks(String pace) => 'mocks to go, $pace';
  static String stepSemantics(int step, String value) => 'Step $step of 3. $value. Change it.';

  // Weak chapters.
  static const String weakTitle = 'Weak chapters';
  static String weakSub(int papers) => 'Where your marks go, from your last ${plural(papers, 'paper')}';
  static String weakLine(String subject, int missed, int asked) => '$subject, $missed of $asked missed';
  static const String marks = 'marks';
  static const String practise = 'Practise';
  static const String repair = 'Repair';
  static const String seeRepair = 'See repair';
  static const String repaired = 'Repaired';
  static String allInReview(int n) => 'All $n in Review';
  static String mistakeHead(int number, String paper, String when) => 'Q$number, $paper, $when';
  /// Day one, for a subject MockMob ranks chapters in: "Start with Partnership and Company Accounts. Your first paper shows where your marks go." The ranking holds no marks, so the line says where to start and never how much a chapter is worth.
  static String weakDayOneStart(List<String> chapters) => 'Start with ${chapters.join(' and ')}. Your first paper shows where your marks go.';
  /// Day one, a subject with no ranking.
  static const String weakDayOne = 'Your weak chapters show here after your first paper: where the marks go, chapter by chapter.';
  static const String weakNone = 'No chapter stands out yet. Every chapter you have answered is holding.';
  static const String weakFailed = 'Your weak chapters did not load.';
  static String weakRowSemantics(String chapter, String line, int marks, bool open) =>
      '$chapter. $line. $marks marks. ${open ? 'Hide mistakes' : 'Show mistakes'}.';

  // Last paper.
  static const String paperTitle = 'Last paper';
  static String paperBar(int right, int wrong, int blank, int total) => '$right right, $wrong wrong, $blank blank, of $total';
  /// "Biggest leak: Share Capital, 47 of the 245 marks you missed: 2 wrong and 7 left blank." The chapter is the one the
  /// result names as costliest (most marks, [marks] = 6 per wrong and 5 per blank), and the figure is shown against what
  /// the whole paper missed through the one rule ([missedMarksDenominator]); with no honest denominator it says "47 marks".
  static String leak(String chapter, int marks, int? ofMissed, int wrong, int blank) {
    final parts = [if (wrong > 0) '$wrong wrong', if (blank > 0) '$blank left blank'].join(' and ');
    final head = ofMissed == null ? '$marks marks' : '$marks of the $ofMissed marks you missed';
    return 'Biggest leak: $chapter, $head${parts.isEmpty ? '' : ': $parts'}.';
  }
  static const String leakPrefix = 'Biggest leak: ';
  static const String repairLeak = 'Repair this leak';
  static const String openResult = 'Open the result';

  // Repairs and Revise.
  static const String queueTitle = 'Repairs and Revise';
  static const String repairs = 'Repairs';
  static const String revise = 'Revise';
  static const String openWord = 'open';
  static const String dueToday = 'due today';

  /// The round is smaller than what is due: the tile's figure is the round (10) and the word keeps the whole (of 92 due today), as the lead card says it.
  static String ofDueToday(int due) => 'of $due due today';
  static String repairedToCheck(int k) => '$k repaired, ready to check on fresh questions';
  static const String noneRepaired = 'Each one you repair comes back on a fresh question.';
  static String reviseFree(int minutes) => 'Free, about $minutes min';
  static const String reviseNothing = 'Nothing due. Repaired questions come back here on their day.';
  static const String reviseUnknown = 'Open Revise to see what is due.';
  static const String queueDayOneRepairs = 'Wrong answers wait here, so each one gets a repair.';
  static const String queueDayOneRevise = 'Repaired questions come back here on their day.';
  static String tileSemantics(String title, String figure, String line) => '$title. $figure. $line.';

  // Your colleges.
  static const String collegesTitle = 'Your colleges';

  static const List<String> _weekday = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  static const List<String> _weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const List<String> _month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  static String weekdayLong(int weekday) => _weekday[weekday - 1];

  /// "Sat 1 May 2027".
  static String _dayLong(DateTime d) => '${_weekdayShort[d.weekday - 1]} ${d.day} ${_month[d.month - 1]} ${d.year}';

  /// "Mon 1 Feb".
  static String _dayShort(DateTime d) => '${_weekdayShort[d.weekday - 1]} ${d.day} ${_month[d.month - 1]}';
  static String dayShort(DateTime d) => _dayShort(d);
  static String _dayShortNoWeekdayComma(DateTime d) => _dayShort(d);

  /// "Sat 17 Oct, 9:12 PM".
  static String paperWhen(DateTime d) => '${_dayShort(d)}, ${formatTime12(d)}';

  static String listJoin(List<String> items) {
    if (items.length <= 1) return items.join();
    return '${items.sublist(0, items.length - 1).join(', ')} and ${items.last}';
  }

  static String _lowerFirst(String s) => s.isEmpty ? s : s[0].toLowerCase() + s.substring(1);
  static String _upperFirst(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
