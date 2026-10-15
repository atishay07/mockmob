import 'dart:async';

import 'package:drift/drift.dart';

import '../../models/session.dart';
import '../../storage/app_database.dart';
import 'session_clock.dart';

/// The append-only event log of one session, stored in `answer_journal` (design spec 5.5).
///
/// Rules from contract section 3, enforced here and unit tested:
/// - `seq` starts at 1 and rises by 1, with no gaps, up to 5,000 events,
/// - `at` is an integer number of milliseconds on the session clock and never decreases,
/// - an event is returned only once it is in the database; the engine shows a tapped answer
///   at once and rolls it back if that write fails,
/// - the log only grows, so every resend is a byte-identical prefix of the next one.
class SessionJournal {
  SessionJournal._(this._db, this.userId, this.sessionId, List<SessionEvent> events, DateTime Function() now) : _events = events, _now = now;

  /// Hard server limit on events in one session.
  static const maxEvents = 5000;

  /// Past this many events only `answer` events are recorded, so answers always have room.
  static const visitCutoff = 4500;

  final AppDatabase _db;
  final String userId;
  final String sessionId;
  final DateTime Function() _now;
  final List<SessionEvent> _events;
  Future<void> _queue = Future.value();

  /// Loads the session's stored events.
  static Future<SessionJournal> open(AppDatabase db, {required String userId, required String sessionId, DateTime Function()? now}) async {
    final rows =
        await (db.select(db.answerJournal)
              ..where((t) => t.userId.equals(userId) & t.sessionId.equals(sessionId))
              ..orderBy([(t) => OrderingTerm.asc(t.seq)]))
            .get();
    final events = [for (final r in rows) decodeRow(seq: r.seq, qid: r.qid, type: r.type, atMs: r.atMs, stored: r.answer)];
    return SessionJournal._(db, userId, sessionId, events, now ?? DateTime.now);
  }

  // The journal table has one nullable integer per event (`answer`), so the fields of the newer
  // event types are packed into it rather than adding columns (no local schema change):
  //   answer  the option, null for a clear        visit  the via's index in [SessionVia.all], or null
  //   mark    1 marked, 0 removed                 strike option * 2 + (1 when crossed out)
  //   end     the reason's index in [SessionEndReason.all]      away, back  null
  // A row written before these types existed (a visit with null) reads back exactly as before.

  /// The integer stored for [e].
  static int? encodeStored(SessionEvent e) => switch (e.type) {
    SessionEvent.answerType => e.answer,
    SessionEvent.visit => e.via == null ? null : SessionVia.all.indexOf(e.via!),
    SessionEvent.mark => (e.marked ?? false) ? 1 : 0,
    SessionEvent.strike => (e.option ?? 0) * 2 + ((e.on ?? false) ? 1 : 0),
    SessionEvent.end => SessionEndReason.all.indexOf(e.reason ?? SessionEndReason.submit),
    _ => null,
  };

  /// The event a stored row holds.
  static SessionEvent decodeRow({required int seq, required String qid, required String type, required int atMs, int? stored}) {
    String? pick(List<String> values) => stored != null && stored >= 0 && stored < values.length ? values[stored] : null;
    return switch (type) {
      SessionEvent.answerType => SessionEvent(seq: seq, qid: qid, type: type, at: atMs, answer: stored),
      SessionEvent.visit => SessionEvent(seq: seq, qid: qid, type: type, at: atMs, via: pick(SessionVia.all)),
      SessionEvent.mark => SessionEvent(seq: seq, qid: qid, type: type, at: atMs, marked: stored == 1),
      SessionEvent.strike => SessionEvent(seq: seq, qid: qid, type: type, at: atMs, option: (stored ?? 0) ~/ 2, on: (stored ?? 0).isOdd),
      SessionEvent.end => SessionEvent(seq: seq, qid: qid, type: type, at: atMs, reason: pick(SessionEndReason.all) ?? SessionEndReason.submit),
      _ => SessionEvent(seq: seq, qid: qid, type: type, at: atMs),
    };
  }

  /// Every event so far, in order. Do not modify.
  List<SessionEvent> get events => List.unmodifiable(_events);

  int get lastSeq => _events.isEmpty ? 0 : _events.last.seq;
  int get lastAt => _events.isEmpty ? 0 : _events.last.at;

  /// The latest answer for each answered question. A cleared answer is not in the map.
  Map<String, int> get answers {
    final out = <String, int>{};
    for (final e in _events) {
      if (!e.isAnswer) continue;
      if (e.answer == null) {
        out.remove(e.qid);
      } else {
        out[e.qid] = e.answer!;
      }
    }
    return out;
  }

  /// Questions with an answer event the server has not acknowledged (a clear counts too).
  Set<String> unsyncedQuestionIds(int acknowledgedSequence) => {
    for (final e in _events)
      if (e.isAnswer && e.seq > acknowledgedSequence) e.qid,
  };

  /// How many questions had an answer as of event [seq]: the "31 answers sent before then"
  /// figure, counted from the journal up to `acknowledgedSequence`.
  int answeredCountThrough(int seq) {
    final answered = <String, bool>{};
    for (final e in _events) {
      if (e.seq > seq) break;
      if (e.isAnswer) answered[e.qid] = e.answer != null;
    }
    return answered.values.where((v) => v).length;
  }

  /// Completes when every write queued so far has finished (a failed write never fails the queue).
  Future<void> idle() => _queue;

  /// Records that the student is now looking at [qid], reached by [via] ([SessionVia]). Returns
  /// null when the log is nearly full and visits are no longer recorded.
  Future<SessionEvent?> recordVisit(String qid, SessionClock clock, {String? via}) => _append(
    clock,
    (seq, at) => SessionEvent(seq: seq, qid: qid, type: SessionEvent.visit, at: at, via: kRichSessionEvents && SessionVia.all.contains(via) ? via : null),
  );

  /// Records an answer, or a cleared answer when [answer] is null. Returns null only when the
  /// log is completely full.
  Future<SessionEvent?> recordAnswer(String qid, int? answer, SessionClock clock) =>
      _append(clock, (seq, at) => SessionEvent(seq: seq, qid: qid, type: SessionEvent.answerType, at: at, answer: answer));

  /// Records [qid] marked for review ([marked] true) or its mark removed.
  Future<SessionEvent?> recordMark(String qid, bool marked, SessionClock clock) =>
      _rich(clock, (seq, at) => SessionEvent(seq: seq, qid: qid, type: SessionEvent.mark, at: at, marked: marked));

  /// Records the served [option] of [qid] crossed out ([on] true) or brought back.
  Future<SessionEvent?> recordStrike(String qid, int option, bool on, SessionClock clock) =>
      _rich(clock, (seq, at) => SessionEvent(seq: seq, qid: qid, type: SessionEvent.strike, at: at, option: option, on: on));

  /// Records the app leaving the screen ([away] true) or coming back, with [qid] on screen.
  Future<SessionEvent?> recordPresence(String qid, SessionClock clock, {required bool away}) =>
      _rich(clock, (seq, at) => SessionEvent(seq: seq, qid: qid, type: away ? SessionEvent.away : SessionEvent.back, at: at));

  /// Records the end of the paper ([SessionEndReason]) with [qid] on screen. Its `at` never passes
  /// [maxAt] (the session length), so a time-up end lands on the paper's last moment and is not
  /// filtered out of the submit. Recorded until the log is completely full, like an answer.
  Future<SessionEvent?> recordEnd(String qid, String reason, SessionClock clock, {required int maxAt}) => _rich(
    clock,
    (seq, at) => SessionEvent(seq: seq, qid: qid, type: SessionEvent.end, at: at > maxAt && maxAt >= lastAt ? maxAt : at, reason: reason),
    essential: true,
  );

  /// The newer event types, only in a build that sends them.
  Future<SessionEvent?> _rich(SessionClock clock, SessionEvent Function(int seq, int at) build, {bool essential = false}) =>
      kRichSessionEvents ? _append(clock, build, essential: essential) : Future<SessionEvent?>.value();

  Future<SessionEvent?> _append(SessionClock clock, SessionEvent Function(int seq, int at) build, {bool essential = false}) {
    // One writer at a time keeps seq and at strictly ordered even with rapid taps. The time is read
    // when the student acted, not when the queue reaches the write; it never goes below the last.
    final calledAt = clock.elapsedMs;
    final result = Completer<SessionEvent?>();
    _queue = _queue.then((_) async {
      try {
        final count = _events.length;
        final event = build(lastSeq + 1, calledAt < lastAt ? lastAt : calledAt);
        // Past the cutoff only answers (and the end) are recorded, so answers always have room.
        final keeps = event.isAnswer || essential;
        if (count >= maxEvents || (!keeps && count >= visitCutoff)) {
          result.complete(null);
          return;
        }
        await _db
            .into(_db.answerJournal)
            .insert(
              AnswerJournalCompanion.insert(
                userId: userId,
                sessionId: sessionId,
                seq: event.seq,
                qid: event.qid,
                type: event.type,
                atMs: event.at,
                answer: Value(encodeStored(event)),
                createdAtMs: _now().millisecondsSinceEpoch,
              ),
            );
        _events.add(event);
        result.complete(event);
      } on Object catch (error, stack) {
        result.completeError(error, stack);
      }
    });
    return result.future;
  }

  /// Replaces the whole log with the server's events (after an `EVENT_CONFLICT` the server's log
  /// wins and the runner rebuilds from it).
  Future<void> replaceWith(List<SessionEvent> events) {
    final done = Completer<void>();
    _queue = _queue.then((_) async {
      try {
        await _db.transaction(() async {
          await (_db.delete(_db.answerJournal)..where((t) => t.userId.equals(userId) & t.sessionId.equals(sessionId))).go();
          await _db.batch((b) {
            b.insertAll(_db.answerJournal, [
              for (final e in events)
                AnswerJournalCompanion.insert(
                  userId: userId,
                  sessionId: sessionId,
                  seq: e.seq,
                  qid: e.qid,
                  type: e.type,
                  atMs: e.at,
                  answer: Value(encodeStored(e)),
                  createdAtMs: _now().millisecondsSinceEpoch,
                ),
            ]);
          });
        });
        _events
          ..clear()
          ..addAll(events);
        done.complete();
      } on Object catch (error, stack) {
        done.completeError(error, stack);
      }
    });
    return done.future;
  }

  /// Events with `at <= durationMs`, as the submit sends them [API 3.9].
  List<SessionEvent> eventsWithin(int durationMs) => [
    for (final e in _events)
      if (e.at <= durationMs) e,
  ];
}
