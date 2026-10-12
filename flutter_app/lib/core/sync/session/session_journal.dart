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
/// - an event is written to the database before it is returned, so the UI shows an answer
///   selected only once it is on the phone,
/// - the log only grows, so every resend is a byte-identical prefix of the next one.
class SessionJournal {
  SessionJournal._(this._db, this.userId, this.sessionId, List<SessionEvent> events, DateTime Function() now)
      : _events = events,
        _now = now;

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
    final rows = await (db.select(db.answerJournal)
          ..where((t) => t.userId.equals(userId) & t.sessionId.equals(sessionId))
          ..orderBy([(t) => OrderingTerm.asc(t.seq)]))
        .get();
    final events = [
      for (final r in rows) SessionEvent(seq: r.seq, qid: r.qid, type: r.type, at: r.atMs, answer: r.answer),
    ];
    return SessionJournal._(db, userId, sessionId, events, now ?? DateTime.now);
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

  /// Records that the student is now looking at [qid]. Returns null when the log is nearly
  /// full and visits are no longer recorded.
  Future<SessionEvent?> recordVisit(String qid, SessionClock clock) => _append(qid, SessionEvent.visit, null, clock);

  /// Records an answer, or a cleared answer when [answer] is null. Returns null only when the
  /// log is completely full.
  Future<SessionEvent?> recordAnswer(String qid, int? answer, SessionClock clock) => _append(qid, SessionEvent.answerType, answer, clock);

  Future<SessionEvent?> _append(String qid, String type, int? answer, SessionClock clock) {
    // One writer at a time keeps seq and at strictly ordered even with rapid taps.
    final result = Completer<SessionEvent?>();
    _queue = _queue.then((_) async {
      try {
        final count = _events.length;
        final isAnswer = type == SessionEvent.answerType;
        if (count >= maxEvents || (!isAnswer && count >= visitCutoff)) {
          result.complete(null);
          return;
        }
        final event = SessionEvent(
          seq: lastSeq + 1,
          qid: qid,
          type: type,
          at: clock.eventAt(lastAt),
          answer: isAnswer ? answer : null,
        );
        await _db.into(_db.answerJournal).insert(
              AnswerJournalCompanion.insert(
                userId: userId,
                sessionId: sessionId,
                seq: event.seq,
                qid: event.qid,
                type: event.type,
                atMs: event.at,
                answer: Value(event.answer),
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
                  answer: Value(e.answer),
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
  List<SessionEvent> eventsWithin(int durationMs) => [for (final e in _events) if (e.at <= durationMs) e];
}
