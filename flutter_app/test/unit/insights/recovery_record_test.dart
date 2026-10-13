// Concept checks and the playbook (website Progress, web parity C4): the slim read of
// GET /api/recovery, its cache, and how the record page shows each state of it.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/recovery_record.dart';
import 'package:mockmob/features/insights/screens/insights_screen.dart';
import 'package:mockmob/features/insights/widgets/recovery_sections.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';
import 'support/insights_fixtures.dart';

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
}

const _serverBody = {
  'attempts': [
    {'id': 'a1', 'questionsSnapshot': [{}]},
  ],
  'ordinaryReview': [],
  'reviews': [],
  'dueReviews': 0,
  'milestones': [
    {'kind': 'first_session', 'title': 'x', 'href': '/result/a1', 'detail': 'y'},
  ],
  'note': 'Fresh delayed checks provide concept evidence.',
  'playbookState': 'ready',
  'progress': [
    {'concept': 'Partnership: admission of a partner', 'state': 'delayed_check_1', 'sampleSize': 2, 'evidenceLabel': 'One delayed check passed'},
    {'concept': '', 'state': 'x', 'sampleSize': 1, 'evidenceLabel': 'nameless, dropped'},
  ],
  'playbook': [
    {'id': 7, 'attempt_id': 'a1', 'strategy': 'concept_repair', 'reflection': '  Read each option twice.  ', 'evidence_state': 'more_evidence_needed', 'created_at': '2026-10-12T16:30:00+00:00'},
    {'id': 8, 'attempt_id': 'a2', 'strategy': 'two_pass', 'reflection': '', 'created_at': '2026-10-10T08:00:00Z'},
    {'id': 9, 'attempt_id': null, 'strategy': 'something_new', 'reflection': 'Kept short.'},
  ],
};

void main() {
  setUpAll(loadAppFonts);

  group('RecoveryRecord.fromJson', () {
    test('reads checks and playbook, drops nameless rows, keeps nothing else', () {
      final r = RecoveryRecord.fromJson(_serverBody);
      expect(r.checks, hasLength(1));
      expect(r.checks.single.sampleSize, 2);
      expect(r.checks.single.evidenceLabel, 'One delayed check passed');
      expect(r.playbook, hasLength(3));
      expect(r.playbook.first.id, '7');
      expect(r.playbook.first.attemptId, 'a1');
      expect(r.playbook.first.reflection, 'Read each option twice.');
      expect(r.playbook.first.savedAt, DateTime.utc(2026, 10, 12, 16, 30));
      expect(r.playbookAvailable, isTrue);
    });

    test('strategy names are plain sentence case, and an unknown one is shown not hidden', () {
      final r = RecoveryRecord.fromJson(_serverBody);
      expect(r.playbook[0].strategyLabel, 'Concept repair');
      expect(r.playbook[1].strategyLabel, 'Two-pass approach');
      expect(r.playbook[2].strategyLabel, 'Something new');
    });

    test('an unavailable playbook is not the same as an empty one', () {
      final r = RecoveryRecord.fromJson({'playbookState': 'unavailable', 'playbook': [], 'progress': []});
      expect(r.playbookAvailable, isFalse);
      expect(r.playbook, isEmpty);
    });

    test('garbage reads as empty instead of throwing', () {
      expect(RecoveryRecord.fromJson('nope').checks, isEmpty);
      expect(RecoveryRecord.fromJson(null).playbook, isEmpty);
      expect(RecoveryRecord.fromJson({'progress': 'x', 'playbook': [1, 'a']}).playbook, isEmpty);
    });

    test('the slim copy for the cache reads back the same', () {
      final r = RecoveryRecord.fromJson(_serverBody);
      final again = RecoveryRecord.fromJson(r.toJson());
      expect(again.checks.single.concept, r.checks.single.concept);
      expect(again.playbook.map((p) => p.id), r.playbook.map((p) => p.id));
      expect(again.playbook.first.savedAt, r.playbook.first.savedAt);
      expect(r.toJson().containsKey('attempts'), isFalse);
    });
  });

  group('RecoveryRecordRepository', () {
    late AppDatabase db;
    late FakeHttpAdapter http;
    late ProviderContainer container;
    final now = DateTime.utc(2026, 10, 13, 15);

    ProviderContainer make(FakeHttpAdapter adapter) => ProviderContainer(overrides: [
          authSnapshotProvider.overrideWith(_FakeAuth.new),
          appDatabaseProvider.overrideWithValue(db),
          apiClientProvider.overrideWithValue(newApiClient(adapter, now: () => now)),
          nowProvider.overrideWithValue(() => now),
        ]);

    setUp(() {
      db = newTestDb();
      http = FakeHttpAdapter();
      container = make(http);
    });

    tearDown(() async {
      container.dispose();
      await db.close();
    });

    Future<void> until(ProviderContainer c, bool Function(RemoteState<RecoveryRecord>) done) async {
      for (var i = 0; i < 600 && !done(c.read(recoveryRecordRepositoryProvider)); i++) {
        await Future<void>.delayed(const Duration(milliseconds: 5));
      }
      final st = c.read(recoveryRecordRepositoryProvider); expect(done(st), isTrue, reason: 'state never settled: loading=${st.loading} err=${st.error?.code} val=${st.value}');
    }

    test('one read when first watched, the slim record cached, nothing fetched again by itself', () async {
      http.replies.add(const FakeReply(200, _serverBody));
      container.read(recoveryRecordRepositoryProvider);
      await until(container, (s) => s.value != null && !s.loading);
      expect(http.requests.single.path, '/api/recovery');
      expect(container.read(recoveryRecordRepositoryProvider).value!.playbook, hasLength(3));
      final cached = (await db.select(db.cacheEntries).get()).single;
      expect(cached.cacheKey, 'recovery-record');
      expect(cached.json.contains('questionsSnapshot'), isFalse);
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(http.requests, hasLength(1));
    });

    test('a response with every attempt in it (large) is still read and only the slim record is kept', () async {
      final filler = 'x' * 80000;
      http.replies.add(FakeReply(200, {..._serverBody, 'attempts': [{'id': 'a1', 'questionsSnapshot': filler}]}));
      container.read(recoveryRecordRepositoryProvider);
      await until(container, (s) => s.value != null && !s.loading);
      expect(container.read(recoveryRecordRepositoryProvider).value!.checks, hasLength(1));
    });

    test('offline after a first read shows the phone copy, marked stale', () async {
      http.replies.add(const FakeReply(200, _serverBody));
      container.read(recoveryRecordRepositoryProvider);
      await until(container, (s) => s.value != null && !s.loading);

      final offline = FakeHttpAdapter()..handler = (_) => const FakeReply.network();
      final second = make(offline);
      addTearDown(second.dispose);
      second.read(recoveryRecordRepositoryProvider);
      await until(second, (s) => s.error != null && !s.loading);
      final s = second.read(recoveryRecordRepositoryProvider);
      expect(s.value!.checks.single.sampleSize, 2);
      expect(s.isStale, isTrue);
      expect(s.error!.isOffline, isTrue);
    });

    test('a failed first read with no copy is a plain failure', () async {
      http.handler = (_) => const FakeReply(503, {'error': 'unavailable'});
      container.read(recoveryRecordRepositoryProvider);
      await until(container, (s) => s.isFailedEmpty);
      expect(container.read(recoveryRecordRepositoryProvider).value, isNull);
    });

    test('a body that is not the record is an unusable response, not a crash', () async {
      http.replies.add(const FakeReply(200, '<html>maintenance</html>'));
      container.read(recoveryRecordRepositoryProvider);
      await until(container, (s) => s.isFailedEmpty);
      expect(container.read(recoveryRecordRepositoryProvider).error!.code, 'unusable_response');
    });
  });

  group('RecoverySections', () {
    Future<void> pump(WidgetTester tester, RemoteState<RecoveryRecord> state, {Future<void> Function()? onRetry, GoRouter? router}) async {
      final body = SingleChildScrollView(child: Padding(padding: const EdgeInsets.all(16), child: RecoverySections(state: state, onRetry: onRetry ?? () async {})));
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            theme: buildTheme(Brightness.light),
            routerConfig: router ??
                GoRouter(routes: [
                  GoRoute(path: '/', builder: (c, s) => Scaffold(body: body)),
                  GoRoute(path: '/result/:id', builder: (c, s) => Scaffold(body: Text('RESULT ${s.pathParameters['id']}'))),
                ]),
          ),
        ),
      );
      await tester.pump();
    }

    RemoteState<RecoveryRecord> value(Map<String, dynamic> j, {ApiError? error}) => RemoteState(value: RecoveryRecord.fromJson(j), error: error);

    testWidgets('nothing is drawn while it has not been asked for', (tester) async {
      const idle = RemoteState<RecoveryRecord>.idle();
      expect(RecoverySections.shows(idle), isFalse);
      await pump(tester, idle);
      expect(find.text(InsightsCopy.checksHeading), findsNothing);
      expect(find.text(InsightsCopy.playbookHeading), findsNothing);
    });

    testWidgets('while it loads, a placeholder holds the place and no section claims anything', (tester) async {
      await pump(tester, const RemoteState<RecoveryRecord>(loading: true));
      expect(find.bySemanticsLabel('Loading checks and playbook'), findsOneWidget);
      expect(find.text(InsightsCopy.checksEmpty), findsNothing);
    });

    testWidgets('failed with nothing on the phone: one plain row, and Try again asks again', (tester) async {
      var retried = 0;
      await pump(
        tester,
        const RemoteState<RecoveryRecord>(error: ApiError(kind: ApiErrorKind.server, code: 'x', status: 503)),
        onRetry: () async => retried++,
      );
      expect(find.text(InsightsCopy.recoveryFailed), findsOneWidget);
      await tester.tap(find.text(InsightsCopy.retry));
      expect(retried, 1);
    });

    testWidgets('offline with nothing on the phone says so', (tester) async {
      await pump(tester, const RemoteState<RecoveryRecord>(error: ApiError(kind: ApiErrorKind.network, code: 'network')));
      expect(find.text(InsightsCopy.recoveryOffline), findsOneWidget);
      expect(find.text(InsightsCopy.recoveryFailed), findsNothing);
    });

    testWidgets('empty: checks and playbook each say what is true', (tester) async {
      await pump(tester, value({'progress': [], 'playbook': []}));
      expect(find.text(InsightsCopy.checksEmpty), findsOneWidget);
      expect(find.text(InsightsCopy.playbookEmpty), findsOneWidget);
    });

    testWidgets('an unreadable playbook is not shown as empty', (tester) async {
      await pump(tester, value({'progress': [], 'playbook': [], 'playbookState': 'unavailable'}));
      expect(find.text(InsightsCopy.playbookUnavailable), findsOneWidget);
      expect(find.text(InsightsCopy.playbookEmpty), findsNothing);
    });

    testWidgets('rich: checks with their counts, playbook with strategy, reason, date and what it cannot claim', (tester) async {
      await pump(tester, value(_serverBody));
      expect(find.text('Partnership: admission of a partner'), findsOneWidget);
      expect(find.text('One delayed check passed'), findsOneWidget);
      expect(find.text('2 delayed checks'), findsOneWidget);
      expect(find.text('Concept repair'), findsOneWidget);
      expect(find.text('Read each option twice.'), findsOneWidget);
      expect(find.text('Two-pass approach'), findsOneWidget);
      expect(find.text(InsightsCopy.playbookNoReflection), findsOneWidget);
      expect(find.text(InsightsCopy.playbookEvidence), findsNWidgets(3));
      expect(find.text('12 Oct'), findsOneWidget);
    });

    testWidgets('a playbook row opens the session it was written about; one without a session does not', (tester) async {
      await pump(tester, value(_serverBody));
      await tester.tap(find.text('Concept repair'));
      await tester.pumpAndSettle();
      expect(find.text('RESULT a1'), findsOneWidget);
    });

    testWidgets('text at 1.3 scale does not overflow', (tester) async {
      tester.view.physicalSize = const Size(384 * 2, 900 * 2);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.3)), child: app!),
            home: Scaffold(body: SingleChildScrollView(child: Padding(padding: const EdgeInsets.all(16), child: RecoverySections(state: value(_serverBody), onRetry: () async {})))),
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  });

  group('the record page', () {
    Future<void> pumpPage(WidgetTester tester, RemoteState<RecoveryRecord>? recovery) async {
      final record = RemoteState(value: rich(), fetchedAt: DateTime.utc(2026, 10, 13, 14, 30));
      tester.view.physicalSize = const Size(384 * 2, 3600 * 2);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authSnapshotProvider.overrideWith(_FakeAuth.new),
            nowProvider.overrideWithValue(() => DateTime.utc(2026, 10, 13, 14, 30)),
            insightsInputsProvider.overrideWithValue(InsightsInputs(insights: record, attempts: trendAttempts(), recovery: recovery)),
          ],
          child: MaterialApp(theme: buildTheme(Brightness.light), home: const InsightsScreen()),
        ),
      );
      await tester.pump();
    }

    testWidgets('puts concept checks and the playbook at the end of the record', (tester) async {
      await pumpPage(tester, RemoteState(value: RecoveryRecord.fromJson(_serverBody)));
      expect(find.text(InsightsCopy.checksHeading), findsOneWidget);
      expect(find.text(InsightsCopy.playbookHeading), findsOneWidget);
      final byTop = tester.getTopLeft(find.text(InsightsCopy.subjectsHeading)).dy;
      expect(tester.getTopLeft(find.text(InsightsCopy.checksHeading)).dy, greaterThan(byTop));
    });

    testWidgets('leaves the record exactly as it was while the read has not started', (tester) async {
      await pumpPage(tester, null);
      expect(find.text(InsightsCopy.checksHeading), findsNothing);
      expect(find.text(InsightsCopy.playbookHeading), findsNothing);
      expect(find.text(InsightsCopy.subjectsHeading), findsOneWidget);
    });
  });
}
