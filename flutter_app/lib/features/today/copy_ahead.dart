// The richer Today (D52, TODAY-SWIPE-1018): Mobi in the header, The weeks ahead, Your marks and the
// Weak chapters bars. Sentence case, no arrows, no middle dots, 12-hour times, real dates, every
// count with its denominator. A planned full mock is "suggested", never promised; NTA's dates keep
// the word "expected".
import '../../core/copy/formatters.dart';
import '../../core/copy/sentences.dart';

abstract final class AheadCopy {
  // Mobi in the header.
  static const String askMobi = 'Ask Mobi';

  // The weeks ahead.
  static const String title = 'The weeks ahead';
  static String pace(int perWeek) => 'At ${plural(perWeek, 'study day')} a week';
  static const String datesOnly = 'The dates ahead, as expected from last year';
  static const String nextWeek = 'Next week';
  static const String weekOf = 'Week of';

  /// "19 to 25 Oct", "26 Oct to 1 Nov".
  static String range(DateTime from, DateTime to) =>
      from.month == to.month ? '${from.day} to ${to.day} ${_month[to.month - 1]}' : '${dayMonth(from)} to ${dayMonth(to)}';

  /// "26 Oct".
  static String dayMonth(DateTime d) => '${d.day} ${_month[d.month - 1]}';

  /// The week's head: its study days, its suggested full mocks and what comes back in Revise.
  static String weekTitle({required int days, required int mocks, int? revise}) {
    final mockWords = mocks == 0 ? null : (mocks == 1 ? 'a full mock' : '$mocks full mocks');
    final reviseWords = revise == null || revise <= 0 ? null : '$revise back in Revise';
    if (days <= 0 && mockWords == null) return reviseWords == null ? restWeek : 'Rest week, $reviseWords';
    final head = days <= 0 ? _upperFirst(mockWords!) : plural(days, 'study day');
    final more = [if (days > 0 && mockWords != null) mockWords, ?reviseWords];
    if (more.isEmpty) return head;
    if (more.length == 1) return days > 0 && mockWords != null ? '$head and ${more.first}' : '$head, ${more.first}';
    return '$head, ${more.first} and ${more.last}';
  }

  static const String restWeek = 'Rest week';

  /// "Full mock 8 of 21, suggested for Sat, 60 minutes."
  static String mockLine(int number, int target, DateTime on) => 'Full mock $number of $target, suggested for ${_weekdayShort[on.weekday - 1]}, 60 minutes.';

  /// One week's suggested full mocks, every one named: "Full mock 8 of 21, suggested for Thu, 60
  /// minutes.", "Full mocks 8 and 9 of 21, suggested for Mon and Thu, 60 minutes each." or "Full mocks
  /// 8 to 10 of 21, suggested for Mon, Wed and Fri, 60 minutes each." The numbers run on, oldest first.
  static String mocksLine(List<int> numbers, int target, List<DateTime> on) {
    if (numbers.length == 1) return mockLine(numbers.single, target, on.single);
    final which = numbers.length == 2 ? '${numbers.first} and ${numbers.last}' : '${numbers.first} to ${numbers.last}';
    final days = [for (final d in on) _weekdayShort[d.weekday - 1]];
    final when = '${days.sublist(0, days.length - 1).join(', ')} and ${days.last}';
    return 'Full mocks $which of $target, suggested for $when, 60 minutes each.';
  }
  static const String reviseLine = 'Questions you repaired come back on their day.';
  static const String boardsWeek = 'A board week: the plan goes lighter.';
  static const String then = 'Then, at this pace';

  static String halfGoal(int number, int target) => 'Full mock $number of $target, half your goal';
  static const String registration = 'Registration expected to open';
  static String registrationLine(int days) => '${_upperFirst(inTime(days))}, as expected from last year\'s dates.';
  static const String boards = 'Class 12 boards';
  static String boardsLine(int studyDays) => 'The plan goes lighter: ${plural(studyDays, 'study day')} a week.';
  static String exam({required bool own}) => own ? 'CUET UG, your date' : 'CUET UG expected';

  /// "27 weeks, 94 study days and 14 more full mocks between now and then."
  static String examLine({required int days, int? studyDays, int? mocksLeft}) {
    final parts = <String>[
      days >= 7 ? plural(days ~/ 7, 'week') : plural(days, 'day'),
      if (studyDays != null && studyDays > 0) plural(studyDays, 'study day'),
      if (mocksLeft != null && mocksLeft > 0) mocksLeft == 1 ? '1 more full mock' : '$mocksLeft more full mocks',
    ];
    return '${joinWithAnd(parts)} between now and then.';
  }

  /// "in 15 weeks", "in 9 days", "tomorrow".
  static String inTime(int days) => days >= 14 ? 'in ${days ~/ 7} weeks' : (days == 1 ? 'tomorrow' : 'in $days days');

  /// "early Dec", "mid-Feb", "late Apr": a date at the pace, said as loosely as it is known.
  static String about(DateTime d) {
    final part = d.day <= 10 ? 'early' : (d.day <= 20 ? 'mid-' : 'late');
    return part.endsWith('-') ? '$part${_month[d.month - 1]}' : '$part ${_month[d.month - 1]}';
  }

  /// "mid-Feb to early Apr".
  static String span(DateTime from, DateTime to) => '${about(from)} to ${about(to)}';

  /// "Sat 1 May".
  static String dayShort(DateTime d) => '${_weekdayShort[d.weekday - 1]} ${d.day} ${_month[d.month - 1]}';

  static String weekSemantics(String when, String title, String? line) => joinSentences([when, title, line, 'Change plan']);
  static String dayChip(int weekday, {required bool planned, required bool mock}) =>
      '${_weekdayLong[weekday]}${mock ? ', full mock suggested' : (planned ? ', planned' : ', not planned')}';

  // Your marks.
  static const String marksTitle = 'Your marks';

  /// "Your last 6 Accountancy mocks", or "Newest 6 of your 9 Accountancy mocks".
  static String marksSub(int shown, int all, String subject) =>
      shown == all ? 'Your last $shown $subject mocks' : 'Newest $shown of your $all $subject mocks';

  /// "204 on Mock 7, your best of these 6."
  static String marksBest(int marks, String label, int shown) => '$marks on $label, your best of these $shown.';

  /// "171 on Mock 7. Your best of these 6 is 204, on Mock 5."
  static String marksNotBest(int marks, String label, int shown, int best, String bestLabel) =>
      '$marks on $label. Your best of these $shown is $best, on $bestLabel.';

  /// "+33 on Mock 6.", "−12 on Mock 6.", or "Level with Mock 6." when the marks are the same (never
  /// "0 on Mock 6.", which reads as a zero score).
  static String marksChange(int delta, String previous) =>
      delta == 0 ? 'Level with $previous.' : '${delta > 0 ? '+' : minusSign}${delta.abs()} on $previous.';
  static const String minusSign = '−';
  static String chartSemantics(List<(String, int)> points, int outOf) =>
      'Marks on your last ${points.length} mocks, out of $outOf: ${points.map((p) => '${p.$1}, ${p.$2}').join('; ')}.';
  static const String lastPaper = 'Last paper';

  // Weak chapters.
  static const String marksOpen = 'marks open';
  static const String weakHint = 'Tap a chapter for its mistakes and a 10-question set.';
  static const String practiseSet = 'Practise 10 questions';

  static const List<String> _month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  static const List<String> _weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const List<String> _weekdayLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /// The one-letter day chips, Monday first.
  static const List<String> dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  static String _upperFirst(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
