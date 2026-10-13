import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/repositories/repositories.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/result_routes.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/you/you_providers.dart' show lateNightLinesProvider, PrefToggle;

import '../../../helpers/golden_harness.dart';

/// What the screens asked for.
class ResultLog {
  final List<String> opened = [];
  final List<String> seen = [];
  final List<int> progress = [];
  final List<(String, Map<String, Object?>)> events = [];
  bool hintMarked = false;
  int reminderDeclined = 0;
}

/// Records what the screens asked for, without storage.
class FakeResultActions extends ResultActions {
  FakeResultActions(super.ref, [ResultLog? log]) : log = log ?? ResultLog();

  final ResultLog log;

  List<String> get opened => log.opened;
  List<String> get seen => log.seen;
  List<int> get progress => log.progress;
  List<(String, Map<String, Object?>)> get events => log.events;

  @override
  Future<void> markOpened(String attemptId, {required String mode, required String variant}) async {
    opened.add(attemptId);
    track('result_opened', {'mode': mode, 'variant': variant});
  }

  @override
  Future<void> markSeen(String attemptId) async => seen.add(attemptId);

  @override
  Future<void> saveProgress(String attemptId, int card) async => progress.add(card);

  @override
  Future<void> markSkipHintShown() async => log.hintMarked = true;

  @override
  Future<void> declineReminder() async => log.reminderDeclined++;

  @override
  Future<void> acknowledgeFirstMock(String attemptId, DateTime achievedAt) async => log.events.add(('first_full_mock', {'attempt': attemptId}));

  @override
  void track(String event, Map<String, Object?> props) => events.add((event, props));
}

class FakeHaptics implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

/// Overrides for the result screens. [data] is what `recapDataProvider` returns.
List<Override> resultOverrides({
  required String attemptId,
  required RecapData data,
  RecapRitual ritual = const RecapRitual(),
  int? progress,
  bool reminderDue = false,
  ResultLog? log,
  FakeHaptics? haptics,
  List<Override> extra = const [],
}) => [
  recapDataProvider(attemptId).overrideWithValue(data),
  recapRitualProvider(attemptId).overrideWith((ref) async => ritual),
  recapProgressProvider(attemptId).overrideWith((ref) async => progress),
  resultActionsProvider.overrideWith((ref) => FakeResultActions(ref, log)),
  hapticsProvider.overrideWithValue(Haptics(enabled: haptics != null, driver: haptics ?? FakeHaptics())),
  reminderOfferProvider.overrideWith((ref) async => reminderDue),
  repairLocalRecordsProvider.overrideWith((ref) => Stream.value(const [])),
  nowProvider.overrideWithValue(() => DateTime(2026, 10, 12, 22, 50)),
  studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
  userIdProvider.overrideWithValue('u1'),
  rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
  lateNightLinesProvider.overrideWith(() => PrefToggle(initial: true, read: (_) async => true, write: (_, _) async {})),
  ...extra,
];

/// The result routes plus stubs for every place they lead to.
List<RouteBase> resultRoutes() => [
  GoRoute(
    path: '/result/:attemptId',
    builder: resultScreen,
    routes: [
      GoRoute(path: 'sealed', builder: resultSealedScreen),
      GoRoute(path: 'recap/:card', builder: resultRecapScreen),
    ],
  ),
  for (final p in [
    '/today',
    '/review',
    '/today/alternatives',
    '/practice/setup/:mode',
    '/review/repair/:a/:q',
    '/permissions/notifications',
  ])
    GoRoute(
      path: p,
      builder: (context, state) => Scaffold(body: Center(child: Text('AT ${state.uri}'))),
    ),
];

/// Wraps the whole app, so goldens capture screens that have no Scaffold.
const resultGoldenKey = ValueKey('result-golden');

/// Pumps the app's result routes at [location] in a real router.
Future<GoRouter> pumpResultRoute(
  WidgetTester tester, {
  required String location,
  required List<Override> overrides,
  Brightness brightness = Brightness.dark,
  Size size = const Size(384, 853),
  bool disableAnimations = false,
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(initialLocation: location, routes: resultRoutes());
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: RepaintBoundary(
          key: resultGoldenKey,
          child: MaterialApp.router(
            debugShowCheckedModeBanner: false,
            theme: buildTheme(Brightness.light),
            darkTheme: buildTheme(Brightness.dark),
            themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
            routerConfig: router,
            builder: (context, app) => MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale), disableAnimations: disableAnimations),
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
