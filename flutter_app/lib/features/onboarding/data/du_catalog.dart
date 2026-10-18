/// DU CSAS 2026 data for the onboarding's course and college steps: the six Commerce and
/// Economics programmes shown as tiles ([DuCatalog.courses], most chosen first), every other course
/// with Round 1 seats for "More courses" ([DuCatalog.more]), their eligibility combinations from
/// the Bulletin, and the Round 1 minimum allocation score of every college for every category,
/// out of 1000.
///
/// The figures are real Round 1 minimums from 2026: always shown with that label and the scale.
/// They say nothing about 2027 and never stand for a chance of admission.
library;

part 'du_2026_data.dart';

/// One slot of an eligibility combination ("Any one Language from List A").
class DuSlot {
  const DuSlot.language(this.count)
      : kind = DuSlotKind.language,
        subject = null,
        specific = const [];

  /// Named languages ("Bengali from List A"), plus [count] more of any language.
  const DuSlot.languages(this.specific, {this.count = 0})
      : kind = DuSlotKind.language,
        subject = null;
  const DuSlot.domain(String this.subject)
      : kind = DuSlotKind.domain,
        count = 1,
        specific = const [];
  const DuSlot.free(this.count)
      : kind = DuSlotKind.free,
        subject = null,
        specific = const [];
  const DuSlot.generalTest()
      : kind = DuSlotKind.generalTest,
        count = 1,
        subject = null,
        specific = const [];

  final DuSlotKind kind;

  /// For a language slot, how many languages of the student's choice beyond [specific].
  final int count;

  /// The required domain subject (`mathematics`, `accountancy`), for [DuSlotKind.domain].
  final String? subject;

  /// The languages a language slot names (`bengali`); empty when any language will do.
  final List<String> specific;

  /// Every language this slot takes.
  int get languages => specific.length + count;
}

enum DuSlotKind { language, domain, free, generalTest }

/// One combination of CUET subjects that makes a student eligible.
class DuCombo {
  const DuCombo(this.text, this.slots);

  /// The Bulletin's own wording.
  final String text;
  final List<DuSlot> slots;
}

/// One college's offering of a course: its full name, the short name students use, and the
/// Round 1 minimum allocation score per category (null where nobody was allocated).
class DuOffering {
  const DuOffering(this.college, this.short, this.round1);

  final String college;
  final String short;
  final List<double?> round1;

  /// The Round 1 minimum for [category], or null.
  double? scoreFor(String category) {
    final i = DuCatalog.categories.indexOf(category);
    return i < 0 ? null : round1[i];
  }
}

class DuCourse {
  const DuCourse({
    required this.id,
    required this.name,
    required this.short,
    required this.combos,
    required this.offerings,
    this.stream = 'Commerce & Economics',
  });

  final String id;

  /// The Bulletin's name ("B.Com. (Hons.)").
  final String name;

  /// The name students use ("B.Com (Hons)").
  final String short;

  /// The Bulletin's stream ("Commerce & Economics", "Science").
  final String stream;
  final List<DuCombo> combos;
  final List<DuOffering> offerings;

  int get collegeCount => offerings.length;

  /// Colleges that allocated seats to [category] in Round 1, highest minimum first.
  List<DuOffering> ladder(String category) {
    final rows = [
      for (final o in offerings)
        if (o.scoreFor(category) != null) o,
    ]..sort((a, b) => b.scoreFor(category)!.compareTo(a.scoreFor(category)!));
    return rows;
  }

  DuOffering? offeringAt(String college) {
    for (final o in offerings) {
      if (o.college == college) return o;
    }
    return null;
  }

  /// True when every combination needs [subject] (so it is pre-ticked on the subjects step).
  bool requires(String subject) => combos.every((c) => c.slots.any((s) => s.kind == DuSlotKind.domain && s.subject == subject));

  /// The List B subjects every combination names, in the order the first one lists them.
  List<String> get requiredDomains => [
        if (combos.isNotEmpty)
          for (final s in combos.first.slots)
            if (s.kind == DuSlotKind.domain && requires(s.subject!)) s.subject!,
      ];

  /// True when every combination needs the General Aptitude Test.
  bool get requiresGeneralTest => combos.every((c) => c.slots.any((s) => s.kind == DuSlotKind.generalTest));
}

abstract final class DuCatalog {
  /// The label every figure carries.
  static const String source = 'Round 1 minimum, 2026';

  /// The scale of a CSAS score.
  static const int scale = 1000;

  /// Default category until the student picks one. The choice stays on the phone.
  static const String defaultCategory = 'UR';

  static const List<String> categories = _categories;

  /// The six Commerce and Economics programmes, most chosen first: the course step's tiles.
  static const List<DuCourse> courses = _courses;

  /// Every other course with Round 1 seats in 2026, A to Z ("More courses"). B.A. (Programme)
  /// is not here: its rows are per pair of disciplines, so it has no one college ladder.
  static const List<DuCourse> more = _moreCourses;

  /// [courses] then [more].
  static const List<DuCourse> all = [..._courses, ..._moreCourses];

  static DuCourse? course(String? id) {
    if (id == null) return null;
    for (final c in all) {
      if (c.id == id) return c;
    }
    return null;
  }

  /// The Bulletin's name for a List B subject id ("Biology / Biological Studies / ..."), or the id.
  static String domainName(String id) => _domainNames[id] ?? id;

  /// The Bulletin's name for a List A language id ("Bengali"), or the id.
  static String languageName(String id) => _languageNames[id] ?? id;

  /// A score as DU prints it, to one decimal ("924.3").
  static String format(double score) => score.toStringAsFixed(1);
}
