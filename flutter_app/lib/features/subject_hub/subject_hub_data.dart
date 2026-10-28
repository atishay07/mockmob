import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/models.dart';
import '../../core/repositories/attempts_repository.dart';
import '../practice/data/practice_catalog.dart';
import 'subject_hub_content.dart';

/// The fewest answers in a chapter before a percentage is printed for it. Under this the row says
/// the count and nothing sharper: "1 of 1" is not 100 percent.
const int minAnswersForPercent = 5;

/// The public subject id for whatever the route carries: a public id (`business_studies`), the
/// website's slug (`business-studies`) or an attempt-side id (`gat`, `business`).
String hubSubjectId(String raw) {
  final id = raw.trim().toLowerCase().replaceAll('-', '_');
  return switch (id) {
    'business' || 'bst' => 'business_studies',
    'gat' => 'general_test',
    _ => id,
  };
}

/// The website's hub for [subjectId], or null for a subject the website has no hub for.
SubjectHubContent? hubContentFor(String subjectId) {
  final id = hubSubjectId(subjectId);
  for (final hub in subjectHubs) {
    if (hub.subjectId == id) return hub;
  }
  return null;
}

/// One chapter's answers across the student's attempts in the subject.
class ChapterRecord {
  const ChapterRecord({required this.name, this.correct = 0, this.wrong = 0, this.blank = 0});

  final String name;
  final int correct;
  final int wrong;

  /// Questions of this chapter that were shown and left unanswered.
  final int blank;

  int get answered => correct + wrong;

  /// True when at least one question of the chapter has been seen.
  bool get seen => answered + blank > 0;

  /// The share right, only once there are enough answers to say it; null before that.
  int? get percent => answered >= minAnswersForPercent ? (correct * 100 / answered).round() : null;

  /// 0 to 1 for the bar, or null when there is nothing to draw.
  double? get fraction => answered == 0 ? null : correct / answered;
}

/// What the student's own attempts say about one subject.
class SubjectRecord {
  const SubjectRecord({
    required this.attempts,
    required this.correct,
    required this.wrong,
    required this.lastAt,
    required this.chapters,
    required this.hasChapterDetail,
  });

  static const SubjectRecord none = SubjectRecord(attempts: 0, correct: 0, wrong: 0, lastAt: null, chapters: {}, hasChapterDetail: false);

  /// How many attempts in this subject the account holds.
  final int attempts;
  final int correct;
  final int wrong;
  final DateTime? lastAt;

  /// Per chapter, keyed by the chapter's name as the list names it.
  final Map<String, ChapterRecord> chapters;

  /// False when the attempts came without their questions, so a chapter with no answers may only
  /// mean "not broken down" and must not be called unpractised.
  final bool hasChapterDetail;

  int get answered => correct + wrong;
}

String _norm(String s) => s.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();

/// The record of [chapters] in the attempts whose subject is one of [subjectIds] (the public id
/// and the attempt-side id). A question counts under the chapter whose name it carries (case and
/// spacing aside); a question of a chapter the list does not name is left out of the rows.
SubjectRecord buildSubjectRecord({
  required Iterable<Attempt> attempts,
  required Set<String> subjectIds,
  required List<String> chapters,
}) {
  final byName = {for (final c in chapters) _norm(c): c};
  final correct = <String, int>{};
  final wrong = <String, int>{};
  final blank = <String, int>{};
  var count = 0;
  var right = 0;
  var wrongAll = 0;
  DateTime? last;
  var detail = false;
  for (final a in attempts) {
    if (!subjectIds.contains(a.subject)) continue;
    count++;
    right += a.correct;
    wrongAll += a.wrong;
    if (last == null || a.completedAt.isAfter(last)) last = a.completedAt;
    if (a.questions.isNotEmpty) detail = true;
    for (final q in a.questions) {
      final name = byName[_norm(q.chapter ?? '')];
      if (name == null) continue;
      final d = a.detailFor(q.id);
      if (d?.isCorrect == true) {
        correct[name] = (correct[name] ?? 0) + 1;
      } else if (d?.isCorrect == false) {
        wrong[name] = (wrong[name] ?? 0) + 1;
      } else {
        blank[name] = (blank[name] ?? 0) + 1;
      }
    }
  }
  if (count == 0) return SubjectRecord.none;
  return SubjectRecord(
    attempts: count,
    correct: right,
    wrong: wrongAll,
    lastAt: last,
    hasChapterDetail: detail,
    chapters: {
      for (final c in chapters) c: ChapterRecord(name: c, correct: correct[c] ?? 0, wrong: wrong[c] ?? 0, blank: blank[c] ?? 0),
    },
  );
}

/// The chapters to list for [subjectId]: the live subject list when it has them (practice takes
/// chapter names from there), otherwise the website's own list bundled with the app.
final subjectHubChaptersProvider = Provider.autoDispose.family<List<String>, String>((ref, subjectId) {
  final id = hubSubjectId(subjectId);
  final live = ref.watch(practiceSubjectsProvider).value;
  for (final s in live ?? const <Subject>[]) {
    if (s.id == id && s.chapters.isNotEmpty) return s.chapters;
  }
  return hubContentFor(id)?.chapters ?? const [];
});

/// The attempt-side ids of [subjectId]: the public id and the internal one the catalogue names.
final subjectHubIdsProvider = Provider.autoDispose.family<Set<String>, String>((ref, subjectId) {
  final id = hubSubjectId(subjectId);
  final live = ref.watch(practiceSubjectsProvider).value;
  return {id, internalSubjectFor(id, live)};
});

/// The student's record in [subjectId], from the attempts the app already holds.
final subjectHubRecordProvider = Provider.autoDispose.family<SubjectRecord, String>((ref, subjectId) {
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  if (attempts == null) return SubjectRecord.none;
  return buildSubjectRecord(
    attempts: attempts,
    subjectIds: ref.watch(subjectHubIdsProvider(subjectId)),
    chapters: ref.watch(subjectHubChaptersProvider(subjectId)),
  );
});
