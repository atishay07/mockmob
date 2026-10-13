/// The subjects the onboarding offers: the Commerce set, General Test, and Mathematics (asked
/// only because three of the six courses need it).
enum SheetSubject {
  english('english', 'English', 'Eng'),
  accountancy('accountancy', 'Accountancy', 'Acc'),
  businessStudies('business_studies', 'Business Studies', 'BSt'),
  economics('economics', 'Economics', 'Eco'),
  generalTest('general_test', 'General Test', 'GT'),
  mathematics('mathematics', 'Maths or Applied Maths', 'Maths');

  const SheetSubject(this.id, this.label, this.abbr);

  /// The public subject id (`/api/subjects`).
  final String id;
  final String label;

  /// For the one-line summary on the sheet.
  final String abbr;

  /// MockMob has a free starting-point check (the `baseline` allowance) for these four.
  bool get hasStartingPoint => const {english, accountancy, businessStudies, economics}.contains(this);

  /// Written to the profile on save. Maths is left out: the app cannot tell Mathematics from
  /// Applied Mathematics here, and neither has questions in MockMob yet.
  bool get syncs => this != mathematics;

  /// A language from DU's List A.
  bool get isLanguage => this == english;

  /// A domain subject from DU's List B.
  bool get isListB => const {accountancy, businessStudies, economics, mathematics}.contains(this);

  static SheetSubject? byId(String? id) {
    for (final s in values) {
      if (s.id == id) return s;
    }
    return null;
  }
}

/// How solid a subject feels, in the student's own estimate. Ordered weakest first.
enum Confidence {
  shaky('Shaky'),
  okay('Okay'),
  strong('Strong');

  const Confidence(this.label);

  final String label;

  static Confidence? byName(String? name) {
    for (final c in values) {
      if (c.name == name) return c;
    }
    return null;
  }
}

/// When a weakest-first tie needs breaking, this order decides (the numerical subjects first).
const List<SheetSubject> kTieOrder = [
  SheetSubject.accountancy,
  SheetSubject.economics,
  SheetSubject.businessStudies,
  SheetSubject.english,
  SheetSubject.generalTest,
  SheetSubject.mathematics,
];

/// The API's client-side cap on profile subjects.
const int kMaxSubjects = 5;

/// [subjects] ordered weakest first by [confidence] (unrated counts as Okay), ties by [kTieOrder].
List<SheetSubject> weakestFirst(Iterable<SheetSubject> subjects, Map<SheetSubject, Confidence> confidence) {
  final list = subjects.toList();
  int rank(SheetSubject s) => (confidence[s] ?? Confidence.okay).index;
  list.sort((a, b) {
    final r = rank(a).compareTo(rank(b));
    return r != 0 ? r : kTieOrder.indexOf(a).compareTo(kTieOrder.indexOf(b));
  });
  return list;
}
