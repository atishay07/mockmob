import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/plan_repository.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/storage_providers.dart';

import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

/// An auth controller that starts signed in without touching Supabase.
class _FakeAuth extends AuthController {
  _FakeAuth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;

  void switchTo(AuthSnapshot next) => state = next;
}

const _signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co');

void main() {
  late AppDatabase db;
  late FakeHttpAdapter http;
  late DateTime now;
  late ProviderContainer container;

  setUp(() {
    db = newTestDb();
    http = FakeHttpAdapter();
    now = DateTime.utc(2026, 10, 12, 16);
    container = ProviderContainer(overrides: [
      authSnapshotProvider.overrideWith(() => _FakeAuth(_signedIn)),
      appDatabaseProvider.overrideWithValue(db),
      apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
      nowProvider.overrideWithValue(() => now),
    ]);
  });

  tearDown(() async {
    container.dispose();
    await db.close();
  });

  Future<void> until(bool Function() done) async {
    for (var i = 0; i < 400 && !done(); i++) {
      await Future<void>.delayed(Duration.zero);
    }
    expect(done(), isTrue, reason: 'state never settled');
  }

  const planJson = {
    'primary': {'kind': 'ordinary_practice', 'title': 'Practise', 'href': '/dashboard?mode=quick&count=10'},
    'alternatives': [],
    'minutes': 10,
    'pathwayState': 'blocked_content',
    'recordState': 'ready',
  };

  group('PlanRepository', () {
    test('loads, caches with the time, and shows the cache first next time', () async {
      http.replies.add(const FakeReply(200, planJson));
      final provider = planRepositoryProvider(10);
      container.read(provider);
      await until(() => container.read(provider).value != null && !container.read(provider).loading);
      expect(container.read(provider).value!.primary.kind, 'ordinary_practice');
      expect(container.read(provider).fromCache, isFalse);
      expect(container.read(provider).fetchedAt, now);
      expect(http.requests.single.path, '/api/learning/plan');
      expect(http.requests.single.headers['Authorization'], startsWith('Bearer '));
      expect((await db.select(db.cachedPlan).get()).single.minutes, 10);

      // A new container (app restart) with no network: the cached plan shows, labelled with its time.
      final offline = FakeHttpAdapter()..handler = (_) => const FakeReply.network();
      now = now.add(const Duration(hours: 3));
      final second = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(() => _FakeAuth(_signedIn)),
        appDatabaseProvider.overrideWithValue(db),
        apiClientProvider.overrideWithValue(newApiClient(offline)),
        nowProvider.overrideWithValue(() => now),
      ]);
      addTearDown(second.dispose);
      second.read(provider);
      await until(() => second.read(provider).error != null);
      final s = second.read(provider);
      expect(s.value!.primary.title, 'Practise');
      expect(s.fromCache, isTrue);
      expect(s.isStale, isTrue);
      expect(s.fetchedAt!.toUtc(), DateTime.utc(2026, 10, 12, 16));
    });

    test('each minutes value is cached separately and sent as a query', () async {
      http.handler = (o) => FakeReply(200, {...planJson, 'minutes': o.queryParameters['minutes']});
      container.read(planRepositoryProvider(10));
      container.read(planRepositoryProvider(30));
      await until(() => container.read(planRepositoryProvider(10)).value != null && container.read(planRepositoryProvider(30)).value != null);
      expect({for (final r in http.requests) r.path}, {'/api/learning/plan'});
      expect((await db.select(db.cachedPlan).get()).map((r) => r.minutes).toSet(), {10, 30});
    });

    test('a failure with nothing cached is an empty failed state', () async {
      http.handler = (_) => const FakeReply(500, {'error': 'x'});
      container.read(planRepositoryProvider(20));
      await until(() => container.read(planRepositoryProvider(20)).error != null);
      expect(container.read(planRepositoryProvider(20)).isFailedEmpty, isTrue);
    });

    test('refresh() reads again and never loops on its own', () async {
      http.replies.add(const FakeReply(200, planJson));
      container.read(planRepositoryProvider(10));
      await until(() => container.read(planRepositoryProvider(10)).value != null && !container.read(planRepositoryProvider(10)).loading);
      final before = http.requests.length;
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(http.requests.length, before);
      http.replies.add(FakeReply(200, {...planJson, 'minutes': 20}));
      await container.read(planRepositoryProvider(10).notifier).refresh();
      expect(http.requests.length, before + 1);
      expect(container.read(planRepositoryProvider(10)).value!.minutes, 20);
    });

    test('a different signed-in user starts empty and does not see the cached plan', () async {
      http.replies.add(const FakeReply(200, planJson));
      container.read(planRepositoryProvider(10));
      await until(() => container.read(planRepositoryProvider(10)).value != null && !container.read(planRepositoryProvider(10)).loading);
      (container.read(authSnapshotProvider.notifier) as _FakeAuth).switchTo(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2'));
      http.handler = (_) => const FakeReply.network();
      container.read(planRepositoryProvider(10));
      await until(() => container.read(planRepositoryProvider(10)).error != null);
      expect(container.read(planRepositoryProvider(10)).value, isNull);
    });

    test('signed out stays idle and makes no request', () async {
      (container.read(authSnapshotProvider.notifier) as _FakeAuth).switchTo(AuthSnapshot.signedOut);
      container.read(planRepositoryProvider(10));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(container.read(planRepositoryProvider(10)).value, isNull);
      expect(http.requests, isEmpty);
    });
  });

  group('AttemptsRepository', () {
    List<Map<String, dynamic>> list(int n) => [
          for (var i = 0; i < n; i++) attemptJson(id: 'a$i', completedAt: 1000 + i, questions: chapterOf('Goodwill', right: 2, wrong: 1)),
        ];

    test('fetches once, parses, and stores one row per attempt newest first', () async {
      http.replies.add(FakeReply(200, jsonEncode(list(3))));
      container.read(attemptsRepositoryProvider);
      await until(() => container.read(attemptsRepositoryProvider).value != null && !container.read(attemptsRepositoryProvider).loading);
      final state = container.read(attemptsRepositoryProvider);
      expect(state.value!.length, 3);
      expect((await db.select(db.cachedAttempts).get()).length, 3);
      expect(http.requests.single.path, '/api/attempts');
    });

    test('cache first: a restart with cached data does not call the network', () async {
      http.replies.add(FakeReply(200, jsonEncode(list(2))));
      container.read(attemptsRepositoryProvider);
      await until(() => container.read(attemptsRepositoryProvider).value != null && !container.read(attemptsRepositoryProvider).loading);

      final quiet = FakeHttpAdapter();
      final second = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(() => _FakeAuth(_signedIn)),
        appDatabaseProvider.overrideWithValue(db),
        apiClientProvider.overrideWithValue(newApiClient(quiet)),
        nowProvider.overrideWithValue(() => now),
      ]);
      addTearDown(second.dispose);
      second.read(attemptsRepositoryProvider);
      await until(() => second.read(attemptsRepositoryProvider).value != null);
      expect(second.read(attemptsRepositoryProvider).value!.length, 2);
      expect(second.read(attemptsRepositoryProvider).fromCache, isTrue);
      expect(second.read(attemptsRepositoryProvider).loading, isFalse);
      expect(quiet.requests, isEmpty);
    });

    test('force refresh replaces the cache, including removing rows that no longer exist', () async {
      http.replies.add(FakeReply(200, jsonEncode(list(3))));
      container.read(attemptsRepositoryProvider);
      await until(() => container.read(attemptsRepositoryProvider).value != null && !container.read(attemptsRepositoryProvider).loading);
      http.replies.add(FakeReply(200, jsonEncode(list(1))));
      await container.read(attemptsRepositoryProvider.notifier).refresh(force: true);
      expect(container.read(attemptsRepositoryProvider).value!.length, 1);
      expect((await db.select(db.cachedAttempts).get()).length, 1);
    });

    test('a large payload is parsed off the main isolate and still comes out right', () async {
      final big = list(60);
      final body = jsonEncode(big);
      expect(body.length, greaterThan(50000));
      http.replies.add(FakeReply(200, body));
      container.read(attemptsRepositoryProvider);
      await until(() => container.read(attemptsRepositoryProvider).value != null && !container.read(attemptsRepositoryProvider).loading);
      expect(container.read(attemptsRepositoryProvider).value!.length, 60);
      expect(container.read(attemptsRepositoryProvider).value!.first.questions.length, 3);
    });

    test('upsertSubmitted puts a fresh attempt at the top and in the cache', () async {
      http.replies.add(FakeReply(200, jsonEncode(list(2))));
      container.read(attemptsRepositoryProvider);
      await until(() => container.read(attemptsRepositoryProvider).value != null && !container.read(attemptsRepositoryProvider).loading);
      await container.read(attemptsRepositoryProvider.notifier).upsertSubmitted(attemptJson(id: 'new', completedAt: 99999, questions: chapterOf('A', right: 1)));
      final attempts = container.read(attemptsRepositoryProvider).value!;
      expect(attempts.first.id, 'new');
      expect(attempts.length, 3);
      expect((await db.select(db.cachedAttempts).get()).length, 3);
    });

    test('detail reads one attempt with its answer reviews and caches it', () async {
      http.replies.add(FakeReply(200, {...attemptJson(id: 'a1', questions: chapterOf('A', right: 1, wrong: 1)), 'answerReviews': {}, 'answerReviewState': 'ready'}));
      container.read(attemptDetailProvider('a1'));
      await until(() => container.read(attemptDetailProvider('a1')).value != null && !container.read(attemptDetailProvider('a1')).loading);
      expect(http.requests.single.path, '/api/attempts/a1');
      expect(container.read(attemptDetailProvider('a1')).value!.answerReviewState, 'ready');
      expect((await db.select(db.cacheEntries).get()).single.cacheKey, 'attempt:a1');
    });
  });

  group('Goal, prefs, rhythm, credits and quote', () {
    test('saving the goal changes state only after the server answers, and sends both fields', () async {
      http.replies.add(const FakeReply(200, {'daysPerWeek': 4, 'timezone': 'Asia/Kolkata', 'pausedUntil': null}));
      container.read(goalRepositoryProvider);
      await until(() => container.read(goalRepositoryProvider).value != null && !container.read(goalRepositoryProvider).loading);
      http.replies.add(const FakeReply(200, {'daysPerWeek': 5, 'timezone': 'Asia/Kolkata', 'pausedUntil': '2026-10-26'}));
      final saved = await container.read(goalRepositoryProvider.notifier).save(daysPerWeek: 5, pausedUntil: '2026-10-26');
      expect(saved.daysPerWeek, 5);
      expect(http.requests.last.method, 'PUT');
      expect(http.requests.last.body, {'daysPerWeek': 5, 'pausedUntil': '2026-10-26'});
      expect(container.read(goalRepositoryProvider).value!.pausedUntil, '2026-10-26');
    });

    test('a rejected goal leaves the state alone and throws', () async {
      http.replies.add(const FakeReply(200, {'daysPerWeek': 4}));
      container.read(goalRepositoryProvider);
      await until(() => container.read(goalRepositoryProvider).value != null && !container.read(goalRepositoryProvider).loading);
      http.replies.add(const FakeReply(422, {'error': 'invalid_request', 'message': 'Pick a date within 100 days.'}));
      await expectLater(container.read(goalRepositoryProvider.notifier).save(daysPerWeek: 4, pausedUntil: '2030-01-01'), throwsA(isA<Object>()));
      expect(container.read(goalRepositoryProvider).value!.daysPerWeek, 4);
    });

    test('notification prefs update sends only the given fields in wire format', () async {
      http.replies.add(const FakeReply(200, {'timezone': 'Asia/Kolkata', 'quietStart': '23:00', 'quietEnd': '07:00', 'channels': {}, 'studyWindow': null, 'weeklyCap': 5}));
      container.read(notificationPrefsRepositoryProvider);
      await until(() => container.read(notificationPrefsRepositoryProvider).value != null && !container.read(notificationPrefsRepositoryProvider).loading);
      http.replies.add(const FakeReply(200, {'timezone': 'Asia/Kolkata', 'quietStart': '22:30', 'quietEnd': '07:00', 'channels': {'study_window': true}, 'studyWindow': {'start': '20:00', 'end': '20:30'}, 'weeklyCap': 3}));
      final next = await container.read(notificationPrefsRepositoryProvider.notifier).update(
            quietStart: const ClockTime(22, 30),
            weeklyCap: 3,
            channels: {'study_window': true},
            studyWindow: const StudyWindow(start: ClockTime(20, 0), end: ClockTime(20, 30)),
          );
      expect(http.requests.last.body, {
        'quietStart': '22:30',
        'weeklyCap': 3,
        'channels': {'study_window': true},
        'studyWindow': {'start': '20:00', 'end': '20:30'},
      });
      expect(next.quietStart, const ClockTime(22, 30));
      expect(container.read(studentTimezoneProvider), 'Asia/Kolkata');
    });

    test('clearing the study window sends null', () async {
      http.replies.add(const FakeReply(200, {'studyWindow': {'start': '20:00', 'end': '20:30'}}));
      container.read(notificationPrefsRepositoryProvider);
      await until(() => container.read(notificationPrefsRepositoryProvider).value != null && !container.read(notificationPrefsRepositoryProvider).loading);
      http.replies.add(const FakeReply(200, {'studyWindow': null}));
      await container.read(notificationPrefsRepositoryProvider.notifier).update(clearStudyWindow: true);
      expect((http.requests.last.body as Map).containsKey('studyWindow'), isTrue);
      expect((http.requests.last.body as Map)['studyWindow'], isNull);
    });

    test('before the prefs load the engine falls back to Asia/Kolkata and the spec quiet hours', () {
      expect(container.read(notificationPrefsRepositoryProvider.notifier).effectivePrefs.quietStart.toWire(), '23:00');
      expect(container.read(studentTimezoneProvider), 'Asia/Kolkata');
    });

    test('rhythm is cached with its time', () async {
      http.replies.add(const FakeReply(200, {'weekStart': '2026-10-12', 'studyDays': 2, 'daysGoal': 4, 'weeksMetStreak': 3}));
      container.read(rhythmRepositoryProvider);
      await until(() => container.read(rhythmRepositoryProvider).value != null && !container.read(rhythmRepositoryProvider).loading);
      expect(container.read(rhythmRepositoryProvider).value!.weeksMetStreak, 3);
      expect((await db.select(db.cacheEntries).get()).single.cacheKey, 'rhythm');
    });

    test('credits keep an unknown balance unknown', () async {
      http.replies.add(const FakeReply(200, {'state': 'available', 'wallet': {'known': false}}));
      container.read(creditsRepositoryProvider);
      await until(() => container.read(creditsRepositoryProvider).value != null && !container.read(creditsRepositoryProvider).loading);
      expect(container.read(creditsRepositoryProvider).value!.explanationBalance, isNull);
    });

    test('the quote sends subject, mode, count and purpose and reads a blocked quote from a 200', () async {
      http.replies.add(const FakeReply(200, {'state': 'blocked', 'launchable': false, 'reasonCode': 'access_required', 'reason': 'NTA-style mode is part of Pro.'}));
      final quote = await container.read(quoteRepositoryProvider).quote(subject: 'accountancy', mode: 'nta', count: 50, purpose: 'full_sample');
      expect(quote.isAccessRequired, isTrue);
      expect(quote.launchable, isFalse);
      final r = http.requests.single;
      expect(r.path, '/api/practice/quote');
    });
  });

  test('RemoteState helpers', () {
    const empty = RemoteState<int>.idle();
    expect(empty.hasValue, isFalse);
    expect(const RemoteState<int>(loading: true).isInitialLoading, isTrue);
    expect(const RemoteState<int>(value: 1, loading: true).isInitialLoading, isFalse);
  });
}
