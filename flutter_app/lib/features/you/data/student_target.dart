// What the student put on their sheet in setup, as You shows it: the stage, the course and up to
// eight colleges (every one they picked), the subjects with how solid each feels, what costs them marks and their study
// week. Most of it has no endpoint (APP-API-CONTRACT 2.1) and lives on the phone in the
// onboarding answers; the week's day count and study time are also on the server (goal and
// reminders). This is the one seam You reads, so tests override [studentTargetProvider].
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../onboarding/data/du_catalog.dart' show DuCatalog;
import '../../onboarding/data/subjects.dart' show Confidence;
import '../../onboarding/model/choices.dart' show Stage, StudyTime, Worry;
import '../../onboarding/model/deck.dart' show Steps;
import '../../onboarding/onboarding.dart' show onboardingAnswersProvider;
import 'confidence_store.dart';

/// The study week as the student set it.
class StudentWeek {
  const StudentWeek({required this.days, required this.window, required this.minutes});

  /// Study days, 0 = Monday.
  final Set<int> days;
  final StudyTime window;

  /// 10, 20 or 30.
  final int minutes;
}

/// [days] made to hold exactly [count] weekdays (1 to 7), for a week whose phone copy and server
/// goal disagree. The server only knows how many days, so the weekdays the student already
/// picked stay: extra ones are dropped from the end of the week, missing ones are added from
/// Monday on.
Set<int> daysForCount(Set<int> days, int count) {
  final want = count.clamp(1, 7);
  final kept = ([...days]..sort()).take(want).toSet();
  for (var d = 0; d < 7 && kept.length < want; d++) {
    kept.add(d);
  }
  return kept;
}

class StudentTarget {
  const StudentTarget({
    this.course,
    this.courseId,
    this.colleges = const [],
    this.subjects = const [],
    this.stage,
    this.worry,
    this.confidence = const {},
    this.week,
    this.category = DuCatalog.defaultCategory,
  });

  /// The programme as students say it, "B.Com (Hons)".
  final String? course;

  /// The DU course id, for the editor.
  final String? courseId;

  /// College names in order of the marks they needed last year, every one picked (up to eight).
  /// Today shows the top three of them; the account keeps them all (19 Oct, G7).
  final List<String> colleges;

  /// Public subject ids from setup, weakest first. You prefers the profile's subjects and falls
  /// back to these before the account has them.
  final List<String> subjects;

  /// Where the student is on the road, when they said.
  final Stage? stage;
  final Worry? worry;

  /// How solid each subject feels, by public id.
  final Map<String, Confidence> confidence;

  /// The week, once the student set one.
  final StudentWeek? week;

  /// The category the college figures use ("UR").
  final String category;

  bool get isEmpty => course == null && colleges.isEmpty && subjects.isEmpty && stage == null;

  static const none = StudentTarget();
}

/// The answers kept on this phone, read field by field: a field the student never answered is
/// left out rather than shown as a default.
final studentTargetProvider = Provider<StudentTarget>((ref) {
  final answers = ref.watch(onboardingAnswersProvider).value;
  final extra = ref.watch(youConfidenceProvider);
  if (answers == null) return StudentTarget(confidence: extra);
  final course = answers.course;
  final weekSet = answers.sealed || answers.isDone(Steps.rhythm);
  return StudentTarget(
    course: course?.short,
    courseId: course?.id,
    colleges: [
      for (final name in answers.colleges)
        if (course?.offeringAt(name) case final o?) o.college,
    ],
    subjects: [for (final s in answers.ranked) s.id],
    stage: answers.stage,
    worry: answers.worry,
    confidence: {
      for (final e in answers.confidence.entries) e.key.id: e.value,
      ...extra,
    },
    category: answers.category,
    week: weekSet ? StudentWeek(days: answers.days, window: answers.window, minutes: answers.minutes) : null,
  );
});
