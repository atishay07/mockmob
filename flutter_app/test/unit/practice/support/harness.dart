import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier;
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/practice/widgets/resume_slot.dart' show draftSummaryProvider;
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/data/practice_notes.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/practice_result_screen.dart';

import '../../../helpers/golden_harness.dart';

/// The wall clock of every practice widget test: 12 October 2026, 11:00 PM.
final DateTime testNow = DateTime(2026, 10, 12, 23);

/// A launchable quote from the server's own JSON shape.
PracticeQuote quoteOf({
  String state = 'available',
  bool launchable = true,
  String reasonCode = 'ok',
  String? reason,
  int? cost,
  int? balance = 100,
  Map<String, dynamic>? allowance,
  String entitlement = 'free',
  String subjectName = 'Accountancy',
  String mode = 'quick',
  int count = 10,
  int? durationSec,
  DateTime? expiresAt,
}) => PracticeQuote.fromJson({
  'state': state,
  'launchable': launchable,
  'reasonCode': reasonCode,
  'reason': reason,
  'creditCost': cost,
  'creditBalance': balance,
  'allowance': allowance,
  'entitlement': {'kind': entitlement},
  'subject': {'id': 'accountancy', 'name': subjectName},
  'mode': {'id': mode},
  'count': count,
  'durationSec': durationSec,
  'idempotencyToken': launchable ? 'token-0000000000' : null,
  'expiresAt': (expiresAt ?? testNow.add(const Duration(minutes: 1))).toUtc().toIso8601String(),
});

PracticeQuote dailyFree({int count = 10}) =>
    quoteOf(cost: 0, allowance: {'kind': 'daily_practice', 'state': 'available'}, durationSec: count * 60, count: count);
PracticeQuote creditsQuote({int cost = 10, int balance = 100, String mode = 'quick', int count = 10}) =>
    quoteOf(cost: cost, balance: balance, durationSec: mode == 'full' ? 3600 : count * 60, count: count, mode: mode);
PracticeQuote lowCredits({int cost = 10, int balance = 8}) => quoteOf(
  state: 'blocked',
  launchable: false,
  reasonCode: 'insufficient_credits',
  reason: 'Quick Practice costs 10 credits and you have 8.',
  cost: cost,
  balance: balance,
);
PracticeQuote proGate() => quoteOf(
  state: 'blocked',
  launchable: false,
  reasonCode: 'access_required',
  reason: 'NTA Mode needs Pro. Quick Practice and Full Mock are available with credits.',
  mode: 'nta',
  count: 50,
);
PracticeQuote modeUnavailable() =>
    quoteOf(state: 'unavailable', launchable: false, reasonCode: 'mode_unavailable', reason: 'NTA Mode is not available right now.');

typedef QuoteHandler = FutureOr<PracticeQuote> Function(String subject, String mode, int? count, String? purpose);

class FakeQuoteRepository implements QuoteRepository {
  FakeQuoteRepository(this.handler);

  QuoteHandler handler;
  final List<({String subject, String mode, int? count, String? purpose})> calls = [];

  @override
  Future<PracticeQuote> quote({required String subject, required String mode, int? count, String? purpose}) async {
    calls.add((subject: subject, mode: mode, count: count, purpose: purpose));
    return handler(subject, mode, count, purpose);
  }
}

class FakeCatalog implements PracticeCatalogApi {
  FakeCatalog({this.mocks = 6, this.failChapters = false});

  int mocks;
  bool failChapters;

  static const _subjects = [
    Subject(id: 'english', internalId: 'english', name: 'English', practice: 'supported'),
    Subject(id: 'accountancy', internalId: 'accountancy', name: 'Accountancy', practice: 'supported'),
    Subject(id: 'business_studies', internalId: 'business_studies', name: 'Business studies', practice: 'supported'),
    Subject(id: 'economics', internalId: 'economics', name: 'Economics', practice: 'supported'),
    Subject(id: 'physics', internalId: 'physics', name: 'Physics', practice: 'supported'),
    Subject(id: 'general_test', internalId: 'gat', name: 'General test', practice: 'supported'),
  ];

  @override
  Future<List<Subject>> subjects() async => _subjects;

  @override
  Future<ChapterCatalog> chapters(String subjectId) async {
    if (failChapters) throw const ApiError(kind: ApiErrorKind.server, code: 'server_error');
    return const ChapterCatalog(
      units: [
        ChapterUnit(
          id: 'u1',
          name: 'Partnership accounts',
          chapters: [
            ChapterEntry(id: 'c1', name: 'Admission of a partner'),
            ChapterEntry(id: 'c2', name: 'Retirement and death of a partner'),
            ChapterEntry(id: 'c3', name: 'Goodwill'),
          ],
        ),
        ChapterUnit(
          id: 'u2',
          name: 'Company accounts',
          chapters: [ChapterEntry(id: 'c4', name: 'Issue of shares')],
        ),
      ],
    );
  }

  @override
  Future<List<AttemptSummary>> attemptSummaries({int maxPages = 8}) async => [
    for (var i = 0; i < mocks; i++) AttemptSummary(id: 'm$i', subject: 'accountancy', mode: 'full'),
    const AttemptSummary(id: 'q1', subject: 'accountancy', mode: 'quick'),
  ];
}

class FakeAuth extends AuthController {
  FakeAuth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;

  @override
  Future<void> reload() async {}
}

AuthSnapshot signedIn({List<String> subjects = const ['accountancy', 'english'], int credits = 100}) =>
    AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co', subjects: subjects, creditBalance: credits);

class FakeNetwork extends NetworkStatusNotifier {
  FakeNetwork(this.status);

  final NetworkStatus status;

  @override
  NetworkStatus build() => status;
}

class FakeStarter implements PracticeStarting {
  FakeStarter([this.outcome = const Started('sess-1')]);

  StartOutcome outcome;
  Completer<void>? hold;
  final List<PracticeSelection> started = [];
  final List<int?> mockNumbers = [];

  @override
  Future<StartOutcome> start(PracticeSelection selection, {required PracticeQuote quote, int? mockNumber}) async {
    started.add(selection);
    mockNumbers.add(mockNumber);
    if (hold != null) await hold!.future;
    return outcome;
  }
}

class FakeAnalytics implements AnalyticsClient {
  final List<(String, Map<String, Object?>?)> events = [];

  @override
  Future<bool> track(String name, {Map<String, Object?>? props}) async {
    events.add((name, props));
    return true;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakePendingResults implements PendingResultRepository {
  final List<String> opened = [];
  DateTime? receivedAt;

  @override
  Future<void> markOpened(String attemptId) async => opened.add(attemptId);

  @override
  Future<PendingResult?> find(String attemptId) async =>
      receivedAt == null ? null : PendingResult(attemptId: attemptId, receivedAt: receivedAt!);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeAttempts extends AttemptsRepository {
  FakeAttempts([this.attempts]);

  final List<Attempt>? attempts;

  @override
  RemoteState<List<Attempt>> build() => attempts == null ? const RemoteState.idle() : RemoteState(value: attempts, fetchedAt: testNow);
}

class FakeDetail extends AttemptDetailRepository {
  FakeDetail(super.attemptId, {this.detail, this.error, this.loading = false, this.fetchedAt});

  final AttemptDetail? detail;
  final ApiError? error;
  final bool loading;
  final DateTime? fetchedAt;

  @override
  RemoteState<AttemptDetail> build() => RemoteState(value: detail, error: error, loading: loading, fetchedAt: fetchedAt ?? testNow);

  @override
  Future<void> refresh({bool force = false}) async {}
}

/// The providers every practice screen needs, all in memory.
List<Override> practiceOverrides({
  FakeQuoteRepository? quotes,
  FakeCatalog? catalog,
  FakeStarter? starter,
  AuthSnapshot? auth,
  NetworkStatus network = NetworkStatus.online,
  FakeAnalytics? analytics,
  FakePendingResults? pending,
  SessionDraft? draft,
  List<Override> extra = const [],
}) => [
  quoteRepositoryProvider.overrideWithValue(quotes ?? FakeQuoteRepository((s, m, c, p) => creditsQuote())),
  practiceCatalogApiProvider.overrideWithValue(catalog ?? FakeCatalog()),
  practiceStarterProvider.overrideWithValue(starter ?? FakeStarter()),
  authSnapshotProvider.overrideWith(() => FakeAuth(auth ?? signedIn())),
  networkStatusProvider.overrideWith(() => FakeNetwork(network)),
  latestSessionDraftProvider.overrideWith((ref) => Stream.value(draft)),
  if (draft != null) draftSummaryProvider(draft.sessionId).overrideWith((ref) async => null),
  hapticsProvider.overrideWithValue(const Haptics(enabled: false)),
  analyticsClientProvider.overrideWithValue(analytics ?? FakeAnalytics()),
  pendingResultRepositoryProvider.overrideWithValue(pending ?? FakePendingResults()),
  nowProvider.overrideWithValue(() => testNow),
  ...extra,
];

/// Pumps [routes] in a real [GoRouter], at the golden size, with the app theme.
Future<GoRouter> pumpRouted(
  WidgetTester tester, {
  required String location,
  required List<GoRoute> routes,
  List<Override> overrides = const [],
  Brightness brightness = Brightness.light,
  Size size = kGoldenSize,
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(initialLocation: location, routes: routes);
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp.router(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
          routerConfig: router,
          builder: (context, app) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: app!,
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  return router;
}

/// A route that only shows its own path, so a test can see where the app went.
GoRoute stubRoute(String path) => GoRoute(
  path: path,
  builder: (context, state) => Scaffold(body: Center(child: Text('AT ${state.uri}'))),
);

/// Result-screen overrides for one attempt.
List<Override> resultOverrides({
  required String attemptId,
  AttemptDetail? detail,
  ApiError? error,
  bool loading = false,
  Attempt? cachedAttempt,
  DateTime? received,
  String? chapter,
  FakeCatalog? catalog,
  DateTime? fetchedAt,
  FakeAnalytics? analytics,
  FakePendingResults? pending,
}) => [
  ...practiceOverrides(catalog: catalog, analytics: analytics, pending: pending),
  attemptDetailProvider(
    attemptId,
  ).overrideWith(() => FakeDetail(attemptId, detail: detail, error: error, loading: loading, fetchedAt: fetchedAt)),
  attemptsRepositoryProvider.overrideWith(() => FakeAttempts(cachedAttempt == null ? null : [cachedAttempt])),
  resultReceivedAtProvider.overrideWith((ref, id) async => received ?? DateTime(2026, 10, 12, 23, 51)),
  practiceNoteProvider.overrideWith((ref, id) async => PracticeNote(chapter: chapter, mode: 'quick')),
];
