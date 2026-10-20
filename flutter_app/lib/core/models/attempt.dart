import 'json_helpers.dart';
import 'mistake_insights.dart';
import 'mistake_lab.dart';
import 'question.dart';
import 'swot.dart';

/// Server verdict for one question. `isCorrect` is null for a question left blank.
class AnswerDetail {
  const AnswerDetail({required this.qid, this.givenIndex, this.isCorrect, this.timeMs});

  factory AnswerDetail.fromJson(Json j) => AnswerDetail(
        qid: asStringOr(j['qid'], ''),
        givenIndex: asInt(j['givenIndex']),
        isCorrect: asBool(j['isCorrect']),
        timeMs: asInt(j['timeMs']),
      );

  final String qid;
  final int? givenIndex;
  final bool? isCorrect;
  final int? timeMs;

  bool get isWrong => isCorrect == false;
  bool get isBlank => isCorrect == null;
}

class AttemptRecovery {
  const AttemptRecovery({this.telemetry, this.answerChangeQids = const []});

  factory AttemptRecovery.fromJson(Json j) => AttemptRecovery(
        telemetry: asString(j['telemetry']),
        answerChangeQids: [
          for (final c in asJsonList(asJson(j['observed'])['answerChanges'])) asStringOr(c['qid'], ''),
        ].where((q) => q.isNotEmpty).toList(),
      );

  /// `self_reported`, `inconsistent` or `invalid`. Only `self_reported` is usable.
  final String? telemetry;

  /// Questions whose answer was changed at least once (right to wrong cells on the strip).
  final List<String> answerChangeQids;

  bool get isUsable => telemetry == 'self_reported';
}

class SelectionMeta {
  const SelectionMeta({
    this.mode,
    this.sessionId,
    this.scoringVersion,
    this.durationMinutes,
    this.recovery,
    this.raw = const {},
  });

  factory SelectionMeta.fromJson(Json j) => SelectionMeta(
        mode: asString(j['mode']),
        sessionId: asString(j['sessionId']),
        scoringVersion: asString(j['scoringVersion']),
        durationMinutes: asInt(j['durationMinutes']),
        recovery: j['recovery'] is Map ? AttemptRecovery.fromJson(asJson(j['recovery'])) : null,
        raw: j,
      );

  final String? mode;
  final String? sessionId;
  final String? scoringVersion;
  final int? durationMinutes;
  final AttemptRecovery? recovery;
  final Json raw;

  /// Server scored attempts only; anything else is legacy device scoring.
  bool get isServerScored => scoringVersion == 'server_practice_v1' || scoringVersion == 'server_snapshot_v1';
}

/// A Mob paper still open for the Mob (server src/lib/mob/paperHold.mjs, C-dec 2 item 1): the server keeps its keys,
/// explanations and per-question right or wrong until the paper closes, and sends the marks with this hold instead.
/// `title`, `line` and `short` are the server's sentences; [until] is when the answers open.
class MobHold {
  const MobHold({required this.until, this.title = '', this.line = '', this.short = '', this.kind = 'weekly'});

  /// `mobHold` of an attempt, or `held` of a side-by-side. Null when absent or without a readable time.
  static MobHold? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final until = asDate(j['until']);
    if (until == null) return null;
    return MobHold(
      until: until,
      title: asStringOr(j['title'], ''),
      line: asStringOr(j['line'], ''),
      short: asStringOr(j['short'], ''),
      kind: asStringOr(j['kind'], 'weekly'),
    );
  }

  final DateTime until;
  final String title;
  final String line;
  final String short;

  /// `weekly` or `extra`.
  final String kind;

  bool isOpenAt(DateTime now) => !now.isBefore(until);
}

/// A scored attempt: the body of `POST /api/attempts` and one row of `GET /api/attempts`.
/// Marks are `correct * 5 - wrong` out of `total * 5` (a display derivation, never authority).
class Attempt {
  const Attempt({
    required this.id,
    required this.subject,
    required this.score,
    required this.correct,
    required this.wrong,
    required this.unattempted,
    required this.total,
    required this.details,
    required this.questions,
    required this.selectionMeta,
    required this.completedAt,
    this.userId,
    this.formatId,
    this._mode,
    this.mobHold,
  });

  factory Attempt.fromJson(Json j) {
    final questions = [for (final q in asJsonList(j['questionsSnapshot'])) SnapshotQuestion.fromJson(q)];
    final details = [for (final d in asJsonList(j['details'])) AnswerDetail.fromJson(d)];
    final meta = SelectionMeta.fromJson(asJson(j['selectionMeta']));
    final total = asInt(j['total']) ?? questions.length;
    return Attempt(
      id: asStringOr(j['id'], ''),
      userId: asString(j['userId']),
      subject: asStringOr(j['subject'], ''),
      score: asInt(j['score']) ?? 0,
      correct: asInt(j['correct']) ?? details.where((d) => d.isCorrect == true).length,
      wrong: asInt(j['wrong']) ?? details.where((d) => d.isWrong).length,
      unattempted: asInt(j['unattempted']) ?? 0,
      total: total,
      details: details,
      questions: questions,
      selectionMeta: meta,
      mode: asString(j['mode']),
      formatId: asString(j['formatId']),
      completedAt: asDate(j['completedAt']) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      mobHold: MobHold.fromJson(j['mobHold']),
    );
  }

  final String id;
  final String? userId;

  /// Internal subject id (compare with `subjects[].internalId`).
  final String subject;

  /// Percentage 0 to 100 as the server computes it. Not marks.
  final int score;
  final int correct;
  final int wrong;
  final int unattempted;
  final int total;
  final List<AnswerDetail> details;
  final List<SnapshotQuestion> questions;
  final SelectionMeta selectionMeta;
  final DateTime completedAt;
  final String? formatId;
  final String? _mode;

  /// Set while this is a Mob paper whose answers the server still holds (no rows, no keys until it closes).
  final MobHold? mobHold;

  /// `full`, `nta`, `quick`, `smart`. Top-level `mode` when the server sends it, otherwise
  /// `selectionMeta.mode` (the attempts list also holds Quick practice).
  String? get mode => _mode ?? selectionMeta.mode;

  /// A full or NTA-style mock (the attempts that take a "Mock N" number).
  bool get isMock => mode == 'full' || mode == 'nta';

  /// Marks scored: `correct * 5 - wrong`.
  int get marks => correct * 5 - wrong;
  int get maxMarks => total * 5;

  AnswerDetail? detailFor(String qid) {
    for (final d in details) {
      if (d.qid == qid) return d;
    }
    return null;
  }
}

/// A correction or hold on one answer key (`answerReviews` of the result read) [API 2.8].
class AnswerReview {
  const AnswerReview({
    required this.state,
    this.currentIndex,
    this.explanation,
    this.chosenIndex,
    this.originalMarks,
    this.correctedMarks,
    this.adjustment,
  });

  factory AnswerReview.fromJson(Json j) => AnswerReview(
        state: asStringOr(j['state'], ''),
        currentIndex: asInt(j['currentIndex']),
        explanation: asString(j['explanation']),
        chosenIndex: asInt(j['chosenIndex']),
        originalMarks: asInt(j['originalMarks']),
        correctedMarks: asInt(j['correctedMarks']),
        adjustment: asInt(j['adjustment']),
      );

  static const withdrawn = 'withdrawn';
  static const underReview = 'under_review';
  static const contentChanged = 'content_changed';
  static const keyChangedUnverified = 'key_changed_unverified';
  static const corrected = 'corrected';

  /// States that hold a question out of repair and out of key display.
  static const heldStates = {withdrawn, underReview, contentChanged, keyChangedUnverified};

  final String state;
  final int? currentIndex;
  final String? explanation;
  final int? chosenIndex;
  final int? originalMarks;
  final int? correctedMarks;
  final int? adjustment;

  bool get isHeld => heldStates.contains(state);
  bool get isCorrected => state == corrected;
}

/// `recap` block on the result read (backend module B8, not live yet) [design spec 5.6].
class AttemptRecap {
  const AttemptRecap({this.tone, this.previousMarks, this.previousMax, this.previousAttemptId, this.timingReliable, this.formatId});

  factory AttemptRecap.fromJson(Json j) {
    final prev = j['previousComparable'];
    final p = prev is Map ? asJson(prev) : null;
    return AttemptRecap(
      tone: asString(j['tone']),
      previousMarks: p == null ? null : asInt(p['marks']),
      previousMax: p == null ? null : asInt(p['max']),
      previousAttemptId: p == null ? null : asString(p['attemptId']),
      timingReliable: asBool(j['timingReliable']),
      formatId: asString(j['formatId']),
    );
  }

  /// `lower`, `higher`, `neutral` or null.
  final String? tone;
  final int? previousMarks;
  final int? previousMax;
  final String? previousAttemptId;
  final bool? timingReliable;
  final String? formatId;

  bool get hasPrevious => previousMarks != null && previousMax != null;
}

/// `GET /api/attempts/{id}`: the attempt plus answer reviews.
class AttemptDetail {
  const AttemptDetail({
    required this.attempt,
    this.answerReviews = const {},
    this.answerReviewState = 'ready',
    this.recap,
    this.mistakeInsights = const {},
    this.swot,
    this.lab,
    this.savedRepairs = const {},
  });

  factory AttemptDetail.fromJson(Json j) {
    final reviews = <String, AnswerReview>{};
    asJson(j['answerReviews']).forEach((qid, v) {
      if (v is Map) reviews[qid] = AnswerReview.fromJson(asJson(v));
    });
    return AttemptDetail(
      attempt: Attempt.fromJson(j),
      answerReviews: reviews,
      answerReviewState: asStringOr(j['answerReviewState'], 'ready'),
      recap: j['recap'] is Map ? AttemptRecap.fromJson(asJson(j['recap'])) : null,
      mistakeInsights: MistakeInsights.mapFrom(j['mistakeInsights']),
      swot: j['swot'] is Map ? Swot.fromJson(asJson(j['swot'])) : null,
      lab: MistakeLab.tryParse(j['lab']),
      savedRepairs: _savedRepairsFrom(j['savedRepairs']),
    );
  }

  /// `savedRepairs` of the server (F17): the wrong answers of this paper that already hold a saved
  /// repair, by question id, with when it was made. Absent on an older server: the app then goes by
  /// its own records on the phone. A row with no readable time is left out, never guessed.
  static Map<String, DateTime> _savedRepairsFrom(Object? raw) {
    if (raw is! Map) return const {};
    final out = <String, DateTime>{};
    raw.forEach((qid, v) {
      if (qid is! String || v is! Map) return;
      final at = DateTime.tryParse('${v['repairedAt'] ?? ''}');
      if (at != null) out[qid] = at.toUtc();
    });
    return out;
  }

  final Attempt attempt;
  final Map<String, AnswerReview> answerReviews;

  /// `ready` or `unavailable`. Unavailable means no key or explanation may be shown at all.
  final String answerReviewState;
  final AttemptRecap? recap;

  /// "From your record" lines per wrong answer (question id), built by the server from stored
  /// records. Empty when the server sends none.
  final Map<String, MistakeInsights> mistakeInsights;

  /// The post-mock read, null when the server omits it (practice results, an older server).
  final Swot? swot;

  /// The Mistake Lab (where the missed marks went, the first-pick re-mark, how others answered),
  /// null when the server omits it (an older server, answer checks not ready, a failed step) or
  /// sends one that does not add up.
  final MistakeLab? lab;

  /// Question ids of this paper with a saved repair on the account, and when each was made. Empty
  /// when the server does not say (an older server). A mistake listed here opens its saved repair
  /// and never offers a paid one again.
  final Map<String, DateTime> savedRepairs;

  bool get reviewsUnavailable => answerReviewState == 'unavailable';

  /// Questions held for a key check (the "Marks held" variant).
  List<String> get heldQuestionIds => [
        for (final e in answerReviews.entries)
          if (e.value.isHeld) e.key,
      ];
  bool get hasHeld => heldQuestionIds.isNotEmpty;

  /// The key rule of design spec 5.7: show the correct option only when there is no review, or
  /// the review is `corrected` (then use its `currentIndex`). Returns null whenever no key may
  /// be shown, including when the review state is unavailable.
  int? visibleKeyIndex(String qid) {
    if (reviewsUnavailable) return null;
    final review = answerReviews[qid];
    if (review == null) {
      for (final q in attempt.questions) {
        if (q.id == qid) return q.correctIndex;
      }
      return null;
    }
    return review.isCorrected ? review.currentIndex : null;
  }

  /// The explanation under the same rule as [visibleKeyIndex].
  String? visibleExplanation(String qid) {
    if (reviewsUnavailable) return null;
    final review = answerReviews[qid];
    if (review == null) {
      for (final q in attempt.questions) {
        if (q.id == qid) return q.explanation;
      }
      return null;
    }
    return review.isCorrected ? review.explanation : null;
  }
}
