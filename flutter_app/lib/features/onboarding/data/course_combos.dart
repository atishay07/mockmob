import 'du_catalog.dart';

/// A course's CUET subject combinations in one short line, built only from its Bulletin
/// combinations ([DuCourse.combos]): "A language + Maths or Accountancy + any 2 subjects".
///
/// Two combinations that differ in one named subject read as one ("Maths or Accountancy"), which
/// says exactly what the Bulletin says. Nothing is narrowed: "any 2 subjects" stays any two from
/// List B, and a language slot stays any language unless the Bulletin names one.
abstract final class CourseCombos {
  /// The line for [course], at most [max] alternatives; more are counted ("or 2 other ways").
  static String line(DuCourse course, {int max = 2}) {
    final groups = _merge(course.combos);
    if (groups.isEmpty) return '';
    // A later way that starts like the first drops the shared start: "A language + any 3
    // subjects, or any 1 subject + General Test" (the language still holds for both).
    final first = groups.first;
    final shown = <String>[
      for (final g in groups.take(max))
        identical(g, first) ? _sentence(g) : _sentence(g.sublist(_shared(first, g))),
    ];
    final rest = groups.length - shown.length;
    final text = shown.join(', or ');
    final tail = rest <= 0 ? '' : ', or ${rest == 1 ? 'one other way' : '$rest other ways'}';
    return _capitalise('$text$tail');
  }

  /// The plain name of a List B subject, as students say it.
  static String subjectName(String id) => switch (id) {
        'mathematics' => 'Maths',
        'accountancy' => 'Accountancy',
        'computer_science' => 'Computer Science',
        'biology' => 'Biology',
        _ => DuCatalog.domainName(id).split(' / ').first.trim(),
      };

  /// Each merged combination: per slot, the alternatives at that place.
  static List<List<List<DuSlot>>> _merge(List<DuCombo> combos) {
    final groups = <List<List<DuSlot>>>[];
    for (final combo in combos) {
      var merged = false;
      for (final g in groups) {
        if (g.length != combo.slots.length) continue;
        var differ = -1;
        var ok = true;
        for (var i = 0; i < combo.slots.length; i++) {
          final s = combo.slots[i];
          if (g[i].any((x) => _same(x, s))) continue;
          // Only one place may differ, and only between named List B subjects.
          if (differ >= 0 || s.kind != DuSlotKind.domain || g[i].any((x) => x.kind != DuSlotKind.domain)) {
            ok = false;
            break;
          }
          differ = i;
        }
        if (!ok) continue;
        // A merged place stays merged only when every other place is single and equal.
        if (differ >= 0 && List.generate(g.length, (i) => i).any((i) => i != differ && g[i].length > 1)) continue;
        if (differ >= 0) g[differ].add(combo.slots[differ]);
        merged = true;
        break;
      }
      if (!merged) groups.add([for (final s in combo.slots) [s]]);
    }
    return groups;
  }

  /// How many leading places [b] shares with [a], leaving at least one of [b]'s own.
  static int _shared(List<List<DuSlot>> a, List<List<DuSlot>> b) {
    var n = 0;
    while (n < a.length && n < b.length - 1 && a[n].length == 1 && b[n].length == 1 && _same(a[n].single, b[n].single)) {
      n++;
    }
    return n;
  }

  static bool _same(DuSlot a, DuSlot b) =>
      a.kind == b.kind && a.count == b.count && a.subject == b.subject && a.specific.join(',') == b.specific.join(',');

  static String _sentence(List<List<DuSlot>> places) => [for (final p in places) _place(p)].join(' + ');

  static String _place(List<DuSlot> alternatives) {
    if (alternatives.length > 1) return [for (final s in alternatives) subjectName(s.subject!)].join(' or ');
    final s = alternatives.single;
    return switch (s.kind) {
      DuSlotKind.language => _language(s),
      DuSlotKind.domain => subjectName(s.subject!),
      DuSlotKind.free => s.count == 1 ? 'any 1 subject' : 'any ${s.count} subjects',
      DuSlotKind.generalTest => 'General Test',
    };
  }

  static String _language(DuSlot s) {
    final named = [for (final id in s.specific) DuCatalog.languageName(id)];
    if (named.isEmpty) return s.count == 1 ? 'a language' : '${s.count} languages';
    if (s.count == 0) return named.join(' + ');
    return '${named.join(' + ')} + ${s.count == 1 ? 'a language' : '${s.count} languages'}';
  }

  static String _capitalise(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
