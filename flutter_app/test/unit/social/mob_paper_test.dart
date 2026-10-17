// Sitting a Mob paper: the start route, the draft it writes, resuming it, and every refusal.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/sync_providers.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_paper.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';
import 'mob_test_kit.dart';

void main() {
  late AppDatabase db;
  late FakeHttpAdapter http;
  late SessionDraftRepository drafts;
  late MobPaperLauncher launcher;
  late int wall;
  final engines = <SessionEngine>[];
  late Mob mob;

  setUp(() {
    db = newTestDb();
    http = FakeHttpAdapter();
    wall = 2000000;
    mob = MobRead.fromJson(mobFixture('get_not_sat_v1.json')).mob!;
    final scope = LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall));
    drafts = SessionDraftRepository(scope);
    final sessionApi = FakeSessionApi();
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
    http.handler = (options) => FakeReply(200, sessionViewJson(id: 'practice_mob1', count: 10, startedAt: 1000000, expiresAt: 1720000, serverNow: 1000000));
    launcher = MobPaperLauncher(
      api: newApiClient(http),
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
          draftKey: args.draftKey,
        );
        engines.add(engine);
        return engine;
      },
      now: () => wall,
    );
  });

  tearDown(() async {
    engines.clear();
    await db.close();
  });

  Map<String, dynamic> bodyOf(int i) =>
      (http.requests[i].body is String ? jsonDecode(http.requests[i].body! as String) : http.requests[i].body) as Map<String, dynamic>;

  String keyFor(String paper) => mobPaperDraftKey(userId: 'u1', mobId: mob.id, paperKey: paper);

  test('the week\'s paper: the start names its Mob and nothing else, and the draft has its own row', () async {
    final outcome = await launcher.start(mob);
    expect(outcome, isA<MobPaperStarted>().having((s) => s.sessionId, 'sessionId', 'practice_mob1'));
    expect(http.requests.single.path, endsWith('/api/mob/paper/start'));
    expect(bodyOf(0), {'mob': mob.id}, reason: 'the server derives the key, the questions and the options');
    final saved = await drafts.byKey(keyFor('2026-10-12'));
    expect(saved, isNotNull);
    expect(saved!.sessionId, 'practice_mob1');
    expect(saved.mode, 'quick');
    expect(saved.subject, 'accountancy');
    expect(saved.count, 10);
    // An ordinary quick 10 in the same subject keeps its own row: the Mob paper never takes it.
    expect(await drafts.byKey(SessionDraft.keyFor(userId: 'u1', subject: 'accountancy', count: 10, mode: 'quick')), isNull);
  });

  test('an extra paper names its id and keeps its own draft row', () async {
    final extra = MobExtra.fromJson({'id': 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35', 'count': 10});
    final outcome = await launcher.start(mob, extra: extra);
    expect(outcome, isA<MobPaperStarted>());
    expect(bodyOf(0), {'mob': mob.id, 'extra': 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35'});
    expect(await drafts.byKey(keyFor('c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35')), isNotNull);
    expect(await drafts.byKey(keyFor('2026-10-12')), isNull);
  });

  test('a paper already running on this phone opens where it was, with no second start', () async {
    await launcher.start(mob);
    final again = await launcher.start(mob);
    expect(again, isA<MobPaperStarted>().having((s) => s.resumed, 'resumed', isTrue));
    expect(http.requests, hasLength(1));
  });

  test('a second tap while the start runs joins the first', () async {
    final a = launcher.start(mob);
    final b = launcher.start(mob);
    expect(await a, isA<MobPaperStarted>());
    expect(await b, isA<MobPaperStarted>());
    expect(http.requests, hasLength(1));
  });

  test('once the time is up the draft is not resumed: a fresh start asks the server', () async {
    await launcher.start(mob);
    wall += 2 * 3600 * 1000;
    final again = await launcher.start(mob);
    expect(again, isA<MobPaperStarted>().having((s) => s.resumed, 'resumed', isFalse));
    expect(http.requests, hasLength(2));
  });

  group('refusals read as the server\'s sentence', () {
    final cases = <(String, int, MobFailure)>[
      ('PAPER_ALREADY_SAT', 409, MobFailure.alreadySat),
      ('WEEK_CLOSED', 410, MobFailure.weekClosed),
      ('PAPER_EXPIRED', 410, MobFailure.paperExpired),
      ('FREE_PAPER_USED', 409, MobFailure.freePaperUsed),
      ('CREDITS', 402, MobFailure.credits),
      ('PAPER_UNAVAILABLE', 503, MobFailure.paperUnavailable),
      ('MIGRATION', 503, MobFailure.migration),
      ('NOT_IN_MOB', 404, MobFailure.notInMob),
      ('EXTRA_CLOSED', 410, MobFailure.extraClosed),
    ];
    for (final (code, status, expected) in cases) {
      test(code, () async {
        http.handler = (o) => FakeReply(status, ((mobFixture('errors_v1.json')[code] as Map<String, dynamic>)['body']));
        final outcome = await launcher.start(mob);
        expect(outcome, isA<MobPaperFailed>().having((f) => f.failure, 'failure', expected));
        expect(await drafts.byKey(keyFor('2026-10-12')), isNull, reason: 'nothing is written for a paper that did not start');
      });
    }

    test('offline', () async {
      http.handler = (o) => const FakeReply.network();
      final outcome = await launcher.start(mob);
      expect(outcome, isA<MobPaperFailed>().having((f) => f.failure, 'failure', MobFailure.offline));
    });
  });

  test('a start with no usable deadline is refused before anything is written', () async {
    http.handler = (o) => FakeReply(200, sessionViewJson(id: 'practice_mob1', count: 10, startedAt: 1000000, expiresAt: 1000000, serverNow: 1000000));
    final outcome = await launcher.start(mob);
    expect(outcome, isA<MobPaperFailed>().having((f) => f.failure, 'failure', MobFailure.generic));
    expect(await drafts.byKey(keyFor('2026-10-12')), isNull);
  });

  test('an empty paper is refused', () async {
    http.handler = (o) => FakeReply(200, sessionViewJson(id: 'practice_mob1', count: 0, startedAt: 1000000, expiresAt: 1720000, serverNow: 1000000));
    final outcome = await launcher.start(mob);
    expect(outcome, isA<MobPaperFailed>());
  });
}
