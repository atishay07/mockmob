import '../../../core/models/attempt.dart';
import '../../../core/models/question.dart';
import '../data/mistake_index.dart';

/// How many questions one Review again set holds.
const reviewAgainLimit = 10;

/// How many repaired mistakes are considered before the ones whose question and key are not on
/// the phone are left out: the set still fills to [reviewAgainLimit] when some are missing.
const reviewAgainPool = 30;

/// One question of the set: the mistake, the question as it was in the paper, and what the phone
/// holds for it. Built only for a question whose key is cached, so a card is never shown broken.
class AgainQuestion {
  const AgainQuestion({required this.item, required this.question, required this.keyIndex, this.explanation});

  final MistakeItem item;
  final SnapshotQuestion question;

  /// The correct option's index, from the attempt detail's key rule (never a hidden key).
  final int keyIndex;

  /// The key explanation, free and on the phone, or null.
  final String? explanation;

  String get key => item.key;
}

/// The mistakes to ask again, in order: those the student missed in their last Review again first
/// (they are the ones that did not hold), then the oldest repair first. Only mistakes that are
/// repaired, never an open one (an open mistake belongs to the repair) and never a set-aside one.
/// [seed] (the keys of a repair run just finished) narrows the set to those, still in this order.
List<MistakeItem> reviewAgainCandidates(ReviewIndex index, {Set<String> missed = const {}, Set<String>? seed, int limit = reviewAgainPool}) {
  final all = [
    for (final g in index.groups)
      for (final i in g.items)
        if (i.stage == MistakeStage.repaired && (seed == null || seed.contains(i.key))) i,
  ];
  final epoch = DateTime.fromMillisecondsSinceEpoch(0);
  all.sort((a, b) {
    final am = missed.contains(a.key) ? 0 : 1;
    final bm = missed.contains(b.key) ? 0 : 1;
    if (am != bm) return am - bm;
    final byTime = (a.stageAt ?? epoch).compareTo(b.stageAt ?? epoch);
    return byTime != 0 ? byTime : a.key.compareTo(b.key);
  });
  return all.take(limit).toList();
}

/// The set from [candidates]: each needs its question in [attemptOf] and its key in [detailOf]
/// (the attempt detail cached on the phone). Questions without either are left out, never shown
/// broken, and the set fills from the next candidates up to [limit].
List<AgainQuestion> buildReviewAgainSet({
  required List<MistakeItem> candidates,
  required Attempt? Function(String attemptId) attemptOf,
  required AttemptDetail? Function(String attemptId) detailOf,
  int limit = reviewAgainLimit,
}) {
  final out = <AgainQuestion>[];
  for (final item in candidates) {
    if (out.length >= limit) break;
    final detail = detailOf(item.attemptId);
    final attempt = attemptOf(item.attemptId) ?? detail?.attempt;
    if (attempt == null || detail == null) continue;
    SnapshotQuestion? question;
    for (final q in attempt.questions) {
      if (q.id == item.questionId) {
        question = q;
        break;
      }
    }
    final key = detail.visibleKeyIndex(item.questionId);
    if (question == null || key == null || key < 0 || key >= question.options.length) continue;
    final text = detail.visibleExplanation(item.questionId)?.trim();
    out.add(AgainQuestion(item: item, question: question, keyIndex: key, explanation: text == null || text.isEmpty ? null : text));
  }
  return out;
}

/// How a finished set went: how many held, and the keys that did not (they come back first).
class AgainResult {
  const AgainResult({required this.held, required this.total, required this.missedKeys});

  final int held;
  final int total;
  final List<String> missedKeys;

  /// "proud" for 6 of 8 or better (three quarters), "nod" for half or better, otherwise "encourage".
  AgainTone get tone {
    if (total == 0) return AgainTone.nod;
    final share = held / total;
    if (share >= 0.75) return AgainTone.proud;
    if (share >= 0.375) return AgainTone.nod;
    return AgainTone.encourage;
  }
}

enum AgainTone { proud, nod, encourage }
