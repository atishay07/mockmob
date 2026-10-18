import 'course_combos.dart';
import 'du_catalog.dart';
import 'subject_sets.dart';
import 'subjects.dart';

/// A course's CUET subject rule as one plain sentence, for the subjects step before any pick
/// (owner, 19 Oct, G9: "this shows after someone has selected"). Built only from the Bulletin's
/// combinations ([DuCourse.combos]); the examples come from the course's first common set and are
/// offered as examples ("such as"), never as a requirement.
///
/// "B.Com (Hons) needs a language, usually English, plus Maths or Accountancy and any two other
/// subjects, such as Business Studies and Economics."
abstract final class CourseRule {
  static String? sentence(DuCourse course) {
    final ways = CourseCombos.ways(course);
    if (ways.isEmpty) return null;
    final first = ways.first;
    final examples = _examples(course, first);
    final lead = _way(first, examples: examples, firstWay: true);
    if (ways.length == 1) return '${course.short} needs $lead.';
    // A second way that starts like the first drops the shared language: "either any three
    // subjects, ..., or one subject and the General Test".
    final second = ways[1];
    final shared = _sharedLanguage(first, second);
    final firstRest = shared ? _way(first.sublist(1), examples: examples, firstWay: true) : null;
    final secondText = _way(shared ? second.sublist(1) : second, examples: const [], firstWay: false);
    final more = ways.length - 2;
    final tail = more <= 0 ? '' : ', or one of ${_count(more)} other combinations';
    if (shared && firstRest != null) {
      return '${course.short} needs ${_language(first.first.single, firstWay: true)}, plus either $firstRest, or $secondText$tail.';
    }
    return '${course.short} needs either $lead, or $secondText$tail.';
  }

  static bool _sharedLanguage(List<List<DuSlot>> a, List<List<DuSlot>> b) =>
      a.length > 1 &&
      b.length > 1 &&
      a.first.length == 1 &&
      b.first.length == 1 &&
      a.first.single.kind == DuSlotKind.language &&
      b.first.single.kind == DuSlotKind.language &&
      a.first.single.count == b.first.single.count &&
      a.first.single.specific.join(',') == b.first.single.specific.join(',');

  /// One way in, as words: "a language, usually English, plus Maths or Accountancy and any two
  /// other subjects, such as Business Studies and Economics".
  static String _way(List<List<DuSlot>> places, {required List<SheetSubject> examples, required bool firstWay}) {
    final hasLanguage = places.isNotEmpty && places.first.length == 1 && places.first.single.kind == DuSlotKind.language;
    final named = places.any((p) => p.any((s) => s.kind == DuSlotKind.domain));
    final parts = <String>[];
    for (final p in hasLanguage ? places.skip(1) : places) {
      if (p.length > 1) {
        parts.add([for (final s in p) CourseCombos.subjectName(s.subject!)].join(' or '));
        continue;
      }
      final s = p.single;
      parts.add(switch (s.kind) {
        DuSlotKind.language => _language(s, firstWay: false),
        DuSlotKind.domain => CourseCombos.subjectName(s.subject!),
        DuSlotKind.generalTest => 'the General Test',
        DuSlotKind.free => _free(s.count, other: named, examples: examples),
      });
    }
    final rest = _join(parts);
    if (!hasLanguage) return rest;
    final language = _language(places.first.single, firstWay: firstWay);
    return rest.isEmpty ? language : '$language, plus $rest';
  }

  static String _free(int n, {required bool other, required List<SheetSubject> examples}) {
    final what = n == 1 ? 'one ${other ? 'other ' : ''}subject' : 'any ${_count(n)} ${other ? 'other ' : ''}subjects';
    if (examples.isEmpty) return what;
    final names = [for (final s in examples) s.label];
    final list = examples.length <= n ? _join(names) : _join(names, last: 'or');
    return '$what, such as $list';
  }

  static String _language(DuSlot s, {required bool firstWay}) {
    final named = [for (final id in s.specific) DuCatalog.languageName(id)];
    final any = s.count == 0 ? '' : (s.count == 1 ? 'a language' : '${_count(s.count)} languages');
    if (named.isEmpty) return firstWay && s.count == 1 ? 'a language, usually English' : any;
    return any.isEmpty ? _join(named) : '${_join(named)} and $any';
  }

  /// The subjects of the course's first common set that the rule leaves open (not the language,
  /// the General Test or a subject the rule names), as examples for its "any" subjects.
  static List<SheetSubject> _examples(DuCourse course, List<List<DuSlot>> way) {
    final sets = SubjectSets.forCourse(course);
    if (sets.isEmpty) return const [];
    final named = {for (final p in way) for (final s in p) if (s.kind == DuSlotKind.domain) s.subject};
    return [
      for (final s in sets.first.subjects)
        if (!s.isLanguage && s != SheetSubject.generalTest && !named.contains(s.id)) s,
    ];
  }

  static String _count(int n) => switch (n) { 1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five', _ => '$n' };

  static String _join(List<String> items, {String last = 'and'}) => switch (items.length) {
        0 => '',
        1 => items.single,
        2 => '${items.first} $last ${items.last}',
        _ => '${items.sublist(0, items.length - 1).join(', ')} $last ${items.last}',
      };
}
