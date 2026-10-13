import '../../../core/models/repair.dart';
import 'mistake_index.dart';

/// Why a repair call did not produce an explanation the student can read now.
enum RepairFailure {
  offline,
  rateLimited,
  inProgress,

  /// 502 and 503: the explanation could not be made.
  unavailable,

  /// 422 other than `not_a_mistake`, or a snapshot the server cannot use.
  cannotRepair,
  notFound,
  unknown;

  /// Calling again may work without the student changing anything.
  bool get canRetry => this != cannotRepair && this != notFound;
}

/// What happened to one mistake in this run.
sealed class MistakeOutcome {
  const MistakeOutcome();
}

/// The call is in flight.
class OutcomeLoading extends MistakeOutcome {
  const OutcomeLoading();
}

/// `explained`, or `stored` (a free reopen). Acknowledged by the server at [ackedAt].
class OutcomeExplained extends MistakeOutcome {
  const OutcomeExplained(this.response, {required this.ackedAt, this.reopened = false});

  final RepairResponse response;
  final DateTime ackedAt;

  /// Reopened an earlier repair: shown again, not counted again.
  final bool reopened;
}

/// `held_for_recheck`, or a 409 eligibility answer: set aside, nothing charged.
class OutcomeSetAside extends MistakeOutcome {
  const OutcomeSetAside({required this.heldByServer});

  /// True for `held_for_recheck` (the server recorded it); false for a 409 answer.
  final bool heldByServer;
}

/// `not_explained`: nothing charged.
class OutcomeNotExplained extends MistakeOutcome {
  const OutcomeNotExplained();
}

class OutcomeFailed extends MistakeOutcome {
  const OutcomeFailed(this.failure);

  final RepairFailure failure;
}

/// The no-AI answer review built from the attempt detail. [reason] says why it is showing.
class OutcomeKeyReview extends MistakeOutcome {
  const OutcomeKeyReview(this.reason);

  final KeyReviewReason reason;
}

enum KeyReviewReason {
  /// The student chose to read the key explanations.
  chosen,

  /// 402 `insufficient_ai_credits`.
  outOfCredits,

  /// 503 `paused`.
  paused,

  /// The explanation could not be made and the student asked for the key instead.
  fallback,
}

/// One mistake in the run.
class RepairStep {
  const RepairStep(this.item, [this.outcome]);

  final MistakeItem item;
  final MistakeOutcome? outcome;

  RepairStep withOutcome(MistakeOutcome? o) => RepairStep(item, o);

  /// Counts toward "N mistakes repaired": an acknowledged explained or stored answer that is
  /// not a reopen of an earlier repair.
  bool get countsAsRepaired => switch (outcome) {
    OutcomeExplained(:final reopened) => !reopened,
    _ => false,
  };
}

enum RepairPhase { entry, working, ending }

/// A repair run over the open mistakes of one attempt and chapter.
class RepairRunState {
  const RepairRunState({
    required this.attemptId,
    required this.chapter,
    required this.subjectId,
    required this.source,
    required this.steps,
    this.index = 0,
    this.phase = RepairPhase.entry,
    this.keyOnly = false,
    this.repairedBefore = false,
  });

  final String attemptId;
  final String chapter;
  final String subjectId;
  final String source;
  final List<RepairStep> steps;
  final int index;
  final RepairPhase phase;

  /// Every step shows the key explanation instead of calling the repair (empty wallet,
  /// paused, or the student's choice).
  final bool keyOnly;

  /// The student had a repaired mistake on this phone before this run (for "first repair").
  final bool repairedBefore;

  RepairStep? get current => index < steps.length ? steps[index] : null;
  bool get isLast => index >= steps.length - 1;

  int get repairedCount => steps.where((s) => s.countsAsRepaired).length;
  int get setAsideCount => steps.where((s) => s.outcome is OutcomeSetAside).length;
  int get reviewedCount => steps.where((s) => s.outcome is OutcomeKeyReview).length;

  /// Keys of the mistakes this run touched, so "Repair N more" offers different ones.
  Set<String> get touchedKeys => {for (final s in steps.take(index + 1)) s.item.key};

  /// The latest acknowledgement of a counted repair in this run (the receipt time).
  DateTime? get lastAckedAt {
    DateTime? latest;
    for (final s in steps) {
      final o = s.outcome;
      if (o is OutcomeExplained && !o.reopened && (latest == null || o.ackedAt.isAfter(latest))) latest = o.ackedAt;
    }
    return latest;
  }

  RepairRunState copyWith({List<RepairStep>? steps, int? index, RepairPhase? phase, bool? keyOnly}) => RepairRunState(
    attemptId: attemptId,
    chapter: chapter,
    subjectId: subjectId,
    source: source,
    steps: steps ?? this.steps,
    index: index ?? this.index,
    phase: phase ?? this.phase,
    keyOnly: keyOnly ?? this.keyOnly,
    repairedBefore: repairedBefore,
  );

  RepairRunState withCurrent(MistakeOutcome? outcome) {
    final next = [...steps];
    next[index] = next[index].withOutcome(outcome);
    return copyWith(steps: next);
  }
}
