/// The CUET subjects whose paper has a choice a student makes once (owner, 5 Nov, LK94): Mathematics and Computer Science
/// (Section B1 or B2) and Accountancy (Part B, one of two). ONE Dart source of these for the onboarding, You > Subjects and
/// Learn. The ids, labels, the `label` word and the default are the website's `data/cuet_syllabus.js` SUBJECT_OPTIONS
/// exactly (test/unit/learn2/data/subject_options_parity_test.dart holds them to `tool/learn2_parity/subject_options.mjs`'s
/// output); the question and the one-line notes are the app's own words, written from the same syllabus's chapters.
///
/// The server keeps a student's choice (`PUT /api/me/subject-options { subject, option }`, any id below); Learn then shows only
/// that option's chapters.
library;

/// One of a subject's options: its id (what the server stores), its name, and one line on what it covers.
class SubjectOptionChoice {
  const SubjectOptionChoice(this.id, this.label, this.note);

  final String id;

  /// "B1 Mathematics", "Analysis of Financial Statements" (the website's own label).
  final String label;

  /// One line on what it covers, from the syllabus's chapters ("Calculus, vectors and 3D geometry, probability.").
  final String note;
}

/// A subject's options: the word its paper uses ("Section" or "Part"), the question the app asks, the choices and the default.
class SubjectOptionSet {
  const SubjectOptionSet({required this.subject, required this.label, required this.question, required this.choices, required this.defaultId});

  /// The public subject id ("accountancy").
  final String subject;

  /// "Section" (Mathematics, Computer Science) or "Part" (Accountancy), as the website's data names it.
  final String label;

  /// "Which Part B does your school teach?"
  final String question;
  final List<SubjectOptionChoice> choices;

  /// The choice drawn ticked before the student picks: B1, B1, AFS.
  final String defaultId;

  SubjectOptionChoice? choice(String? id) {
    final want = normalizeSubjectOption(subject, id);
    for (final c in choices) {
      if (c.id == want) return c;
    }
    return null;
  }
}

/// Every subject with an option, keyed by public id.
const Map<String, SubjectOptionSet> kSubjectOptions = {
  'mathematics': SubjectOptionSet(
    subject: 'mathematics',
    label: 'Section',
    question: 'Which Maths does your school teach?',
    choices: [
      SubjectOptionChoice('B1', 'B1 Mathematics', 'Calculus, vectors and 3D geometry, probability.'),
      SubjectOptionChoice('B2', 'B2 Applied Mathematics', 'Numbers, statistics and financial maths.'),
    ],
    defaultId: 'B1',
  ),
  'computer_science': SubjectOptionSet(
    subject: 'computer_science',
    label: 'Section',
    question: 'Which course does your school teach?',
    choices: [
      SubjectOptionChoice('B1', 'B1 Computer Science', 'Python files, stacks, queues, searching and sorting.'),
      SubjectOptionChoice('B2', 'B2 Informatics Practices', 'Pandas, plotting with Matplotlib, SQL queries.'),
    ],
    defaultId: 'B1',
  ),
  'accountancy': SubjectOptionSet(
    subject: 'accountancy',
    label: 'Part',
    question: 'Which Part B does your school teach?',
    choices: [
      SubjectOptionChoice('AFS', 'Analysis of Financial Statements', 'Company statements, ratios and cash flow.'),
      SubjectOptionChoice('CAS', 'Computerised Accounting', 'Accounting software, spreadsheets and databases.'),
    ],
    defaultId: 'AFS',
  ),
};

/// The line under every option question: the choice is never final.
const String kSubjectOptionLater = 'You can change this later in Learn.';

/// The subject's public id as the options are keyed: trimmed, as the website's `subjectId` reads it.
String subjectOptionKey(String subject) => subject.trim();

/// The options of [subject], or null when its paper has none.
SubjectOptionSet? subjectOptionsFor(String? subject) => subject == null ? null : kSubjectOptions[subjectOptionKey(subject)];

/// A saved option checked against the subject's choices (trimmed, upper-cased); anything else is null. The website's
/// `normalizeOption`.
String? normalizeSubjectOption(String? subject, String? option) {
  final set = subjectOptionsFor(subject);
  if (set == null || option == null) return null;
  final value = option.trim().toUpperCase();
  for (final c in set.choices) {
    if (c.id == value) return value;
  }
  return null;
}

/// The option drawn ticked before the student picks (null for a subject without options). The website's `defaultOption`.
String? defaultSubjectOption(String? subject) => subjectOptionsFor(subject)?.defaultId;
