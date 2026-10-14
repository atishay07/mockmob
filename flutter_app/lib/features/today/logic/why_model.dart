// "Why this" (spec 5.3): the paper behind tonight's move, its real counts, the chapters where
// the marks went, and how much one paper can say. Pure, from the cached attempt.
import '../../../core/domain/chapter_breakdown.dart';
import '../../../core/models/attempt.dart';
import 'move_builder.dart';
import 'subjects.dart';

class WhyChapter {
  const WhyChapter({required this.chapter, required this.wrong, required this.blank, required this.questions});

  final String chapter;
  final int wrong;
  final int blank;
  final int questions;
}

class WhyModel {
  const WhyModel({
    required this.attemptId,
    required this.source,
    required this.subject,
    required this.date,
    required this.wrong,
    required this.correct,
    required this.blank,
    required this.chapters,
    required this.early,
    required this.isMock,
  });

  final String attemptId;
  final String source;
  final String subject;
  final DateTime date;
  final int wrong;
  final int correct;
  final int blank;

  /// Chapters that lost marks, most first, at most four.
  final List<WhyChapter> chapters;

  /// Only one paper in this subject so far.
  final bool early;
  final bool isMock;
}

/// Null when the attempt is not in the record (the suggestion changed).
WhyModel? buildWhy(List<Attempt> attempts, String attemptId, {required DateTime Function(DateTime) toDate}) {
  Attempt? a;
  for (final x in attempts) {
    if (x.id == attemptId) a = x;
  }
  if (a == null) return null;
  final breakdown = observedChapterBreakdown(a);
  final papers = attempts.where((x) => x.subject == a!.subject && (x.isMock || x.total >= minQuestionsForBasis)).length;
  return WhyModel(
    attemptId: a.id,
    source: paperLabel(attempts, a),
    subject: subjectName(a.subject),
    date: toDate(a.completedAt),
    wrong: a.wrong,
    correct: a.correct,
    blank: a.unattempted,
    chapters: [
      for (final s in breakdown.lossChapters.take(4))
        if (s.chapter.trim().isNotEmpty) WhyChapter(chapter: s.chapter, wrong: s.wrong, blank: s.unattempted, questions: s.questions),
    ],
    early: papers <= 1,
    isMock: a.isMock,
  );
}
