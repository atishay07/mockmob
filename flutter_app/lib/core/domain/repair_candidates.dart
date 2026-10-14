import '../models/attempt.dart';
import 'tonight_pick.dart';

/// A wrong answer that Mistake Repair may be offered for.
class RepairCandidate {
  const RepairCandidate({required this.questionId, required this.number, required this.chapter, this.givenIndex});

  final String questionId;

  /// 1-based position in the paper.
  final int number;
  final String chapter;

  /// The option the student chose.
  final int? givenIndex;
}

/// The mistakes of [attempt] that repair may offer (design spec 5.6).
///
/// Candidates are wrong answers only. Not attempted questions are never candidates: a blank
/// is a skipped question, not a conceptual error, and the client never sends one to repair.
/// Excluded:
/// - questions whose review state is `withdrawn`, `under_review`, `content_changed` or
///   `key_changed_unverified` ([reviews] is `AttemptDetail.answerReviews`, empty when unknown),
/// - questions already repaired on this phone ([repairedIds]),
/// - ids the server answered with `not_a_mistake` ([notAMistakeIds]), hidden quietly.
List<RepairCandidate> repairCandidates(
  Attempt attempt, {
  Map<String, AnswerReview> reviews = const {},
  Set<String> repairedIds = const {},
  Set<String> notAMistakeIds = const {},
}) {
  final out = <RepairCandidate>[];
  for (var i = 0; i < attempt.questions.length; i++) {
    final q = attempt.questions[i];
    final detail = attempt.detailFor(q.id);
    if (detail == null || detail.isCorrect != false) continue;
    if (reviews[q.id]?.isHeld ?? false) continue;
    if (repairedIds.contains(q.id) || notAMistakeIds.contains(q.id)) continue;
    out.add(RepairCandidate(questionId: q.id, number: i + 1, chapter: q.chapter ?? '', givenIndex: detail.givenIndex));
  }
  return out;
}

/// Minutes per mistake, a stated assumption pending a measured figure after the pilot.
const repairMinutesPerMistake = 3;

/// "About" N minutes for [mistakes]: 3 minutes each, rounded up to the nearest 5. Null for
/// none, so no time is shown with zero candidates. 3 mistakes gives 10.
int? repairMinutes(int mistakes) {
  if (mistakes <= 0) return null;
  final raw = mistakes * repairMinutesPerMistake;
  return ((raw + 4) ~/ 5) * 5;
}

/// A duration chip on the recap's last card and the Today card.
class RepairDurationOption {
  const RepairDurationOption({required this.minutes, required this.mistakes});

  final int minutes;

  /// How many mistakes that duration holds.
  final int mistakes;
}

const _optionTable = [
  RepairDurationOption(minutes: 5, mistakes: 2),
  RepairDurationOption(minutes: 10, mistakes: 3),
  RepairDurationOption(minutes: 20, mistakes: 6),
];

/// The 5, 10 and 20 minute chips for a repair, capped by the candidates: a chip that holds
/// more mistakes than exist is not shown, and with 2 or fewer candidates none are shown. When no
/// chip holds exactly all of them (4 or 5 mistakes), a last chip does, so the longest choice is
/// always the whole chapter that Review offers.
List<RepairDurationOption> repairDurationOptions(int candidateCount) {
  if (candidateCount <= 2) return const [];
  final fit = [for (final o in _optionTable) if (o.mistakes <= candidateCount) o];
  final covered = fit.isEmpty ? 0 : fit.last.mistakes;
  if (covered < candidateCount && candidateCount < _optionTable.last.mistakes) {
    fit.add(RepairDurationOption(minutes: repairMinutes(candidateCount)!, mistakes: candidateCount));
  }
  return fit;
}

/// Explanation credits a repair of [mistakes] needs: one per mistake.
int repairCreditsNeeded(int mistakes) => mistakes < 0 ? 0 : mistakes;

/// The wallet cannot cover the task. Null when it can, or when the balance is unknown
/// (an unknown balance shows no line, and never counts as zero).
class RepairWalletShortfall {
  const RepairWalletShortfall({required this.needed, required this.balance});

  final int needed;
  final int balance;

  /// How many mistakes the balance can still cover.
  int get coveredMistakes => balance < 0 ? 0 : balance;
}

RepairWalletShortfall? repairWalletShortfall({required int mistakes, required int? balance}) {
  if (balance == null) return null;
  final needed = repairCreditsNeeded(mistakes);
  return balance >= needed ? null : RepairWalletShortfall(needed: needed, balance: balance);
}

/// What one repair key opens: one chapter of one paper, the same run `RepairRun.open` builds
/// (the tapped mistake first, then the chapter's other open mistakes by question number), so the
/// words on a key always match the entry it opens.
class RepairKeyScope {
  const RepairKeyScope({required this.chapter, required this.firstQuestionId, required this.count, required this.othersInPaper});

  /// The chapter as the run groups it ([chapterKey]: an unnamed chapter is "Other questions").
  final String chapter;

  /// The mistake the run opens on.
  final String firstQuestionId;

  /// The run's mistake count.
  final int count;

  /// Mistakes of the same paper in other chapters: the run does not hold them.
  final int othersInPaper;

  /// "About" minutes for the run, 3 per mistake rounded up to 5.
  int get minutes => repairMinutes(count) ?? 0;

  bool get hasNamedChapter => chapter != otherChapter;
}

/// The words for a repair key, from what it actually opens.
abstract final class RepairCandidates {
  /// The run a key on [candidates] (one paper's open mistakes) opens. With [startQuestionId] the
  /// run starts there, in that question's chapter; without one it is tonight's chapter (the one
  /// holding the most open mistakes, the pick Today, Review and Start make). [limit] keeps the run
  /// to that many, as a `?count=` link does. Null when there is nothing to open.
  static RepairKeyScope? scopeOf(List<RepairCandidate> candidates, {String? startQuestionId, int? limit}) {
    if (candidates.isEmpty) return null;
    RepairCandidate? start;
    if (startQuestionId != null) {
      for (final c in candidates) {
        if (c.questionId == startQuestionId) start = c;
      }
      if (start == null) return null;
    } else {
      final pick = pickTonightChapter(candidates, chapterOf: (c) => c.chapter, numberOf: (c) => c.number);
      if (pick == null) return null;
      start = pick.items.first;
    }
    final chapter = chapterKey(start.chapter);
    final inChapter = [
      for (final c in candidates)
        if (chapterKey(c.chapter) == chapter) c,
    ];
    var count = inChapter.length;
    if (limit != null && limit > 0 && limit < count) count = limit;
    return RepairKeyScope(
      chapter: chapter,
      firstQuestionId: start.questionId,
      count: count,
      othersInPaper: candidates.length - inChapter.length,
    );
  }

  /// "Repair 1 mistake" or "Repair 3 mistakes": the count on the key is the run's count.
  static String keyLabel(RepairKeyScope scope) => 'Repair ${_mistakes(scope.count)}';

  /// The line under the key: "Principles of management, about 5 minutes." and, when the paper
  /// has more in other chapters, "The other 4 are in Review."
  static String describe(RepairKeyScope scope) {
    final where = scope.hasNamedChapter ? shortChapterName(scope.chapter) : 'Questions with no chapter';
    final rest = scope.othersInPaper <= 0
        ? ''
        : ' The other ${scope.othersInPaper} ${scope.othersInPaper == 1 ? 'is' : 'are'} in Review.';
    return '$where, about ${scope.minutes} minutes.$rest';
  }

  /// What a screen reader says for the key: the count, the chapter and the time in one sentence.
  static String spoken(RepairKeyScope scope) => '${keyLabel(scope)}. ${describe(scope)}';

  static String _mistakes(int n) => n == 1 ? '1 mistake' : '$n mistakes';
}

/// "Partnership" for "Partnership: admission of a partner" (the same rule as Review's copy).
String shortChapterName(String chapter) {
  final head = chapter.split(':').first.trim();
  return head.isEmpty ? chapter : head;
}
