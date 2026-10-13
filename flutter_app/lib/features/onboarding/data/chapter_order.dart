import 'subjects.dart';

/// MockMob's chapter order per subject, copied from `data/cuet_chapter_priorities.json` (the
/// order the question planner works in). It carries no frequency data, so copy may name the
/// first chapter but never claim how often it appears in the paper.
const Map<SheetSubject, List<String>> kChapterOrder = {
  SheetSubject.english: ['Reading Comprehension', 'Vocabulary', 'Para Jumbles', 'Grammar', 'Error Detection'],
  SheetSubject.generalTest: ['Current Affairs', 'General Knowledge', 'Quantitative Aptitude', 'Logical Reasoning', 'Data Interpretation'],
  SheetSubject.accountancy: ['Partnership', 'Company Accounts', 'Financial Statements', 'Dissolution'],
  SheetSubject.businessStudies: ['Principles of Management', 'Marketing', 'Financial Management', 'Consumer Protection'],
  SheetSubject.economics: ['Money and Banking', 'National Income', 'Government Budget', 'Balance of Payments', 'Demand/Supply'],
  SheetSubject.mathematics: ['Matrices', 'Determinants', 'Integrals', 'Differential Equations', 'Probability'],
};

/// The first chapter in MockMob's order for [subject].
String firstChapter(SheetSubject subject) => kChapterOrder[subject]!.first;
