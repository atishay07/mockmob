import 'subjects.dart';

/// MockMob's chapter order per subject: `data/cuet_chapter_priorities.json` (the order the
/// question planner works in) where it has the subject, otherwise the syllabus order of
/// `data/subjects.js`. It carries no frequency data, so copy may name the first chapter but
/// never claim how often it appears in the paper.
const Map<SheetSubject, List<String>> kChapterOrder = {
  SheetSubject.english: ['Reading Comprehension', 'Vocabulary', 'Para Jumbles', 'Grammar', 'Error Detection'],
  SheetSubject.generalTest: ['Current Affairs', 'General Knowledge', 'Quantitative Aptitude', 'Logical Reasoning', 'Data Interpretation'],
  SheetSubject.accountancy: ['Partnership', 'Company Accounts', 'Financial Statements', 'Dissolution'],
  SheetSubject.businessStudies: ['Principles of Management', 'Marketing', 'Financial Management', 'Consumer Protection'],
  SheetSubject.economics: ['Money and Banking', 'National Income', 'Government Budget', 'Balance of Payments', 'Demand/Supply'],
  SheetSubject.mathematics: ['Matrices', 'Determinants', 'Integrals', 'Differential Equations', 'Probability'],
  SheetSubject.physics: ['Electromagnetic Induction', 'Moving Charges and Magnetism', 'Wave Optics', 'Nuclei', 'Ray Optics and Optical Instruments'],
  SheetSubject.chemistry: ['Solutions', 'Electrochemistry', 'Chemical Kinetics', 'Coordination Compounds', 'Aldehydes Ketones and Carboxylic Acids'],
  SheetSubject.biology: ['Biotechnology and its Applications', 'Human Health and Disease', 'Molecular Basis of Inheritance', 'Evolution', 'Ecosystem'],
  SheetSubject.computerScience: ['Database Concepts', 'MySQL', 'Structured Query Language'],
  SheetSubject.history: ['Bricks, Beads & Bones', 'Kings, Farmers & Towns', 'Kinship, Caste & Class'],
  SheetSubject.politicalScience: ['Challenges of Nation Building', 'Era of One-Party Dominance', 'Politics of Planned Development'],
  SheetSubject.geography: ['Human Geography: Nature and Scope', 'Population', 'Migration'],
  SheetSubject.psychology: ['Variations in Psychological Attributes', 'Self & Personality', 'Meeting Life Challenges'],
  SheetSubject.sociology: ['Introducing Indian Society', 'Demographic Structure', 'Social Institutions'],
};

/// The first chapter in MockMob's order for [subject].
String firstChapter(SheetSubject subject) => kChapterOrder[subject]?.first ?? subject.label;

/// The subjects whose chapters above come from the planner file's ranking (`cuet_chapter_priorities.json`).
/// The other subjects hold syllabus order only, so nothing may be said of them as "first".
const Set<SheetSubject> kRankedSubjects = {
  SheetSubject.english,
  SheetSubject.generalTest,
  SheetSubject.accountancy,
  SheetSubject.businessStudies,
  SheetSubject.economics,
  SheetSubject.mathematics,
  SheetSubject.physics,
  SheetSubject.chemistry,
  SheetSubject.biology,
};

/// The first [take] chapters of the planner's ranking for the public subject [subjectId], or null
/// when MockMob has no ranking for it. The file carries no frequency or marks, so a caller may
/// name these chapters, never say how many marks they hold.
List<String>? rankedChapters(String? subjectId, {int take = 2}) {
  final subject = SheetSubject.byId(subjectId);
  if (subject == null || !kRankedSubjects.contains(subject)) return null;
  final order = kChapterOrder[subject];
  if (order == null || order.isEmpty) return null;
  return order.take(take).toList(growable: false);
}
