import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/domain/chapter_breakdown.dart' show marksGapPerWrong;
import '../../../core/models/json_helpers.dart';
import '../../../core/models/study.dart';
import '../../review/data/review_providers.dart' show reviewIndexProvider;
import '../models/learn_catalog.dart';

// What Learn (the lesson library, `/learn`), Practice's Learn row and its shelf say, from the study catalog and the
// student's open mistakes (LEARN-REVIEW-1017 5.9 and 5.11, packet P-LR6). The app port of the website's
// `data/study/concepts_pick.mjs`: PURE, no I/O and no clock, so the panel, "Where you lose marks" and "All chapters"
// print the same numbers. The open mistakes come from the phone's own Review index (the same count Review's header,
// Today and Practice print), priced the way the result prices them: a wrong answer costs 6 marks.

/// Minutes the "Lock it in" step takes: the key reads Learn plus this (the website's `LOCK_IN_MINUTES`).
const int lockInMinutes = 2;

/// The comparison key for a subject or chapter name: "Admission of a partner" is "Admission of Partner", "Retirement &
/// Death" is "Retirement and death". Case, '&', '_' and the words a, an and the do not tell two names apart.
String nameKey(String? value) => (value ?? '')
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replaceAll('_', ' ')
    .replaceAll(RegExp(r'[^a-z0-9 ]+'), ' ')
    .replaceAll(RegExp(r'\b(?:a|an|the)\b'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

/// The catalog's subject id for an attempt's subject id ("accounts" is "accountancy").
String catalogSubjectId(String id) => switch (id) {
  'accounts' || 'acc' => 'accountancy',
  'business' || 'bst' => 'business_studies',
  'eco' => 'economics',
  'gat' => 'general_test',
  _ => id,
};

/// One chapter's open mistakes across the student's papers, and what they cost.
class ChapterCost {
  const ChapterCost({required this.subject, required this.chapter, required this.open});

  /// The catalog's subject id.
  final String subject;
  final String chapter;
  final int open;

  int get marks => open * marksGapPerWrong;
}

/// The open mistakes by chapter, costliest first, from the phone's Review index; null until it is read.
final learnChapterCostsProvider = Provider<List<ChapterCost>?>((ref) {
  final index = ref.watch(reviewIndexProvider);
  if (index == null) return null;
  final costs = [
    for (final g in index.openGroups) ChapterCost(subject: catalogSubjectId(g.subjectId), chapter: g.chapter, open: g.openCount),
  ]..sort((a, b) {
      final m = b.marks.compareTo(a.marks);
      return m != 0 ? m : a.chapter.compareTo(b.chapter);
    });
  return costs;
});

String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

String _sentence(String? text) {
  final t = (text ?? '').replaceAll(' · ', ', ').replaceAll(RegExp(r'\s+'), ' ').trim();
  if (t.isEmpty) return '';
  final cap = '${t[0].toUpperCase()}${t.substring(1)}';
  return RegExp(r'[.!?]$').hasMatch(cap) ? cap : '$cap.';
}

bool _sameChapter(String? a, String? b) => a != null && b != null && nameKey(a).isNotEmpty && nameKey(a) == nameKey(b);

/// The catalog's lessons for one subject's chapter, in the order they are taught.
List<LearnUnit> chapterLessons(LearnCatalog catalog, String subject, String chapter) => [
  for (final u in catalog.units)
    if (u.id.isNotEmpty && u.subject == subject && _sameChapter(u.chapter, chapter)) u,
];

/// "Start the lesson, 9 minutes": Learn plus Lock it in, or Lock it in alone for a lesson already read.
int? startMinutes(LearnUnit unit) {
  final m = unit.estimatedMinutes;
  if (m == null) return null;
  return unit.isRead ? lockInMinutes : m + lockInMinutes;
}

/// The key for a lesson: "Finish the lesson, step 3 of 9" when its run is open, else "Start the lesson, 9 minutes".
String startKey(LearnUnit unit) {
  if (unit.runId != null && unit.step != null && unit.steps != null) return 'Finish the lesson, step ${unit.step} of ${unit.steps}';
  final m = startMinutes(unit);
  return m == null ? 'Start the lesson' : 'Start the lesson, ${_plural(m, 'minute')}';
}

String _cost(LearnUnit? unit) {
  final cards = unit?.cardCount ?? 0;
  if (cards <= 0) return 'Free.';
  return cards == 1 ? 'Free. Its card then joins Revise.' : 'Free. Its $cards cards then join Revise.';
}

enum PickKind { finish, mistakes, next, practise }

/// The one lesson to read next (5.9), the one lime key on Learn.
class ConceptsPick {
  const ConceptsPick({
    required this.kind,
    required this.title,
    required this.reason,
    required this.key,
    this.unit,
    this.lead = '',
    this.cost,
    this.runId,
    this.minutes,
    this.chapter,
    this.open = 0,
  });

  final PickKind kind;
  final LearnUnit? unit;
  final String title;

  /// "Read this next.", "Start here.", "Finish this next." (empty for practise).
  final String lead;
  final String reason;
  final String key;
  final String? cost;

  /// The lesson run to open instead of starting one: the active run, or the lesson's own open run.
  final String? runId;
  final int? minutes;
  final String? chapter;

  /// Open mistakes in the lesson's chapter (mistakes only).
  final int open;
}

/// The pick, in the website's order:
///   1  an unfinished lesson ("Finish the lesson, step k of n")
///   2  the unread lesson for the costliest chapter with open mistakes
///   3  the next unread lesson the catalog recommends
///   4  nothing to read: practise questions
/// Due cards are never the pick: they are Revise's.
ConceptsPick conceptsPick(LearnCatalog catalog, List<ChapterCost>? costs) {
  final active = catalog.active;
  if (active != null && active.id.isNotEmpty && active.mode == 'learn') {
    final unit = active.unitId == null ? null : catalog.unitById(active.unitId!);
    final step = active.step;
    final total = active.total;
    final where = step != null && total != null;
    return ConceptsPick(
      kind: PickKind.finish,
      unit: unit,
      title: unit?.title ?? active.title ?? 'Your lesson',
      lead: 'Finish this next.',
      reason: where ? 'You stopped at step $step of $total. Everything before it is saved.' : 'Everything you did is saved.',
      key: where ? 'Finish the lesson, step $step of $total' : 'Finish the lesson',
      cost: _cost(unit),
      runId: active.id,
      minutes: unit?.estimatedMinutes,
      chapter: unit?.chapter,
    );
  }
  for (final c in costs ?? const <ChapterCost>[]) {
    final lessons = chapterLessons(catalog, c.subject, c.chapter);
    final unit = lessons.where((u) => u.status == StudyUnitStatus.inProgress).firstOrNull ?? lessons.where((u) => !u.isRead).firstOrNull;
    if (unit == null) continue;
    final chapter = unit.chapter ?? c.chapter;
    return ConceptsPick(
      kind: PickKind.mistakes,
      unit: unit,
      title: unit.title,
      lead: 'Read this next.',
      reason: '${c.open} of your open ${c.open == 1 ? 'mistake is' : 'mistakes are'} in its chapter, $chapter.',
      key: startKey(unit),
      cost: _cost(unit),
      runId: unit.runId,
      minutes: unit.estimatedMinutes,
      chapter: chapter,
      open: c.open,
    );
  }
  final nextId = catalog.next?.id;
  final next = nextId == null || nextId.isEmpty ? null : catalog.unitById(nextId);
  if (next != null) {
    final read = recordLine(catalog).read;
    final reason = _sentence(next.summary).isNotEmpty ? _sentence(next.summary) : _sentence(catalog.next?.reason);
    return ConceptsPick(
      kind: PickKind.next,
      unit: next,
      title: next.title,
      lead: read > 0 ? 'Read this next.' : 'Start here.',
      reason: reason,
      key: startKey(next),
      cost: _cost(next),
      runId: next.runId,
      minutes: next.estimatedMinutes,
      chapter: next.chapter,
    );
  }
  return const ConceptsPick(
    kind: PickKind.practise,
    title: 'Every lesson is read',
    reason: 'Nothing is waiting. Practise a chapter or take a mock to find what to study next.',
    key: 'Practise questions',
  );
}

/// What one lesson row shows: one line that is true about it, and its time (or Read).
({String line, String trailing}) lessonRow(LearnUnit unit) {
  final summary = (unit.summary ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  final String line;
  if (unit.dueCards > 0) {
    line = '${_plural(unit.dueCards, 'card')} due in Revise today';
  } else if (unit.runId != null && unit.step != null && unit.steps != null) {
    line = ['In progress, step ${unit.step} of ${unit.steps}.', if (summary.isNotEmpty) summary].join(' ');
  } else if (unit.isRead) {
    line = summary.isEmpty ? 'Read' : summary;
  } else {
    line = summary.isEmpty ? 'New' : 'New. $summary';
  }
  final m = unit.estimatedMinutes;
  return (line: line, trailing: unit.isRead ? 'Read' : (m == null ? '' : '$m min'));
}

String _lessonsMeta(List<LearnUnit> lessons) {
  final read = lessons.where((u) => u.isRead).length;
  return '${_plural(lessons.length, 'lesson')}${read > 0 ? ', $read read' : ''}';
}

/// A chapter row of Learn: its name, its open cost, one line, and its lessons.
class ChapterRow {
  const ChapterRow({required this.name, required this.marks, required this.open, required this.lessons, required this.meta});

  final String name;

  /// Marks the open mistakes cost (0 when none is open).
  final int marks;
  final int open;
  final List<LearnUnit> lessons;
  final String meta;
}

/// Chapters of [subject] with open mistakes, costliest first, with their lessons.
List<ChapterRow> loseMarks(LearnCatalog catalog, List<ChapterCost>? costs, String subject) => [
  for (final c in costs ?? const <ChapterCost>[])
    if (c.subject == subject)
      () {
        final lessons = chapterLessons(catalog, subject, c.chapter);
        return ChapterRow(
          name: lessons.firstOrNull?.chapter ?? c.chapter,
          marks: c.marks,
          open: c.open,
          lessons: lessons,
          meta: '${_plural(c.open, 'open mistake')}. ${lessons.isEmpty ? 'No lesson yet. Practise the chapter' : _lessonsMeta(lessons)}',
        );
      }(),
];

/// Every chapter of [subject] in syllabus order (or the order its lessons are taught, when the catalog sends no
/// syllabus), with its open cost and its lessons, and the head line.
({List<ChapterRow> chapters, int lessons, String head}) allChapters(LearnCatalog catalog, List<ChapterCost>? costs, String subject) {
  final syllabus = catalog.subjects.where((s) => s.id == subject).firstOrNull?.chapters ?? const <String>[];
  final names = <String>[...syllabus];
  for (final u in catalog.unitsOf(subject)) {
    final c = u.chapter?.trim();
    if (c != null && c.isNotEmpty && !names.any((n) => _sameChapter(n, c))) names.add(c);
  }
  final open = {
    for (final c in costs ?? const <ChapterCost>[])
      if (c.subject == subject) nameKey(c.chapter): c,
  };
  final chapters = [
    for (final name in names)
      () {
        final lessons = chapterLessons(catalog, subject, name);
        final cost = open[nameKey(name)];
        return ChapterRow(
          name: name,
          marks: cost?.marks ?? 0,
          open: cost?.open ?? 0,
          lessons: lessons,
          meta: lessons.isEmpty ? 'No lesson yet. Practice ready' : _lessonsMeta(lessons),
        );
      }(),
  ];
  final taught = chapters.where((c) => c.lessons.isNotEmpty).length;
  final count = chapters.fold(0, (n, c) => n + c.lessons.length);
  return (chapters: chapters, lessons: count, head: '${_plural(count, 'lesson')}, $taught of ${chapters.length} chapters');
}

/// A chapter with no lesson yet, found by a search.
typedef ChapterHit = ({String subject, String name});

/// Lessons and chapters (without a lesson) that match [query], across subjects. Under two characters: null.
({List<LearnUnit> lessons, List<ChapterHit> chapters})? searchConcepts(String query, LearnCatalog catalog) {
  final needle = nameKey(query);
  if (needle.length < 2) return null;
  bool hit(String? text) => nameKey(text).contains(needle);
  final lessons = [
    for (final u in catalog.units)
      if (u.id.isNotEmpty && (hit(u.title) || hit(u.chapter) || hit(u.summary))) u,
  ].take(30).toList();
  final chapters = <ChapterHit>[];
  for (final s in catalog.subjects) {
    for (final c in s.chapters) {
      if (!hit(c)) continue;
      if (catalog.units.any((u) => u.subject == s.id && _sameChapter(u.chapter, c))) continue;
      chapters.add((subject: s.id, name: c));
    }
  }
  return (lessons: lessons, chapters: chapters.take(30).toList());
}

/// The study record as one line: "2 of 9 lessons read, 8 cards in Revise, 23 cards recalled". The card numbers only
/// when the server sends them.
({int read, int of, int? cards, int? recalled, String text}) recordLine(LearnCatalog catalog) {
  final p = asJson(catalog.core.raw['progress']);
  final read = asInt(p['lessonsRead']) ?? catalog.units.where((u) => u.isRead).length;
  final of = asInt(p['lessonsAvailable']) ?? catalog.units.length;
  final cards = asInt(p['cardsStarted']);
  final recalled = asInt(p['recallReviews']);
  final parts = [
    '$read of ${_plural(of, 'lesson')} read',
    if (cards != null) '${_plural(cards, 'card')} in Revise',
    if (recalled != null) '${_plural(recalled, 'card')} recalled',
  ];
  return (read: read, of: of, cards: cards, recalled: recalled, text: parts.join(', '));
}

/// Practice's Learn row and shelf (5.11): "{lesson}, {m} min" and why, or the library when every lesson is read.
({ConceptsPick pick, String title, String line}) practicePanel(LearnCatalog catalog, List<ChapterCost>? costs) {
  final pick = conceptsPick(catalog, costs);
  if (pick.kind == PickKind.practise) return (pick: pick, title: 'Learn', line: learnLede);
  final minutes = pick.minutes == null ? '' : ', ${pick.minutes} min';
  final line = pick.kind == PickKind.mistakes || pick.kind == PickKind.finish ? pick.reason : '${pick.lead} ${pick.reason}'.trim();
  return (pick: pick, title: '${pick.title}$minutes', line: line);
}

/// Learn's one-line lede (the website's).
const String learnLede = 'Short lessons on the ideas behind your mistakes.';

/// Where a lesson was opened from (5.10), read back from `?from=`: `chapter:{subject}:{chapter}`, `q:{attemptId}:{n}`
/// or `today`. Anything else is null, never a guess.
sealed class LessonFrom {
  const LessonFrom();

  static LessonFrom? parse(String? value) {
    final text = value ?? '';
    if (text == 'today') return const FromToday();
    final q = RegExp(r'^q:([^:]+):(\d{1,3})$').firstMatch(text);
    if (q != null) return FromQuestion(attemptId: q.group(1)!, number: int.parse(q.group(2)!));
    final c = RegExp(r'^chapter:([^:]+):(.+)$').firstMatch(text);
    if (c != null && c.group(2)!.trim().isNotEmpty) return FromChapter(subject: c.group(1)!, chapter: c.group(2)!);
    return null;
  }
}

class FromToday extends LessonFrom {
  const FromToday();
}

class FromQuestion extends LessonFrom {
  const FromQuestion({required this.attemptId, required this.number});

  final String attemptId;
  final int number;
}

class FromChapter extends LessonFrom {
  const FromChapter({required this.subject, required this.chapter});

  final String subject;
  final String chapter;
}
