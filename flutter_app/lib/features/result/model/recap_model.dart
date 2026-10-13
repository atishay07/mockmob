import '../../../core/domain/domain.dart';
import '../../../core/models/models.dart';
import '../../../core/platform/review_prompt.dart' show ReviewMoment;
import '../../../core/widgets/bubbles/bubble_painter.dart' show BubbleState;
import 'recap_variant.dart';
import 'subject_names.dart';

/// The previous comparable mock (server `recap.previousComparable`, spec 5.6).
class PreviousMock {
  const PreviousMock({required this.label, required this.marks, required this.max});

  /// "Mock 6", or "Your last mock" when its number is not known on this phone.
  final String label;
  final int marks;
  final int max;
}

/// Everything the recap and the full result show, derived once from server facts. Every number
/// comes from the attempt's own counts through the core domain functions; nothing is invented.
class RecapModel {
  const RecapModel({
    required this.attemptId,
    required this.subjectId,
    required this.subjectName,
    required this.ordinal,
    required this.questionCount,
    required this.durationMinutes,
    required this.submittedAt,
    this.receivedAt,
    required this.breakdown,
    required this.cells,
    required this.variant,
    required this.keysUnavailable,
    required this.heldCount,
    required this.chapters,
    required this.candidates,
    required this.blankCount,
    required this.monthMockCount,
    this.previous,
    this.creditBalance,
    this.firstMockTokenAt,
    this.detailLoaded = true,
    this.mode = 'full',
    this.blanksInReview = false,
  });

  final String attemptId;

  /// Attempt-side subject id (`accountancy`, `gat`, ...).
  final String subjectId;
  final String subjectName;

  /// "Mock 7"; null for Quick practice.
  final int? ordinal;
  final int questionCount;
  final int? durationMinutes;

  /// Local time of completion.
  final DateTime submittedAt;

  /// When this phone received the server's acknowledgment; null when no acknowledgment is on
  /// this phone (a result submitted elsewhere), so no "saved at" time is ever invented.
  final DateTime? receivedAt;
  final MarkBreakdown breakdown;

  /// One bubble per question in paper order: filled (correct), wrong, blank, marked (held).
  final List<BubbleState> cells;
  final RecapVariant variant;
  final bool keysUnavailable;
  final int heldCount;

  /// Observed chapter breakdown, held questions excluded.
  final ChapterBreakdown chapters;

  /// Wrong answers that repair may offer.
  final List<RepairCandidate> candidates;
  final int blankCount;

  /// Full and NTA-style mocks finished this calendar month, this one included.
  final int monthMockCount;
  final PreviousMock? previous;

  /// Explanation credits; null when unknown (never treated as zero).
  final int? creditBalance;

  /// The server's `first_full_mock` milestone when this attempt earned it.
  final DateTime? firstMockTokenAt;

  /// False when only the cached attempt is known (the detail read failed or is loading).
  final bool detailLoaded;

  /// `full`, `nta` or `quick` (for analytics only).
  final String mode;

  /// Review keeps the blanks of the newest paper that has any (`buildReviewIndex`); true when
  /// that paper is this one, so "they are in Review" is only said when it is so.
  final bool blanksInReview;

  String get mockLabel => ordinal == null ? 'Quick practice' : 'Mock $ordinal';
  String get title => '$mockLabel, $subjectName';
  int get marks => breakdown.scored;
  int get maxMarks => breakdown.max;
  int get correct => breakdown.correct;
  int get wrong => breakdown.wrong;
  int get unattempted => breakdown.unattempted;
  bool get isHeld => variant == RecapVariant.held;

  /// An NTA mode result: no reminder row and no store review ask here.
  bool get isNta => mode == 'nta';

  /// The store review moment this result is, or null when it is not one. Only a full mock that
  /// improved on the one before it, or held steady against it (the server's `higher` and
  /// `neutral` tones, with that mock on record), is a good moment. Never NTA mode or a quick
  /// practice, a first mock (nothing to compare), a lower result, or one with answer keys on
  /// hold or missing: the figure is not final or not whole there. (`held` here is a steady
  /// result; [isHeld] is the keys on hold.)
  ReviewMoment? get reviewMoment {
    if (mode != 'full' || keysUnavailable) return null;
    return switch (variant) {
      RecapVariant.higher => ReviewMoment.resultImproved,
      RecapVariant.standard when previous != null => ReviewMoment.resultHeld,
      _ => null,
    };
  }

  /// Default repair size: the 10-minute chip when it exists, else all candidates.
  /// The repair this result asks for, the same pick Today and Review make: the chapter with the
  /// most wrong answers (a repair run covers one chapter). Null with nothing to repair.
  TonightChapter<RepairCandidate>? get tonight =>
      pickTonightChapter(candidates, chapterOf: (c) => c.chapter, numberOf: (c) => c.number);

  /// How many mistakes tonight's repair can hold.
  int get tonightCount => tonight?.items.length ?? 0;

  int get defaultRepairMinutes {
    final options = repairDurationOptions(tonightCount);
    for (final o in options) {
      if (o.minutes == 10) return 10;
    }
    if (options.isNotEmpty) return options.first.minutes;
    return repairMinutes(tonightCount) ?? 0;
  }
}

/// Builds the [RecapModel]. [attempts] is the cached list (may not hold this attempt yet);
/// [attemptsLoaded] is false while that list has not loaded, so the mock number and the
/// first-mock token stay unknown rather than guessed from an empty list; [repairedIds] are questions repaired on this phone; [milestones] are the server's.
/// [toLocal] turns an instant into the student's own day (their saved time zone, the one Review
/// reads); the phone's zone is only the fallback, so a wrong phone clock never moves a mock into
/// another month or another hour.
RecapModel buildRecapModel({
  required Attempt attempt,
  AttemptDetail? detail,
  List<Attempt> attempts = const [],
  Set<String> repairedIds = const {},
  int? creditBalance,
  DateTime? receivedAt,
  List<RhythmMilestone> milestones = const [],
  bool attemptsLoaded = true,
  DateTime Function(DateTime)? toLocal,
}) {
  final local = toLocal ?? _deviceLocal;
  final ordinal = mockOrdinal(attempts, attempt, listLoaded: attemptsLoaded);
  final held = detail?.heldQuestionIds.toSet() ?? const <String>{};
  final variant = resolveRecapVariant(hasHeld: held.isNotEmpty, ordinal: ordinal, tone: detail?.recap?.tone);

  final cells = <BubbleState>[];
  for (final q in attempt.questions) {
    final d = attempt.detailFor(q.id);
    if (held.contains(q.id)) {
      cells.add(BubbleState.marked);
    } else if (d?.isCorrect == true) {
      cells.add(BubbleState.filled);
    } else if (d?.isCorrect == false) {
      cells.add(BubbleState.wrong);
    } else {
      cells.add(BubbleState.blank);
    }
  }

  return RecapModel(
    attemptId: attempt.id,
    subjectId: attempt.subject,
    subjectName: subjectDisplayName(attempt.subject),
    ordinal: ordinal,
    questionCount: attempt.total,
    durationMinutes: attempt.selectionMeta.durationMinutes,
    submittedAt: local(attempt.completedAt),
    receivedAt: receivedAt == null ? null : local(receivedAt),
    breakdown: markBreakdownOf(attempt),
    cells: cells,
    variant: variant,
    keysUnavailable: detail?.reviewsUnavailable ?? false,
    heldCount: held.length,
    chapters: observedChapterBreakdown(attempt, excludeQuestionIds: held),
    candidates: repairCandidates(attempt, reviews: detail?.answerReviews ?? const {}, repairedIds: repairedIds),
    blankCount: attempt.unattempted,
    monthMockCount: monthMockCount(attempts, attempt, toLocal: local),
    previous: _previous(detail, attempts),
    creditBalance: creditBalance,
    firstMockTokenAt: attemptsLoaded ? _firstMockToken(attempts, attempt, milestones, local) : null,
    detailLoaded: detail != null,
    mode: attempt.mode ?? 'full',
    blanksInReview: _blanksInReview(attempts, attempt),
  );
}

bool _blanksInReview(List<Attempt> attempts, Attempt attempt) {
  if (attempt.unattempted == 0) return false;
  return !attempts.any((a) => a.id != attempt.id && a.unattempted > 0 && a.completedAt.isAfter(attempt.completedAt));
}

PreviousMock? _previous(AttemptDetail? detail, List<Attempt> attempts) {
  final recap = detail?.recap;
  if (recap == null || !recap.hasPrevious) return null;
  String label = 'Your last mock';
  final id = recap.previousAttemptId;
  if (id != null) {
    for (final a in attempts) {
      if (a.id == id) {
        final n = mockOrdinal(attempts, a);
        if (n != null) label = 'Mock $n';
      }
    }
  }
  return PreviousMock(label: label, marks: recap.previousMarks!, max: recap.previousMax!);
}

DateTime _deviceLocal(DateTime t) => t.toLocal();

/// Full and NTA-style mocks, any subject, finished in the same calendar month as [attempt] and
/// not after it, counting [attempt] itself once. The month is the student's ([toLocal]).
int monthMockCount(Iterable<Attempt> attempts, Attempt attempt, {DateTime Function(DateTime)? toLocal}) {
  if (!attempt.isMock) return 0;
  final local = toLocal ?? _deviceLocal;
  final at = local(attempt.completedAt);
  var n = 1;
  for (final a in attempts) {
    if (a.id == attempt.id || !a.isMock) continue;
    final t = local(a.completedAt);
    if (t.year == at.year && t.month == at.month && !a.completedAt.isAfter(attempt.completedAt)) n++;
  }
  return n;
}

/// The brass first-mock token shows only when the server recorded `first_full_mock` and this
/// attempt is the student's only full or NTA-style mock up to now (any subject).
DateTime? _firstMockToken(List<Attempt> attempts, Attempt attempt, List<RhythmMilestone> milestones, DateTime Function(DateTime) local) {
  if (!attempt.isMock) return null;
  RhythmMilestone? m;
  for (final x in milestones) {
    if (x.id == 'first_full_mock' && x.earned) m = x;
  }
  if (m == null) return null;
  final earlier = attempts.where((a) => a.id != attempt.id && a.isMock && !a.completedAt.isAfter(attempt.completedAt));
  return earlier.isEmpty ? local(m.achievedAt!) : null;
}
