import '../../../core/domain/mock_ordinal.dart';
import '../../../core/domain/tonight_pick.dart';
import '../../../core/models/attempt.dart';
import '../../../core/repositories/repair_local_repository.dart';

/// Where one mistake stands. Found and Reviewed are still open (a key review is not a repair);
/// Repaired closes the repair; Set aside means the answer key is being checked. Retested and
/// Still right need tests on new questions, which are not ready yet, so no item reaches them.
enum MistakeStage {
  found,
  reviewed,
  repaired,
  setAside;

  bool get isOpen => this == found || this == reviewed;
}

/// One wrong answer, with where and when it was found.
class MistakeItem {
  const MistakeItem({
    required this.attemptId,
    required this.questionId,
    required this.number,
    required this.chapter,
    required this.subjectId,
    required this.source,
    required this.foundAt,
    this.givenIndex,
    this.stage = MistakeStage.found,
    this.stageAt,
  });

  final String attemptId;
  final String questionId;

  /// 1-based position in the paper.
  final int number;
  final String chapter;

  /// The attempt's internal subject id.
  final String subjectId;

  /// "Mock 7" or "Quick practice".
  final String source;
  final DateTime foundAt;
  final int? givenIndex;
  final MistakeStage stage;

  /// When the stage was recorded (the server acknowledgement for Repaired and Set aside).
  final DateTime? stageAt;

  String get key => '$attemptId/$questionId';

  /// The same mistake at another stage (a saved repair the server reports, found on the phone).
  MistakeItem atStage(MistakeStage next, DateTime? at) => MistakeItem(
    attemptId: attemptId,
    questionId: questionId,
    number: number,
    chapter: chapter,
    subjectId: subjectId,
    source: source,
    foundAt: foundAt,
    givenIndex: givenIndex,
    stage: next,
    stageAt: at,
  );
}

/// The mistakes of one chapter (across attempts), newest first.
class ChapterGroup {
  const ChapterGroup({required this.chapter, required this.subjectId, required this.items});

  final String chapter;
  final String subjectId;
  final List<MistakeItem> items;

  List<MistakeItem> get open => [
    for (final i in items)
      if (i.stage.isOpen) i,
  ];
  int get openCount => open.length;
  int get repairedCount => items.where((i) => i.stage == MistakeStage.repaired).length;
  int get setAsideCount => items.where((i) => i.stage == MistakeStage.setAside).length;
  DateTime get latestFoundAt => items.map((i) => i.foundAt).reduce((a, b) => a.isAfter(b) ? a : b);

  /// The open mistakes split by paper, newest paper first, each by question number. A repair run
  /// covers one chapter of one paper (`RepairRun.open`), so this is the unit the group's key
  /// repairs: its count is the run's step count.
  List<PaperOpen> get openByPaper {
    final byPaper = <String, List<MistakeItem>>{};
    for (final i in open) {
      byPaper.putIfAbsent(i.attemptId, () => []).add(i);
    }
    final out = [
      for (final items in byPaper.values)
        PaperOpen(
          attemptId: items.first.attemptId,
          source: items.first.source,
          foundAt: items.first.foundAt,
          items: [...items]..sort((a, b) => a.number.compareTo(b.number)),
        ),
    ]..sort((a, b) => b.foundAt.compareTo(a.foundAt));
    return out;
  }

  /// This chapter with only the items of [stage] (a group split by outcome keeps its identity).
  ChapterGroup? onlyStage(MistakeStage stage) {
    final kept = [for (final i in items) if (i.stage == stage) i];
    return kept.isEmpty ? null : ChapterGroup(chapter: chapter, subjectId: subjectId, items: kept);
  }
}

/// The open mistakes of one chapter in one paper: what one repair run holds.
class PaperOpen {
  const PaperOpen({required this.attemptId, required this.source, required this.foundAt, required this.items});

  final String attemptId;

  /// "Mock 7" or "Quick practice".
  final String source;
  final DateTime foundAt;
  final List<MistakeItem> items;
}

/// A skipped question. Never a repair candidate.
class BlankItem {
  const BlankItem({required this.attemptId, required this.questionId, required this.number, required this.chapter});

  final String attemptId;
  final String questionId;
  final int number;
  final String chapter;
}

/// The skipped questions of the latest attempt that has any.
class BlankGroup {
  const BlankGroup({required this.attemptId, required this.source, required this.items});

  final String attemptId;
  final String source;
  final List<BlankItem> items;
}

/// The single next move on the tab, the same pick Today and Start make ([pickTonightChapter]):
/// the chapter with the most open mistakes in the newest paper that can carry a repair and still
/// has any (results not opened yet are left for their reveal).
class TonightPick {
  const TonightPick({
    required this.attemptId,
    required this.chapter,
    required this.subjectId,
    required this.source,
    required this.items,
    this.paperOpen = 0,
    this.chapterOpen = 0,
  });

  final String attemptId;
  final String chapter;
  final String subjectId;
  final String source;

  /// The chapter's open mistakes in this paper, by question number.
  final List<MistakeItem> items;

  /// Every open mistake in the paper.
  final int paperOpen;

  /// The chapter's open mistakes across every paper.
  final int chapterOpen;
}

/// Everything the Review tab shows, derived from the attempts list and the local repair records.
class ReviewIndex {
  const ReviewIndex({required this.groups, required this.attempts, this.blanks, this.tonight});

  /// Chapters with at least one open mistake first (newest found first), then the rest.
  final List<ChapterGroup> groups;
  final BlankGroup? blanks;
  final TonightPick? tonight;

  /// Every attempt, newest first.
  final List<Attempt> attempts;

  List<ChapterGroup> get openGroups => [
    for (final g in groups)
      if (g.openCount > 0) g,
  ];
  int get openCount => groups.fold(0, (n, g) => n + g.openCount);

  /// The open mistakes outside the papers in [sealed] (results not opened yet).
  int openCountExcept(Set<String> sealed) {
    if (sealed.isEmpty) return openCount;
    var n = 0;
    for (final g in groups) {
      for (final i in g.items) {
        if (i.stage.isOpen && !sealed.contains(i.attemptId)) n++;
      }
    }
    return n;
  }
  bool get hasAnyMistake => groups.isNotEmpty;

  /// Every wrong answer on record that is still counted (not-a-mistake answers are left out).
  int get foundCount => groups.fold(0, (n, g) => n + g.items.length);
  int get repairedCount => groups.fold(0, (n, g) => n + g.repairedCount);
  int get setAsideCount => groups.fold(0, (n, g) => n + g.setAsideCount);

  /// Full and NTA-style mocks, newest first.
  List<Attempt> get mocks => [
    for (final a in attempts)
      if (a.isMock) a,
  ];

  Attempt? attempt(String id) {
    for (final a in attempts) {
      if (a.id == id) return a;
    }
    return null;
  }

  MistakeItem? item(String attemptId, String questionId) {
    for (final g in groups) {
      for (final i in g.items) {
        if (i.attemptId == attemptId && i.questionId == questionId) return i;
      }
    }
    return null;
  }

  /// The other papers in which the question of [item] was also answered wrong, newest first.
  /// Only real records: the same question id marked wrong in another attempt on this account.
  /// Empty when the question was missed once (or when nothing else is known).
  List<MistakeItem> missedElsewhere(MistakeItem item) {
    final all = _byQuestion[this] ??= _questionMap(groups);
    final same = all[item.questionId];
    if (same == null || same.length < 2) return const [];
    return [
      for (final i in same)
        if (i.attemptId != item.attemptId) i,
    ];
  }

  /// The open mistakes of [attemptId] in [chapter], by question number.
  List<MistakeItem> openIn(String attemptId, String chapter) {
    final out = <MistakeItem>[];
    for (final g in groups) {
      if (g.chapter != chapter) continue;
      out.addAll(g.items.where((i) => i.attemptId == attemptId && i.stage.isOpen));
    }
    return out..sort((a, b) => a.number.compareTo(b.number));
  }

  /// The next chapter to offer after a repair: the attempt's largest other open chapter, then
  /// any other open chapter. Skips [exclude] (mistakes just worked on).
  TonightPick? nextAfter(String attemptId, Set<String> exclude) {
    TonightPick? pick(bool sameAttempt) {
      final byChapter = <String, List<MistakeItem>>{};
      for (final g in groups) {
        for (final i in g.items) {
          if (!i.stage.isOpen || exclude.contains(i.key)) continue;
          if (sameAttempt != (i.attemptId == attemptId)) continue;
          byChapter.putIfAbsent('${i.attemptId}|${i.chapter}', () => []).add(i);
        }
      }
      if (byChapter.isEmpty) return null;
      final best = byChapter.values.reduce((a, b) => b.length > a.length ? b : a)..sort((a, b) => a.number.compareTo(b.number));
      final first = best.first;
      return TonightPick(attemptId: first.attemptId, chapter: first.chapter, subjectId: first.subjectId, source: first.source, items: best);
    }

    return pick(true) ?? pick(false);
  }
}

/// Each index's mistakes by question id (built once, on first use).
final Expando<Map<String, List<MistakeItem>>> _byQuestion = Expando('mistakesByQuestion');

Map<String, List<MistakeItem>> _questionMap(List<ChapterGroup> groups) {
  final out = <String, List<MistakeItem>>{};
  for (final g in groups) {
    for (final i in g.items) {
      out.putIfAbsent(i.questionId, () => []).add(i);
    }
  }
  for (final list in out.values) {
    list.sort((a, b) => b.foundAt.compareTo(a.foundAt));
  }
  return out;
}

/// "Mock 7" for a full or NTA-style mock, otherwise "Quick practice".
String sourceLabel(Iterable<Attempt> attempts, Attempt attempt) {
  final n = mockOrdinal(attempts, attempt);
  return n == null ? 'Quick practice' : 'Mock $n';
}

/// Chapter name for a question, never empty.
String chapterOf(String? chapter) => chapterKey(chapter);

MistakeStage _stageFor(RepairLocalRecord? r) {
  if (r == null) return MistakeStage.found;
  if (r.isRepaired) return MistakeStage.repaired;
  return switch (r.status) {
    RepairLocalStatus.heldForRecheck => MistakeStage.setAside,
    RepairLocalStatus.reviewed => MistakeStage.reviewed,
    _ => MistakeStage.found,
  };
}

/// Builds the index. [attempts] is the attempts list (any order); [records] are the local repair
/// records; [unopened] are results not opened yet. Questions the server called `not_a_mistake`
/// are hidden quietly.
///
/// [saved] is what the account holds as repairs (`attemptId/questionId` to when it was made, F17).
/// A mistake in it is Repaired, at the time the server made it, whatever the phone's own record
/// says or lacks: a repair made on another phone, on the website or before a reinstall counts here
/// the moment it is read, and its row opens the saved repair for free.
ReviewIndex buildReviewIndex(
  List<Attempt> attempts,
  List<RepairLocalRecord> records, {
  Set<String> unopened = const {},
  Map<String, DateTime> saved = const {},
}) {
  final sorted = [...attempts]..sort((a, b) => b.completedAt.compareTo(a.completedAt));
  final byKey = {for (final r in records) '${r.attemptId}/${r.questionId}': r};
  final groups = <String, List<MistakeItem>>{};
  BlankGroup? blanks;

  for (final attempt in sorted) {
    final source = sourceLabel(sorted, attempt);
    final attemptBlanks = <BlankItem>[];
    for (var i = 0; i < attempt.questions.length; i++) {
      final q = attempt.questions[i];
      final detail = attempt.detailFor(q.id);
      if (detail == null) continue;
      final chapter = chapterOf(q.chapter);
      if (detail.isBlank) {
        attemptBlanks.add(BlankItem(attemptId: attempt.id, questionId: q.id, number: i + 1, chapter: chapter));
        continue;
      }
      if (!detail.isWrong) continue;
      final record = byKey['${attempt.id}/${q.id}'];
      if (record?.status == RepairLocalStatus.notAMistake) continue;
      // The account's own record wins over a phone that has no repair (or only a key review) for it.
      final savedAt = (record?.isRepaired ?? false) ? null : saved['${attempt.id}/${q.id}'];
      final stage = savedAt != null ? MistakeStage.repaired : _stageFor(record);
      groups
          .putIfAbsent('${attempt.subject}|$chapter', () => [])
          .add(
            MistakeItem(
              attemptId: attempt.id,
              questionId: q.id,
              number: i + 1,
              chapter: chapter,
              subjectId: attempt.subject,
              source: source,
              foundAt: attempt.completedAt,
              givenIndex: detail.givenIndex,
              stage: stage,
              stageAt: stage == MistakeStage.found ? null : (savedAt ?? record?.ackedAt),
            ),
          );
    }
    if (blanks == null && attemptBlanks.isNotEmpty) blanks = BlankGroup(attemptId: attempt.id, source: source, items: attemptBlanks);
  }

  final list =
      [for (final items in groups.values) ChapterGroup(chapter: items.first.chapter, subjectId: items.first.subjectId, items: items)]
        ..sort((a, b) {
          final open = (b.openCount > 0 ? 1 : 0) - (a.openCount > 0 ? 1 : 0);
          if (open != 0) return open;
          final t = b.latestFoundAt.compareTo(a.latestFoundAt);
          return t != 0 ? t : b.openCount - a.openCount;
        });

  final index = ReviewIndex(groups: list, attempts: sorted, blanks: blanks);
  return ReviewIndex(groups: list, attempts: sorted, blanks: blanks, tonight: _tonight(index, sorted, unopened));
}

TonightPick? _tonight(ReviewIndex index, List<Attempt> newestFirst, Set<String> unopened) {
  for (final attempt in newestFirst) {
    if (!isRepairBasis(attempt) || unopened.contains(attempt.id)) continue;
    final open = [
      for (final g in index.groups)
        for (final i in g.items)
          if (i.attemptId == attempt.id && i.stage.isOpen) i,
    ];
    final pick = pickTonightChapter(open, chapterOf: (i) => i.chapter, numberOf: (i) => i.number);
    if (pick == null) continue;
    final first = pick.items.first;
    final chapterOpen = index.groups
        .where((g) => g.chapter == pick.chapter && g.subjectId == first.subjectId)
        .fold<int>(0, (n, g) => n + g.openCount);
    return TonightPick(
      attemptId: attempt.id,
      chapter: pick.chapter,
      subjectId: first.subjectId,
      source: first.source,
      items: pick.items,
      paperOpen: pick.paperOpen,
      chapterOpen: chapterOpen,
    );
  }
  return null;
}
