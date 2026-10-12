import '../models/attempt.dart';

/// Marks a wrong answer sits below a right one: 5 not earned plus the 1 taken off.
const marksGapPerWrong = 6;

/// Marks a blank sits below a right one.
const marksGapPerBlank = 5;

/// A chapter needs at least this many questions before it can be named as the one that cost
/// the most marks (design spec 5.6).
const minQuestionsToNameChapter = 3;

/// What one chapter cost in one attempt. Wrong and not attempted are always kept apart.
class ChapterStat {
  const ChapterStat({
    required this.chapter,
    required this.questions,
    required this.correct,
    required this.wrong,
    required this.unattempted,
    required this.wrongNumbers,
    required this.blankNumbers,
  });

  final String chapter;
  final int questions;
  final int correct;
  final int wrong;
  final int unattempted;

  /// 1-based question numbers of the wrong answers, in paper order.
  final List<int> wrongNumbers;

  /// 1-based question numbers of the not attempted questions.
  final List<int> blankNumbers;

  /// `wrong * 6 + unattempted * 5`: an observation under this attempt's key, not a forecast.
  int get marksLost => wrong * marksGapPerWrong + unattempted * marksGapPerBlank;

  bool get canBeNamed => questions >= minQuestionsToNameChapter;
}

/// The observed chapter breakdown of one attempt, ported from `data/session_recovery.js`.
class ChapterBreakdown {
  const ChapterBreakdown({required this.stats, required this.wrongNumbers});

  /// Every chapter, sorted by marks lost (descending), then wrong answers (descending), then
  /// chapter name, so a tie never reshuffles the order between opens.
  final List<ChapterStat> stats;

  /// Question numbers of all wrong answers, for the case where no chapter can be named.
  final List<int> wrongNumbers;

  /// Chapters that lost marks, in sorted order.
  List<ChapterStat> get lossChapters => [for (final s in stats) if (s.marksLost > 0) s];

  /// The chapter that cost the most marks among those with enough questions to be named,
  /// or null when none qualifies (every chapter has fewer than 3 questions, or nothing was lost).
  ChapterStat? get leader {
    for (final s in stats) {
      if (s.marksLost > 0 && s.canBeNamed) return s;
    }
    return null;
  }

  /// True when no chapter can be named and card 3 should list the wrong answers by number.
  bool get listWrongByNumber => leader == null;

  /// The leading chapter has blanks only: say so instead of calling them mistakes.
  bool get leaderIsBlanksOnly {
    final l = leader;
    return l != null && l.wrong == 0 && l.unattempted > 0;
  }
}

/// Builds the breakdown from an attempt's own snapshot and per-question details.
/// [excludeQuestionIds] removes questions held for a key check (withdrawn, under review, ...).
ChapterBreakdown observedChapterBreakdown(Attempt attempt, {Set<String> excludeQuestionIds = const {}}) {
  final byChapter = <String, _Acc>{};
  final allWrong = <int>[];
  for (var i = 0; i < attempt.questions.length; i++) {
    final q = attempt.questions[i];
    if (excludeQuestionIds.contains(q.id)) continue;
    final number = i + 1;
    final detail = attempt.detailFor(q.id);
    final chapter = q.chapter ?? '';
    final acc = byChapter.putIfAbsent(chapter, _Acc.new);
    acc.questions++;
    if (detail?.isCorrect == true) {
      acc.correct++;
    } else if (detail?.isCorrect == false) {
      acc.wrong++;
      acc.wrongNumbers.add(number);
      allWrong.add(number);
    } else {
      acc.unattempted++;
      acc.blankNumbers.add(number);
    }
  }
  final stats = [
    for (final e in byChapter.entries)
      ChapterStat(
        chapter: e.key,
        questions: e.value.questions,
        correct: e.value.correct,
        wrong: e.value.wrong,
        unattempted: e.value.unattempted,
        wrongNumbers: e.value.wrongNumbers,
        blankNumbers: e.value.blankNumbers,
      ),
  ]..sort((a, b) {
      final lost = b.marksLost.compareTo(a.marksLost);
      if (lost != 0) return lost;
      final wrong = b.wrong.compareTo(a.wrong);
      if (wrong != 0) return wrong;
      return a.chapter.compareTo(b.chapter);
    });
  return ChapterBreakdown(stats: stats, wrongNumbers: allWrong);
}

class _Acc {
  int questions = 0;
  int correct = 0;
  int wrong = 0;
  int unattempted = 0;
  final List<int> wrongNumbers = [];
  final List<int> blankNumbers = [];
}
