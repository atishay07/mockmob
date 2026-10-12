import 'json_helpers.dart';

/// Why a plan action says what it says: `record` is observed from the student's results,
/// `rule` is a fixed planning rule.
class PlanFact {
  const PlanFact({required this.basis, required this.text});

  factory PlanFact.fromJson(Json j) => PlanFact(basis: asStringOr(j['basis'], 'rule'), text: asStringOr(j['text'], ''));

  final String basis;
  final String text;
}

/// One action of the plan. `href` is a WEB path and must be mapped to a native route by the
/// action router, never opened as is [API 2.4].
class PlanAction {
  const PlanAction({
    required this.kind,
    required this.title,
    this.href,
    this.reason,
    this.duration,
    this.availability,
    this.evidence = const [],
    this.facts = const [],
  });

  factory PlanAction.fromJson(Json j) => PlanAction(
        kind: asStringOr(j['kind'], ''),
        title: asStringOr(j['title'], ''),
        href: asString(j['href']),
        reason: asString(j['reason']),
        duration: asString(j['duration']),
        availability: asString(j['availability']),
        evidence: asStringList(j['evidence']),
        facts: [for (final f in asJsonList(j['facts'])) PlanFact.fromJson(f)],
      );

  /// `resume_session`, `fresh_check`, `repair`, `investigate`, `baseline`, `ordinary_practice`.
  final String kind;
  final String title;
  final String? href;
  final String? reason;
  final String? duration;
  final String? availability;
  final List<String> evidence;
  final List<PlanFact> facts;
}

class PlanTonight {
  const PlanTonight({required this.state, this.sessionId, this.minutes, this.completedAt, this.reviewMinutes});

  factory PlanTonight.fromJson(Json j) => PlanTonight(
        state: asStringOr(j['state'], 'ready'),
        sessionId: asString(j['sessionId']),
        minutes: asInt(j['minutes']),
        completedAt: asDate(j['completedAt']),
        reviewMinutes: asInt(j['reviewMinutes']),
      );

  /// `ready` or `recorded`.
  final String state;
  final String? sessionId;
  final int? minutes;
  final DateTime? completedAt;
  final int? reviewMinutes;
}

/// `GET /api/learning/plan?minutes=` [API 2.4]. The server decides the plan; the app renders it.
class LearningPlan {
  const LearningPlan({
    required this.primary,
    this.alternatives = const [],
    this.minutes,
    this.sequence = const [],
    this.study,
    this.studyState,
    this.pathwayState = 'blocked_content',
    this.recordState = 'ready',
    this.ordinaryAttemptCount = 0,
    this.tonight,
    this.episodeCount = 0,
    this.milestones = const [],
  });

  factory LearningPlan.fromJson(Json j) => LearningPlan(
        primary: PlanAction.fromJson(asJson(j['primary'])),
        alternatives: [for (final a in asJsonList(j['alternatives'])) PlanAction.fromJson(a)],
        minutes: asInt(j['minutes']),
        sequence: asJsonList(j['sequence']),
        study: j['study'] is Map ? asJson(j['study']) : null,
        studyState: asString(j['studyState']),
        pathwayState: asStringOr(j['pathwayState'], 'blocked_content'),
        recordState: asStringOr(j['recordState'], 'ready'),
        ordinaryAttemptCount: asInt(j['ordinaryAttemptCount']) ?? 0,
        tonight: j['tonight'] is Map ? PlanTonight.fromJson(asJson(j['tonight'])) : null,
        episodeCount: j['episodes'] is List ? (j['episodes'] as List).length : 0,
        milestones: asJsonList(j['milestones']),
      );

  final PlanAction primary;
  final List<PlanAction> alternatives;

  /// The minutes the server honoured (10, 20 or 30).
  final int? minutes;
  final List<Map<String, dynamic>> sequence;
  final Map<String, dynamic>? study;
  final String? studyState;

  /// `available` or `blocked_content`. Fresh checks are not offered while blocked.
  final String pathwayState;

  /// `ready` or `unavailable`.
  final String recordState;
  final int ordinaryAttemptCount;
  final PlanTonight? tonight;
  final int episodeCount;
  final List<Map<String, dynamic>> milestones;

  bool get isBlockedContent => pathwayState == 'blocked_content';
  bool get recordUnavailable => recordState == 'unavailable';

  /// Due flash cards from the study block, when the plan carries one.
  int? get dueCards => asInt(study?['dueCards']);
}
