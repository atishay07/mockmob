import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/sync_providers.dart';
import 'package:mockmob/features/practice/data/open_paper.dart';
import 'package:mockmob/features/practice/data/practice_notes.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/pending_start.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';

/// A paper the phone may have opened and never heard back about (v15 walk, credits): the start key
/// keeps what was asked for and lives as long as the paper, Today and Practice offer to continue it,
/// asking again names the same key, and a credit-spending start waits for a paper that is open.
void main() {
  late AppDatabase db;
  late FakeHttpAdapter http;
  late FakeSessionApi sessionApi;
  late SessionDraftRepository drafts;
  late PracticeNotes notes;
  late int wall;
  late SessionEngineServices services;
  late ApiClient api;
  final engines = <SessionEngine>[];
  var changes = 0;

  final mock = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy');
  final quick = PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy');

  /// The server's answer for a paper opened at the phone's clock now, [minutes] long.
  FakeReply viewReply({int count = 50, String id = 'sess-9', int minutes = 60, List<Map<String, dynamic>>? events, String mode = 'full'}) {
    final json = sessionViewJson(id: id, count: count, startedAt: wall, expiresAt: wall + minutes * 60000, serverNow: wall, events: events);
    (json['meta'] as Map<String, dynamic>)['mode'] = mode;
    return FakeReply(200, json);
  }

  PracticeStarter newStarter() => PracticeStarter(
    api: api,
    drafts: drafts,
    userId: () => 'u1',
    startEngine: (StartSessionArgs args) async {
      final engine = await SessionEngine.start(
        services: services,
        view: args.view,
        subject: args.subject,
        mode: args.mode,
        count: args.count,
        generationKey: args.generationKey,
        chapter: args.chapter,
        mockNumber: args.mockNumber,
        serverEvents: args.serverEvents,
      );
      engines.add(engine);
      return engine;
    },
    rememberSession: (id, s) => notes.write(id, chapter: s.chapterLabel, mode: s.mode.apiMode),
    onPendingChanged: () => changes++,
  );

  late PracticeStarter starter;

  setUp(() {
    db = newTestDb();
    http = FakeHttpAdapter();
    sessionApi = FakeSessionApi();
    wall = 2000000;
    changes = 0;
    final scope = LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall));
    drafts = SessionDraftRepository(scope);
    notes = PracticeNotes(scope);
    services = SessionEngineServices(
      db: db,
      userId: 'u1',
      api: sessionApi,
      drafts: drafts,
      submitter: SessionSubmitter(
        api: sessionApi,
        drafts: drafts,
        pendingResults: PendingResultRepository(scope),
        cacheAttempt: (_) async {},
        now: () => DateTime.fromMillisecondsSinceEpoch(wall),
      ),
      clockFactory: () => SessionClock(monotonicMs: () => 0, wallMs: () => wall),
      timerFactory: ManualTimers().create,
      now: () => DateTime.fromMillisecondsSinceEpoch(wall),
    );
    http.handler = (_) => viewReply();
    api = newApiClient(http);
    starter = newStarter();
  });

  tearDown(() async {
    engines.clear();
    await db.close();
  });

  Map<String, dynamic> bodyOf(int i) =>
      (http.requests[i].body is String ? jsonDecode(http.requests[i].body! as String) : http.requests[i].body) as Map<String, dynamic>;

  /// A start whose answer never came: the request left, the phone lost it.
  Future<void> startLost(PracticeSelection s, {PracticeQuote? quote, int? mockNumber}) async {
    final before = http.handler;
    http.handler = (_) => const FakeReply.network();
    final outcome = await starter.start(s, quote: quote, mockNumber: mockNumber);
    expect(outcome, isA<StartFailed>());
    http.handler = before;
  }

  OpenPaperResolver resolver({Future<SessionView> Function(String id)? verify, List<Subject>? catalog}) => OpenPaperResolver(
    drafts: drafts,
    verify: verify ?? (id) => sessionApi.resume(id),
    now: () => DateTime.fromMillisecondsSinceEpoch(wall),
    catalog: () => catalog,
  );

  group('the start key', () {
    test('keeps what the start asked for, and lists it until it has a draft', () async {
      await startLost(mock, mockNumber: 7);
      final stored = await drafts.pendingStarts();
      expect(stored, hasLength(1));
      expect(stored.single.draftKey, mock.draftKey('u1'));
      expect(stored.single.start['mode'], 'full');
      expect(stored.single.start['count'], 50);
      expect(stored.single.start['mockNumber'], 7);
      final pending = PendingStart.from(stored.single)!;
      expect(pending.selection.mode, PracticeMode.full);
      expect(pending.selection.subjectId, 'accountancy');
      expect(pending.mockNumber, 7);
      expect(pending.generationKey, bodyOf(0)['generationKey']);
    });

    test('a mock keeps its key for the hour the paper may be open, a quick set for its own length', () async {
      expect(PendingStart.windowFor(mock), const Duration(hours: 1, minutes: 2));
      expect(PendingStart.windowFor(quick), const Duration(minutes: 15), reason: 'never under the quarter hour a key always had');
      expect(PendingStart.windowFor(PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: 20)), const Duration(minutes: 22));
      expect(PendingStart.windowFor(PracticeSelection(mode: PracticeMode.smart, subjectId: 'accountancy', count: 20)), const Duration(minutes: 32));
    });

    test('a lost mock start asks for the same paper fifty minutes later, with the same key', () async {
      await startLost(mock, mockNumber: 7);
      wall += 50 * 60000;
      final outcome = await starter.start(mock);
      expect(outcome, isA<Started>());
      expect(bodyOf(1)['generationKey'], bodyOf(0)['generationKey'], reason: 'the same key is the same paper: the server charges once');
      // A repeat of a key is the phone opening a paper it began: the mock keeps its number.
      expect((await drafts.bySessionId('sess-9'))!.mockNumber, 7);
    });

    test("past the paper's own hour the key is renewed: that paper cannot be open any more", () async {
      await startLost(mock);
      wall += 63 * 60000;
      await starter.start(mock);
      expect(bodyOf(1)['generationKey'], isNot(bodyOf(0)['generationKey']));
    });

    test('a repeat made without a quote names the same allowance as the try before it', () async {
      final free = PracticeQuote.fromJson({
        'state': 'available',
        'launchable': true,
        'reasonCode': 'ok',
        'creditCost': 0,
        'allowance': {'kind': 'full_sample:accountancy', 'state': 'available'},
        'subject': {'id': 'accountancy', 'name': 'Accountancy'},
      });
      await startLost(mock, quote: free, mockNumber: 1);
      expect(bodyOf(0)['purpose'], 'full_sample');
      await starter.start(mock);
      expect(bodyOf(1)['purpose'], 'full_sample');
    });

    test('a key whose paper has a draft here is spent: the next start is a new paper', () async {
      expect(await starter.start(quick), isA<Started>());
      final key = bodyOf(0)['generationKey'] as String;
      expect((await drafts.bySessionId('sess-9'))!.generationKey, key);
      // A kill between the draft and the clearing of the key leaves the key behind.
      await db.into(db.cacheEntries).insertOnConflictUpdate(
        CacheEntriesCompanion.insert(
          userId: 'u1',
          cacheKey: 'genkey:${quick.draftKey('u1')}',
          json: jsonEncode({'key': key, 'start': PendingStart.record(quick)}),
          fetchedAtMs: wall,
        ),
      );
      expect(await drafts.pendingStarts(), isEmpty, reason: 'its paper is on the phone: nothing to offer');
      expect(await drafts.generationKeyFor(quick.draftKey('u1')), isNot(key));
    });

    test('a paper the server says has ended is an ended start, and its key is forgotten', () async {
      await startLost(mock);
      http.handler = (_) => const FakeReply(422, {'error': 'SESSION_EXPIRED'});
      final outcome = await starter.start(mock);
      expect(outcome, isA<StartFailed>().having((f) => f.failure, 'failure', StartFailure.ended));
      expect(await drafts.pendingStarts(), isEmpty);
    });

    test('a paper the server holds with answers on it comes back with them, not as a new paper', () async {
      await startLost(mock);
      http.handler = (_) => viewReply(events: [
        {'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 0},
        {'seq': 2, 'qid': 'q1', 'type': 'answer', 'at': 1500, 'answer': 1},
        {'seq': 3, 'qid': 'q2', 'type': 'visit', 'at': 2500, 'via': 'next'},
      ]);
      expect(await starter.start(mock), isA<Started>());
      final draft = (await drafts.bySessionId('sess-9'))!;
      expect(draft.acknowledgedSequence, 3);
      expect(draft.visited, {'q1', 'q2'});
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-9');
      expect(journal.events.map((e) => e.seq), [1, 2, 3], reason: 'the log is the server\'s, so the next save continues it');
      expect(journal.answers, {'q1': 1});
    });

    test('the starter says when a key is written and when it is forgotten', () async {
      await startLost(mock);
      final written = changes;
      expect(written, greaterThan(0));
      await starter.start(mock);
      expect(changes, greaterThan(written));
    });

    test('a free fresh check keeps no record to offer', () async {
      final fresh = PracticeSelection(mode: PracticeMode.chapter, subjectId: 'accountancy', count: 5, chapter: 'Goodwill', recoveryFrom: 'att-1');
      http.handler = (_) => const FakeReply.network();
      await starter.start(fresh);
      expect(await drafts.pendingStarts(), isEmpty);
    });
  });

  group('running drafts', () {
    SessionDraft draft0(String id, {required int endsAt, bool pending = false, bool rejected = false, String subject = 'accountancy'}) =>
        draftOf(sessionId: id, endsAtWallMs: endsAt, pending: pending, subject: subject).copyWith(rejected: rejected);

    test('only a paper with time left that has not been handed in counts', () async {
      await drafts.save(draft0('running', endsAt: wall + 600000));
      await drafts.save(draft0('over', endsAt: wall - 1000, subject: 'economics'));
      await drafts.save(draft0('rejected', endsAt: wall + 600000, subject: 'physics', rejected: true));
      await drafts.archive(draft0('archived', endsAt: wall + 600000, subject: 'english'));
      final running = await drafts.runningDrafts();
      expect(running.map((d) => d.sessionId), ['running']);
    });

    test('a paper that was handed in and is still being sent is not open', () async {
      await drafts.save(draft0('sent', endsAt: wall + 600000, pending: true));
      expect(await drafts.runningDrafts(), isEmpty);
    });
  });

  group('what is offered', () {
    test('a start whose answer never came is offered as a paper not opened yet, with no clock', () async {
      await startLost(mock, mockNumber: 7);
      final paper = (await resolver().offer(null))!;
      expect(paper.kind, OpenPaperKind.pending);
      expect(paper.apiMode, 'full');
      expect(paper.subjectId, 'accountancy');
      expect(paper.count, 50);
      expect(paper.mockNumber, 7);
      expect(paper.endsAt, isNull, reason: 'nobody has read the paper\'s clock yet');
    });

    test('nothing is offered when nothing is open', () async {
      expect(await resolver().offer(null), isNull);
    });

    test('a paper running on this phone is led with by Today and Practice: no second card', () async {
      await startLost(mock);
      await drafts.save(draftOf(sessionId: 'here', endsAtWallMs: wall + 600000));
      expect(await resolver().offer(null), isNull);
    });

    test('a start older than its paper\'s hour is not offered', () async {
      await startLost(mock);
      wall += 63 * 60000;
      expect(await resolver().offer(null), isNull);
    });

    test('a paper the server holds is offered with the end time the server reports, on this phone\'s clock', () async {
      final soon = sessionViewOf(id: 'held-1', count: 50, startedAt: 1000000, expiresAt: 1000000 + 3600000, serverNow: 1000000 + 1200000);
      final paper = (await resolver(verify: (id) async {
        expect(id, 'held-1');
        return soon;
      }).offer((sessionId: 'held-1', subject: 'accountancy', mode: 'full')))!;
      expect(paper.kind, OpenPaperKind.held);
      expect(paper.sessionId, 'held-1');
      // 40 minutes of the hour are left on the server's clock: that is the end time here.
      expect(paper.endsAt, DateTime.fromMillisecondsSinceEpoch(wall + 40 * 60000));
      expect(paper.count, 50);
    });

    test('the server\'s internal subject becomes the public one (General Test)', () async {
      final view = SessionView.fromJson({
        ...sessionViewJson(id: 'held-2', count: 10, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000),
        'questions': [
          {'id': 'q1', 'subject': 'gat', 'options': const []},
        ],
      });
      final paper = (await resolver(
        verify: (_) async => view,
        catalog: const [Subject(id: 'general_test', internalId: 'gat', name: 'General test', practice: 'supported')],
      ).offer((sessionId: 'held-2', subject: null, mode: null)))!;
      expect(paper.subjectId, 'general_test');
    });

    test('a plan read that is stale never offers a paper that is over', () async {
      final paper = await resolver(verify: (_) async => throw const ApiError(kind: ApiErrorKind.server, code: 'SESSION_EXPIRED', status: 422))
          .offer((sessionId: 'gone', subject: 'accountancy', mode: 'full'));
      expect(paper, isNull);
    });

    test('a paper that is not active on the server is not offered', () async {
      final ended = SessionView.fromJson({...sessionViewJson(id: 'done', startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000), 'state': 'finished'});
      expect(await resolver(verify: (_) async => ended).offer((sessionId: 'done', subject: 'accountancy', mode: 'full')), isNull);
    });

    test('a server that cannot be reached offers the stored start instead, and not a guess', () async {
      await startLost(mock);
      final paper = (await resolver(verify: (_) async => throw const ApiError(kind: ApiErrorKind.network, code: 'network'))
          .offer((sessionId: 'held-3', subject: 'accountancy', mode: 'full')))!;
      expect(paper.kind, OpenPaperKind.pending);
    });

    test('a paper this phone has a draft for is the phone\'s to lead with, not the server\'s', () async {
      await drafts.save(draftOf(sessionId: 'held-4', endsAtWallMs: wall - 5000));
      var asked = false;
      final paper = await resolver(verify: (id) async {
        asked = true;
        return sessionViewOf(id: id);
      }).offer((sessionId: 'held-4', subject: 'accountancy', mode: 'full'));
      expect(paper, isNull);
      expect(asked, isFalse, reason: 'no request for a paper the phone already holds');
    });

    test('the paper the server holds and the start that asked for it are one card, with the mock\'s number', () async {
      await startLost(mock, mockNumber: 7);
      final view = sessionViewOf(id: 'held-5', count: 50, startedAt: 1000000, expiresAt: 1000000 + 3600000, serverNow: 1000000);
      final paper = (await resolver(verify: (_) async => view).offer((sessionId: 'held-5', subject: 'accountancy', mode: 'full')))!;
      expect(paper.kind, OpenPaperKind.held);
      expect(paper.start, isNotNull);
      expect(paper.mockNumber, 7);
    });
  });

  group('what waits for an open paper', () {
    test('a paper running on this phone stops a second paid start', () async {
      await drafts.save(draftOf(sessionId: 'here', endsAtWallMs: wall + 600000, mode: 'quick'));
      final open = (await resolver().blocker(null))!;
      expect(open.kind, OpenPaperKind.onPhone);
      expect(open.sessionId, 'here');
      expect(open.apiMode, 'quick');
    });

    test('a paper the server holds stops it too', () async {
      final view = sessionViewOf(id: 'held-6', count: 50, startedAt: 1000000, expiresAt: 1000000 + 3600000, serverNow: 1000000);
      final open = (await resolver(verify: (_) async => view).blocker((sessionId: 'held-6', subject: 'accountancy', mode: 'full')))!;
      expect(open.kind, OpenPaperKind.held);
    });

    test('a start nobody read does not: nothing says it is open, and asking again is the same paper', () async {
      await startLost(mock);
      expect(await resolver().blocker(null), isNull);
    });

    test('nothing open: nothing waits', () async {
      expect(await resolver().blocker(null), isNull);
    });
  });

  group('continuing', () {
    PaperContinuer continuer() => PaperContinuer(
      starter: starter,
      startEngine: (args) async {
        final engine = await SessionEngine.start(
          services: services,
          view: args.view,
          subject: args.subject,
          mode: args.mode,
          count: args.count,
          generationKey: args.generationKey,
          mockNumber: args.mockNumber,
          serverEvents: args.serverEvents,
        );
        engines.add(engine);
        return engine;
      },
      drafts: drafts,
      changed: () => changes++,
    );

    test('a start nobody read is asked for again with its own key, and opens', () async {
      await startLost(mock, mockNumber: 7);
      final paper = (await resolver().offer(null))!;
      final result = await continuer().open(paper);
      expect(result, isA<Continued>().having((c) => c.sessionId, 'sessionId', 'sess-9'));
      expect(bodyOf(1)['generationKey'], bodyOf(0)['generationKey']);
      expect(bodyOf(1)['mode'], 'full');
      expect(await drafts.pendingStarts(), isEmpty, reason: 'the paper is on the phone now');
    });

    test('a paper the server holds that no stored start asked for is taken over from its own copy', () async {
      final view = SessionView.fromJson(
        sessionViewJson(id: 'held-7', count: 50, startedAt: wall - 600000, expiresAt: wall + 3000000, serverNow: wall, events: [
          {'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 0},
          {'seq': 2, 'qid': 'q1', 'type': 'answer', 'at': 900, 'answer': 2},
        ]),
      );
      final paper = (await resolver(verify: (_) async => view).offer((sessionId: 'held-7', subject: 'accountancy', mode: 'full')))!;
      final requestsBefore = http.requests.length;
      final result = await continuer().open(paper);
      expect(result, isA<Continued>().having((c) => c.sessionId, 'sessionId', 'held-7'));
      expect(http.requests.length, requestsBefore, reason: 'taking a paper over starts nothing and charges nothing');
      final draft = (await drafts.bySessionId('held-7'))!;
      expect(draft.mode, 'full');
      expect(draft.subject, 'accountancy');
      expect(draft.acknowledgedSequence, 2);
      expect((await drafts.summaryOf(draft)).answered, 1);
      // The clock is the paper's own: ten minutes were gone when it was taken over.
      expect(draft.endsAtWallMs, wall + 3000000);
    });

    test('a held paper with a stored start is asked for again with that key, so the server answers with the same paper', () async {
      await startLost(mock, mockNumber: 7);
      final view = sessionViewOf(id: 'sess-9', count: 50, startedAt: 1000000, expiresAt: 1000000 + 3600000, serverNow: 1000000);
      final paper = (await resolver(verify: (_) async => view).offer((sessionId: 'sess-9', subject: 'accountancy', mode: 'full')))!;
      expect(paper.start, isNotNull);
      final result = await continuer().open(paper);
      expect(result, isA<Continued>());
      expect(bodyOf(1)['generationKey'], bodyOf(0)['generationKey']);
    });

    test('a paper the server has ended says so, and no new charge was made', () async {
      await startLost(mock);
      http.handler = (_) => const FakeReply(422, {'error': 'SESSION_EXPIRED'});
      final paper = (await resolver().offer(null))!;
      final result = await continuer().open(paper);
      expect(result, isA<ContinueFailed>().having((f) => f.failure, 'failure', StartFailure.ended));
    });

    test('offline keeps the card and says so', () async {
      await startLost(mock);
      http.handler = (_) => const FakeReply.network();
      final paper = (await resolver().offer(null))!;
      final result = await continuer().open(paper);
      expect(result, isA<ContinueFailed>().having((f) => f.failure, 'failure', StartFailure.offline));
      expect(await drafts.pendingStarts(), hasLength(1), reason: 'the key stays: the next try is the same paper');
    });

    test('a paper already running is simply opened', () async {
      await drafts.save(draftOf(sessionId: 'here', endsAtWallMs: wall + 600000));
      final paper = (await resolver().blocker(null))!;
      expect(await continuer().open(paper), isA<Continued>().having((c) => c.sessionId, 'sessionId', 'here'));
    });

    test('"Not now" forgets the key, so the card goes and a new start is a new paper', () async {
      await startLost(mock);
      final paper = (await resolver().offer(null))!;
      final before = changes;
      await continuer().letGo(paper);
      expect(await drafts.pendingStarts(), isEmpty);
      expect(changes, greaterThan(before));
      expect(await resolver().offer(null), isNull);
    });
  });

  group('the plan\'s resume', () {
    test('the session a resume action waits on comes from its structured field, else its address, else its evidence', () {
      PlanAction action(Map<String, dynamic> j) => PlanAction.fromJson({'kind': 'resume_session', 'title': 'Resume your practice', ...j});
      expect(action({'action': {'type': 'resume', 'sessionId': 'a-1'}, 'href': '/test?sessionId=b-2', 'evidence': ['c-3']}).resumeSessionId, 'a-1');
      expect(action({'href': '/test?subject=accountancy&mode=full&sessionId=b-2', 'evidence': ['c-3']}).resumeSessionId, 'b-2');
      expect(action({'evidence': ['c-3']}).resumeSessionId, 'c-3');
      expect(action({}).resumeSessionId, isNull);
    });

    test('only a resume action is a resume', () {
      final repair = PlanAction.fromJson({'kind': 'repair', 'title': 'Repair', 'href': '/test?sessionId=x-1', 'evidence': ['x-1']});
      expect(repair.resumeSessionId, isNull);
    });

    test('the hint the resolver reads carries the subject and mode the server named', () {
      final plan = LearningPlan.fromJson({
        'primary': {
          'kind': 'resume_session',
          'title': 'Resume your practice',
          'href': '/test?subject=accountancy&mode=full&sessionId=s-1&experience=practice',
          'evidence': ['s-1'],
          'action': {'type': 'resume', 'subject': 'accountancy', 'mode': 'full', 'sessionId': 's-1'},
        },
      });
      expect(heldHintOf(plan), (sessionId: 's-1', subject: 'accountancy', mode: 'full'));
      expect(heldHintOf(null), isNull);
    });

    test('Today and Practice read one plan', () {
      expect(openPaperPlanMinutes, 10);
    });
  });
}
