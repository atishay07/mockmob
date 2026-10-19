import '../../../core/models/attempt.dart';
import 'chapter_ties.dart';
import 'insights_models.dart';
import 'subject_names.dart';

/// The scored sessions behind each claim on the record page (brief 12.1, evidence first). The
/// server's record reads the 60 most recent sessions, so evidence is drawn from the same 60
/// on the phone. A claim with no session behind it here is not shown.
class RecordEvidence {
  RecordEvidence(List<Attempt> attempts, {required this.now})
      : recent = ([
          for (final a in attempts)
            if (a.total > 0) a,
        ]..sort((x, y) => y.completedAt.compareTo(x.completedAt)))
            .take(window)
            .toList();

  /// Sessions the server's record covers.
  static const int window = 60;

  /// Newest first.
  final List<Attempt> recent;
  final DateTime now;

  static String _norm(String? s) => (s ?? '').trim().toLowerCase();

  /// Every session in the record: the ledger and the share answered right rest on all of them.
  List<Attempt> get ledger => recent;

  /// Sessions with a right answer, a wrong one, or a blank, for the three legend entries.
  List<Attempt> get withRight => [for (final a in recent) if (a.correct > 0) a];
  List<Attempt> get withWrong => [for (final a in recent) if (a.wrong > 0) a];
  List<Attempt> get withBlank => [for (final a in recent) if (a.unattempted > 0) a];

  /// Sessions where an answer was changed (device events).
  List<Attempt> get changes => [
        for (final a in recent)
          if ((a.selectionMeta.recovery?.answerChangeQids ?? const []).isNotEmpty) a,
      ];

  /// Sessions with timed answers (device events).
  List<Attempt> get pace => [
        for (final a in recent)
          if (a.details.any((d) => d.timeMs != null)) a,
      ];

  /// Sessions finished in the last 14 days: this week and last week.
  List<Attempt> get lastTwoWeeks {
    final from = now.subtract(const Duration(days: 14));
    return [for (final a in recent) if (!a.completedAt.isBefore(from)) a];
  }

  /// Sessions with a question from [chapter] of [subject].
  List<Attempt> chapter(String subject, String chapter) {
    final s = canonicalSubjectId(subject);
    final c = _norm(chapter);
    return [
      for (final a in recent)
        if (a.questions.any((q) =>
            _norm(q.chapter) == c &&
            (canonicalSubjectId(a.subject) == s || canonicalSubjectId(q.internalSubject ?? q.subject ?? '') == s)))
          a,
    ];
  }

  /// Sessions with an easy question answered wrong.
  List<Attempt> get easyMisses => [
        for (final a in recent)
          if (() {
            final easy = {for (final q in a.questions) if (_norm(q.difficulty) == 'easy') q.id};
            return a.details.any((d) => d.isWrong && easy.contains(d.qid));
          }())
            a,
      ];

  /// The sessions behind one finding of the server's readout, or empty when the phone cannot
  /// show them (the finding is then hidden).
  List<Attempt> forFinding(Finding f, PrepInsights v) => switch (f.id) {
        'chapter' => v.ranked.isEmpty ? const [] : chapter(costliestChapters(v.ranked).first.subject, costliestChapters(v.ranked).first.chapter),
        'thin' => v.thin.isEmpty ? const [] : chapter(v.thin.first.subject, v.thin.first.chapter),
        'changes' => changes,
        'pace' => pace,
        'skips' => withBlank,
        'easy' => easyMisses,
        _ => const [],
      };
}
