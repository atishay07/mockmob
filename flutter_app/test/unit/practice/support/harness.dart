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
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier, networkRestoredProvider;
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart' show repairLocalRecordsProvider;
import 'package:mockmob/features/result/widgets/fold_section.dart' show FoldMemory;
import 'package:mockmob/features/credits/data/credit_figures.dart' show CreditFigures, creditFiguresProvider;
import 'package:mockmob/features/practice/widgets/suggestion_hero.dart' show draftAnsweredProvider, draftSummaryProvider;
import 'package:mockmob/features/learn/data/catalog_repository.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart' show studentTimezoneProvider;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/you/you_providers.dart' show PrefToggle, lateNightLinesProvider;
import 'package:mockmob/features/practice/data/practice_notes.dart';
import 'package:mockmob/features/review/data/review_providers.dart' show ReviewInputs, reviewInputsProvider;
import 'package:mockmob/features/review/revise/revise_data.dart' show reviseEntryProvider;
import 'package:mockmob/features/review/again/review_again_entry.dart' show reviewAgainCountProvider;
import 'package:mockmob/features/review/data/review_providers.dart' show openRepairsProvider;
import 'package:mockmob/features/practice/data/practice_prefs.dart';
import 'package:mockmob/features/social/data/mob_models.dart' show MobRead;
import 'package:mockmob/features/social/data/mob_repository.dart' show mobRepositoryProvider;
import 'package:mockmob/features/practice/data/practice_starter.dart';
import '../../../helpers/no_open_paper.dart';
import 'package:mockmob/features/practice/data/result_actions.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/practice_result_screen.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart' show insightsRepositoryProvider;
import 'package:mockmob/features/insights/data/saved_repository.dart' show SavedList, savedRepositoryProvider;
import 'package:mockmob/features/rules/data/rules_data.dart' show startSheetProvider;

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
  FakeCatalog({this.mocks = 6, this.failChapters = false, this.counts = const {}, this.extra = const []});

  int mocks;
  bool failChapters;

  /// `/api/stats` subjectCounts by internal id.
  Map<String, int> counts;

  /// Registry rows practice cannot start in (for the stale-subject banner).
  List<CatalogEntry> extra;

  @override
  Future<List<CatalogEntry>> registry() async => [for (final s in _subjects) CatalogEntry(s), ...extra];

  @override
  Future<Map<String, int>> questionCounts() async => counts;

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

  /// The network changes (offline, then back).
  void change(NetworkStatus next) => state = next;
}

class FakeStarter implements PracticeStarting {
  FakeStarter([this.outcome = const Started('sess-1')]);

  StartOutcome outcome;
  Completer<void>? hold;
  final List<PracticeSelection> started = [];
  final List<int?> mockNumbers = [];

  @override
  Future<StartOutcome> start(PracticeSelection selection, {PracticeQuote? quote, int? mockNumber}) async {
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

  /// The result read arrives.
  void deliver(AttemptDetail value) => state = RemoteState(value: value, fetchedAt: testNow);
}

/// The providers every practice screen needs, all in memory.
List<Override> practiceOverrides({
  FakeQuoteRepository? quotes,
  FakeCatalog? catalog,
  FakeStarter? starter,
  AuthSnapshot? auth,
  FakeAuth? authNotifier,
  NetworkStatus network = NetworkStatus.online,
  FakeNetwork? networkNotifier,
  FakeAnalytics? analytics,
  FakePendingResults? pending,
  SessionDraft? draft,
  int? answered,
  List<Attempt>? attempts,
  LearnCatalog? learn,
  DateTime? now,
  MemoryPrefsStore? prefs,
  Stream<void>? restored,
  bool lateNightLines = true,

  /// Every mistake open on the account (Practice's Repairs row); null: not read yet, no row.
  int? openRepairs,
  List<Override> extra = const [],

  /// A test that brings its own open paper turns this off: nothing is open by default.
  bool nothingOpen = true,
}) => [
  ...(nothingOpen ? noOpenPaperOverrides : quietOpenPaperOverrides),
  practicePrefsStoreProvider.overrideWithValue(prefs ?? MemoryPrefsStore()),
  networkRestoredProvider.overrideWith((ref) => restored ?? const Stream<void>.empty()),
  attemptsRepositoryProvider.overrideWith(() => FakeAttempts(attempts)),
  learnCatalogProvider.overrideWithBuild((ref, notifier) => learn == null ? const RemoteState.idle() : RemoteState(value: learn, fetchedAt: testNow)),
  quoteRepositoryProvider.overrideWithValue(quotes ?? FakeQuoteRepository((s, m, c, p) => creditsQuote())),
  practiceCatalogApiProvider.overrideWithValue(catalog ?? FakeCatalog()),
  practiceStarterProvider.overrideWithValue(starter ?? FakeStarter()),
  authSnapshotProvider.overrideWith(() => authNotifier ?? FakeAuth(auth ?? signedIn())),
  networkStatusProvider.overrideWith(() => networkNotifier ?? FakeNetwork(network)),
  latestSessionDraftProvider.overrideWith((ref) => Stream.value(draft)),
  if (draft != null)
    draftSummaryProvider(draft.sessionId).overrideWith(
      (ref) async => answered == null ? null : DraftSummary(answered: answered, acknowledgedAnswered: answered, total: draft.count),
    ),
  // The painted sheet on the resume card inks exactly the questions that have an answer.
  if (draft != null) draftAnsweredProvider(draft.sessionId).overrideWith((ref) async => answered == null ? null : [for (var i = 0; i < draft.count; i++) i < answered]),
  hapticsProvider.overrideWithValue(const Haptics(enabled: false)),
  // A mock's sheet reads the student's rule from the server (Mistake Lab slice 3); offline here,
  // with no rule in force, so the sheet simply has no line.
  startSheetProvider.overrideWith((ref, subject) async => null),
  // "More ways in" asks Review whether Revise has cards due; no server here, so none (the row falls back to Review again).
  reviseEntryProvider.overrideWith((ref) async => null),
  // Its Review again count reads the phone's repair index (the real drift database, which a widget
  // test cannot open): none repaired here, so the row stays hidden.
  reviewAgainCountProvider.overrideWithValue(0),
  // The Repairs row reads the same index through one count: set per test, none by default.
  openRepairsProvider.overrideWithValue(openRepairs),
  savedRepositoryProvider.overrideWithBuild((ref, n) => RemoteState(value: const SavedList(), fetchedAt: testNow)),
  // "Ask Mobi what to practise" (More ways in) reads the record: settled and empty here, so no line under it and no database.
  insightsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState()),
  analyticsClientProvider.overrideWithValue(analytics ?? FakeAnalytics()),
  pendingResultRepositoryProvider.overrideWithValue(pending ?? FakePendingResults()),
  nowProvider.overrideWithValue(() => now ?? testNow),
  studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
  rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
  lateNightLinesProvider.overrideWith(
    () => PrefToggle(initial: lateNightLines, read: (_) async => lateNightLines, write: (_, _) async {}),
  ),
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
  // Every case starts with the result's folds closed (the memory lasts an app session).
  FoldMemory.instance.reset();
  addTearDown(FoldMemory.instance.reset);
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(initialLocation: location, routes: routes);
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        // The Mob's entry row on Practice reads the server through the phone's database: nothing has
        // been read (it draws nothing) unless the test passes its own.
        if (!overrides.any((o) => identical(o.origin, mobRepositoryProvider)))
          mobRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<MobRead>()),
        ...overrides,
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: RepaintBoundary(
          key: previewBoundary,
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
    ),
  );
  await tester.pump();
  return router;
}

/// Wraps the app pumped by [pumpRouted], so a golden test can also save a DPR 2 preview.
final GlobalKey previewBoundary = GlobalKey(debugLabel: 'preview');

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
  ReplayInventory? replay,
  Future<DateTime?>? receivedLater,

  /// The two balances the next move states (null: unknown, never zero).
  CreditFigures credits = const CreditFigures(),
}) => [
  ...practiceOverrides(catalog: catalog, analytics: analytics, pending: pending, attempts: cachedAttempt == null ? null : [cachedAttempt]),
  creditFiguresProvider.overrideWithValue(credits),
  repairLocalRecordsProvider.overrideWith((ref) => Stream.value(const [])),
  replayInventoryProvider.overrideWith((ref, id) async => replay),
  // The repair key reads Review's index; settled and empty here, so no database stream is opened.
  reviewInputsProvider.overrideWithValue(
    ReviewInputs(attempts: RemoteState(value: cachedAttempt == null ? null : [cachedAttempt], fetchedAt: testNow)),
  ),
  attemptDetailProvider(
    attemptId,
  ).overrideWith(() => FakeDetail(attemptId, detail: detail, error: error, loading: loading, fetchedAt: fetchedAt)),
  resultReceivedAtProvider.overrideWith((ref, id) => receivedLater ?? Future.value(received ?? DateTime(2026, 10, 12, 23, 51))),
  practiceNoteProvider.overrideWith((ref, id) async => PracticeNote(chapter: chapter, mode: 'quick')),
];
