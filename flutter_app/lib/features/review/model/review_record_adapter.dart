// The record the weak-chapter port runs on, built from what the app already holds: the attempts list, the phone's repair records
// and the account's saved repairs, all through Review's own index. The website builds the same record on its server
// (`src/lib/server/review.js` `buildReviewRecord`); this is its twin, so Review prints the same numbers on both platforms for
// one student, and every count agrees with Today and the result because it comes from the same `ReviewIndex`.
//
// What it follows from the website's record, on purpose:
//  * a chapter's id is its subject and its name; every question of a paper counts toward "questions asked", right answers too;
//  * only a paper with at least one wrong or skipped question is read in full, so only such a paper puts questions on offer;
//  * a wrong answer whose key is set aside (or that the server called not a mistake) is kept as an item with a `keyState`, so
//    the chapter leaves it out of the marks lost and the marks on offer alike.
//
// What the app adds: a paper whose result has not been opened is left out whole. Its marks are the result's own reveal, and its
// mistakes cannot be repaired until the result is open (Review says so), so Review never prices a chapter from a sealed paper.
import '../../../core/models/question.dart' show SnapshotQuestion;
import '../data/mistake_index.dart';
import '../data/review_providers.dart' show subjectName;
import 'review_chapters.dart';

/// What one Check it held came back as, when this phone has it: right (it held) or wrong (it slipped), and when it was answered.
class CheckOutcome {
  const CheckOutcome({required this.right, this.at});

  final bool right;
  final DateTime? at;
}

const _letters = 'ABCDEFGH';

/// The key the index and the check outcomes hold a mistake under: its paper and its question.
String mistakeKeyOf(String attemptId, String questionId) => '$attemptId/$questionId';

/// The record of [index]: every paper that is open, the chapters they asked, and one item per wrong or skipped question.
///
/// [checks] are the Check it held outcomes the phone holds, by [mistakeKeyOf]: a saved repair with one reads as held (right)
/// or slipped (wrong); without one it is waiting for Check it held. [unopened] are the papers whose result is still sealed.
ReviewRecord reviewRecordOf(
  ReviewIndex index, {
  required DateTime now,
  Set<String> unopened = const {},
  Map<String, CheckOutcome> checks = const {},
}) {
  final byKey = <String, MistakeItem>{
    for (final g in index.groups)
      for (final i in g.items) i.key: i,
  };
  final papers = <RecordPaper>[];
  final chapters = <String, RecordChapter>{};
  final asked = <String, Map<String, int>>{};
  final items = <RecordItem>[];

  for (final a in index.attempts) {
    if (unopened.contains(a.id)) continue;
    papers.add(
      RecordPaper(id: a.id, name: sourceLabel(index.attempts, a), at: a.completedAt, subject: a.subject, subjectName: subjectName(a.subject)),
    );
    final perChapter = <String, int>{};
    final mine = <RecordItem>[];
    for (var n = 0; n < a.questions.length; n++) {
      final q = a.questions[n];
      final name = chapterOf(q.chapter);
      final chapterId = '${a.subject}|$name';
      perChapter[chapterId] = (perChapter[chapterId] ?? 0) + 1;
      final detail = a.detailFor(q.id);
      if (detail == null || !(detail.isBlank || detail.isWrong)) continue;
      chapters.putIfAbsent(chapterId, () => RecordChapter(id: chapterId, name: name, subject: a.subject, subjectName: subjectName(a.subject)));
      final stem = stemLine(q.question.trim().isNotEmpty ? q.question : (q.body ?? ''));
      if (detail.isBlank) {
        mine.add(RecordItem(paper: a.id, q: n + 1, qid: q.id, ch: chapterId, state: RecordState.blank, stem: stem));
        continue;
      }
      final pick = _pick(q, detail.givenIndex);
      final m = byKey[mistakeKeyOf(a.id, q.id)];
      if (m == null) {
        // The server called it not a mistake: the question is out of every figure, like a key under re-check.
        mine.add(RecordItem(paper: a.id, q: n + 1, qid: q.id, ch: chapterId, state: RecordState.open, keyState: 'corrected', stem: stem, pick: pick));
        continue;
      }
      switch (m.stage) {
        case MistakeStage.found || MistakeStage.reviewed:
          mine.add(RecordItem(paper: a.id, q: n + 1, qid: q.id, ch: chapterId, state: RecordState.open, stem: stem, pick: pick));
        case MistakeStage.setAside:
          mine.add(RecordItem(paper: a.id, q: n + 1, qid: q.id, ch: chapterId, state: RecordState.open, keyState: 'under_review', stem: stem, pick: pick));
        case MistakeStage.repaired:
          final check = checks[m.key];
          mine.add(
            RecordItem(
              paper: a.id,
              q: n + 1,
              qid: q.id,
              ch: chapterId,
              state: check == null ? RecordState.repaired : (check.right ? RecordState.held : RecordState.slipped),
              stem: stem,
              pick: pick,
              repairedAt: m.stageAt?.toUtc(),
              checkedAt: check?.at?.toUtc(),
            ),
          );
      }
    }
    // A paper with nothing missed is not read in full: it puts no questions on offer (the website's rule).
    if (mine.isNotEmpty) {
      asked[a.id] = perChapter;
      items.addAll(mine);
    }
  }

  return ReviewRecord(now: now.toUtc(), papers: papers, chapters: chapters.values.toList(), items: items, chapterQuestions: asked);
}

/// The student's letter for a wrong answer: the option's own key, else A to H by position.
String? _pick(SnapshotQuestion q, int? given) {
  if (given == null || given < 0) return null;
  if (given < q.options.length) {
    final key = q.options[given].key.trim();
    if (key.isNotEmpty) return key;
  }
  return given < _letters.length ? _letters[given] : null;
}
