import 'json_helpers.dart';
import 'question.dart';

/// Whether this build sends the slice-2 session events (`mark`, `strike`, `away`, `back`, `end`
/// and `via` on a visit; Mistake Lab v4 spec 6). An older server refuses a log that carries them;
/// the app then sends the same save or submit again with the event set that server knows and keeps
/// to it for the rest of its run (`OldServerFallbackApi`), so no paper is lost to the ship order.
/// Build with `--dart-define=MOCKMOB_CAPTURE_V2=false` to record none of them at all.
const bool kRichSessionEvents = bool.fromEnvironment('MOCKMOB_CAPTURE_V2', defaultValue: true);

/// How a question was reached (`via` on a visit event).
abstract final class SessionVia {
  static const next = 'next';
  static const previous = 'previous';
  static const palette = 'palette';
  static const swipe = 'swipe';
  static const resume = 'resume';

  /// Shown with its passage set without being moved to (the website's set page; the app reads it
  /// in a server log and never writes it). Counts as opened, never as time (paper_trace rule 5).
  static const set = 'set';

  /// The submit page opened over the question named: until the next visit or answer no question is
  /// on screen, so the time spent deciding to submit is credited to none (paper_trace rule 6).
  static const sheet = 'sheet';

  /// Every value, in the order the phone's journal stores them (an index): new values go at the end.
  static const all = [next, previous, palette, swipe, resume, set, sheet];

  /// The values the first slice-2 server knew. A server that refuses a later one is sent the visit
  /// without it (OldServerFallbackApi).
  static const first = [next, previous, palette, swipe, resume];
}

/// How a session ended (`reason` on the `end` event, and `endedBy` on the submit).
abstract final class SessionEndReason {
  static const submit = 'submit';
  static const timeUp = 'time_up';
  static const ntaStrikes = 'nta_strikes';

  static const all = [submit, timeUp, ntaStrikes];
}

/// One entry of the cumulative event log sent with `PUT /api/sessions` and the submit
/// [API 3, 2.7]. `at` is integer milliseconds on the session clock; `qid` is always the question
/// on screen.
///
/// The types and their own fields, exactly as the server's `scoreSession` accepts them:
/// `answer {answer}`, `visit {via?}`, `mark {marked}`, `strike {option, on}`, `away`, `back` and
/// `end {reason}`. Marks, strike-outs, time away and the end are data for the result's analysis
/// after submit; none of them changes the answer or the score.
class SessionEvent {
  const SessionEvent({
    required this.seq,
    required this.qid,
    required this.type,
    required this.at,
    this.answer,
    this.via,
    this.marked,
    this.option,
    this.on,
    this.reason,
  });

  factory SessionEvent.fromJson(Json j) {
    final type = asStringOr(j['type'], 'visit');
    return SessionEvent(
      seq: asInt(j['seq']) ?? 0,
      qid: asStringOr(j['qid'], ''),
      type: type,
      at: asInt(j['at']) ?? 0,
      answer: type == answerType ? asInt(j['answer']) : null,
      via: type == visit && SessionVia.all.contains(j['via']) ? j['via'] as String : null,
      marked: type == mark ? asBool(j['marked']) : null,
      option: type == strike ? asInt(j['option']) : null,
      on: type == strike ? asBool(j['on']) : null,
      reason: type == end && SessionEndReason.all.contains(j['reason']) ? j['reason'] as String : null,
    );
  }

  static const visit = 'visit';
  static const answerType = 'answer';
  static const mark = 'mark';
  static const strike = 'strike';
  static const away = 'away';
  static const back = 'back';
  static const end = 'end';

  final int seq;
  final String qid;
  final String type;
  final int at;

  /// Option index, or null for a cleared answer. Only written for `answer` events.
  final int? answer;

  /// `visit` only: how the question was reached ([SessionVia]), or null (the paper's first visit).
  final String? via;

  /// `mark` only: marked for review (true) or the mark removed (false).
  final bool? marked;

  /// `strike` only: the served option index crossed out ([on] true) or brought back.
  final int? option;
  final bool? on;

  /// `end` only: [SessionEndReason].
  final String? reason;

  bool get isAnswer => type == answerType;

  /// Key order is fixed (seq, qid, type, at, then the type's own fields) so a resent prefix is
  /// byte-identical.
  Json toJson() => {
        'seq': seq,
        'qid': qid,
        'type': type,
        'at': at,
        if (isAnswer) 'answer': answer,
        if (type == visit && via != null) 'via': via,
        if (type == mark) 'marked': marked ?? false,
        if (type == strike) ...{'option': option ?? 0, 'on': on ?? false},
        if (type == end) 'reason': reason ?? SessionEndReason.submit,
      };

  @override
  bool operator ==(Object other) =>
      other is SessionEvent &&
      other.seq == seq &&
      other.qid == qid &&
      other.type == type &&
      other.at == at &&
      other.answer == answer &&
      other.via == via &&
      other.marked == marked &&
      other.option == option &&
      other.on == on &&
      other.reason == reason;

  @override
  int get hashCode => Object.hash(seq, qid, type, at, answer, via, marked, option, on, reason);
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
    this.message,
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
        message: asString(j['message']),
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

  /// The server's own sentence about this paper (for example why an NTA paper is short).
  final String? message;

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
