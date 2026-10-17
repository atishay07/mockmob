// The road board (owner test 15 Oct: "showing the board, making it a bit more interactive, and
// making it editable or changeable, something more valuable and useful"): four tiles under the
// road to May that are the student's own, each one tappable for its detail and two of them
// editable. Plain values and arithmetic only, so tests feed fixtures:
//
// * Your exam date: the start of the expected window until the student sets a day of their own.
//   NTA has not published 2027, so the default always says "expected".
// * Mocks taken: full and NTA-style mocks on the record, against a target the student sets.
// * Study days left: the student's weekly goal from today to their date, board weeks at two
//   (the onboarding plan's own arithmetic, CuetCalendar).
// * This week: study days the server counted this week, against the goal.
//
// Nothing here predicts marks or chances.
import '../../../core/models/attempt.dart';
import '../../onboarding/data/calendar.dart';

/// What the student set for their road. Kept on this phone (`roadPlanProvider`).
class RoadPlan {
  const RoadPlan({this.examDate, this.mockTarget, this.onAccount = false});

  /// The account holds the road (the server has the fields): a save says "Saved to your account",
  /// never "on this phone" (walk 1, TODAY-5).
  final bool onAccount;

  /// The day they are aiming for (a UTC date), or null for the expected window.
  final DateTime? examDate;

  /// How many full mocks they want behind them before the exam, or null when unset.
  final int? mockTarget;

  RoadPlan copyWith({DateTime? examDate, bool clearDate = false, int? mockTarget, bool clearTarget = false}) => RoadPlan(
        examDate: clearDate ? null : (examDate ?? this.examDate),
        mockTarget: clearTarget ? null : (mockTarget ?? this.mockTarget),
        onAccount: onAccount,
      );

  @override
  bool operator ==(Object other) => other is RoadPlan && other.examDate == examDate && other.mockTarget == mockTarget && other.onAccount == onAccount;

  @override
  int get hashCode => Object.hash(examDate, mockTarget, onAccount);
}

/// The latest day a student can set: the end of June after the expected window, in case NTA
/// moves it. The earliest is tomorrow.
DateTime latestExamDate(DateTime windowStart) => DateTime.utc(windowStart.year, 6, 30);

/// The mock target's range on the stepper.
const int mockTargetMin = 1;
const int mockTargetMax = 60;

/// A first target to offer when the student has none: one full mock a fortnight to the exam,
/// at least five, never below what they have already taken plus one.
int suggestedMockTarget({required int weeks, required int taken}) {
  final pace = (weeks / 2).ceil();
  final base = pace < 5 ? 5 : pace;
  final atLeast = taken + 1;
  return (base < atLeast ? atLeast : base).clamp(mockTargetMin, mockTargetMax);
}

class RoadBoard {
  const RoadBoard({
    required this.today,
    required this.examDate,
    required this.ownDate,
    required this.daysToExam,
    this.mocksTaken,
    this.mockTarget,
    this.lastMockAt,
    this.studyDaysLeft,
    this.goal,
    this.weekDone,
    this.weekGoal,
  });

  final DateTime today;

  /// The day the board counts to: the student's own, else the start of the expected window.
  final DateTime examDate;

  /// True when [examDate] is the student's own choice.
  final bool ownDate;

  /// Whole days from today to [examDate] (0 on the day, never negative).
  final int daysToExam;

  /// Full and NTA-style mocks on the record; null while the record has not been read.
  final int? mocksTaken;
  final int? mockTarget;

  /// When the newest mock was completed (a UTC date), or null.
  final DateTime? lastMockAt;

  /// Study sessions left at the student's goal, board weeks at two; null without a goal.
  final int? studyDaysLeft;
  final int? goal;

  /// Study days the server counted this week, and the week's goal; null while rhythm is off.
  final int? weekDone;
  final int? weekGoal;

  int get weeksToExam => daysToExam ~/ 7;

  /// The same board counted to [day] instead (the exam flag while it is dragged): the days, the
  /// study days and the mock pace follow, nothing else changes.
  RoadBoard withExam(DateTime day, {required bool own}) {
    final days = DateTime(day.year, day.month, day.day).difference(DateTime(today.year, today.month, today.day)).inDays;
    return RoadBoard(
      today: today,
      examDate: day,
      ownDate: own,
      daysToExam: days < 0 ? 0 : days,
      mocksTaken: mocksTaken,
      mockTarget: mockTarget,
      lastMockAt: lastMockAt,
      studyDaysLeft: goal == null || days <= 0 ? null : sessionsUntil(today, day, daysPerWeek: goal!),
      goal: goal,
      weekDone: weekDone,
      weekGoal: weekGoal,
    );
  }

  /// The same board at another study-days goal (the pace strip while it is dragged).
  RoadBoard withGoal(int? next) => RoadBoard(
        today: today,
        examDate: examDate,
        ownDate: ownDate,
        daysToExam: daysToExam,
        mocksTaken: mocksTaken,
        mockTarget: mockTarget,
        lastMockAt: lastMockAt,
        studyDaysLeft: next == null || daysToExam <= 0 ? null : sessionsUntil(today, examDate, daysPerWeek: next),
        goal: next,
        weekDone: weekDone,
        weekGoal: weekGoal,
      );

  /// The same board with another mock target (the mock ruler while it moves).
  RoadBoard withTarget(int? target) => RoadBoard(
        today: today,
        examDate: examDate,
        ownDate: ownDate,
        daysToExam: daysToExam,
        mocksTaken: mocksTaken,
        mockTarget: target,
        lastMockAt: lastMockAt,
        studyDaysLeft: studyDaysLeft,
        goal: goal,
        weekDone: weekDone,
        weekGoal: weekGoal,
      );

  /// Mocks still to take for the target, or null without one.
  int? get mocksLeft {
    final target = mockTarget, taken = mocksTaken;
    if (target == null || taken == null) return null;
    return target - taken < 0 ? 0 : target - taken;
  }

  /// Days between mocks if the rest are spread evenly to the exam, or null when it cannot be
  /// said (no target, target met, or no days left).
  int? get daysPerMock {
    final left = mocksLeft;
    if (left == null || left == 0 || daysToExam <= 0) return null;
    final d = (daysToExam / left).floor();
    return d < 1 ? 1 : d;
  }
}

/// Study sessions from [from] (a date) up to [until] at [daysPerWeek], with the board weeks of
/// [until]'s year at [CuetCalendar.boardWeekSessions]. Whole weeks only, as onboarding counts.
int sessionsUntil(DateTime from, DateTime until, {required int daysPerWeek}) {
  final start = DateTime(from.year, from.month, from.day);
  final end = DateTime(until.year, until.month, until.day);
  final weeks = end.difference(start).inDays ~/ 7;
  if (weeks <= 0 || daysPerWeek <= 0) return 0;
  final boardsStart = CuetCalendar.boardsStart(until.year), boardsEnd = CuetCalendar.boardsEnd(until.year);
  var total = 0;
  for (var w = 0; w < weeks; w++) {
    final weekStart = start.add(Duration(days: w * 7));
    final inBoards = !weekStart.isBefore(boardsStart) && weekStart.isBefore(boardsEnd);
    total += inBoards && daysPerWeek > CuetCalendar.boardWeekSessions ? CuetCalendar.boardWeekSessions : daysPerWeek;
  }
  return total;
}

/// The board for [today]. [dateOf] turns an instant into the student's calendar date.
RoadBoard buildRoadBoard({
  required DateTime today,
  required DateTime windowStart,
  required RoadPlan plan,
  required List<Attempt>? attempts,
  required DateTime Function(DateTime instant) dateOf,
  int? goal,
  int? weekDone,
  int? weekGoal,
}) {
  final own = plan.examDate;
  final ownValid = own != null && own.isAfter(today) && !own.isAfter(latestExamDate(windowStart));
  final exam = ownValid ? own : windowStart;
  final days = exam.difference(today).inDays;
  final mocks = attempts?.where((a) => a.isMock).toList();
  DateTime? last;
  if (mocks != null && mocks.isNotEmpty) {
    last = dateOf(mocks.map((a) => a.completedAt).reduce((a, b) => a.isAfter(b) ? a : b));
  }
  return RoadBoard(
    today: today,
    examDate: exam,
    ownDate: ownValid,
    daysToExam: days < 0 ? 0 : days,
    mocksTaken: mocks?.length,
    mockTarget: plan.mockTarget,
    lastMockAt: last,
    studyDaysLeft: goal == null || days <= 0 ? null : sessionsUntil(today, exam, daysPerWeek: goal),
    goal: goal,
    weekDone: weekDone,
    weekGoal: weekGoal,
  );
}
