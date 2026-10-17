import 'dart:async';
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
  late PracticeStarter Function(Future<void> Function(String draftKey)? awaitClosing) buildStarter;
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
    buildStarter = (awaitClosing) => PracticeStarter(
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
      rememberSession: (id, s) => notes.write(id, chapter: s.chapterLabel, mode: s.mode.apiMode),
      afterStarted: started.add,
      awaitClosing: awaitClosing,
    );
    starter = buildStarter(null);
  });

  tearDown(() async {
    engines.clear();
    await db.close();
  });

  Map<String, dynamic> bodyOf(int i) =>
      (http.requests[i].body is String ? jsonDecode(http.requests[i].body! as String) : http.requests[i].body) as Map<String, dynamic>;

  final quick = PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy');

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

  test('a start waits for a runner still closing under its draft key before it saves its own draft (practice-02)', () async {
    final gate = Completer<void>();
    String? waitedOn;
    final waiting = buildStarter((key) {
      waitedOn = key;
      return gate.future;
    });
    var done = false;
    final outcome = waiting.start(quick, quote: _quote()).whenComplete(() => done = true);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(done, isFalse, reason: 'the start is held while the earlier runner closes');
    expect(engines, isEmpty, reason: 'no draft is saved yet');
    expect(waitedOn, quick.draftKey('u1'));
    gate.complete();
    expect(await outcome, isA<Started>());
    expect(engines, hasLength(1));
  });

  test('a start that cannot wait for the close still starts (an ordering guard only)', () async {
    final outcome = await buildStarter((key) => Future<void>.error(StateError('closing failed'))).start(quick, quote: _quote());
    expect(outcome, isA<Started>());
  });

  test('five fresh questions start as a free recovery session for that attempt and chapter', () async {
    final link = Uri.parse('/practice/start?mode=chapter&subject=business_studies&count=5&chapter=Staffing&recoveryFrom=att-7');
    final fresh = PracticeSelection(
      mode: PracticeMode.chapter,
      subjectId: link.queryParameters['subject']!,
      count: 5,
      chapter: link.queryParameters['chapter'],
      recoveryFrom: link.queryParameters['recoveryFrom'],
    );
    await starter.start(fresh);
    final body = bodyOf(0);
    expect(body['subject'], 'business_studies');
    expect(body['mode'], 'quick');
    expect(body['count'], '5');
    expect(body['chapter'], 'Staffing');
    expect(body['recoveryFrom'], 'att-7');
    expect(body['experience'], 'recovery');
    expect(body.containsKey('purpose'), isFalse);
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
    final chapter = PracticeSelection(mode: PracticeMode.chapter, subjectId: 'accountancy', chapter: 'Admission of a partner', count: 15);
    await starter.start(chapter, quote: _quote());
    final body = bodyOf(0);
    expect(body['mode'], 'quick');
    expect(body['chapter'], 'Admission of a partner');
    expect(body['count'], '15');
    expect(body.containsKey('chapters'), isFalse);
    expect((await notes.read('sess-9'))?.chapter, 'Admission of a partner');
  });

  test('a chapter outside Quick practice is never sent (Fine-tune scope, F9)', () async {
    final sel = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy', chapter: 'Goodwill');
    await starter.start(sel, quote: _quote());
    expect(bodyOf(0).containsKey('chapter'), isFalse);
    expect(bodyOf(0).containsKey('chapters'), isFalse);
  });

  test('Quick practice takes the chapters it was given', () async {
    final sel = PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', chapter: 'Goodwill');
    await starter.start(sel, quote: _quote());
    expect(bodyOf(0)['chapter'], 'Goodwill');
  });

  test('a mock is 50 questions, and its number reaches the draft', () async {
    http.handler = (_) =>
        FakeReply(200, sessionViewJson(id: 'sess-9', count: 50, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    final mock = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy');
    await starter.start(mock, quote: _quote(), mockNumber: 7);
    final body = bodyOf(0);
    expect(body['mode'], 'full');
    expect(body['count'], '50');
    final draft = await drafts.bySessionId('sess-9');
    expect(draft!.mockNumber, 7);
  });

  test('an exam paper that is not exactly 50 questions is refused, with the reason, and its key forgotten', () async {
    http.handler = (_) =>
        FakeReply(200, sessionViewJson(id: 'sess-short', count: 38, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    final nta = PracticeSelection(mode: PracticeMode.nta, subjectId: 'accountancy');
    final outcome = await starter.start(nta, quote: _quote());
    expect(outcome, isA<StartFailed>());
    final failed = outcome as StartFailed;
    expect(failed.failure, StartFailure.notEnoughQuestions);
    expect(failed.message, ntaPaperSizeMessage(38));
    expect(await drafts.bySessionId('sess-short'), isNull, reason: 'no exam opens on a short paper');
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
    final mock = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy');
    http.handler = (_) =>
        FakeReply(200, sessionViewJson(id: 'sess-9', count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
    await starter.start(mock, quote: _quote(allowance: {'kind': 'full_sample:accountancy', 'state': 'available'}));
    expect(bodyOf(0)['purpose'], 'full_sample');

    await drafts.delete(mock.draftKey('u1'));
    http.requests.clear();
    await starter.start(mock, quote: _quote(allowance: {'kind': 'full_sample:accountancy', 'state': 'used'}));
    expect(bodyOf(0).containsKey('purpose'), isFalse);
  });

  test('an earlier session with unsent answers never blocks the start; it stays owed', () async {
    final earlier = draftOf(sessionId: 'old-1', count: 10, mode: 'quick', endsAtWallMs: wall + 600000, pending: true, mockNumber: null);
    await drafts.save(earlier);
    sessionApi.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
    final outcome = await starter.start(quick, quote: _quote());
    expect(outcome, isA<Started>());
    final kept = (await drafts.bySessionId('old-1'))!;
    expect(kept.pendingSubmission, isTrue);
    expect(kept.draftKey, SessionDraftRepository.archiveKeyOf('old-1'));
  });

  test('the draft key matches the engine draft key for the same selection', () {
    expect(quick.draftKey('u1'), SessionDraft.keyFor(userId: 'u1', subject: 'accountancy', count: 10, mode: 'quick'));
    final chapter = PracticeSelection(mode: PracticeMode.chapter, subjectId: 'economics', chapter: 'Money', count: 5);
    expect(chapter.draftKey('u1'), SessionDraft.keyFor(userId: 'u1', subject: 'economics', chapter: 'Money', count: 5, mode: 'quick'));
  });

  group('the chosen selection reaches the server exactly', () {
    test('Business Studies, 5 questions starts Business Studies with 5 questions', () async {
      final bst = PracticeSelection(mode: PracticeMode.quick, subjectId: 'business_studies', count: 5);
      http.handler = (options) =>
          FakeReply(200, sessionViewJson(id: 'sess-9', count: 5, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
      await starter.start(bst, quote: _quote());
      final body = bodyOf(0);
      expect(body['subject'], 'business_studies');
      expect(body['count'], '5');
      expect(body['mode'], 'quick');
      final draft = await drafts.bySessionId('sess-9');
      expect(draft!.subject, 'business_studies');
      expect(draft.count, 5);
      expect(started.single.subjectId, 'business_studies');
    });

    test('every offered length is sent as chosen', () async {
      for (final (i, count) in practiceCounts.indexed) {
        http.handler = (options) =>
            FakeReply(200, sessionViewJson(id: 'sess-c$count', count: count, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000));
        await starter.start(PracticeSelection(mode: PracticeMode.quick, subjectId: 'economics', count: count), quote: _quote());
        expect(bodyOf(i)['count'], '$count');
        expect(bodyOf(i)['subject'], 'economics');
      }
    });

    test('several chapters go in chapters, one in chapter, and difficulty is sent', () async {
      final two = PracticeSelection(
        mode: PracticeMode.chapter,
        subjectId: 'accountancy',
        chapters: const ['Goodwill', 'Issue of shares'],
        difficulty: PracticeDifficulty.hard,
        count: 15,
      );
      await starter.start(two, quote: _quote());
      final body = bodyOf(0);
      expect(body['chapters'], 'Goodwill,Issue of shares');
      expect(body.containsKey('chapter'), isFalse);
      expect(body['difficulty'], 'hard');
      expect(body['count'], '15');
    });

    test('Smart practice sends mode smart and never a difficulty', () async {
      final smart = PracticeSelection(mode: PracticeMode.smart, subjectId: 'english', difficulty: PracticeDifficulty.easy);
      expect(smart.count, 15);
      await starter.start(smart, quote: _quote());
      final body = bodyOf(0);
      expect(body['mode'], 'smart');
      expect(body['count'], '15');
      expect(body.containsKey('difficulty'), isFalse);
    });

    test('a different difficulty or chapter set never shares a stored key', () {
      final base = PracticeSelection(mode: PracticeMode.chapter, subjectId: 'accountancy', chapters: const ['Goodwill'], count: 10);
      final harder = base.copyWith(difficulty: PracticeDifficulty.hard);
      final more = base.copyWith(chapters: const ['Goodwill', 'Issue of shares']);
      expect({base.draftKey('u1'), harder.draftKey('u1'), more.draftKey('u1')}, hasLength(3));
    });
  });

  group('practice-04: a start whose deadline is missing or already past is refused', () {
    for (final (name, edit) in <(String, void Function(Map<String, dynamic>))>[
      ('no expiresAt', (j) => j.remove('expiresAt')),
      ('an unreadable expiresAt', (j) => j['expiresAt'] = 'soon'),
      ('expiresAt at the server clock', (j) => j['expiresAt'] = DateTime.fromMillisecondsSinceEpoch(1000000, isUtc: true).toIso8601String()),
    ]) {
      test(name, () async {
        http.handler = (options) {
          final json = sessionViewJson(id: 'sess-9', count: 10, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000);
          edit(json);
          return FakeReply(200, json);
        };
        final outcome = await starter.start(quick, quote: _quote());
        expect(outcome, isA<StartFailed>().having((f) => f.failure, 'failure', StartFailure.generic));
        // Nothing reached the phone: no engine, no draft, no "started" bookkeeping, so no timer
        // can submit an empty paper.
        expect(engines, isEmpty);
        expect(await drafts.bySessionId('sess-9'), isNull);
        expect(started, isEmpty);
      });
    }
  });
}
