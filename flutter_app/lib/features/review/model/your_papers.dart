// Your papers (19 Oct, owner D106 and G20): Review becomes Practice > Your papers. Top to bottom: a stats strip (papers sat,
// the latest marks with their trend, open repairs), a subject filter, the papers newest first (name, subject, marks out of
// the maximum, date with a 12-hour time; a tap opens that paper's result and answers), then Mistakes to repair by chapter.
//
// PURE: no Flutter, no providers. Every figure on the page comes from one place so the numbers agree (the 18 Oct walk found
// repair counts 139 / 19 / 2 and full mocks 5 / 13 / 8 disagreeing): the strip's papers are the rows' count, the strip's
// open repairs are the open mistakes the chapter list holds (both read one ReviewRecord, filtered by the same subject), and
// a paper's marks are the attempt's own `marks` of `maxMarks`, the figure its result counts up to.
import '../../../core/domain/mock_ordinal.dart';
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import '../data/review_providers.dart' show subjectName;
import 'review_chapters.dart';

/// One subject the papers can be filtered by, with how many papers it has.
class PaperSubject {
  const PaperSubject({required this.name, required this.papers});

  final String name;
  final int papers;
}

/// One paper as its row shows it.
class PaperLine {
  const PaperLine({
    required this.attemptId,
    required this.name,
    required this.subject,
    required this.when,
    required this.location,
    required this.right,
    required this.wrong,
    required this.blank,
    this.marks,
    this.max,
    this.sealed = false,
    this.change,
    this.up,
  });

  final String attemptId;

  /// "Mock 3", "Mock 3 (NTA mode)", "Quick practice", "Chapter practice" or "Smart practice".
  final String name;

  /// "Accountancy".
  final String subject;

  /// "Sun 18 Oct, 10:11 PM", in the student's own zone.
  final String when;

  /// Where a tap goes: the result (a mock's full result, a practice set's result), or the sealed sheet for a result that has
  /// not been opened (Your papers never spoils a reveal).
  final String location;

  /// The attempt's own marks and maximum; null while sealed.
  final int? marks;
  final int? max;
  final int right;
  final int wrong;
  final int blank;
  final bool sealed;

  /// "+12 on Mock 7", "−3 on the set before", "Level with Mock 7": against the previous opened paper of the same subject,
  /// kind and length. Null when there is none.
  final String? change;

  /// True when the change went up, false when down, null when level or none.
  final bool? up;
}

/// The strip at the top: papers sat, the newest opened paper's marks with their change, and the open repairs.
class PapersStrip {
  const PapersStrip({required this.papers, required this.toRepair, this.latest});

  final int papers;
  final PaperLine? latest;
  final int toRepair;
}

/// Everything Your papers draws for one subject filter (null: every subject).
class YourPapersView {
  const YourPapersView({required this.subjects, required this.subject, required this.strip, required this.papers, required this.body});

  /// The subjects the filter offers, most papers first; empty when the papers are all of one subject (nothing to filter).
  final List<PaperSubject> subjects;

  /// The filter applied: a subject's name, or null for every subject.
  final String? subject;
  final PapersStrip strip;

  /// Newest first.
  final List<PaperLine> papers;

  /// The chapters, the saved repairs and their lines, built from the record filtered by [subject].
  final ChaptersBody body;

  bool get isEmpty => papers.isEmpty;
}

/// The name a paper goes by on its row.
String paperName(Iterable<Attempt> all, Attempt a) {
  final n = mockOrdinal(all, a);
  if (n != null) return a.mode == 'nta' ? 'Mock $n (NTA mode)' : 'Mock $n';
  return switch (a.mode) {
    'smart' => 'Smart practice',
    'chapter' => 'Chapter practice',
    _ => 'Quick practice',
  };
}

/// Where a paper's row opens.
String paperLocation(Attempt a, {required bool sealed}) {
  if (sealed) return AppRoutes.resultSealed(a.id);
  return a.isMock ? AppRoutes.result(a.id) : AppRoutes.practiceResult(a.id);
}

/// The record with only the papers of [subject] (and their items, chapters and question counts), so every figure the
/// chapter list prints reads the same subset as the rows above it. Null keeps the whole record.
ReviewRecord recordForSubject(ReviewRecord record, String? subject) {
  if (subject == null) return record;
  bool mine(String? id) => subjectName(id ?? '') == subject;
  final papers = [for (final p in record.papers) if (mine(p.subject)) p];
  final ids = {for (final p in papers) p.id};
  final items = [for (final i in record.items) if (ids.contains(i.paper)) i];
  final chapterIds = {for (final i in items) i.ch};
  final counts = record.chapterQuestions;
  return ReviewRecord(
    now: record.now,
    papers: papers,
    chapters: [for (final c in record.chapters) if (chapterIds.contains(c.id)) c],
    items: items,
    chapterQuestions: counts == null ? null : {for (final e in counts.entries) if (ids.contains(e.key)) e.key: e.value},
  );
}

String _minus(int n) => '−$n';

/// Builds the page. [attempts] is the student's papers in any order; [unopened] the results still sealed; [record] the
/// chapter record ([reviewRecordOf] over the same papers); [local] reads an instant as the student's wall clock.
YourPapersView buildYourPapers({
  required List<Attempt> attempts,
  required Set<String> unopened,
  required ReviewRecord record,
  String? subject,
  LocalTime local = istLocal,
}) {
  final all = [...attempts]..sort((a, b) => b.completedAt.compareTo(a.completedAt));

  // The filter: every subject with a paper, most papers first, then by name. One subject has nothing to filter.
  final counts = <String, int>{};
  for (final a in all) {
    final name = subjectName(a.subject);
    counts[name] = (counts[name] ?? 0) + 1;
  }
  final subjects = [for (final e in counts.entries) PaperSubject(name: e.key, papers: e.value)]
    ..sort((a, b) {
      final n = b.papers.compareTo(a.papers);
      return n != 0 ? n : a.name.compareTo(b.name);
    });
  // A filter for a subject that has no papers (any more) falls back to every subject.
  final applied = subject != null && counts.containsKey(subject) ? subject : null;
  final shown = [for (final a in all) if (applied == null || subjectName(a.subject) == applied) a];

  PaperLine line(Attempt a) {
    final sealed = unopened.contains(a.id);
    var right = 0, wrong = 0, blank = 0;
    for (final q in a.questions) {
      final d = a.detailFor(q.id);
      if (d == null || d.isBlank) {
        blank++;
      } else if (d.isWrong) {
        wrong++;
      } else {
        right++;
      }
    }
    // A paper read without its rows still has its counts.
    if (a.questions.isEmpty) {
      right = a.correct;
      wrong = a.wrong;
      blank = a.unattempted;
    }
    String? change;
    bool? up;
    if (!sealed) {
      final at = all.indexOf(a);
      for (final b in all.skip(at + 1)) {
        if (b.subject != a.subject || b.mode != a.mode || b.total != a.total) continue;
        if (unopened.contains(b.id)) break;
        final than = b.isMock ? paperName(all, b) : 'the set before';
        final by = a.marks - b.marks;
        change = by == 0 ? 'Level with $than' : (by > 0 ? '+$by on $than' : '${_minus(-by)} on $than');
        up = by == 0 ? null : by > 0;
        break;
      }
    }
    return PaperLine(
      attemptId: a.id,
      name: paperName(all, a),
      subject: subjectName(a.subject),
      when: dayStamp(a.completedAt, local: local),
      location: paperLocation(a, sealed: sealed),
      marks: sealed ? null : a.marks,
      max: sealed ? null : a.maxMarks,
      right: sealed ? 0 : right,
      wrong: sealed ? 0 : wrong,
      blank: sealed ? 0 : blank,
      sealed: sealed,
      change: change,
      up: up,
    );
  }

  final papers = [for (final a in shown) line(a)];
  final body = chaptersBody(recordForSubject(record, applied), local: local);
  final toRepair = body.rows.fold<int>(0, (n, r) => n + r.open.length);
  PaperLine? latest;
  for (final p in papers) {
    if (!p.sealed) {
      latest = p;
      break;
    }
  }
  return YourPapersView(
    subjects: subjects.length >= 2 ? subjects : const [],
    subject: applied,
    strip: PapersStrip(papers: papers.length, latest: latest, toRepair: toRepair),
    papers: papers,
    body: body,
  );
}
