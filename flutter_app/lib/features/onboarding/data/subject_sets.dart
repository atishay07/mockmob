import 'du_catalog.dart';
import 'eligibility.dart';
import 'subjects.dart';

/// A common set of CUET subjects the subjects step offers as one tap. Nothing is ticked until the
/// student taps one (owner, 18 Oct, D42).
class SubjectSet {
  const SubjectSet(this.title, this.subjects);

  final String title;
  final List<SheetSubject> subjects;

  /// True when [chosen] is exactly this set, in any order.
  bool matches(Iterable<SheetSubject> chosen) {
    final a = chosen.toSet();
    return a.length == subjects.length && a.containsAll(subjects);
  }
}

abstract final class SubjectSets {
  static const SubjectSet commerce = SubjectSet('Commerce', [
    SheetSubject.accountancy,
    SheetSubject.businessStudies,
    SheetSubject.economics,
    SheetSubject.english,
  ]);
  static const SubjectSet commerceMaths = SubjectSet('Commerce with Maths', [
    SheetSubject.accountancy,
    SheetSubject.businessStudies,
    SheetSubject.economics,
    SheetSubject.mathematics,
    SheetSubject.english,
  ]);
  static const SubjectSet commerceTest = SubjectSet('Commerce with General Test', [
    SheetSubject.accountancy,
    SheetSubject.businessStudies,
    SheetSubject.economics,
    SheetSubject.english,
    SheetSubject.generalTest,
  ]);
  static const SubjectSet mathsTest = SubjectSet('Maths and General Test', [
    SheetSubject.accountancy,
    SheetSubject.economics,
    SheetSubject.mathematics,
    SheetSubject.english,
    SheetSubject.generalTest,
  ]);

  static const List<SubjectSet> all = [commerce, commerceMaths, commerceTest, mathsTest];

  /// Up to three sets for [course]: without one, the first three; with one, only sets that keep
  /// it open (so BMS gets Maths and General Test, and a science course gets none).
  static List<SubjectSet> forCourse(DuCourse? course, {int max = 3}) {
    if (course == null) return all.take(max).toList();
    return [for (final s in all) if (EligibilityCheck.of(course, s.subjects.toSet()).eligible) s].take(max).toList();
  }
}
