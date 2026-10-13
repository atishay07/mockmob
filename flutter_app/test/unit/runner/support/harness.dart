import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/runner/data/runner_effects.dart';
import 'package:mockmob/features/runner/data/runner_loader.dart';
import 'package:mockmob/features/runner/data/runner_session.dart';
import 'package:mockmob/features/runner/runner_routes.dart';

import '../../../helpers/golden_harness.dart' show FileAssetBundle;

/// The Night Sheet frame: 384 by 853 logical px at DPR 2.
const Size kRunnerSize = Size(384, 853);

class RecordingSystemUi implements RunnerSystemUi {
  final List<String> calls = [];

  @override
  Future<void> enter() async => calls.add('enter');

  @override
  Future<void> exit() async => calls.add('exit');
}

class RecordingHaptics implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<void> selectionClick() async => calls.add('selection');
}

class RunnerHarness {
  RunnerHarness({required this.router, required this.systemUi, required this.haptics, required this.afterSubmit});

  final GoRouter router;
  final RecordingSystemUi systemUi;
  final RecordingHaptics haptics;
  final List<RunnerSession> afterSubmit;

  String get location => router.routerDelegate.currentConfiguration.uri.toString();
}

GoRoute _stub(String path) => GoRoute(
  path: path,
  builder: (context, state) => Scaffold(body: Center(child: Text('AT ${state.uri}'))),
);

/// Pumps the runner routes with [load] as what opening the session finds.
Future<RunnerHarness> pumpRunner(
  WidgetTester tester, {
  RunnerLoad? load,
  RunnerSession? session,
  String location = '/run/sess-1',
  Brightness brightness = Brightness.dark,
  Size size = kRunnerSize,
  double textScale = 1,
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  final opened = load ?? RunnerReady(session!);
  final systemUi = RecordingSystemUi();
  final haptics = RecordingHaptics();
  final after = <RunnerSession>[];
  final router = GoRouter(
    initialLocation: location,
    routes: [
      GoRoute(
        path: '/run/:sessionId',
        builder: runScreen,
        routes: [GoRoute(path: 'submit', builder: runSubmitScreen)],
      ),
      _stub('/practice'),
      _stub('/practice/result/:attemptId'),
      _stub('/today'),
      _stub('/result/:attemptId/sealed'),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        runnerOpenerProvider.overrideWithValue((_) async => opened),
        runnerSystemUiProvider.overrideWithValue(systemUi),
        runnerAfterSubmitProvider.overrideWithValue(after.add),
        networkRestoredProvider.overrideWith((ref) => const Stream<void>.empty()),
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ...overrides,
      ],
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
  await tester.pump();
  return RunnerHarness(router: router, systemUi: systemUi, haptics: haptics, afterSubmit: after);
}

/// Lets sheets and page transitions finish.
Future<void> settle(WidgetTester tester, {int ms = 800}) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(Duration(milliseconds: ms ~/ 8));
  }
}
