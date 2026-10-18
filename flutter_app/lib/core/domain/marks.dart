import '../models/attempt.dart';

/// Marks per correct answer and the penalty for a wrong one (+5 and -1).
const marksPerCorrect = 5;
const marksPenaltyPerWrong = 1;

/// Where the marks of a mock went (design spec 5.6, card 2). Every number is derived from
/// the server's counts and is a display derivation, never authority.
///
/// The four parts always sum to [max]: `scored + takenOff + notEarnedOnWrong + notEarnedOnBlank`
/// is `5c - w + w + 5w + 5u`, which is `5n`.
class MarkBreakdown {
  const MarkBreakdown({
    required this.correct,
    required this.wrong,
    required this.unattempted,
    required this.scored,
    required this.takenOff,
    required this.notEarnedOnWrong,
    required this.notEarnedOnBlank,
  });

  final int correct;
  final int wrong;
  final int unattempted;

  /// `correct * 5 - wrong`: the marks the student has.
  final int scored;

  /// One mark taken off for each wrong answer.
  final int takenOff;

  /// The 5 marks a wrong answer did not earn, for each wrong answer.
  final int notEarnedOnWrong;

  /// The 5 marks a blank did not earn, for each blank.
  final int notEarnedOnBlank;

  int get questions => correct + wrong + unattempted;

  /// Out of `questions * 5`.
  int get max => questions * marksPerCorrect;

  /// Everything that is not scored: taken off plus not earned on wrong and on blank.
  int get lost => takenOff + notEarnedOnWrong + notEarnedOnBlank;

  /// The four parts in display order, summing to [max].
  List<int> get parts => [scored, takenOff, notEarnedOnWrong, notEarnedOnBlank];
}

/// The one function every screen uses for these numbers. Negative inputs count as zero.
MarkBreakdown markBreakdown(int correct, int wrong, int unattempted) {
  final c = correct < 0 ? 0 : correct;
  final w = wrong < 0 ? 0 : wrong;
  final u = unattempted < 0 ? 0 : unattempted;
  return MarkBreakdown(
    correct: c,
    wrong: w,
    unattempted: u,
    scored: c * marksPerCorrect - w * marksPenaltyPerWrong,
    takenOff: w * marksPenaltyPerWrong,
    notEarnedOnWrong: w * marksPerCorrect,
    notEarnedOnBlank: u * marksPerCorrect,
  );
}

/// [markBreakdown] for a server-scored attempt, from its own counts.
MarkBreakdown markBreakdownOf(Attempt attempt) => markBreakdown(attempt.correct, attempt.wrong, attempt.unattempted);

/// What a chapter's missed marks are shown against, the one rule for every screen that says "47 of the 245 marks you
/// missed" (the result's recap card and the paper reel's closing card; v15 walk, M5).
///
/// The denominator is what the whole paper missed ([paperMissed], `max - score`), because the chapter's marks are
/// part of it: the figure can never be bigger than what it is shown against. It is null, and the words then drop
/// the denominator ("47 marks"), when no honest one exists:
///
/// * the paper missed more than it holds ([paperMax]): a negative score (a wrong answer costs 6, 5 not won and 1
///   taken off), where "of 300" on a 250-mark paper reads as a mistake;
/// * [chapterMissed] is more than [paperMissed]: the counts do not agree, so no fraction is claimed.
///
/// The reel used to print "47 of 45 marks missed": 47 counts the wrong answers' penalties, 45 was five marks a question
/// in the chapter, a total that has no room for them.
int? missedMarksDenominator({required int chapterMissed, required int paperMissed, int? paperMax}) {
  if (paperMax != null && paperMissed > paperMax) return null;
  if (chapterMissed > paperMissed) return null;
  return paperMissed;
}
