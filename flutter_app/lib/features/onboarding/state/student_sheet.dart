import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../data/calendar.dart';
import '../data/du_catalog.dart';
import '../data/subjects.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../model/plan.dart';
import 'answers_controller.dart';

/// One dream college with its real Round 1 figure for the student's category (null when no seat
/// went to that category in Round 1).
class SheetCollege {
  const SheetCollege({required this.name, required this.short, required this.score});

  final String name;
  final String short;
  final double? score;
}

/// The student's sealed sheet, for Today, You and anything else that wants what the student
/// said in onboarding. Read-only; it lives on the phone (see `sheetSyncProvider` for what was
/// written to the account).
class StudentSheet {
  const StudentSheet({required this.answers, required this.now});

  final OnboardingAnswers answers;
  final DateTime now;

  Stage get stage => answers.stage ?? Stage.notSure;

  /// Whole weeks to the expected May window, or null once it has started.
  int? get weeksToWindow => CuetCalendar.weeksTo(stage.cuetYear, now);

  /// The DU course, or null ("Not sure yet").
  DuCourse? get course => answers.course;
  List<SheetCollege> get colleges => [
        for (final name in answers.colleges)
          if (course?.offeringAt(name) case final o?) SheetCollege(name: o.college, short: o.short, score: o.scoreFor(answers.category)),
      ];

  /// Label for the college figures: "Last year's DU closing scores, UR, out of 1000".
  String get collegeSource => '${DuCatalog.source}, ${answers.category}, out of ${DuCatalog.scale}';
  String get category => answers.category;

  /// The subjects, weakest first, with how solid each felt.
  List<(SheetSubject, Confidence?)> get subjects => [for (final s in answers.ranked) (s, answers.confidence[s])];
  Worry? get worry => answers.worry;
  int get minutes => answers.minutes;

  /// Study days, 0 = Monday.
  Set<int> get days => answers.days;
  StudyTime get studyTime => answers.window;

  /// The starting-point check the plan begins with.
  FirstMove get firstMove => FirstMove.of(answers);

  /// The first move was put off to the study window.
  bool get deferredToTonight => answers.tonight;
  PlanSummary get plan => PlanSummary.of(answers, now);
}

/// The sealed sheet, or null before the student seals one (or while it loads).
final studentSheetProvider = Provider<StudentSheet?>((ref) {
  final answers = ref.watch(onboardingAnswersProvider).value;
  if (answers == null || !answers.sealed) return null;
  return StudentSheet(answers: answers, now: ref.watch(nowProvider)());
});
