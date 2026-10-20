// Every line Today says (Night Sheet brief sections 1.1, 8 and 12; design spec 5.3, 6.7, 6.8).
// Voice: a sharp senior who has been through CUET. Short, specific, warm, never defensive.
// Sentence case, no exclamation marks, no arrows, 12-hour times, real dates.
import '../../core/auth/load_problem.dart';
import '../../core/copy/formatters.dart' as fmt;
import '../../core/copy/formatters.dart';
import '../../core/copy/state_words.dart' show SavedCopy;
import '../../core/domain/cuet_dates.dart';
import '../paper_reel/model/paper_reel_model.dart' show PaperReelModel;
import 'logic/today_model.dart' show DurationChoice;
import '../../core/copy/sentences.dart';
import '../../core/auth/display_name.dart' show shownName;

abstract final class TodayCopy {
  // Header.
  /// "Good evening, Asha" (TODAY-1017 section 5), by the student's local hour: morning from 5 AM,
  /// afternoon from noon, evening from 5 PM to midnight. After midnight it never claims the
  /// evening ("Good evening" at 2:41 AM, D28): until 5 AM it is a plain "Hello", with no comment on
  /// the hour (the "Up late" line retired with the sleepy Mobi, F11). After 7 or more days away it
  /// is "Welcome back, Asha". Without a usable first name there is no name at all.
  static String greeting(int hour, String? firstName, {bool returning = false}) {
    final who = firstName == null || firstName.isEmpty ? null : firstName;
    final String salutation;
    if (returning) {
      salutation = 'Welcome back';
    } else {
      salutation = switch (hour) {
        < 5 => 'Hello',
        < 12 => 'Good morning',
        < 17 => 'Good afternoon',
        _ => 'Good evening',
      };
    }
    return who == null ? salutation : '$salutation, $who';
  }

  /// A first name that is really a handle ("app-e2e-student", "asha_v", "asha07") or the email's own
  /// local part is never used in the greeting (acceptance 11). A real name with a dot or a hyphen
  /// ("Mary-Ann") is (I11, 20 Oct). The rule is [shownName]'s, in one place.
  static bool isHandleName(String name, {String? email}) => shownName(name, email: email) == null;

  static String updatedAt(DateTime time) => 'Updated ${formatTime12(time)}';
  static const String offlineSuffix = 'You are offline.';
  static String updatedOffline(DateTime time) => SavedCopy.offline(time);
  static String updatedNotRefreshed(DateTime time) => SavedCopy.refreshFailed(time);
  static String updatedTried(DateTime time) => SavedCopy.triedAgain(time);
  static const String refreshSemantics = 'Try again';

  // Hero overlines.
  static String moveOverline(DateTime now) => "${tonightOrTodayTitle(now)}'s move";
  static const String firstMoveOverline = 'Your first move';
  static const String resumeOverline = 'Still open';
  static const String endedOverline = 'While you were away';
  static const String sealedOverline = 'Back from marking';

  // Day one and new user (brief 11.11).
  static const String questionsUnit = 'questions';
  // The big number and its label already say "10 questions in Accountancy", so these lines do not say them again
  // (20 Oct: the two-line title and the three-line body pushed "Suggested for you" off the first screen).
  static String startingPointLine(String subject, [int n = 10]) => 'CUET-style, marked +5 and −1. It shows where your marks go, by chapter.';
  static String startingPointWith(String subject, String framing, [int n = 10]) => 'CUET-style questions. $framing';
  static String checkSetFor(DateTime at) => 'Your check is set for ${formatTime12(at)}.';
  /// One wording at every text size: the chips above already say "10 min", and the key never
  /// has to swap to a shorter sentence when the text grows.
  static const String startNow = 'Start now, 10 min';
  static String startNowFor(int minutes) => 'Start now, $minutes min';
  static const String fullMockInstead = 'Full mock instead';
  static const String subjectChanged = 'You changed your subjects. Earlier results stay under the old ones.';

  // Ready (client-built repair).
  /// "to repair\ntonight": the big number is tonight's batch, not mistakes made today. Said only
  /// when the run holds the whole chapter, the number Review's badge shows.
  static String mistakesLabel(int n, DateTime now) => n == 1 ? 'mistake\nto repair' : 'mistakes\nto repair';

  /// After 7 or more days away: the first few of the last paper's open mistakes.
  static String mistakesFirstLabel(int n) => n == 1 ? 'mistake to\nrepair first' : 'mistakes to\nrepair first';

  /// "to repair\nin 10 min": a shorter run than the whole chapter names its length, so its number
  /// never reads as tonight's total next to Review's badge.
  static String mistakesInLabel(int minutes) => 'to repair\nin $minutes min';

  /// Where tonight's batch comes from: "3 of the 4 open mistakes in Admission of a partner, from
  /// Mock 7 on 11 Oct." The denominator names its noun, so the 4 reads as what Review's badge
  /// counts (the chapter's open mistakes) and the hero's 3 as the part that fits the chosen
  /// length. Never "holds": that word is kept for a passed fresh check.
  ///
  /// [allOpen] is every mistake open on the account (Review's own count): when it is more than this batch the line
  /// ends "123 open in all.", so the card says what it names (a part) next to what Review and the Repairs tile say
  /// (the whole), and the three numbers never read as disagreeing (v15 walk, M6).
  static String tonightLine(int n, int chapterOpen, String source, String chapter, DateTime marked, {int? allOpen}) {
    final from = 'from $source on ${formatDayMonthShort(marked)}';
    final tail = openInAllTail(allOpen, n);
    if (n < chapterOpen) return '$n of the $chapterOpen open mistakes in $chapter, $from.$tail';
    // The whole chapter: the big number already says how many, so the line never repeats it
    // (design critic 16 Oct, finding 1). "Every" keeps the denominator: all of them. Two read
    // "Both", never "All two" (SWIPE-V2-1018, W8).
    final when = '$source on ${formatDayMonthShort(marked)}';
    return (n == 1 ? 'It is from $when, in $chapter.' : n == 2 ? 'Both are from $when, in $chapter.' : 'All ${countWord(n)} are from $when, in $chapter.') + tail;
  }

  /// " 123 open in all." when the account holds more open mistakes than the [shown] ones the card names, else nothing.
  static String openInAllTail(int? allOpen, int shown) => allOpen != null && allOpen > shown ? ' ${openInAll(allOpen)}' : '';
  static String openInAll(int n) => '$n open in all.';

  /// "four" for 4, up to ten; the figure itself above that.
  static String countWord(int n) =>
      n >= 0 && n <= 10 ? const ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] : '$n';

  // The hero's length pill and its panel (design critic 16 Oct, finding 1).
  /// What the pill says: "15 min" for a repair, "10 questions" for practice, "60 min" for the full mock.
  static String lengthWords(DurationChoice d) => d.fullMock || d.questions == null ? '${d.minutes} min' : '${d.questions} questions';

  /// What a panel row says: the pill's words, and for the full mock its whole size, "Full mock: 50 questions, 60 min".
  static String lengthRowWords(DurationChoice d) => d.fullMock ? 'Full mock: ${d.questions} questions, ${d.minutes} min' : lengthWords(d);

  /// What a length gets, beside it in the panel: "2 to repair". Null for practice, whose row
  /// already says its count.
  static String? lengthGets(DurationChoice d) => d.mistakes == null ? null : '${d.mistakes} to repair';

  /// The pill for a screen reader: "Length of today's repair, 15 min. Opens the lengths".
  static String lengthPillSemantics(String title, String words) => '$title, $words. Opens the lengths';

  /// The key's words when the pill beside it says the length: "Start repair, 15 min" is drawn as
  /// "Start repair". Every move key is `verb, length`, so the verb is what comes before the
  /// first comma. Screen readers still hear the whole label.
  static String keyVerb(String label) {
    final at = label.indexOf(', ');
    return at <= 0 ? label : label.substring(0, at);
  }

  static const String repairLength = "Length of today's repair";

  // Mobi in the header (a tap says one of these, in turn).
  static const List<String> mobiIdle = ['One move at a time. This one is ready.'];
  static const List<String> mobiPoint = ['That one, just below. Start when you are set.'];
  /// Only when today's opened result improved or held. A sealed or lower result never gets it.
  static const List<String> mobiCheer = ["Today's paper held or beat the one before."];

  /// A paper was submitted today and its result is lower or has nothing to compare with.
  static const List<String> mobiRecorded = ["Today's paper is on your sheet."];

  /// A paper from today is still sealed: the line says nothing about how it went.
  static const List<String> mobiSealed = ['Your result is ready when you are.', 'Open it whenever you are set.'];
  static const List<String> mobiSleepy = ['Late one. Something short, then sleep.'];

  static String questionNumbers(List<int> numbers) {
    final shown = numbers.take(3).map((n) => '$n').toList();
    final more = numbers.length > 3 ? ' and ${numbers.length - 3} more' : '';
    return 'Questions ${joinWithAnd(shown)}$more.';
  }

  static String startRepair(int minutes) => 'Start repair, $minutes min';
  static String aajKaRepair(int minutes, String chapter) => 'Aaj ka repair: $minutes minutes, $chapter.';
  static String basedOn(DateTime date) => 'Marked on ${formatDayMonth(date)}.';
  static const String earlySignal = 'This comes from one paper so far. Another mock will sharpen it.';

  // Other next-move states (spec 5.3 table, in this voice).
  static String staleLabel(int days) => '${pluralWord(days, 'day')}\nsince a mock';
  static String staleLine(DateTime date) => 'Your latest mock was on ${formatDayMonth(date)}. A fresh set will update this.';
  static const String practiseToRefresh = 'Practise to refresh';
  static String thinLabel(int n) => '${pluralWord(n, 'question')}\nso far';
  static const String thinLine = 'You have only one paper so far. Ten more questions will sharpen the picture.';
  static const String checkThisSkill = 'Check this skill';
  static String repairedLabel(int n) => 'repaired\nfrom $n';
  static String repairedNumberLabel(String source) => 'repaired\nfrom $source';
  static const String repairedLine = 'Fresh checks are not open yet. Practise another skill while those settle.';
  static const String practiseAnother = 'Practise another skill';
  static const String questionsOfMixed = 'mixed\nquestions';
  /// Said only when the record holds no open mistake (blanks are not mistakes). A repair the
  /// student hid for today keeps [noStrongWeakness]: the mistakes are there, just set aside.
  static const String noOpenMistakes = 'No open mistakes to repair right now.';
  static const String noStrongWeakness = 'Nothing stands out right now.';
  static String startMixed(int count) => 'Start mixed practice, $count questions';

  /// A practice key states its length: "Check this skill, 10 questions".
  static String withCount(String label, int count) => '$label, $count questions';
  static const String practiceLength = 'How many questions?';
  /// The failure card (L01): its title names what did not load, its body names why. It shows
  /// only when no attempts are in hand at all; a plan read that failed while the record is on the
  /// phone never reaches the student (the move is built from the papers instead).
  static const String failTitle = "Tonight's move did not load";
  static const String failOfflineTitle = 'You are offline';

  /// The named cause and what to do, for example "MockMob's server is busy right now. Try again
  /// in a minute." Without a known cause the general line stands.
  static String unavailableFor(LoadProblem? problem) => switch (problem) {
        null => unavailableLine,
        LoadProblem.offline => unavailableOffline,
        _ => '${problem.sentence} ${problem.advice}',
      };
  static String get unavailableLine => '${LoadProblem.unknown.sentence} ${LoadProblem.unknown.advice}';
  static const String unavailableOffline = "Tonight's move needs your record. It loads when you reconnect.";

  /// Under the offline card's body: the card is not waiting for a tap.
  static const String failOfflineWatch = 'Trying again as soon as you reconnect.';

  /// After a Try again that changed nothing: its time changes on every tap, so a repeated tap
  /// visibly ran (the 5-second snackbar is retired).
  static String failTried(DateTime at) => 'Tried again at ${formatTime12(at)}. Still not loading.';

  /// The failure card's quiet second action: practice needs no record.
  static const String practiseAnyway = 'Practise anyway';

  /// Under a skeleton that has waited 8 seconds.
  static const String stillLoading = 'Still loading. Your connection looks slow.';
  static const String tryAgain = 'Try again';
  static const String chooseSomethingElse = 'Choose something else';
  static const String hiddenUntilTomorrow = 'It is hidden until tomorrow. Every mistake is still in Your papers.';
  static const String connectToStart = 'Needs a connection to start.';
  static const String showMe = 'Show me';

  /// What the sentence's link opens, for a screen reader.
  static const String showMeSemantics = 'Show me, the paper this comes from.';

  // Returning and late night (brief 1.1, spec 6.7, 6.8).
  /// The greeting already says the name, so the returning hero never repeats it.
  /// Mobi already says hello, so the headline only adds the real gap when there is one.
  static String? returningHeadline(int? daysSincePaper) =>
      daysSincePaper != null && daysSincePaper >= 3 ? '$daysSincePaper days since your latest paper.' : null;
  static String howLong(DateTime now) => 'How long have you got ${tonightOrToday(now)}?';
  static String lastMockStillHere(String source, DateTime date, int mistakes) => mistakes > 0
      ? 'Your latest mock was $source on ${formatDayMonth(date)}. Its ${plural(mistakes, 'mistake')} are still here.'
      : 'Your latest mock was $source on ${formatDayMonth(date)}. Everything is still here.';
  /// Mobi's line on Today's card, its own (Practice and Review say theirs): the card's move is
  /// already short.
  static const String lateNight = 'Still up? One short move, then sleep.';
  static const String mobiWelcomeBack = 'Good to see you.';
  static const String mobiDayOne = "Let's find your marks.";

  // Resume and ended (spec 5.3 item 2).
  static String resumeTitle(String label, String subject) => '$label, $subject';
  static String answeredLabel(int total) => 'of $total\nanswered';
  static String endsAt(DateTime at) => 'Ends at ${formatTime12(at)}.';
  static String savedAt(DateTime at) => 'Saved to your account at ${formatTime12(at)}.';
  /// How long ago the answers were last saved to your account, in words that stay true: a minute
  /// is "a minute ago", an hour "an hour ago". Said from the real save time.
  static String savedAgo(Duration since) {
    final s = since.inSeconds;
    if (s < 45) return 'Saved just now';
    if (s < 90) return 'Saved a minute ago';
    final m = since.inMinutes;
    if (m < 60) return 'Saved $m minutes ago';
    final h = since.inHours;
    if (h < 24) return h == 1 ? 'Saved an hour ago' : 'Saved $h hours ago';
    final d = since.inDays;
    return d == 1 ? 'Saved yesterday' : 'Saved $d days ago';
  }
  static const String answersOnPhone = 'Answers are on this phone.';
  static String resumeKey(String label) => 'Resume $label';
  static String endedRecorded(String label, DateTime at, int answered) =>
      '$label ended at ${formatTime12(at)}. Your ${plural(answered, 'answer')} sent before then were recorded.';
  static String endedSending(String label, DateTime at) =>
      '$label ended at ${formatTime12(at)}. Your answers are on this phone and are being sent.';
  static String endedClosed(String label, DateTime at, int answered) =>
      '$label ended at ${formatTime12(at)} and could not be recorded. '
      '${plural(answered, 'answer')} reached the server.';
  static String endedChecking(String label, DateTime at) =>
      '$label ended at ${formatTime12(at)}. Checking what reached the server.';
  static const String openResult = 'Open result';

  // Sealed result (spec 5.3 item 3, brief 12 Result).
  static String sealedTitle(String label, String subject) => '$label, $subject';
  static String receivedAt(DateTime at) => 'Received at ${formatTime12(at)}. Your result is ready.';
  static const String openSheet = 'Open your sheet';
  /// The row under the lead while a paper's result waits there (a card picked from the deck took the lead): one whole sentence that fits the row.
  static const String sealedWaiting = 'Your result is waiting for you.';

  // The paper reel on Today (D29): a truthful play-back of the student's own marked paper.
  static String reelLine(String? subject) => subject == null
      ? 'Your paper, question by question: where the marks went and what to fix first.'
      : 'Your $subject paper, question by question: where the marks went and what to fix first.';
  static const String reelTitle = 'Play your paper back';
  static const String reelKey = 'Play it back';
  /// The reel's length for a paper of [questions]: the number the result row and the reel itself use (PaperReelModel.secondsFor).
  /// Null while the paper's size is not known: the key then says nothing it cannot stand by.
  static String? reelLength(int? questions) => questions == null ? null : '${PaperReelModel.secondsFor(questions)} s';
  static const String reelLater = 'Not now';
  static const String reelSlow = 'Still reading your paper. A slow connection takes a little longer.';
  static String reelSheetSemantics(int n) => 'Your answer sheet, $n questions, ready to play back.';
  static const String reelNotLoaded = 'The paper did not load. Opening the result instead.';
  static const String openDirectly = 'Open results directly';
  static String moreResults(int n) => n == 1 ? '1 more paper to play back.' : '$n more papers to play back.';

  // Compact slots.
  static String nextUp(String what) => 'Next: $what';
  static String repairWhat(int n, String source) => 'repair ${plural(n, 'mistake')} from $source';

  // Recent papers.
  static const String yourSheet = 'Recent papers';
  // One name per set, each with its real count (owner recording 15 Oct, item 4): "papers" are
  // every finished paper, the rows; the strip is one kind of them, named with its subject.
  /// The rows under "Recent papers", naming what is counted (design critic 16 Oct, finding 6):
  /// "Last 4 of 8 papers", or "All 3 papers" when every paper is shown.
  static String sheetCaption(int shown, int total) {
    if (shown < total) return 'Latest $shown of $total papers';
    return total == 1 ? 'Your only paper' : 'All $total papers';
  }

  /// The kind the strip draws, said the way the rows label them: "Accountancy mocks",
  /// "Accountancy NTA mode mocks", "Accountancy Quick 10 papers".
  static String trendKind({required String subject, required bool mock, bool nta = false, required int questions}) =>
      mock ? '$subject ${nta ? 'NTA mode mocks' : 'mocks'}' : '$subject ${quickLabel(questions)} papers';

  /// The chart's own caption, never the rows': "Marks in your last 6 of 7 Accountancy mocks", or
  /// "Marks in all 3 of your Accountancy mocks" when it draws every one.
  static String trendCaption(int shown, int total, String kind) =>
      shown < total ? 'Marks in your latest $shown of $total $kind' : 'Marks in all $total of your $kind';

  /// A row whose subject is not the chart's says it in its title ("Quick 10, Business Studies"),
  /// so it never reads as part of the chart above it.
  static String rowTitleWithSubject(String label, String subject) => '$label, $subject';
  static String trendDot(String label, String date, int marks, int outOf) => '$label, $date. $marks of $outOf marks. Opens the result.';
  static const String sealed = 'Sealed';
  static String quickLabel(int total) => 'Quick $total';
  static String marksOf(int outOf) => 'of $outOf';
  static String changeUp(int by, String than) => '+$by on $than';
  static String changeDown(int by, String than) => '$minusSign$by on $than';
  static String changeLevel(String than) => 'Level with $than';
  static String splitLine(int right, int wrong, int blank) => '$right right, $wrong wrong, $blank blank';

  // The road.
  static const String roadTitle = 'Road to May';

  /// The road is named after the day it counts to: "Road to May" for the expected window or a
  /// date of their own in May, "Road to 20 Apr" for any other date (critic 17 Oct).
  static String roadTitleFor(DateTime? ownDate) => ownDate == null || ownDate.month == 5 ? roadTitle : 'Road to ${formatDayMonthShort(ownDate)}';

  // The road as a strip of weeks (L05, app-today-1016 section 8).
  static const List<String> weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /// "Mon, Tue, Thu and Sat".
  static String dayList(Iterable<int> days) {
    final names = [for (final d in days.toList()..sort()) weekdayShort[d]];
    if (names.length < 2) return names.join();
    return '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}';
  }

  /// The lead figure's study line: "98 study days at 4 a week, 2 in boards weeks."
  static String studyLine(int days, int goal, {required bool boards}) =>
      '${plural(days, 'study day')} at $goal a week${boards && goal > 2 ? ', 2 in boards weeks' : ''}.';
  static const String studyLineNoGoal = 'Pick your study days below to count them.';

  /// The readout over the rail: the selected week in words.
  static String readThisWeek(int done, int goal) => 'This week: $done of $goal study days done';
  static String readThisWeekNoGoal(int done) => 'This week: ${plural(done, 'study day')} counted';
  static const String readThisWeekPaused = 'This week: paused';
  static String readWeekOf(DateTime start, {int? planned, int? mockNo, int? mockOf, bool boards = false, bool registration = false}) {
    final parts = <String>[
      if (planned != null && planned > 0) plural(planned, 'study day'),
      if (mockNo != null && mockOf != null) 'mock $mockNo of $mockOf',
      if (boards) 'Class 12 boards',
      if (registration) 'registration expected',
    ];
    return 'Week of ${formatDayMonthShort(start)}${parts.isEmpty ? '' : ': ${parts.join(', ')}'}';
  }
  static String readExamWeek(DateTime exam, {required bool own}) =>
      own ? 'Your date: ${formatDayMonth(exam)}' : 'CUET UG expected from ${formatDayMonth(exam)}';
  static String weeksToGo(int weeks) => weeks < 1 ? 'This week' : '${plural(weeks, 'week')} to go';
  static String weeksFromNow(int weeks, {bool boards = false}) =>
      '${boards ? 'Lighter for boards. ' : ''}${weeks == 1 ? 'Next week' : '$weeks weeks from now'}${boards ? '.' : ''}';
  static const String readWeekLink = 'Week';
  static const String railThisA = 'This';
  static const String railThisB = 'week';
  static const String railExam = 'CUET UG';
  static const String railOwnDate = 'Your date';
  static const String railRegistration = 'Registration';
  static const String railBoards = 'Boards';
  static const String railMobiSemantics = 'Mobi, on this week. Shows the next stop.';
  static String railWeekSemantics(DateTime start, int planned, int mocks, int weeksAway) =>
      'Week of ${formatDayMonth(start)}, ${plural(planned, 'study day')} planned${mocks > 0 ? ', planned mock' : ''}, ${weeksAway == 0 ? 'this week' : '${plural(weeksAway, 'week')} from now'}';

  /// The readout's second line for a week a stop begins in: the stop's months (from
  /// `CuetDates`), ", expected", then "18 weeks from now."
  static String readStop(String when, bool expected, int weeksAway) =>
      '$when${expected ? ', expected' : ''}. ${weeksAway == 1 ? 'Next week' : '$weeksAway weeks from now'}.';
  static String chipSemantics(String title, String when, bool expected, int weeks) =>
      '${chipIn(title, weeks)}. $when${expected ? ', expected' : ''}.';

  /// Jump chips under the rail.
  static String chipIn(String title, int weeks) => weeks < 1 ? '$title, this week' : '$title, in ${plural(weeks, 'week')}';

  // Tuner 1: study days a week.
  static const String paceTitle = 'Study days a week';
  static const String paceNone = 'Pick how many days a week you will study.';
  static const String paceUnread = 'Study days did not load. Pull to refresh.';
  static const String paceSaving = 'Saving…';
  static String paceSaved(Iterable<int> days) => 'Saved. ${dayList(days)}.';
  static String paceRest(Iterable<int> days) => '${dayList(days)}.';
  static String paceFailed(String sentence, int old) => '$sentence Your days stay at $old.';
  static const String changeDays = 'Change days';

  /// The week strip's slot when its first read failed (L03): the slot stays, saying so.
  static const String weekFailed = 'This week did not load. Pull down to try again.';
  static String paceSemantics(int n, Iterable<int> days) => '${plural(n, 'day')} a week, ${dayList(days)}';

  // Mocks line under the tuners.
  static String mocksLine(int taken, int? target, int? every) {
    if (target == null) return '${plural(taken, 'full mock')} taken.';
    if (taken >= target) return '$taken taken. Target met.';
    final left = target - taken;
    final pace = every == null ? '' : (every < 10 ? ': about one every ${plural(every, 'day')}' : ': about one every ${plural((every / 7).round(), 'week')}');
    return '$taken taken, $left to go$pace.';
  }
  static const String mocksTitle = 'Full mocks before your date';
  static const String mocksChange = 'Change';
  static String takenWords(int taken) => '$taken taken';
  static String mocksSuggested(int taken, int suggested) => '$taken taken. Suggested: $suggested. Move the ruler to set it.';
  static const String mocksUnread = 'Your mocks did not load yet.';
  static const String mocksSaved = 'Saved on this phone.';
  static const String savedToAccount = 'Saved to your account.';
  static String savedWhere({required bool account}) => account ? savedToAccount : mocksSaved;
  static const String mocksFailed = 'Could not save your target. Try again.';
  static const String mocksOpenSemantics = 'Opens your mocks.';
  static String mocksSemantics(int target, int taken) => '$target, $taken taken';

  // The exam flag on the rail (8.6).
  static const String railExamTwo = 'CUET\nUG';
  static const String railOwnDateTwo = 'Your\ndate';
  static const String flagSemantics = 'Your exam date';
  static String flagValue(DateTime day, int weeksAway) => '${formatDayMonth(day)} ${day.year}, ${plural(weeksAway < 0 ? 0 : weeksAway, 'week')} away';
  static String railExamSemantics(DateTime day, {required bool own}) =>
      own ? 'Your date, ${formatDayMonth(day)}' : 'CUET UG expected from ${formatDayMonth(day)}';
  static String readYourDate(String day) => 'Your date: $day';
  static String readDragLine(int weeks, int? studyDays, int? goal) => studyDays == null || goal == null
      ? plural(weeks, 'week')
      : '${plural(weeks, 'week')}, ${plural(studyDays, 'study day')} at $goal a week';
  static String dateReceipt(String day, {required bool saved, bool account = false}) =>
      saved ? 'Your date: $day. ${savedWhere(account: account)}' : 'Your date: $day.';
  static const String dateFailed = 'Could not save your date. Try again.';
  static const String useExpectedDate = 'Use the expected date';
  static String daysToWindowLabel(int days) => '${days == 1 ? 'day' : 'days'} to the expected\nCUET window, ${CuetDates.windowMonth}';
  static String weeksLabel(int weeks) => '${weeks == 1 ? 'week' : 'weeks'} to the expected\nCUET window, ${CuetDates.windowMonth}';
  static String weeksToBoardsUnit(int weeks) => weeks == 1 ? 'week before\nboards begin' : 'weeks before\nboards begin';
  static const String boardsOn = 'Boards are on. The plan stays light until they end.';
  static const String windowOpen = 'Exam window open';
  static String windowDaysLeft(int days) => '${days == 1 ? 'day' : 'days'} left in the expected\nexam window';
  static String sessionsLine(int n, int goal) {
    if (n <= 0) return 'Your first session starts the count.';
    final about = n < 20 ? n : (n / 10).round() * 10;
    return 'About $about study ${about == 1 ? 'session' : 'sessions'} at $goal a week.';
  }
  static const String stopRegistration = 'CUET registration';
  static const String whenRegistration = CuetDates.registrationMonths;
  static const String stopBoards = 'Class 12 boards';
  static const String whenBoards = CuetDates.boardsWhen;
  static const String noteBoards = 'The plan goes lighter from mid-February.';
  static const String stopExam = 'CUET UG';
  static const String whenExam = CuetDates.windowMonth;
  /// The tag on a stop whose date NTA or CBSE has not published.
  static const String expectedTag = 'Expected';
  /// Said once above the stops when every date is still expected.
  static const String expectedDates = 'Expected dates';
  static const String nowLabel = 'Now';
  /// How far a stop on the road is.
  static const String onNow = 'On now';
  static String inDays(int days) => days <= 0 ? 'Today' : 'in ${plural(days, 'day')}';
  static String inWeeks(int weeks) => 'in ${plural(weeks, 'week')}';
  /// The first stop still ahead.
  static const String nextTag = 'Next';
  /// The stops' short names where they are drawn on the road itself.
  static const String laneRegistration = 'Registration';
  static const String laneBoards = 'Boards';
  static const String laneExam = 'CUET UG';
  /// The stretch from Now to the next stop, written over it on the road ("15 weeks").
  static String stretchTo(int days) => days < 7 ? plural(days < 1 ? 1 : days, 'day') : plural(days ~/ 7, 'week');
  /// How far a day under the finger is from today (the road's scrub readout).
  static String scrubDistance(int days) => days == 0 ? 'today' : (days > 0 ? '${plural(days, 'day')} from now' : '${plural(-days, 'day')} ago');
  static String weekNeedsOnTrack(int n) => n == 1 ? 'This week: 1 more study day by Sunday.' : 'This week: $n more study days by Sunday.';
  static const String weekNeedsMet = 'This week: your goal is met. Anything more is extra.';
  static const String weekNeedsPaused = 'This week is paused. Your run is kept.';
  static const String weekNeedsOutOfReach = 'This week: the goal is out of reach. Each study day still goes on the sheet.';
  /// The scale ("of 1000") is on every row, so the caption names only the source and the
  /// category; it stays on one line instead of leaving "1000" alone on a second. The figures are
  /// the 2026 Round 1 minimum allocation scores, and the caption says so in plain words.
  static String ladderCaption(String? category) => 'Round 1 minimum, 2026, ${categoryWords(category)}';

  /// A college-portal category in words a student says (the shared mapping in core).
  static String categoryWords(String? category) => fmt.categoryWords(category);
  static const String ladderTitle = 'My colleges';

  // Your colleges on Today (IA 5.2).
  static const String collegesTitle = 'Your colleges';
  static const String seeAllColleges = 'See all';
  static const String chooseCollegesShort = 'Choose colleges';
  static const String openCompass = 'Open Compass';
  static const String collegesFailed = 'Your colleges did not load.';
  static String collegesOpenCount(int open, int total) => '$open of $total DU programmes open to your subjects.';
  static const String collegesOpenUnknown = 'See which DU programmes your subjects open.';
  static const String dreamTag = 'Dream';
  static const String chooseColleges = 'Choose your colleges';
  static const String changeColleges = 'Change';
  static const String ladderEmpty = 'Add the colleges you are aiming for and see where each one closed in Round 1, 2026.';

  // The road board (owner test 15 Oct): the student's own tiles under the road.
  static const String boardTitle = 'Your road';
  static const String boardCaption = 'Tap a tile to see it or change it.';
  static const String boardExpectedDate = 'Expected exam date';
  static const String boardYourDate = 'Your exam date';
  static String boardDaysLeft(int days) => days <= 0 ? 'Today' : (days < 14 ? '${plural(days, 'day')} to go' : '${days ~/ 7} weeks to go');
  static const String boardMocks = 'Full mocks taken';
  static const String boardNotRead = 'Not read yet';
  static const String boardSetTarget = 'Tap to set a target';
  static String boardOfTarget(int target) => 'of your target of $target';
  static const String boardStudyDays = 'Study days left';
  static const String boardNoGoal = 'Not set';
  static const String boardSetDays = 'Set your study days';
  static String boardAtGoal(int goal) => 'at $goal a week';
  static const String boardThisWeek = 'This week';
  static String boardStudyDaysWord(int n) => n == 1 ? 'study day' : 'study days';
  static const String boardDateTitle = 'Your exam date';
  static const String boardDateBody =
      'NTA has not published the 2027 dates yet. CUET UG is expected in May 2027. Choose the day you are aiming for and your road counts to it.';
  static const String boardDateInWindow = 'In the expected window';
  static const String boardDateOther = 'Pick another day';
  static const String boardDateReset = 'Count to the expected window';
  static const String boardOnThisPhone = 'Saved on this phone.';
  static const String boardMocksTitle = 'Full mocks';
  static const String boardMocksUnread = 'Your record has not loaded yet, so the count is not shown.';
  static String boardMocksSoFar(int n, DateTime? last) => n == 0 || last == null
      ? 'No full mock on your record yet. The first one shows where you stand.'
      : '${plural(n, 'full mock')} on your record. The latest one was on ${formatDayMonth(last)}.';
  static String boardTargetLabel(String date) => 'Your target by $date';
  static const String boardFewer = 'One fewer';
  static const String boardMore = 'One more';
  static String boardTargetSemantics(int n) => 'Target, ${plural(n, 'full mock')}';
  static const String boardTargetMet = 'Target reached. Anything more is extra.';
  static String boardPace(int left, int weeks, int? every) =>
      every == null || weeks < 1 ? '$left more to go.' : '$left more in ${plural(weeks, 'week')}, about one every ${plural(every, 'day')}.';
  static const String boardSaveTarget = 'Save target';
  static const String boardStartMock = 'Start a full mock';
  static const String boardStudyDaysTitle = 'Study days left';
  static String boardStudyDaysBody(int n, int goal, String date) =>
      'At $goal study ${goal == 1 ? 'day' : 'days'} a week, you have about $n study days before $date.';
  static const String boardStudyDaysNone = 'Choose how many days a week you study and your road counts the study days left.';
  static const String boardBoardsCount = 'Board weeks, mid-February to early April, count two study days at most.';
  static const String boardChangeDays = 'Change study days';
  static String weeksToOwnDate(int weeks, String date) => '${weeks == 1 ? 'week' : 'weeks'} to your exam\ndate, $date';
  static String daysToOwnDate(int days, String date) => '${days == 1 ? 'day' : 'days'} to your exam\ndate, $date';

  /// The cue under the first screen that the road is further down (owner test 15 Oct: "something
  /// in the UI should be leading them below").
  static const String moreBelow = 'Your road to May';

  /// The cue with its number (L07): "Road to May, 28 weeks", or days in the last week.
  static String moreBelowCount({int? weeks, int? days, String title = roadTitle}) {
    if (days != null && days < 7) return '$title, ${plural(days, 'day')}';
    if (weeks != null && weeks > 0) return '$title, ${plural(weeks, 'week')}';
    return moreBelow;
  }

  // Why this sheet.
  static const String whyTitle = 'Why this';
  static String whyFrom(String source, String subject, DateTime date) => 'From $source, $subject, on ${formatDayMonth(date)}.';
  static String whyCounts(int wrong, int correct, int blank) =>
      '$wrong wrong, $correct right, $blank not attempted.';
  static String chapterRow(int wrong, int blank) {
    if (blank == 0) return '$wrong wrong';
    if (wrong == 0) return '$blank not attempted';
    return '$wrong wrong, $blank not attempted';
  }
  static const String whyEarly = 'You have one paper so far. Each mock you add sharpens the picture.';
  static const String whyRepair =
      'A repair walks you through each mistake with a worked explanation, then lets you try a similar question.';
  static const String seeMyAnswers = 'See my answers';
  static const String whyMissing = 'This suggestion has changed since you opened it.';

  // Alternatives sheet.
  static const String alternativesTitle = 'Something else instead';
  static const String altFullMock = 'Full mock';
  static const String altFullMockLine = '50 questions, 60 minutes.';
  static const String altQuick = 'Quick practice';
  static const String altQuickLine = '10 questions, about 10 minutes.';
  static const String altChapter = 'One chapter';
  static const String altChapterLine = 'Pick a chapter and practise only that.';
  static const String altReview = 'Review your mistakes';
  static const String altReviewLine = 'Read the worked explanations, free.';
  static String altRepairTitle(int n) => n == 1 ? 'Repair 1 mistake' : 'Repair $n mistakes';
  static String altRepairNote(String paper, String? chapter, int minutes) =>
      chapter == null ? 'From $paper. About $minutes min.' : 'From $paper, in $chapter. About $minutes min.';
  static String altReviseTitle(int n) => n == 1 ? 'Revise 1 question' : 'Revise $n questions';
  static String altReviseNote(int size, int due, int minutes) =>
      'Due today, so the fixes hold. About $minutes min.';
  static String altPractiseTitle(String subject) => 'Practise $subject';
  static String altPractiseNote(int questions, int? daysAgo) {
    final last = switch (daysAgo) {
      null => 'Not practised yet.',
      0 => 'Done today.',
      1 => 'Done yesterday.',
      final d => 'Done $d days ago.',
    };
    return '$questions questions, about $questions min. $last';
  }

  static String altMockTitle(String subject) => 'A full mock, $subject';
  static String altMockNote(int questions, int minutes, String? lastPaper) =>
      '$questions questions, $minutes min. ${lastPaper == null ? 'None on your record yet.' : 'Your latest was $lastPaper.'}';

  static String altNtaTitle(String subject) => 'NTA mode, $subject';
  static String altNtaNote(int questions, int minutes, {required bool pro}) =>
      'Your next mock on the exam-day screen, as you will meet it. $questions questions, $minutes min.${pro ? '' : ' Comes with Pro.'}';

  /// A server alternative's reason and length: a bare "10" gets its unit.
  static String altPlanNote(String? reason, String? duration) {
    final d = duration?.trim();
    final length = d == null || d.isEmpty ? null : (RegExp(r'^\d+$').hasMatch(d) ? 'About $d min.' : d);
    final r = reason?.trim();
    final why = r == null || r.isEmpty ? null : (r.endsWith('.') ? r : '$r.');
    return [?why, ?length].join(' ');
  }

  static const String notToday = 'Not today';
  static const String notTodayNote = 'Hides this repair until tomorrow.';

  // Weekly ending page.
  static const String weeklyEndingTitle = 'Your week';
  static const String back = 'Back to Today';

  // Loading.
  static const String loading = 'Loading Today';

  // ---------------------------------------------------------------------------------------------
  // Today 1017 (TODAY-1017 sections 4 and 5): one move, then the glance.

  // The move.
  static String firstWeekOverline(int day) => 'Day $day of your first week';
  static const String returningOverline = 'Pick up where you left off';
  static const String doneOverline = 'Done for today';
  static const String seeWhy = 'See why';
  static String seeAll(int n) => 'See all $n';
  static const String changeLength = 'Change length';
  static const String somethingElse = 'Something else';
  static const String practiseMore = 'Practise more';
  static const String seeTonightsRepairs = "See tonight's repairs";

  // The price line under the key (TODAY-1018 section 5): the wallet's and the quote's own numbers.
  static String priceRepair(int balance) => 'Each repair uses 1 credit. You have $balance.';
  static const String priceFree = 'Free. No credits.';
  static const String openTheRepair = 'Open the repair';
  static const String openTheSession = 'Open the session';

  /// The sparse clause (AGENT_RULES overlay: say when data is thin). One paper replaces the why's
  /// source sentence; two add a clause.
  static String sparseOne(String source, DateTime marked) =>
      'From your one paper so far, $source on ${formatDayMonthShort(marked)}. A full mock gives a fuller picture.';
  static String sparseFew(int papers) => 'From your ${countWord(papers)} papers so far.';

  /// The first Repair of the first week names what Repair does, in the move itself (F18).
  static const String firstRepairTeach = 'Repair shows why your answer went wrong and gives you one like it to try.';

  /// After 7 or more days away, with open mistakes on the last paper.
  static String returningWhy(String source, DateTime marked, int open, int shown, {int? allOpen}) {
    final lead = 'Your latest paper was $source on ${formatDayMonthShort(marked)}.';
    final tail = openInAllTail(allOpen, open);
    if (open == shown) return (open == 1 ? '$lead Its one mistake is still open.' : '$lead All ${countWord(open)} of its mistakes are still open.') + tail;
    return '$lead Its ${countWord(open)} open mistakes are still here; start with ${countWord(shown)}.$tail';
  }

  /// After 7 or more days away with nothing open: a warm-up.
  static String warmUpLabel(int n) => 'questions\nto warm up';
  static String warmUpWhy(int days) => 'Your latest session was $days days ago. Ten questions find your footing again, marked the CUET way.';
  static String startQuestions(int n) => 'Start $n questions';

  // Revise (first week, day 2, and any day it has questions due).
  static String reviseLabel(int n) => n == 1 ? 'mistake comes\nback today' : 'mistakes come\nback today';
  static String reviseWhy(int n) =>
      'Revise brings back what you got wrong after 1, 3, 7 and 21 days. ${n == 1 ? 'This one is' : 'These ${countWord(n)} are'} due today, so the fix holds.';
  static String startRevise(int minutes) => 'Start Revise, $minutes min';

  /// The round is smaller than what is due: "10" over "of 92 due today", so the number is the
  /// session's own size and the key's minutes never seem to cover all 92.
  static String reviseOfDue(int due) => 'of $due due\ntoday';

  /// The round's subjects as the card's title: "Accountancy", "Accountancy and Economics",
  /// "Accountancy and 2 more".
  static String reviseSubjects(List<String> names) => names.length <= 2 ? joinWithAnd(names) : '${names.first} and ${names.length - 1} more';

  /// Where the round's questions were missed, newest first: "Mock 3 on 17 Oct", "Quick 10 on
  /// 15 Oct", "2 quick practices", joined into one sentence with Revise's rule after it.
  static String revisePaper(String source, DateTime date) => '$source on ${formatDayMonthShort(date)}';
  static String reviseQuickMany(int n) => '$n quick practices';
  static String reviseMoreMocks(int n) => plural(n, 'more mock');
  static String reviseFrom(List<String> parts) =>
      'From ${joinWithAnd(parts)}. Each comes back after 1, 3, 7 and 21 days, so the fix holds.';

  /// No paper on the phone matches the round's questions: the chapters say where they are from.
  static String reviseFromChapters(String first, int more) => more == 0
      ? 'From $first. Each comes back after 1, 3, 7 and 21 days, so the fix holds.'
      : 'From $first and ${plural(more, 'more chapter')}. Each comes back after 1, 3, 7 and 21 days, so the fix holds.';

  /// The lengths panel's question for Revise (5 or 10 questions, the Revise screen's own setting).
  static const String reviseLength = 'How many to revise today?';

  // Done for today.
  static String doneRepairLabel(int total) => 'of $total repaired\ntonight';
  static String doneRepairWhy(String? chapter) => chapter == null
      ? 'Every repair is saved in Your papers. Check it held opens there when a fix is due.'
      : '$chapter is clear for now. Check it held opens in Your papers when a fix is due.';
  static const String donePracticeLabel = 'minutes\npractised tonight';
  static String donePracticeWhy(DateTime at) => "Saved at ${formatTime12(at)}. Tomorrow's move is planned from it.";

  // The first full mock (first week, days 5 to 7).
  static String firstMockLabel(int minutes) => 'questions in\n$minutes minutes';
  static const String firstMockWhy = 'Your first full mock, timed like the real paper. It shows where you stand across the whole syllabus.';
  static String startTimedMock(int minutes) => 'Start a timed mock, $minutes min';

  // Smart practice (first week, days 3 and 4, Pro).
  static const String smartLabel = 'questions from your\nweak chapters';
  static String smartWhy(String subject, int sessions) =>
      'Smart practice picks questions from the chapters where your $subject marks went, from ${plural(sessions, 'saved session')}.';
  static String startSmart(int n) => 'Start smart practice, $n questions';
  static String startSmartFor(int n) => startSmart(n);
  static String warmUpKey(int n) => 'Start practice, $n questions';

  /// Under a failure's cause: what is still safe.
  static const String safeLine = 'Every paper and every mistake is safe, and Your papers still opens them.';

  // This week (4.3).
  static const String weekTitle = 'This week';
  static const String weekStudyDays = 'study days';
  static String weekCounted(Iterable<int> days) => '${dayList(days)} counted.';
  static String tonightMakes(int n) => 'Tonight makes $n.';
  static const String tonightCounts = 'Tonight counts.';
  /// Papers were finished today but none reached 5 answers, the rule of the server for a study day.
  static String shortPaperToday(int n) =>
      'Today\'s paper had ${n == 0 ? 'no answers' : n == 1 ? '1 answer' : '$n answers'}. A paper counts once you answer 5 questions in it.';
  static String weekGoalMet(int goal) => 'Goal met: $goal of $goal study days. Anything more this week is extra.';
  /// Back after a week or more (TODAY-1018 section 5): no shaming, no streak loss.
  static String weekNew(int goal) => 'A new week starts with one session. ${weekNewKey(goal)}';
  static String weekNewKey(int goal) => 'Today can be day one of $goal.';

  /// Day one (TODAY-1018 section 5).
  static String weekDayOne(int goal) => 'Your plan is ${plural(goal, 'day')} a week. $weekDayOneKey';
  static const String weekDayOneKey = 'Today is the first.';
  static const String weekNoGoal = 'Pick how many days a week you study.';
  static const String setDays = 'Set days';
  static const String weekNotRead = 'Study days did not load.';
  static const String weekPaused = 'Your week is paused. Your run is kept.';
  static String nextStudyDay(String day) => 'Next: $day.';
  static const String restToday = 'Today is a rest day.';
  static String lastWeek(int done, int goal) => 'Last week: $done of $goal.';
  static const String seeYourWeek = 'See your week';
  static String weekSemantics(String figure, String marks, String caption) => joinSentences(['This week, $figure', marks, caption, 'Opens your week']);

  // Road to May (4.4).
  static String roadWeeksTo({required bool own, required int n}) => '${n == 1 ? 'week' : 'weeks'} to ${own ? 'your date' : 'CUET UG'}';
  static String roadDaysTo({required bool own, required int n}) => '${n == 1 ? 'day' : 'days'} to ${own ? 'your date' : 'CUET UG'}';
  static String flagLabel(DateTime day, {required bool own}) => '${own ? 'Your date' : 'CUET UG'}, ${formatDayMonthShort(day)}';
  static String tokenPace(int goal) => '$goal a week';
  static String tokenMocks(int n) => '$n full mocks';
  static String studyDaysAt(int n) => '${plural(n, 'study day')} at';
  static const String studyDaysPick = 'Your study days';
  static String mocksBefore(int taken, {required bool suggested}) => suggested
      ? (taken > 0 ? 'suggested, $taken taken' : 'before your date, suggested')
      : 'before your date, $taken taken';
  static const String doneRail = 'Done';
  static String paceTokenSemantics(int goal) => 'Study days a week, $goal. Opens the days.';
  static String mocksTokenSemantics(int n, int? taken) => 'Full mocks before your date, $n${taken == null ? '' : ', $taken taken'}. Opens the target.';
  static String stripSemantics(int weeks, String flag) => 'The weeks to your exam, $weeks of them. $flag. Opens the week by week road.';

  // The rows (4.5).
  static const String lastPaperTitle = 'Latest paper';
  static const String collegesRowTitle = 'Your colleges';
  static String lastPaperName(String label, String subject) => '$label, $subject';
  static String lastPaperSub(String date, String? change) => change == null ? date : '$date, $change';
  static String collegesSub(String course, int more) => more > 0 ? '${withoutStop(course)}, 2026 Round 1. $more more saved.' : '${withoutStop(course)}, 2026 Round 1.';

  // Your colleges on Today (19 Oct, D104): the three hardest to get into, labelled, and every one
  // a tap away. "Top" says what it means (the owner asked whether the three were first
  // preferences): the ones that need the most marks.
  static String collegesTop(int of) => of > 3 ? 'Your top 3 of $of need the most marks to get in.' : 'The one that needs the most marks comes first.';
  static String collegeRowSub(String course, {required bool figure}) =>
      figure ? '${withoutStop(course)}, 2026 Round 1.' : joinSentences([course, 'There is no 2026 Round 1 cutoff for your category']);
  static String seeAllCount(int n) => 'See all $n colleges';
  static const String seeAllSub = 'Every college you picked, with the marks it needs.';
  static String seeAllSemantics(int n) => 'See all $n colleges. Every college you picked, with the marks it needs.';
  static const String collegesEmpty = 'Choose up to 8 colleges you are aiming for. The 3 that need the most marks show here, with their 2026 cutoffs.';
  static const String choose = 'Choose';

  // Today 1017, second half.
  /// The key's length, drawn inside the key after the verb ("Start repair  15 min"): what comes
  /// after the first comma of every move key. Null when the label has none.
  static String? keyLength(String label) {
    final at = label.indexOf(', ');
    return at <= 0 ? null : label.substring(at + 2);
  }

  static String weekLine(Iterable<int> counted, String tail) => counted.isEmpty ? tail : '${weekCounted(counted)} $tail';
  static String weekFigureSemantics(int done, int? goal) => goal == null ? plural(done, 'study day') : '$done of ${plural(goal, 'study day')}';
  static const String markCounted = 'counted';
  static const String markPlanned = 'planned';
  static const String markRest = 'rest day';
  static const String markBefore = 'before your account';
  static const String markOpen = 'not counted';
  static String rowSemantics(String label, String title, String sub, String figure) => joinSentences([label, title, sub, figure]);
  static String ofDenominator(int n) => 'of $n';
  static const String bandRegistration = 'Registration';
  static const String bandBoards = 'Boards';
}
