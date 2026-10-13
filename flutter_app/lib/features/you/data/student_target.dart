// What the student put on their sheet in setup that the server does not hold yet: the course and
// up to three colleges (API contract 2.1 has no field for them). Read from the onboarding's sealed
// sheet, which lives on the phone; this is the one seam You uses, so tests and other hosts can
// override [studentTargetProvider] with a value.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../onboarding/onboarding.dart' show studentSheetProvider;

class StudentTarget {
  const StudentTarget({this.course, this.colleges = const [], this.subjects = const []});

  /// The programme as students say it, "B.Com (Hons)".
  final String? course;

  /// College names in order of preference, at most three.
  final List<String> colleges;

  /// Public subject ids from setup, weakest first. You prefers the profile's subjects and falls
  /// back to these before the account has them.
  final List<String> subjects;

  bool get isEmpty => course == null && colleges.isEmpty && subjects.isEmpty;

  static const none = StudentTarget();
}

/// The sealed sheet's course, colleges and subjects, or [StudentTarget.none] before a sheet is
/// sealed on this phone.
final studentTargetProvider = Provider<StudentTarget>((ref) {
  final sheet = ref.watch(studentSheetProvider);
  if (sheet == null) return StudentTarget.none;
  return StudentTarget(
    course: sheet.course?.short,
    colleges: [for (final c in sheet.colleges) c.name].take(3).toList(),
    subjects: [for (final (s, _) in sheet.subjects) s.id],
  );
});
