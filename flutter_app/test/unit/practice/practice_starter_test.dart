import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/sync_providers.dart';
import 'package:mockmob/features/practice/data/practice_notes.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';

PracticeQuote _quote({Map<String, dynamic>? allowance}) => PracticeQuote.fromJson({
  'state': 'available',
  'launchable': true,
  'reasonCode': 'ok',
  'creditCost': allowance == null ? 10 : 0,
  'creditBalance': 100,
  'allowance': allowance,
  'subject': {'id': 'accountancy', 'name': 'Accountancy'},
});

void main() {
  late AppDatabase db;
  late FakeHttpAdapter http;
  late FakeSessionApi sessionApi;
  late SessionDraftRepository drafts;
  late PracticeNotes notes;
  late PracticeStarter starter;
  late int wall;
  final engines = <SessionEngine>[];
  final started = <PracticeSelection>[];

  setUp(() {
    db = newTestDb();
    http = FakeHttpAdapter();
    sessionApi = FakeSessionApi();
    wall = 2000000;
    started.clear();
    final scope = LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall));
    drafts = SessionDraftRepository(scope);
    notes = PracticeNotes(scope);
    final services = SessionEngineServices(
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
    http.handler = (options) =>
        FakeReply(200, sessionViewJson(id: 'sess-9', count: 10, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    final ApiClient api = newApiClient(http);
    starter = PracticeStarter(
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
        );
        engines.add(engine);
        return engine;
      },
      rememberSession: (id, s) => notes.write(id, chapter: s.effectiveChapter, mode: s.mode.apiMode),
      afterStarted: started.add,
    );
  });

  tearDown(() async {
    engines.clear();
    await db.close();
  });

  Map<String, dynamic> bodyOf(int i) =>
      (http.requests[i].body is String ? jsonDecode(http.requests[i].body! as String) : http.requests[i].body) as Map<String, dynamic>;

  const quick = PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy');

  test('a start sends the stored key, the string count, experience practice and no chapters field', () async {
    final outcome = await starter.start(quick, quote: _quote());
    expect(outcome, isA<Started>().having((s) => s.sessionId, 'sessionId', 'sess-9'));
    final body = bodyOf(0);
    expect(body['generationKey'], matches(RegExp(r'^[A-Za-z0-9_-]{12,100}$')));
    expect(body['subject'], 'accountancy');
    expect(body['mode'], 'quick');
    expect(body['count'], '10');
    expect(body['experience'], 'practice');
    expect(body.containsKey('chapter'), isFalse);
    expect(body.containsKey('chapters'), isFalse);
    expect(body.containsKey('purpose'), isFalse);
    expect(started, hasLength(1));
  });

  test('the draft and journal are on the phone before the runner opens, and the engine is released', () async {
    await starter.start(quick, quote: _quote());
    final draft = await drafts.bySessionId('sess-9');
    expect(draft, isNotNull);
    expect(draft!.mode, 'quick');
    expect(draft.count, 10);
    expect(draft.view.questions, hasLength(10));
  });

  test('chapter practice sends the single chapter field, and the chapter is remembered', () async {
    const chapter = PracticeSelection(mode: PracticeMode.chapter, subjectId: 'accountancy', chapter: 'Admission of a partner', count: 15);
    await starter.start(chapter, quote: _quote());
    final body = bodyOf(0);
    expect(body['mode'], 'quick');
    expect(body['chapter'], 'Admission of a partner');
    expect(body['count'], '15');
    expect(body.containsKey('chapters'), isFalse);
    expect((await notes.read('sess-9'))?.chapter, 'Admission of a partner');
  });

  test('a chapter outside chapter practice is never sent', () async {
    const sel = PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', chapter: 'Goodwill');
    await starter.start(sel, quote: _quote());
    expect(bodyOf(0).containsKey('chapter'), isFalse);
  });

  test('a mock is 50 questions, and its number reaches the draft', () async {
    http.handler = (_) =>
        FakeReply(200, sessionViewJson(id: 'sess-9', count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    const mock = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy');
    await starter.start(mock, quote: _quote(), mockNumber: 7);
    final body = bodyOf(0);
    expect(body['mode'], 'full');
    expect(body['count'], '50');
    final draft = await drafts.bySessionId('sess-9');
    expect(draft!.mockNumber, 7);
  });

  test('a double tap creates one session: two starts share one request and one key', () async {
    final a = starter.start(quick, quote: _quote());
    final b = starter.start(quick, quote: _quote());
    final results = await Future.wait([a, b]);
    expect(http.requests, hasLength(1));
    expect(results.every((r) => r is Started), isTrue);
  });

  test('after a network failure the retry reuses the same generation key', () async {
    var calls = 0;
    http.handler = (_) => ++calls == 1
        ? const FakeReply.network()
        : FakeReply(200, sessionViewJson(id: 'sess-9', count: 10, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    final first = await starter.start(quick, quote: _quote());
    expect(first, isA<StartFailed>().having((f) => f.failure, 'failure', StartFailure.offline));
    final second = await starter.start(quick, quote: _quote());
    expect(second, isA<Started>());
    expect(bodyOf(1)['generationKey'], bodyOf(0)['generationKey']);
  });

  test('a definitive refusal forgets the key, so the next start is fresh', () async {
    var calls = 0;
    http.handler = (_) => ++calls == 1
        ? const FakeReply(422, {'error': 'INSUFFICIENT_PRACTICE_CONTENT'})
        : FakeReply(200, sessionViewJson(id: 'sess-9', count: 10, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    final first = await starter.start(quick, quote: _quote());
    expect(first, isA<StartFailed>().having((f) => f.failure, 'failure', StartFailure.notEnoughQuestions));
    await starter.start(quick, quote: _quote());
    expect(bodyOf(1)['generationKey'], isNot(bodyOf(0)['generationKey']));
  });

  test('error codes map to the exact failures, never to server text', () async {
    final cases = <(int, String, StartFailure)>[
      (402, 'INSUFFICIENT_CREDITS', StartFailure.notEnoughCredits),
      (402, 'PREMIUM_REQUIRED', StartFailure.notIncluded),
      (422, 'INSUFFICIENT_VERIFIED_CONTENT', StartFailure.notEnoughQuestions),
      (503, 'SESSION_CREATE_FAILED', StartFailure.generic),
      (422, 'SESSION_ALREADY_SUBMITTED', StartFailure.generic),
    ];
    for (final (status, code, expected) in cases) {
      http.handler = (_) => FakeReply(status, {'error': code, 'message': 'raw server text'});
      final outcome = await starter.start(quick, quote: _quote());
      expect(outcome, isA<StartFailed>().having((f) => f.failure, code, expected), reason: code);
    }
  });

  test('purpose is sent only when the quote says the matching allowance is available', () async {
    const mock = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy');
    http.handler = (_) =>
        FakeReply(200, sessionViewJson(id: 'sess-9', count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    await starter.start(mock, quote: _quote(allowance: {'kind': 'full_sample:accountancy', 'state': 'available'}));
    expect(bodyOf(0)['purpose'], 'full_sample');

    await drafts.delete(mock.draftKey('u1'));
    http.requests.clear();
    await starter.start(mock, quote: _quote(allowance: {'kind': 'full_sample:accountancy', 'state': 'used'}));
    expect(bodyOf(0).containsKey('purpose'), isFalse);
  });

  test('an earlier session with unsent answers blocks the start and points at that session', () async {
    final earlier = draftOf(sessionId: 'old-1', count: 10, mode: 'quick', endsAtWallMs: wall + 600000, pending: true, mockNumber: null);
    await drafts.save(earlier);
    sessionApi.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
    final outcome = await starter.start(quick, quote: _quote());
    expect(outcome, isA<StartPendingElsewhere>().having((o) => o.sessionId, 'sessionId', 'old-1'));
  });

  test('the draft key matches the engine draft key for the same selection', () {
    expect(quick.draftKey('u1'), SessionDraft.keyFor(userId: 'u1', subject: 'accountancy', count: 10, mode: 'quick'));
    const chapter = PracticeSelection(mode: PracticeMode.chapter, subjectId: 'economics', chapter: 'Money', count: 5);
    expect(chapter.draftKey('u1'), SessionDraft.keyFor(userId: 'u1', subject: 'economics', chapter: 'Money', count: 5, mode: 'quick'));
  });
}
