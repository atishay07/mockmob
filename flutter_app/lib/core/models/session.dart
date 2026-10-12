import 'json_helpers.dart';
import 'question.dart';

/// One entry of the cumulative event log sent with `PUT /api/sessions` and the submit
/// [API 3, 2.7]. `at` is integer milliseconds on the session clock.
class SessionEvent {
  const SessionEvent({required this.seq, required this.qid, required this.type, required this.at, this.answer});

  factory SessionEvent.fromJson(Json j) => SessionEvent(
        seq: asInt(j['seq']) ?? 0,
        qid: asStringOr(j['qid'], ''),
        type: asStringOr(j['type'], 'visit'),
        at: asInt(j['at']) ?? 0,
        answer: asInt(j['answer']),
      );

  static const visit = 'visit';
  static const answerType = 'answer';

  final int seq;
  final String qid;
  final String type;
  final int at;

  /// Option index, or null for a cleared answer. Only written for `answer` events.
  final int? answer;

  bool get isAnswer => type == answerType;

  /// Key order is fixed (seq, qid, type, at, answer) so a resent prefix is byte-identical.
  Json toJson() => {
        'seq': seq,
        'qid': qid,
        'type': type,
        'at': at,
        if (isAnswer) 'answer': answer,
      };

  @override
  bool operator ==(Object other) =>
      other is SessionEvent && other.seq == seq && other.qid == qid && other.type == type && other.at == at && other.answer == answer;

  @override
  int get hashCode => Object.hash(seq, qid, type, at, answer);
}

class SessionMeta {
  const SessionMeta({
    required this.sessionId,
    this.mode,
    this.requestedCount,
    this.learningPurpose,
    this.contentEvidence,
    this.sessionTicket,
    this.storage,
    this.raw = const {},
  });

  factory SessionMeta.fromJson(Json j) => SessionMeta(
        sessionId: asStringOr(j['sessionId'], ''),
        mode: asString(j['mode']),
        requestedCount: asInt(j['requestedCount']),
        learningPurpose: asString(j['learningPurpose']),
        contentEvidence: asString(j['contentEvidence']),
        sessionTicket: asString(j['sessionTicket']),
        storage: asString(j['storage']),
        raw: j,
      );

  final String sessionId;
  final String? mode;
  final int? requestedCount;
  final String? learningPurpose;
  final String? contentEvidence;

  /// Present in ticket mode: the server keeps no copy, so the app holds this and sends it back.
  final String? sessionTicket;
  final String? storage;

  /// Every field as received, kept so the whole meta can be echoed back on submit.
  final Json raw;

  Json toJson() => raw;
}

/// Public session view returned by `POST /api/sessions` (start or resume) [API 2.7].
class SessionView {
  const SessionView({
    required this.id,
    required this.startedAt,
    required this.expiresAt,
    required this.serverNowMs,
    required this.questions,
    required this.meta,
    this.state,
    this.events = const [],
  });

  factory SessionView.fromJson(Json j) {
    final meta = SessionMeta.fromJson(asJson(j['meta']));
    return SessionView(
      id: asStringOr(j['id'], meta.sessionId),
      startedAt: asDate(j['startedAt']) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      expiresAt: asDate(j['expiresAt']) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      serverNowMs: asInt(j['serverNow']) ?? DateTime.now().millisecondsSinceEpoch,
      state: asString(j['state']),
      questions: [for (final q in asJsonList(j['questions'])) SessionQuestion.fromJson(q)],
      meta: meta,
      events: [for (final e in asJsonList(j['events'])) SessionEvent.fromJson(e)],
    );
  }

  final String id;
  final DateTime startedAt;
  final DateTime expiresAt;

  /// Server wall clock when the response was built, epoch milliseconds.
  final int serverNowMs;
  final String? state;
  final List<SessionQuestion> questions;
  final SessionMeta meta;

  /// Events the server already holds (durable resume only).
  final List<SessionEvent> events;

  /// Ticket mode: no server copy, no PUT sync [API 2.7].
  bool get isTicketMode => meta.sessionTicket != null && meta.sessionTicket!.isNotEmpty;

  Json toJson() => {
        'id': id,
        'startedAt': startedAt.toUtc().toIso8601String(),
        'expiresAt': expiresAt.toUtc().toIso8601String(),
        'serverNow': serverNowMs,
        'state': state,
        'questions': [for (final q in questions) q.toJson()],
        'meta': meta.toJson(),
      };
}
