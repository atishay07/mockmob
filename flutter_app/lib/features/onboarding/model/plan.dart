import '../../../core/copy/formatters.dart';
import '../../../core/router/routes.dart';
import '../data/calendar.dart';
import '../data/chapter_order.dart';
import '../data/du_catalog.dart';
import '../data/eligibility.dart';
import '../copy.dart';
import '../data/subjects.dart';
import 'answers.dart';
import 'choices.dart';
import 'deck.dart';

/// The first move the plan ends on, and only what really runs. For a subject with a free
/// starting-point check (English, Accountancy, Business Studies, Economics) it is that
/// 10-question check; when none of the student's subjects has one, it is 10 questions of
/// practice in their weakest subject, through the same Quick 10 path, and says so.
class FirstMove {
  const FirstMove({required this.subject, required this.chapter, required this.framing, required this.window});

  /// The weakest chosen subject with a starting-point check; otherwise the weakest chosen
  /// subject (practice); Accountancy when nothing was chosen.
  final SheetSubject subject;

  /// The first chapter of [subject] in MockMob's order.
  final String chapter;

  /// One line that the worry answer changed.
  final String framing;
  final StudyTime window;

  static const int questions = 10;
  static const int minutes = 10;

  /// The free starting-point check runs for [subject]. False means plain practice.
  bool get isStartingPoint => subject.hasStartingPoint;

  /// "First check: 10 questions in Accountancy", or "First practice: 10 questions in Physics".
  String get line => isStartingPoint
      ? 'First check: $questions questions in ${subject.label}'
      : 'First practice: $questions questions in ${subject.label}';

  /// The heading over the first move.
  String get title => isStartingPoint ? OnboardingCopy.firstMoveTitle : OnboardingCopy.firstPracticeTitle;

  /// The words beside the big 10.
  String get unit => isStartingPoint ? OnboardingCopy.firstMoveUnit : OnboardingCopy.practiceUnit(subject.label);

  /// The start key.
  String get startLabel => isStartingPoint ? OnboardingCopy.startNow : OnboardingCopy.startPractice(subject.label);

  /// Why "Start" asks for an account first.
  String get needsAccount => isStartingPoint ? OnboardingCopy.checkNeedsAccount : OnboardingCopy.practiceNeedsAccount;

  /// Opens Quick 10 setup in [subject]: with the free starting-point allowance for a
  /// starting-point subject, as plain practice otherwise. The confirm sheet shows any cost.
  String get route => Uri(
        path: AppRoutes.practiceSetup('quick'),
        queryParameters: {'subject': subject.id, 'count': '$questions', if (isStartingPoint) 'purpose': 'baseline'},
      ).toString();

  /// The next time the study window opens: today if it has not started, otherwise tomorrow.
  DateTime nextWindow(DateTime now) {
    final today = DateTime(now.year, now.month, now.day, window.hour);
    return now.isBefore(today) ? today : today.add(const Duration(days: 1));
  }

  /// "Tonight at 8:00 PM", "Tomorrow at 6:00 AM".
  String laterLabel(DateTime now) {
    final at = nextWindow(now);
    final sameDay = at.day == now.day && at.month == now.month;
    final word = sameDay ? (window.hour >= 17 ? 'Tonight' : 'Today') : 'Tomorrow';
    return '$word at ${formatTime12(at)}';
  }

  static FirstMove of(OnboardingAnswers a) {
    final ranked = a.ranked;
    final ready = ranked.where((s) => s.hasStartingPoint).toList();
    SheetSubject subject = ready.isNotEmpty ? ready.first : (ranked.isNotEmpty ? ranked.first : SheetSubject.accountancy);
    bool open(SheetSubject s) => a.subjects.isEmpty || a.subjects.contains(s);
    final worry = a.worry;
    if (worry == Worry.numericals && open(SheetSubject.accountancy)) subject = SheetSubject.accountancy;
    if (worry == Worry.passages && open(SheetSubject.english)) subject = SheetSubject.english;
    final chapter = firstChapter(subject);
    final framing = switch (worry) {
      Worry.knewIt => 'Every slip becomes a repair.',
      Worry.time => 'Answer at exam pace, about a minute each.',
      Worry.numericals => 'Repairs start with the numericals you miss.',
      Worry.passages when subject == SheetSubject.english => 'English first, since passages cost you most.',
      Worry.passages => 'Long passages get a method of their own.',
      Worry.syllabus => 'Then $chapter, the first chapter on your plan.',
      Worry.noIdea || null => 'It decides what you repair first.',
    };
    return FirstMove(subject: subject, chapter: chapter, framing: framing, window: a.window);
  }
}

/// The plan printed on the back of the sheet, built only from the answers and real data.
class PlanSummary {
  const PlanSummary({required this.headline, required this.lines});

  /// "Week one starts with Partnership."
  final String headline;
  final List<String> lines;

  static PlanSummary of(OnboardingAnswers a, DateTime now) {
    final move = FirstMove.of(a);
    final subjectDefault = a.isSkipped(Steps.subjects) || a.subjects.isEmpty;
    final lines = <String>[
      subjectDefault
          ? '${move.line} (${OnboardingCopy.ourDefault}), about ${FirstMove.minutes} minutes. ${move.framing}'
          : '${move.line}, about ${FirstMove.minutes} minutes. ${move.framing}',
      rhythmLine(a),
      chapterLine(move),
      if ((a.stage ?? Stage.notSure).boards) 'Boards end in early April. The plan goes lighter from mid-February.',
      ?eligibilityLine(a),
      ?aimLine(a),
    ];
    return PlanSummary(headline: 'Week one starts with ${move.chapter}.', lines: lines);
  }

  /// True when a skipped step left a default in the plan.
  static bool usesDefaults(OnboardingAnswers a) =>
      a.isSkipped(Steps.subjects) || a.isSkipped(Steps.rhythm) || a.isSkipped(Steps.worry) || a.subjects.isEmpty;

  /// Why the plan starts where it does, without claiming how often a chapter appears.
  static String chapterLine(FirstMove move) => switch (move.subject) {
        SheetSubject.accountancy when move.chapter == 'Partnership' =>
          'Accountancy starts at Partnership. Admission, retirement and dissolution all build on it.',
        _ => '${move.subject.label} starts at ${move.chapter}, the first chapter on your plan.',
      };

  /// "4 evenings a week, 20 minutes, around 8:00 PM." A skipped pace says it is a default.
  static String rhythmLine(OnboardingAnswers a) {
    final n = a.days.length;
    final unit = n == 1 ? a.window.plural.substring(0, a.window.plural.length - 1) : a.window.plural;
    final base = '$n $unit a week, ${a.minutes} minutes, around ${a.window.time}';
    return a.isSkipped(Steps.rhythm) ? '$base (${OnboardingCopy.ourDefault}).' : '$base.';
  }

  /// "That's about 120 sessions before May." Null when the window has passed.
  static String? sessionsLine(OnboardingAnswers a, DateTime now) {
    final stage = a.stage ?? Stage.notSure;
    final n = CuetCalendar.sessionsBefore(stage.cuetYear, now, daysPerWeek: a.days.length, boards: stage.boards);
    if (n <= 0) return null;
    return 'That\'s ${CuetCalendar.about(n)} sessions before May${stage.cuetYear == 2028 ? ' 2028' : ''}.';
  }

  /// The eligibility line for the chosen course, or null without a course or subjects.
  static String? eligibilityLine(OnboardingAnswers a) {
    final course = a.course;
    if (course == null || a.subjects.isEmpty) return null;
    final check = EligibilityCheck.of(course, a.subjects.toSet());
    if (check.eligible) {
      final picks = a.colleges.length;
      final where = switch (picks) { 2 => ' at both your colleges', 3 => ' at all three of your colleges', _ => '' };
      return 'This set keeps ${course.short} open$where.';
    }
    return '${course.short} also needs ${joinWithAnd(check.missing)}.';
  }

  /// "Aim: SRCC 924.3, Hindu 919.9. Last year's DU closing scores, UR, out of 1000."
  static String? aimLine(OnboardingAnswers a) {
    final course = a.course;
    if (course == null || a.colleges.isEmpty) return null;
    final parts = <String>[];
    for (final name in a.colleges) {
      final o = course.offeringAt(name);
      final score = o?.scoreFor(a.category);
      if (o != null) parts.add(score == null ? o.short : '${o.short} ${DuCatalog.format(score)}');
    }
    if (parts.isEmpty) return null;
    return 'Aim: ${parts.join(', ')}. ${DuCatalog.source}, ${a.category}, out of ${DuCatalog.scale}.';
  }
}
