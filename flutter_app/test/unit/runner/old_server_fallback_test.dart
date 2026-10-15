import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/old_server_fallback.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/sync/session/session_api.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';

/// Safe rollout of the slice-2 capture (Mistake Lab v4 spec 6, rollout order): the app sends the new
/// event types by default, and a server from before slice 2 refuses a log that carries them. These
/// tests run the real engine, journal, syncer and submitter against a fake of that older server and
/// check that no answer and no paper is lost, in the save and in the submit.
void main() {
  group('event set views', () {
    final log = [
      const SessionEvent(seq: 1, qid: 'q1', type: 'visit', at: 0),
      const SessionEvent(seq: 2, qid: 'q2', type: 'visit', at: 10, via: 'next'),
      const SessionEvent(seq: 3, qid: 'q2', type: 'mark', at: 11, marked: true),
      const SessionEvent(seq: 4, qid: 'q2', type: 'strike', at: 12, option: 1, on: true),
      const SessionEvent(seq: 5, qid: 'q2', type: 'answer', at: 13, answer: 2),
      const SessionEvent(seq: 6, qid: 'q2', type: 'away', at: 14),
      const SessionEvent(seq: 7, qid: 'q2', type: 'back', at: 20),
    ];

    test('the full set is the journal itself', () {
      final view = EventSetView.of(log, ServerEventSet.full);
      expect(view.events, log);
      expect(view.isWhole, isTrue);
      expect(view.journalSeqOf(5), 5);
    });

    test('an older set drops the new types and numbers the rest again without a gap', () {
      final marks = EventSetView.of(log, ServerEventSet.withMarks);
      expect([for (final e in marks.events) e.type], ['visit', 'visit', 'mark', 'answer']);
      expect([for (final e in marks.events) e.seq], [1, 2, 3, 4]);
      expect(marks.events[1].via, 'next', reason: 'via stays: an older server ignores it and may already hold it');
      expect(marks.events[3].toJson(), {'seq': 4, 'qid': 'q2', 'type': 'answer', 'at': 13, 'answer': 2});

      final oldest = EventSetView.of(log, ServerEventSet.answersAndVisits);
      expect([for (final e in oldest.events) e.type], ['visit', 'visit', 'answer']);
      expect([for (final e in oldest.events) e.seq], [1, 2, 3]);
      expect(oldest.isWhole, isFalse);
    });

    test('the server\'s acknowledgement maps back to the journal, dropped events counting as sent', () {
      final view = EventSetView.of(log, ServerEventSet.answersAndVisits);
      expect(view.journalSeqOf(0), 0);
      expect(view.journalSeqOf(1), 1);
      // The server holds visit, visit: the mark and the strike before the answer are not sent, and
      // the answer (journal seq 5) is still owed.
      expect(view.journalSeqOf(2), 4);
      // Everything sent is held: the away and back after it are never sent, so nothing is owed.
      expect(view.journalSeqOf(3), 7);
      // A server that holds more than this phone sent keeps its lead.
      expect(view.journalSeqOf(5), 9);
    });

    test('the view only grows as the journal grows, so the server\'s prefix always matches', () {
      for (final set in ServerEventSet.values) {
        for (var n = 1; n < log.length; n++) {
          final shorter = EventSetView.of(log.sublist(0, n), set).events;
          final longer = EventSetView.of(log.sublist(0, n + 1), set).events;
          expect(longer.take(shorter.length).toList(), shorter, reason: '$set at $n');
        }
      }
    });
  });

  group('one call at a time', () {
    late _OldServer server;
    late ServerEventSupport support;
    late OldServerFallbackApi api;
    final rich = [
      const SessionEvent(seq: 1, qid: 'q1', type: 'visit', at: 0),
      const SessionEvent(seq: 2, qid: 'q1', type: 'answer', at: 5, answer: 1),
      const SessionEvent(seq: 3, qid: 'q1', type: 'away', at: 6),
    ];

    setUp(() {
      server = _OldServer(types: {'answer', 'visit'});
      support = ServerEventSupport();
      api = OldServerFallbackApi(server, support: support);
    });

    test('a refusal with nothing to leave out is passed on unchanged, after one call', () async {
      server.refuseAll = true;
      final plain = rich.sublist(0, 2);
      await expectLater(api.putEvents(sessionId: 's', events: plain), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'invalid_event_sequence')));
      expect(server.calls, 1);
      expect(support.current, ServerEventSet.full);
    });

    test('a server that refuses the older set too is not taken for an old one', () async {
      server.refuseAll = true;
      await expectLater(api.putEvents(sessionId: 's', events: rich), throwsA(isA<ApiError>()));
      expect(server.calls, 2, reason: 'the full log, then the older set; the oldest would send the same events, so it is skipped');
      expect(support.serverIsOld, isFalse);
    });

    test('a retry that fails for another reason passes that reason on (offline backs off as always)', () async {
      server.failNextRetryWith = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await expectLater(api.putEvents(sessionId: 's', events: rich), throwsA(isA<ApiError>().having((e) => e.kind, 'kind', ApiErrorKind.network)));
      expect(support.serverIsOld, isFalse);
      // The next save tries again from the full set and is taken in the older one.
      expect(await api.putEvents(sessionId: 's', events: rich), 3);
      expect(support.current, ServerEventSet.withMarks);
    });

    test('other refusals (a conflict, an expired session) are never retried', () async {
      server.failNextWith = const ApiError(kind: ApiErrorKind.validation, code: 'EVENT_CONFLICT', status: 422);
      await expectLater(api.putEvents(sessionId: 's', events: rich), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'EVENT_CONFLICT')));
      expect(server.calls, 1);
    });

    test('once taught, every later call goes out in the older set at once', () async {
      expect(await api.putEvents(sessionId: 's', events: rich), 3);
      expect(server.calls, 2);
      final more = [...rich, const SessionEvent(seq: 4, qid: 'q1', type: 'back', at: 9), const SessionEvent(seq: 5, qid: 'q1', type: 'answer', at: 10, answer: 2)];
      expect(await api.putEvents(sessionId: 's', events: more), 5);
      expect(server.calls, 3, reason: 'one call, no refusal first');
      // A log that grew only by events the older set leaves out is not sent again.
      final idle = [...more, const SessionEvent(seq: 6, qid: 'q1', type: 'away', at: 11)];
      expect(await api.putEvents(sessionId: 's', events: idle), 6);
      expect(server.calls, 3);
      expect(server.storedTypes('s'), ['visit', 'answer', 'answer']);
      // No mark in the log, so the first older set already sends what this server knows.
      expect(support.current, ServerEventSet.withMarks);
    });

    test('a new server is sent every event, unchanged, and nothing is learned', () async {
      server = _OldServer(types: null);
      api = OldServerFallbackApi(server, support: support);
      expect(await api.putEvents(sessionId: 's', events: rich), 3);
      expect(server.calls, 1);
      expect(server.storedTypes('s'), ['visit', 'answer', 'away']);
      expect(support.current, ServerEventSet.full);
    });

    test('a slice-2 server from before the sheet via gets that visit without it, and keeps the rest', () async {
      server = _OldServer(types: null, knownVia: SessionVia.first.toSet());
      api = OldServerFallbackApi(server, support: support);
      final log = [
        ...rich,
        const SessionEvent(seq: 4, qid: 'q1', type: 'back', at: 7),
        const SessionEvent(seq: 5, qid: 'q1', type: 'visit', at: 8, via: 'sheet'),
      ];
      expect(await api.putEvents(sessionId: 's', events: log), 5);
      expect(server.refusals, 1);
      expect(support.current, ServerEventSet.firstVia);
      expect(server.storedTypes('s'), ['visit', 'answer', 'away', 'back', 'visit'], reason: 'time away and the end still reach it');
      final submitted = [...log, const SessionEvent(seq: 6, qid: 'q1', type: 'end', at: 9, reason: 'submit')];
      await api.submit(sessionId: 's', answers: {'q1': 1}, events: submitted);
      expect(server.lastSubmitEvents.last, {'seq': 6, 'qid': 'q1', 'type': 'end', 'at': 9, 'reason': 'submit'});
      expect(server.lastSubmitEvents[4], {'seq': 5, 'qid': 'q1', 'type': 'visit', 'at': 8});
      expect(server.refusals, 1);
    });

    test('a practice scored with its record refused teaches the older set for the next papers', () async {
      server.ticket = true;
      final attempt = await api.submit(sessionId: 's', sessionTicket: 't', answers: {'q1': 1}, events: rich);
      expect(attempt['id'], 's');
      expect(server.calls, 1, reason: 'a scored practice is never sent twice');
      expect(support.current, ServerEventSet.withMarks);
    });
  });

  group('the real engine against an older server', () {
    late AppDatabase db;
    late _OldServer server;
    late ServerEventSupport support;
    late SessionDraftRepository drafts;
    late SessionEngineServices services;
    late int mono;
    late int wall;

    SessionEngineServices servicesFor(SessionApi api) {
      DateTime now() => DateTime.fromMillisecondsSinceEpoch(wall);
      final scope = LocalScope(db, () => 'u1', now);
      drafts = SessionDraftRepository(scope);
      return SessionEngineServices(
        db: db,
        userId: 'u1',
        api: api,
        drafts: drafts,
        submitter: SessionSubmitter(
          api: api,
          drafts: drafts,
          pendingResults: PendingResultRepository(scope),
          cacheAttempt: (_) async {},
          appVersion: () => '1.0.0',
          now: now,
        ),
        clockFactory: () => SessionClock(monotonicMs: () => mono, wallMs: () => wall),
        timerFactory: ManualTimers().create,
        now: now,
      );
    }

    void useServer(Set<String>? types) {
      server = _OldServer(types: types);
      support = ServerEventSupport();
      services = servicesFor(OldServerFallbackApi(server, support: support));
    }

    setUp(() {
      db = newTestDb();
      mono = 0;
      wall = 1000000;
      useServer({'answer', 'visit'});
    });

    tearDown(() => db.close());

    Future<SessionEngine> start() => SessionEngine.start(
          services: services,
          view: sessionViewOf(count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000),
          subject: 'accountancy',
          mode: 'nta',
          count: 3,
          generationKey: 'gen-1',
          mockNumber: 7,
        );

    test('the oldest server: saves and the submit go through, every answer is held, the pill says saved', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 5000;
      await engine.goTo(1, via: SessionVia.next);
      mono = 8000;
      expect(await engine.selectAnswer('q2', 1), isTrue);
      mono = 9000;
      engine.setMarked('q2', true);
      mono = 10000;
      engine.recordStrike('q2', 3, true);
      await engine.flushAnswers();

      // Refused with the full log, refused with marks, taken with answers and visits.
      expect(server.refusals, 2);
      expect(support.current, ServerEventSet.answersAndVisits);
      expect(server.storedTypes('sess-1'), ['visit', 'visit', 'answer']);
      expect(engine.saveState.value.state, SaveState.saved);
      expect(engine.unsyncedQuestionIds, isEmpty);

      mono = 12000;
      await engine.onPaused();
      mono = 20000;
      await engine.onResumed();
      mono = 21000;
      expect(await engine.selectAnswer('q3', 0), isTrue);
      await engine.flushAnswers();
      expect(server.refusals, 2, reason: 'nothing is refused once the app knows the server');
      expect(engine.saveState.value.state, SaveState.saved);

      mono = 30000;
      final outcome = await engine.submit();
      expect(outcome, isA<SubmitReceived>());
      expect(server.refusals, 2);
      final sent = server.lastSubmitEvents;
      expect([for (final e in sent) e['type']], ['visit', 'visit', 'answer', 'answer']);
      expect([for (final e in sent) e['seq']], [1, 2, 3, 4]);
      expect(server.submittedAnswers, {'q2': 1, 'q3': 0});
    });

    test('the server that keeps marks: a mark it already holds is sent again as it is, so no conflict', () async {
      useServer({'answer', 'visit', 'mark'});
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 4000;
      await engine.selectAnswer('q1', 2);
      engine.setMarked('q1', true);
      await engine.flushAnswers();
      expect(server.refusals, 0);
      expect(server.storedTypes('sess-1'), ['visit', 'answer', 'mark']);

      mono = 6000;
      await engine.onPaused(); // the away is new to this server
      mono = 9000;
      await engine.onResumed();
      mono = 10000;
      await engine.goTo(2, via: SessionVia.palette);
      await engine.selectAnswer('q3', 1);
      await engine.flushAnswers();
      expect(server.refusals, 1);
      expect(server.conflicts, 0);
      expect(support.current, ServerEventSet.withMarks);
      expect(server.storedTypes('sess-1'), ['visit', 'answer', 'mark', 'visit', 'answer']);
      expect(engine.saveState.value.state, SaveState.saved);

      mono = 20000;
      expect(await engine.submit(), isA<SubmitReceived>());
      expect(server.submittedAnswers, {'q1': 2, 'q3': 1});
    });

    test('a paper whose saves never got through is still submitted (the submit itself steps down)', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      server.putsOffline = true;
      mono = 4000;
      await engine.selectAnswer('q1', 2);
      engine.recordStrike('q1', 0, true);
      mono = 6000;
      await engine.onPaused();
      mono = 9000;
      await engine.onResumed();
      await engine.flushAnswers();
      expect(server.storedTypes('sess-1'), isEmpty);
      mono = 12000;
      final outcome = await engine.submit();
      expect(outcome, isA<SubmitReceived>());
      expect(server.refusals, 1, reason: 'the submit with the full log, then the older set is taken');
      expect(server.storedTypes('sess-1'), ['visit', 'answer']);
      expect(server.submittedAnswers, {'q1': 2});
      expect(support.serverIsOld, isTrue);
    });

    test('a restart forgets the server, and the first save teaches it again without a conflict', () async {
      final engine = await start();
      mono = 4000;
      await engine.selectAnswer('q1', 2);
      mono = 5000;
      await engine.onPaused();
      mono = 7000;
      await engine.onResumed();
      mono = 8000;
      await engine.selectAnswer('q2', 0);
      await engine.flushAnswers();
      await engine.flushDraft();
      engine.dispose();
      final stored = server.storedTypes('sess-1');

      // A new app run: nothing learned yet.
      support = ServerEventSupport();
      services = servicesFor(OldServerFallbackApi(server, support: support));
      final draft = await drafts.bySessionId('sess-1');
      mono = 9000;
      final again = await SessionEngine.restore(services: services, draft: draft!);
      addTearDown(again!.dispose);
      await again.flushAnswers();
      expect(server.conflicts, 0);
      expect(server.storedTypes('sess-1').take(stored.length), stored);
      expect(again.saveState.value.state, SaveState.saved);
      mono = 12000;
      expect(await again.submit(), isA<SubmitReceived>());
      expect(server.submittedAnswers, {'q1': 2, 'q2': 0});
    });

    test('a new server gets every event and the app never steps down', () async {
      useServer(null);
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 4000;
      await engine.selectAnswer('q1', 2);
      engine.recordStrike('q1', 0, true);
      mono = 5000;
      await engine.onPaused();
      mono = 6000;
      await engine.onResumed();
      mono = 7000;
      expect(await engine.submit(), isA<SubmitReceived>());
      expect(server.refusals, 0);
      expect(support.current, ServerEventSet.full);
      expect([for (final e in server.lastSubmitEvents) e['type']], ['visit', 'answer', 'strike', 'away', 'back', 'end']);
    });
  });
}

/// A fake of the server before slice 2 (`data/recovery.js` scoreSession and the
/// `record_recovery_events` function as they were): an event type it does not know refuses the
/// whole log with `invalid_event_sequence`; the stored log is an array, so a gap or a different
/// event at a stored position is `EVENT_CONFLICT`. [types] null is the slice-2 server (every type).
class _OldServer implements SessionApi {
  _OldServer({required this.types, this.knownVia});

  final Set<String>? types;

  /// A slice-2 server's own list of a visit's `via` values (null: it does not look at via).
  final Set<String>? knownVia;
  final Map<String, List<Map<String, Object?>>> _stored = {};
  int calls = 0;
  int refusals = 0;
  int conflicts = 0;
  bool refuseAll = false;
  bool offline = false;
  bool putsOffline = false;
  bool ticket = false;
  ApiError? failNextWith;
  ApiError? failNextRetryWith;
  List<Map<String, Object?>> lastSubmitEvents = const [];
  Map<String, int>? submittedAnswers;

  static const _refused = ApiError(kind: ApiErrorKind.validation, code: 'invalid_event_sequence', status: 422);
  static const _conflict = ApiError(kind: ApiErrorKind.validation, code: 'EVENT_CONFLICT', status: 422);
  static const _badVia = ApiError(kind: ApiErrorKind.validation, code: 'invalid_event_via', status: 422);

  List<String> storedTypes(String sessionId) => [for (final e in _stored[sessionId] ?? const <Map<String, Object?>>[]) e['type']! as String];

  void _validate(List<SessionEvent> events) {
    var last = 0;
    var lastAt = 0;
    for (final e in events) {
      if (refuseAll || e.seq <= last || e.at < lastAt || (types != null && !types!.contains(e.type))) {
        refusals++;
        throw _refused;
      }
      if (knownVia != null && e.type == 'visit' && e.via != null && !knownVia!.contains(e.via)) {
        refusals++;
        throw _badVia;
      }
      last = e.seq;
      lastAt = e.at;
    }
  }

  int _record(String sessionId, List<SessionEvent> events) {
    final stored = _stored.putIfAbsent(sessionId, () => []);
    for (final e in events) {
      final json = e.toJson();
      if (e.seq <= stored.length) {
        if (jsonEncode(stored[e.seq - 1]) != jsonEncode(json)) {
          conflicts++;
          throw _conflict;
        }
        continue;
      }
      if (e.seq != stored.length + 1) {
        conflicts++;
        throw _conflict;
      }
      stored.add(json);
    }
    return stored.isEmpty ? 0 : stored.last['seq']! as int;
  }

  void _gate() {
    calls++;
    if (offline) throw const ApiError(kind: ApiErrorKind.network, code: 'network');
    final next = failNextWith;
    if (next != null) {
      failNextWith = null;
      throw next;
    }
    if (calls > 1) {
      final retry = failNextRetryWith;
      if (retry != null) {
        failNextRetryWith = null;
        throw retry;
      }
    }
  }

  @override
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events}) async {
    if (putsOffline) throw const ApiError(kind: ApiErrorKind.network, code: 'network');
    _gate();
    _validate(events);
    return _record(sessionId, events);
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
    _gate();
    lastSubmitEvents = [for (final e in events) e.toJson()];
    if (ticket) {
      // A practice the server holds no copy of is scored either way; a refused log is only marked.
      var telemetry = 'self_reported';
      try {
        _validate(events);
      } on ApiError {
        telemetry = 'invalid';
      }
      submittedAnswers = answers;
      return {
        'id': sessionId,
        'selectionMeta': {
          'recovery': {'telemetry': telemetry},
        },
      };
    }
    _validate(events);
    _record(sessionId, events);
    // A full or NTA paper is scored from the answers in the stored log.
    final held = <String, int>{};
    for (final e in _stored[sessionId] ?? const <Map<String, Object?>>[]) {
      if (e['type'] != 'answer') continue;
      final a = e['answer'];
      if (a is int) {
        held[e['qid']! as String] = a;
      } else {
        held.remove(e['qid']);
      }
    }
    submittedAnswers = held;
    return {
      'id': sessionId,
      'selectionMeta': {
        'recovery': {'telemetry': 'self_reported'},
      },
    };
  }

  @override
  Future<SessionView> resume(String sessionId) async => throw const ApiError(kind: ApiErrorKind.network, code: 'network');

  @override
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId, {String? forUserId}) async => null;
}
