import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_words.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';

import '../../core_data/support/fakes.dart';
import '../support/fixture_learn_api.dart';

/// HttpLearnApi: every call names exactly the web's path, query and body (web src/components/learn2/api.js), reads the
/// recorded answers, and maps every failure to the web's kinds with the route's body kept.
void main() {
  late FakeHttpAdapter http;
  late List<RequestOptions> seen;
  late FakeReply Function(RequestOptions) answer;
  late HttpLearnApi api;
  late DateTime now;

  HttpLearnApi build({LearnRequestKeys? keys}) {
    final client = newApiClient(http, now: () => now);
    return HttpLearnApi(client, keys: keys ?? LearnRequestKeys.memory(now: () => now));
  }

  setUp(() {
    now = DateTime.utc(2026, 11, 1, 7, 30);
    http = FakeHttpAdapter();
    seen = [];
    answer = (_) => const FakeReply(200, {});
    http.handler = (o) {
      seen.add(o);
      return answer(o);
    };
    api = build();
  });

  FakeReply recorded(String name) => FakeReply(LearnFixtures.status(name), LearnFixtures.json(name));

  group('paths, queries and bodies', () {
    test('GET /api/learn/subject?subject=', () async {
      answer = (_) => recorded('subject_accountancy_pro');
      final d = await api.subject('accountancy');
      expect(seen.single.method, 'GET');
      expect(seen.single.path, '/api/learn/subject');
      expect(seen.single.queryParameters, {'subject': 'accountancy'});
      expect(seen.single.headers['Authorization'], 'Bearer tok-1');
      expect(d.suggestions, hasLength(3));
    });

    test('POST /api/learn/runs/preview with addNext only when asked', () async {
      answer = (_) => recorded('preview_ccss_20_addnext_pro');
      final p = await api.preview(chapterKey: l2Ccss, minutes: 20, leaveOut: ['questions'], addNext: true);
      expect(seen.single.method, 'POST');
      expect(seen.single.path, '/api/learn/runs/preview');
      expect(seen.single.data, {'chapterKey': l2Ccss, 'minutes': 20, 'leaveOut': ['questions'], 'addNext': true});
      expect(p.added!.key, 'accountancy.accounting-ratios');
      await api.preview(chapterKey: l2Aop, minutes: 10);
      expect(seen.last.data, {'chapterKey': l2Aop, 'minutes': 10, 'leaveOut': <String>[]});
    });

    test('POST /api/learn/runs with a request key; a feed from a cover says so', () async {
      answer = (_) => recorded('run_start_feed_aop_pro');
      final run = await api.startRun(const RunStart(kind: LearnKinds.feed, chapterKey: l2Aop, source: 'explore_cover', forYou: true, position: 0));
      final body = seen.single.data as Map<String, dynamic>;
      expect(seen.single.path, '/api/learn/runs');
      expect(body['kind'], 'feed');
      expect(body['chapterKey'], l2Aop);
      expect(body['minutes'], 10);
      expect(body['leaveOut'], <String>[]);
      expect(body['source'], 'explore_cover');
      expect(body['forYou'], isTrue);
      expect(body['position'], 0);
      expect(body['requestKey'], matches(LearnRequestKeys.pattern));
      expect(body.containsKey('fresh'), isFalse);
      expect(run.isFeed, isTrue);
    });

    test('the run routes: read, answer, rate, Keep and end', () async {
      answer = (o) => switch (o.path) {
        '/api/learn/runs/lr_1' => recorded('run_get_feed_aop_pro'),
        '/api/learn/runs/lr_1/answer' => recorded('answer_wrong_pro'),
        '/api/learn/runs/lr_1/end' => recorded('run_end_feed_aop_pro'),
        _ => recorded('rate_got_it_pro'),
      };
      expect((await api.getRun('lr_1')).resumed!.done, 3);
      expect(seen.last.method, 'GET');
      final a = await api.answer('lr_1', 'lr_1-i5', 'B');
      expect(seen.last.path, '/api/learn/runs/lr_1/answer');
      expect(seen.last.data, {'itemId': 'lr_1-i5', 'choice': 'B'});
      expect(a.line!.card, isNotNull);
      await api.rate('lr_1', 'lr_1-i2', 3);
      expect(seen.last.path, '/api/learn/runs/lr_1/rate');
      expect(seen.last.data, {'itemId': 'lr_1-i2', 'rating': 3});
      await api.keep('lr_1', 'lr_1-i1');
      expect(seen.last.path, '/api/learn/runs/lr_1/rate');
      expect(seen.last.data, {'itemId': 'lr_1-i1', 'keep': true});
      final end = await api.end('lr_1');
      expect(seen.last.method, 'GET');
      expect(seen.last.path, '/api/learn/runs/lr_1/end');
      expect(end.feed!.kept.count, 1);
      await api.getRun('a/b');
      expect(seen.last.path, '/api/learn/runs/a%2Fb');
    });

    test('cards by chapter and by subject, shelves, search, covers, save', () async {
      answer = (_) => const FakeReply(200, {});
      await api.chapterCards(l2Aop, filter: 'must');
      expect(seen.last.path, '/api/learn/cards');
      expect(seen.last.queryParameters, {'chapter': l2Aop, 'filter': 'must'});
      await api.subjectCards('accountancy', filter: 'due');
      expect(seen.last.queryParameters, {'subject': 'accountancy', 'filter': 'due'});
      await api.shelves('accountancy');
      expect(seen.last.path, '/api/learn/shelves');
      expect(seen.last.queryParameters, {'subject': 'accountancy'});
      await api.shelves();
      expect(seen.last.queryParameters, isEmpty);
      await api.search('accountancy', 'goodwill');
      expect(seen.last.path, '/api/learn/search');
      expect(seen.last.queryParameters, {'subject': 'accountancy', 'q': 'goodwill'});
      await api.covers('accountancy');
      expect(seen.last.path, '/api/learn/covers');
      expect(seen.last.queryParameters, {'subject': 'accountancy'});
      answer = (_) => const FakeReply(200, {'saved': true, 'count': 4, 'limit': 25});
      final saved = await api.saveQuestion('q1');
      expect((seen.last.method, seen.last.path), ('POST', '/api/bookmarks'));
      expect(seen.last.data, {'questionId': 'q1', 'saved': true});
      expect((saved.saved, saved.count, saved.limit), (true, 4, 25));
    });
  });

  group('errors map to the web kinds, with the body kept', () {
    Future<LearnError> fails(Future<Object?> Function() call) async {
      try {
        await call();
      } on LearnError catch (e) {
        return e;
      }
      fail('no LearnError');
    }

    test('402 FREE_SESSION_USED keeps the line, the options and the run that holds the day', () async {
      answer = (_) => recorded('error_402_free_session_used');
      final e = await fails(() => api.startRun(const RunStart(kind: LearnKinds.feed, chapterKey: l2Pf)));
      expect(e.kind, LearnErrorKind.sessionUsed);
      expect(e.kind.wire, 'session_used');
      expect(e.status, 402);
      expect(e.code, 'FREE_SESSION_USED');
      expect(isSessionUsed(e), isTrue);
      expect(e.isPaymentRequired, isTrue);
      expect(e.sessionUsed.line, LearnFreeWords.sessionDone);
      expect(e.sessionUsed.options, hasLength(2));
      expect(e.sessionUsed.resume!.title, 'Admission of a Partner');
      expect(e.cause, isA<ApiError>());
    });

    test('404 LEARN_OFF and 404 CHAPTER_NOT_FOUND', () async {
      answer = (_) => const FakeReply(404, {'error': 'LEARN_OFF'});
      final off = await fails(() => api.subject('accountancy'));
      expect(off.kind, LearnErrorKind.off);
      expect(isLearnOff(off), isTrue);
      answer = (_) => recorded('error_404_chapter_not_found_start');
      final missing = await fails(() => api.startRun(const RunStart(kind: LearnKinds.feed, chapterKey: l2Missing)));
      expect(missing.kind, LearnErrorKind.chapterNotFound);
      expect(isChapterMissing(missing), isTrue);
      answer = (_) => recorded('error_404_run_not_found');
      final run = await fails(() => api.getRun('lr_000000000000000000000000'));
      expect(run.kind, LearnErrorKind.error);
      expect(run.code, 'RUN_NOT_FOUND');
    });

    test('409: the question skipped, the run closed with its endHref', () async {
      for (final (code, kind) in [('QUESTION_CHANGED', LearnErrorKind.questionChanged), ('QUESTION_HELD', LearnErrorKind.questionHeld)]) {
        answer = (_) => FakeReply(409, {'error': code});
        final e = await fails(() => api.answer('lr_1', 'i1', 'A'));
        expect(e.kind, kind);
        expect(isQuestionSkipped(e), isTrue);
        expect(isRunClosed(e), isFalse);
      }
      answer = (_) => recorded('error_409_run_ended');
      final ended = await fails(() => api.getRun('lr_1'));
      expect(ended.kind, LearnErrorKind.runEnded);
      expect(isRunClosed(ended), isTrue);
      expect(ended.endHref, startsWith('/explore/run?run=lr_'));
      answer = (_) => const FakeReply(409, {'error': 'RUN_EXPIRED', 'endHref': '/learn/run?run=lr_1&end=1'});
      final expired = await fails(() => api.rate('lr_1', 'i1', 3));
      expect(expired.kind, LearnErrorKind.runExpired);
      expect(expired.endHref, '/learn/run?run=lr_1&end=1');
    });

    test('402 PRO_REQUIRED on a Keep; anything else is an error; offline says so', () async {
      answer = (_) => const FakeReply(402, {'error': 'PRO_REQUIRED', 'reason': 'keycards'});
      expect((await fails(() => api.keep('lr_1', 'i1'))).kind, LearnErrorKind.proRequired);
      answer = (_) => const FakeReply(503, {'error': 'LEARN_UNAVAILABLE', 'message': 'x'});
      final down = await fails(() => api.covers('accountancy'));
      expect(down.kind, LearnErrorKind.error);
      expect(down.code, 'LEARN_UNAVAILABLE');
      expect(down.offline, isFalse);
      answer = (_) => const FakeReply.network();
      final offline = await fails(() => api.shelves('accountancy'));
      expect(offline.kind, LearnErrorKind.error);
      expect(offline.offline, isTrue);
      expect(offline.status, isNull);
      answer = (_) => const FakeReply(402, {'error': 'Free bookmark limit reached', 'limit': 25});
      final limit = await fails(() => api.saveQuestion('q1'));
      expect(limit.isPaymentRequired, isTrue);
      expect(limit.kind, LearnErrorKind.error);
    });

    test('the helpers are false for anything that is not a LearnError', () {
      for (final e in <Object?>[null, Exception('x'), const ApiError(kind: ApiErrorKind.conflict, code: 'RUN_ENDED')]) {
        expect([isSessionUsed(e), isQuestionSkipped(e), isRunClosed(e), isChapterMissing(e), isLearnOff(e)], everyElement(isFalse));
      }
    });

    test("the body interceptor is installed once and leaves other routes' errors as they were", () async {
      final client = newApiClient(http);
      HttpLearnApi(client);
      HttpLearnApi(client);
      expect(client.dio.interceptors.whereType<LearnErrorBodies>(), hasLength(1));
      answer = (_) => const FakeReply(402, {'error': 'PRO_REQUIRED', 'reason': 'x'});
      try {
        await client.post('/api/keycards/review', body: const {});
        fail('no error');
      } on ApiError catch (e) {
        expect(e, isNot(isA<LearnApiError>()));
        expect(e.code, 'PRO_REQUIRED');
      }
    });

    test('without a kept body (an ApiError alone) the kind still comes from the code', () {
      final e = LearnError.fromApiError(const ApiError(status: 409, kind: ApiErrorKind.conflict, code: 'RUN_ENDED'));
      expect(e.kind, LearnErrorKind.runEnded);
      expect(e.data, isEmpty);
      expect(e.endHref, isNull);
      expect(LearnError.fromApiError(const ApiError(kind: ApiErrorKind.network, code: 'network')).offline, isTrue);
      expect(const LearnError.off().toString(), 'LearnError(off, 404, LEARN_OFF)');
    });
  });

  group('retries and the 429 hold', () {
    test('a write the server makes idempotent is sent once more after a dropped connection; a read twice more', () async {
      var n = 0;
      answer = (_) => ++n == 1 ? const FakeReply.network() : recorded('answer_right_pro');
      final a = await api.answer('lr_1', 'i5', 'D');
      expect(a.correct, isTrue);
      expect(seen, hasLength(2));
      n = 0;
      seen.clear();
      answer = (_) => const FakeReply.network();
      await expectLater(api.subject('accountancy'), throwsA(isA<LearnError>()));
      expect(seen, hasLength(3));
    });

    test('/api/learn is its own 429 family: a held write holds Learn writes, not reads and not /api/learning', () async {
      final client = newApiClient(http, now: () => now);
      final learn = HttpLearnApi(client);
      answer = (_) => const FakeReply(429, {'error': 'rate_limited'}, {'retry-after': '30'});
      await expectLater(learn.answer('lr_1', 'i1', 'A'), throwsA(isA<LearnError>()));
      expect(client.heldFor('/api/learn/runs/preview', method: 'POST'), isNotNull);
      expect(client.heldFor('/api/learn/runs/lr_9/rate', method: 'POST'), isNotNull);
      expect(client.heldFor('/api/learn/subject'), isNull);
      expect(client.heldFor('/api/learning/plan', method: 'POST'), isNull);
      expect(client.heldFor('/api/keycards/review', method: 'POST'), isNull);
    });
  });

  group('request keys', () {
    test('a retried start sends the same key; fresh takes a new one; the end lets it go', () async {
      final store = MemoryPrefsStore();
      api = build(keys: LearnRequestKeys(store, userId: 'u1', now: () => now));
      answer = (o) => o.path.endsWith('/end') ? recorded('run_end_feed_aop_pro') : recorded('run_start_feed_aop_pro');
      String keyOf(RequestOptions o) => (o.data as Map)['requestKey'] as String;
      const start = RunStart(kind: LearnKinds.feed, chapterKey: l2Aop);
      final run = await api.startRun(start);
      await api.startRun(start);
      expect(keyOf(seen[1]), keyOf(seen[0]));
      await api.startRun(const RunStart(kind: LearnKinds.mix, chapterKey: l2Aop));
      expect(keyOf(seen[2]), isNot(keyOf(seen[0])));
      await api.startRun(const RunStart(kind: LearnKinds.feed, chapterKey: l2Aop, fresh: true));
      final fresh = keyOf(seen[3]);
      expect(fresh, isNot(keyOf(seen[0])));
      expect((seen[3].data as Map)['fresh'], isTrue);
      await api.end(run.id);
      await api.startRun(start);
      expect(keyOf(seen.last), isNot(fresh));
      await api.startRun(const RunStart(kind: LearnKinds.feed, chapterKey: l2Aop, requestKey: 'lk_own_key_123'));
      expect(keyOf(seen.last), 'lk_own_key_123');
      expect(store.values.keys, contains(LearnPrefs.requestKeysKey));
    });
  });

  test('OffLearnApi, the default, answers every route with LEARN_OFF', () async {
    const off = OffLearnApi();
    final calls = <Future<Object?> Function()>[
      () => off.subject('a'),
      () => off.preview(chapterKey: 'c', minutes: 10),
      () => off.startRun(const RunStart()),
      () => off.getRun('r'),
      () => off.answer('r', 'i', 'A'),
      () => off.rate('r', 'i', 3),
      () => off.keep('r', 'i'),
      () => off.end('r'),
      () => off.chapterCards('c'),
      () => off.subjectCards('a'),
      () => off.shelves(),
      () => off.search('a', 'q'),
      () => off.covers('a'),
      () => off.saveQuestion('q'),
    ];
    for (final call in calls) {
      await expectLater(call(), throwsA(isA<LearnError>().having((e) => e.kind, 'kind', LearnErrorKind.off)));
    }
  });
}
