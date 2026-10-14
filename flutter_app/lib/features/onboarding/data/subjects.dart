/// Where a subject sits in the picker. The order here is the order of the groups.
enum SubjectGroup {
  commerce('Commerce'),
  science('Science and Maths'),
  humanities('Humanities'),
  general('Language and General Test');

  const SubjectGroup(this.label);

  final String label;
}

/// The subjects MockMob has practice for: the 15 that `GET /api/subjects` marks `supported`
/// (APP-API-CONTRACT 2.5, `data/cuet_controls.js`). The picker also lists what the server says is
/// not offered yet, read live; those can't be chosen, because the plan needs practice behind it.
enum SheetSubject {
  english('english', 'English', 'Eng', SubjectGroup.general),
  accountancy('accountancy', 'Accountancy', 'Acc', SubjectGroup.commerce),
  businessStudies('business_studies', 'Business Studies', 'BSt', SubjectGroup.commerce),
  economics('economics', 'Economics', 'Eco', SubjectGroup.commerce),
  generalTest('general_test', 'General Test', 'GT', SubjectGroup.general),
  mathematics('mathematics', 'Maths or Applied Maths', 'Maths', SubjectGroup.science),
  physics('physics', 'Physics', 'Phy', SubjectGroup.science),
  chemistry('chemistry', 'Chemistry', 'Chem', SubjectGroup.science),
  biology('biology', 'Biology', 'Bio', SubjectGroup.science),
  computerScience('computer_science', 'Computer Science', 'CS', SubjectGroup.science),
  history('history', 'History', 'Hist', SubjectGroup.humanities),
  politicalScience('political_science', 'Political Science', 'Pol Sci', SubjectGroup.humanities),
  geography('geography', 'Geography', 'Geo', SubjectGroup.humanities),
  psychology('psychology', 'Psychology', 'Psy', SubjectGroup.humanities),
  sociology('sociology', 'Sociology', 'Soc', SubjectGroup.humanities);

  const SheetSubject(this.id, this.label, this.abbr, this.group);

  /// The public subject id (`/api/subjects`).
  final String id;
  final String label;

  /// For the one-line summary on the sheet.
  final String abbr;
  final SubjectGroup group;

  /// MockMob has a free starting-point check (the `baseline` allowance) for these four.
  bool get hasStartingPoint => const {english, accountancy, businessStudies, economics}.contains(this);

  /// Written to the profile on save. Every listed subject is a practice subject the profile takes.
  bool get syncs => true;

  /// A language from DU's List A.
  bool get isLanguage => this == english;

  /// A domain subject from DU's List B: everything but the language and the General Test.
  bool get isListB => this != english && this != generalTest;

  /// Search words beyond the label ("maths", "cs", "pol sci").
  String get searchText => '$label $abbr ${id.replaceAll('_', ' ')}'.toLowerCase();

  static SheetSubject? byId(String? id) {
    final key = id == 'gat' ? 'general_test' : (id == 'applied_mathematics' ? 'mathematics' : id);
    for (final s in values) {
      if (s.id == key) return s;
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
  SheetSubject.physics,
  SheetSubject.chemistry,
  SheetSubject.computerScience,
  SheetSubject.biology,
  SheetSubject.geography,
  SheetSubject.history,
  SheetSubject.politicalScience,
  SheetSubject.psychology,
  SheetSubject.sociology,
];

/// The API's cap on profile subjects.
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
