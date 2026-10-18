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
          // English is the one List A language MockMob has; a named language counts only itself.
          var spare = subjects.where((s) => s.isLanguage).length;
          for (final id in slot.specific) {
            final s = SheetSubject.byId(id);
            if (s != null && subjects.contains(s)) {
              spare--;
            } else {
              gaps.add(DuCatalog.languageName(id));
            }
          }
          if (spare < slot.count) {
            final short = slot.count - (spare < 0 ? 0 : spare);
            gaps.add(slot.specific.isNotEmpty
                ? (short == 1 ? 'one more language' : '$short more languages')
                : (short == 1 ? 'a language such as English' : '$short languages'));
          }
        case DuSlotKind.domain:
          final s = SheetSubject.byId(slot.subject);
          if (s == null || !subjects.contains(s)) {
            gaps.add(s?.label ?? DuCatalog.domainName(slot.subject!).split(' / ').first);
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

/// The subjects to pre-tick for [course]: only what every one of its Bulletin combinations names
/// (a List B subject, the General Test), so each is "Needed for" the course. Nothing without a
/// course: "Not sure yet" assumes no subjects (owner, 18 Oct, D42). Trimmed to the cap.
List<SheetSubject> neededSubjects(DuCourse? course) {
  if (course == null) return const [];
  final set = <SheetSubject>[
    for (final id in course.requiredDomains) ?SheetSubject.byId(id),
    if (course.requiresGeneralTest) SheetSubject.generalTest,
  ];
  return set.take(kMaxSubjects).toList();
}

/// True when [subject] is one every combination of [course] names.
bool neededFor(DuCourse? course, SheetSubject subject) => neededSubjects(course).contains(subject);
