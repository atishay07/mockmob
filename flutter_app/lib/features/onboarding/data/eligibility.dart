import 'du_catalog.dart';
import 'subjects.dart';

/// Whether a set of subjects meets a course's eligibility rule (DU Bulletin 2026-27), and if
/// not, what is missing from the closest combination. Only checks eligibility; it never says
/// anything about a chance of admission.
class EligibilityCheck {
  const EligibilityCheck({required this.course, required this.eligible, required this.missing});

  final DuCourse course;
  final bool eligible;

  /// What the closest combination still needs, in plain words ("Mathematics or Applied Maths").
  final List<String> missing;

  static EligibilityCheck of(DuCourse course, Set<SheetSubject> subjects) {
    List<String>? best;
    for (final combo in course.combos) {
      final gaps = _gaps(combo, subjects);
      if (gaps.isEmpty) return EligibilityCheck(course: course, eligible: true, missing: const []);
      if (best == null || gaps.length < best.length) best = gaps;
    }
    return EligibilityCheck(course: course, eligible: false, missing: best ?? const []);
  }

  static List<String> _gaps(DuCombo combo, Set<SheetSubject> subjects) {
    final gaps = <String>[];
    final used = <SheetSubject>{};
    for (final slot in combo.slots) {
      switch (slot.kind) {
        case DuSlotKind.language:
          final languages = subjects.where((s) => s.isLanguage).length;
          if (languages < slot.count) gaps.add('a language such as English');
        case DuSlotKind.domain:
          final s = SheetSubject.byId(slot.subject);
          if (s == null || !subjects.contains(s)) {
            gaps.add(s?.label ?? slot.subject!);
          } else {
            used.add(s);
          }
        case DuSlotKind.generalTest:
          if (!subjects.contains(SheetSubject.generalTest)) gaps.add('General Test');
        case DuSlotKind.free:
          break;
      }
    }
    // Free slots take any List B subjects the specific slots did not use.
    for (final slot in combo.slots.where((s) => s.kind == DuSlotKind.free)) {
      final spare = subjects.where((s) => s.isListB && !used.contains(s)).length;
      if (spare < slot.count) {
        final short = slot.count - spare;
        gaps.add(short == 1 ? 'one more List B subject' : '$short more List B subjects');
      }
    }
    return gaps;
  }
}

/// The subjects to pre-tick for [course]: the Commerce four, plus Maths and General Test where
/// every combination needs them, trimmed to the five-subject cap.
List<SheetSubject> suggestedSubjects(DuCourse? course) {
  final set = <SheetSubject>[
    SheetSubject.english,
    SheetSubject.accountancy,
    SheetSubject.businessStudies,
    SheetSubject.economics,
  ];
  if (course == null) return set;
  if (course.requires('mathematics')) set.add(SheetSubject.mathematics);
  if (course.requiresGeneralTest) set.add(SheetSubject.generalTest);
  for (final drop in const [SheetSubject.businessStudies, SheetSubject.accountancy]) {
    if (set.length <= kMaxSubjects) break;
    set.remove(drop);
  }
  return set;
}
