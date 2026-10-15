import '../../api/api_error.dart';
import '../../models/session.dart';
import 'session_api.dart';

/// The event sets a server may take, from this build's own down to the oldest.
///
/// The slice-2 capture adds `strike`, `away`, `back` and `end` (Mistake Lab v4 spec 6). A server
/// from before it refuses the whole log with `invalid_event_sequence` when it sees one of them: the
/// in-progress save is refused and, on a full or NTA paper, so is the submit. A slice-2 server that
/// predates a `via` value refuses it with `invalid_event_via` the same way. So the fallback steps
/// down one set at a time:
///
/// - [full]: everything this build writes.
/// - [firstVia]: every type, with a visit's `via` only from the first slice-2 values
///   ([SessionVia.first]); a later one (the submit page's `sheet`) is left off the visit.
/// - [withMarks]: `answer`, `visit` and `mark`, the server that keeps marks for review.
/// - [answersAndVisits]: `answer` and `visit` only, the set this app sent before slice 2.
///
/// In the two oldest sets `via` stays on a visit as it is: those servers ignore fields they do not
/// know, and a visit they already stored with its `via` must be sent again byte for byte, or the
/// server would see a different log (`EVENT_CONFLICT`).
enum ServerEventSet {
  full,
  firstVia,
  withMarks,
  answersAndVisits;

  /// Whether an event of [type] goes out at this level.
  bool keeps(String type) => switch (this) {
        ServerEventSet.full || ServerEventSet.firstVia => true,
        ServerEventSet.withMarks => type == SessionEvent.answerType || type == SessionEvent.visit || type == SessionEvent.mark,
        ServerEventSet.answersAndVisits => type == SessionEvent.answerType || type == SessionEvent.visit,
      };

  /// The `via` a visit goes out with at this level.
  String? viaOf(SessionEvent e) => this == ServerEventSet.firstVia && !SessionVia.first.contains(e.via) ? null : e.via;
}

/// What this app has learned about the server since it started: the richest event set it
/// accepted after refusing a richer one. Remembered for the rest of the app's run, so every later
/// save and submit goes straight to that set (one call, not a refusal and a retry each time).
/// Nothing is stored on the phone: after a restart the first refused call teaches it again.
class ServerEventSupport {
  ServerEventSupport();

  /// The one the app uses. Tests make their own.
  static final ServerEventSupport shared = ServerEventSupport();

  ServerEventSet _set = ServerEventSet.full;

  /// The set the next call starts with.
  ServerEventSet get current => _set;

  /// True once a server refused this build's events and took an older set.
  bool get serverIsOld => _set != ServerEventSet.full;

  /// Remembers that the server took [accepted] after refusing a richer set. Never steps back up.
  void learn(ServerEventSet accepted) {
    if (accepted.index > _set.index) _set = accepted;
  }
}

/// The log as one event set sends it: the events that set keeps, numbered again from the first
/// event's own `seq` without gaps (the server stores the log as an array and refuses a gap).
///
/// The phone's journal is append-only, and so is this view of it: an event the set drops is never
/// sent, so every later view starts with the one before it, and the server's stored prefix still
/// matches. Up to the first dropped event the numbers are the journal's own.
class EventSetView {
  EventSetView._(this.events, this._kept, this._source);

  factory EventSetView.of(List<SessionEvent> source, ServerEventSet set) {
    if (set == ServerEventSet.full || source.isEmpty) return EventSetView._(source, source, source);
    final kept = [for (final e in source) if (set.keeps(e.type)) e];
    final base = source.first.seq;
    return EventSetView._(
      [
        for (var i = 0; i < kept.length; i++)
          SessionEvent(
            seq: base + i,
            qid: kept[i].qid,
            type: kept[i].type,
            at: kept[i].at,
            answer: kept[i].answer,
            via: set.viaOf(kept[i]),
            marked: kept[i].marked,
            option: kept[i].option,
            on: kept[i].on,
            reason: kept[i].reason,
          ),
      ],
      kept,
      source,
    );
  }

  /// What is sent.
  final List<SessionEvent> events;
  final List<SessionEvent> _kept;
  final List<SessionEvent> _source;

  /// True when this view leaves nothing out.
  bool get isWhole => _kept.length == _source.length;

  /// The server's `acknowledgedSequence` (in this view's numbers) as the journal's `seq`. Events
  /// this view leaves out are never sent, so they count as acknowledged once everything around
  /// them is: the save pill and the unsent dots follow answers, never a dropped trace event.
  int journalSeqOf(int ack) {
    if (identical(events, _source) || _source.isEmpty) return ack;
    final base = _source.first.seq;
    final held = ack - base + 1; // events of this view the server holds
    if (held <= 0) return _kept.isEmpty ? ack : _kept.first.seq - 1;
    if (held >= _kept.length) return _source.last.seq + (held - _kept.length);
    return _kept[held].seq - 1;
  }
}

/// A [SessionApi] that never loses a paper to a server older than this build's capture.
///
/// When the server refuses a save or a submit with `invalid_event_sequence` (or `invalid_event_via`)
/// and the log holds events an older server does not know, the same call is sent again with the next
/// older event set
/// ([ServerEventSet]), and the set the server took is remembered for the rest of the app's run
/// ([ServerEventSupport]). The student sees nothing of this: answers, visits and the score are the
/// same, and only the slice-2 trace (time away, strike-outs, the end) stays on the phone.
///
/// A refusal is passed on unchanged when there is nothing older to try, or when the older set is
/// refused too: then it was not about the event types, and the caller handles it as before.
class OldServerFallbackApi implements SessionApi {
  OldServerFallbackApi(this.inner, {ServerEventSupport? support}) : support = support ?? ServerEventSupport.shared;

  final SessionApi inner;
  final ServerEventSupport support;

  /// The codes an older server refuses what it does not know with: an event type (before slice 2)
  /// and a visit's `via` (a slice-2 server before the submit page's `sheet`).
  static const refusedCodes = {'invalid_event_sequence', 'invalid_event_via'};

  /// Per session: the last view the server took and its reply, so a log that grew only by events
  /// the server's set leaves out (a strike-out, time away) is not sent again for nothing.
  final Map<String, (ServerEventSet, SessionEvent, int, int)> _lastTaken = {};

  @override
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events}) async {
    var set = support.current;
    var refused = false;
    while (true) {
      final view = EventSetView.of(events, set);
      final last = _lastTaken[sessionId];
      if (set != ServerEventSet.full && last != null && view.events.isNotEmpty && last.$1 == set && last.$3 == view.events.length && last.$2 == view.events.last) {
        // The server already holds exactly this view.
        return view.journalSeqOf(last.$4);
      }
      try {
        final ack = await inner.putEvents(sessionId: sessionId, events: view.events);
        if (refused) support.learn(set);
        if (view.events.isNotEmpty) _lastTaken[sessionId] = (set, view.events.last, view.events.length, ack);
        return view.journalSeqOf(ack);
      } on ApiError catch (e) {
        final next = _olderSet(e, events, set);
        if (next == null) rethrow;
        refused = true;
        set = next;
      }
    }
  }

  @override
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
    String? forUserId,
    Map<String, Object?>? meta,
  }) async {
    var set = support.current;
    var refused = false;
    while (true) {
      try {
        final attempt = await inner.submit(
          sessionId: sessionId,
          sessionTicket: sessionTicket,
          answers: answers,
          events: EventSetView.of(events, set).events,
          forUserId: forUserId,
          meta: meta,
        );
        if (refused) {
          support.learn(set);
        } else if (_recordRefused(attempt)) {
          // A paper the server keeps no copy of (practice) and an ordinary bank paper are scored even
          // when an older server refuses their log: it only marks the record `invalid`. That submit
          // cannot be sent again, but the rest of this run's papers go out with the older set.
          final older = _nextSet(events, set);
          if (older != null) support.learn(older);
        }
        return attempt;
      } on ApiError catch (e) {
        final next = _olderSet(e, events, set);
        if (next == null) rethrow;
        refused = true;
        set = next;
      }
    }
  }

  @override
  Future<SessionView> resume(String sessionId) => inner.resume(sessionId);

  @override
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId, {String? forUserId}) => inner.fetchAttempt(attemptId, forUserId: forUserId);

  /// The next older set to try after [e], or null when [e] is not a server refusing an event type
  /// (offline, a conflict, an expired session: the caller handles those as always), or when no older
  /// set would send anything different. A set that sends the same events as the one just refused is
  /// skipped, so a log with nothing to leave out is never sent twice.
  ServerEventSet? _olderSet(ApiError e, List<SessionEvent> events, ServerEventSet set) {
    if (e.kind != ApiErrorKind.validation || !refusedCodes.any(e.hasCode)) return null;
    return _nextSet(events, set);
  }

  /// The first set older than [set] that sends something different of [events], or null.
  static ServerEventSet? _nextSet(List<SessionEvent> events, ServerEventSet set) {
    final sent = EventSetView.of(events, set).events;
    for (var i = set.index + 1; i < ServerEventSet.values.length; i++) {
      final older = ServerEventSet.values[i];
      final view = EventSetView.of(events, older).events;
      if (view.length != sent.length) return older;
      for (var j = 0; j < view.length; j++) {
        if (view[j] != sent[j]) return older;
      }
    }
    return null;
  }

  /// The scored attempt says its event log was refused (`selectionMeta.recovery.telemetry`).
  static bool _recordRefused(Map<String, dynamic> attempt) {
    final meta = attempt['selectionMeta'];
    final recovery = meta is Map ? meta['recovery'] : null;
    return recovery is Map && recovery['telemetry'] == 'invalid';
  }
}
