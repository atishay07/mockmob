// A harness for the Learn run's tests: the controller over the recorded Learn server (FixtureLearnApi), the effects it asks
// for, the right and wrong keys of the recorded questions, and the run screen inside a real GoRouter (so Close, Back and every
// key that opens another place can be followed) with the app's theme, a recording haptics driver, reduced motion and text scale
// on demand.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart' show savedRepositoryProvider;
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/run/run_controller.dart';
import 'package:mockmob/features/learn2/run/run_screen.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

import '../../support/fixture_learn_api.dart';

export '../../support/fixture_learn_api.dart';

/// A synthetic card item (a card that parses): `i<n>` of the run `lr_script`.
Map<String, Object?> scriptedCard(int n, {bool look = false, String stage = 'new', String? reason, int seconds = 15}) => {
  'id': 'lr_script-i$n',
  'type': 'card',
  'stage': stage,
  'look': look,
  'recap': false,
  'reason': ?reason,
  'seconds': seconds,
  'card': {
    'id': 'kc.script.c$n',
    'kind': 'definition',
    'front': 'What is idea number $n?',
    'back': 'Idea number $n is a line the book says.',
    'chapterKey': l2Pf,
    'importance': 'must',
    'source': {'kind': 'ncert', 'book': 'Accountancy', 'code': 'leac101', 'chapterNo': 1, 'page': n},
  },
};

/// A run the test writes itself: [items] under the chapter Partnership Fundamentals.
LearnRun scriptedRun(List<Map<String, Object?>> items, {String kind = 'cards', Map<String, Object?>? looks, Map<String, Object?>? resumed, int pile = 0}) =>
    LearnRun.parse({
      'id': 'lr_script',
      'kind': kind,
      'chapter': {'key': l2Pf, 'title': 'Accounting for Partnership: Basic Concepts', 'ref': 'Ch 1', 'partTitle': 'Part 1, Partnership Accounts', 'number': 1},
      'minutes': 10,
      'asked': 10,
      'items': items,
      'revisePile': {'count': pile},
      'resumed': resumed,
      'looks': looks,
    });

/// A server that hands out one written run and takes every rating: for the cases the recordings do not hold (Free's looks,
/// a cards run past 20, an empty run). [rates] answers a rating by its item and rating; the default takes it and counts it
/// into the pile.
class ScriptedRunApi implements LearnApi {
  ScriptedRunApi(this.run, {this.rates, this.endError});

  LearnRun run;
  LearnRateResult Function(String itemId, int rating)? rates;
  Object? endError;
  final List<({String itemId, int rating})> ratings = [];
  final List<RunStart> starts = [];
  int piled = 0;

  @override
  Future<LearnRun> startRun(RunStart start) async {
    starts.add(start);
    return run;
  }

  @override
  Future<LearnRun> getRun(String runId) async => run;

  @override
  Future<LearnRateResult> rate(String runId, String itemId, int rating) async {
    ratings.add((itemId: itemId, rating: rating));
    final custom = rates;
    if (custom != null) return custom(itemId, rating);
    if (rating != 1) piled += 1;
    return LearnRateResult(
      ok: true,
      stamp: rating == 1 ? 'Back later in this run' : 'Back Wed',
      revisePile: piled,
      raw: {
        'ok': true,
        'revisePile': {'count': piled},
      },
    );
  }

  @override
  Future<LearnEnd> end(String runId) async {
    final error = endError;
    if (error != null) throw error;
    return LearnFixtures.end('run_end_mix_pf_pro');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('ScriptedRunApi.${invocation.memberName}');
}

/// What the controller asked the screen to do.
class RunEvents {
  final List<String> said = [];
  final List<RunRated> rated = [];
  final List<String> seePro = [];
  final List<String> lessons = [];
  int saved = 0;
}

/// A run controller over [api] that records its effects in [events]. Reduced motion by default, so a rating's hand-off is
/// 120 ms and no long timer is left behind.
RunController runController(
  LearnApi api, {
  RunLaunch launch = const RunLaunch(chapterKey: l2Pf),
  RunEvents? events,
  LearnPrefs? prefs,
  bool reduced = true,
  Future<void> Function(String lessonId)? openLesson,
}) {
  final e = events ?? RunEvents();
  return RunController(
    api: api,
    launch: launch,
    prefs: prefs,
    onSay: e.said.add,
    onRated: e.rated.add,
    onSeePro: e.seePro.add,
    onSaved: () => e.saved += 1,
    openLesson:
        openLesson ??
        (id) async {
          e.lessons.add(id);
        },
  )..reduced = reduced;
}

/// Lets the fake server's answers land.
Future<void> settle([int turns = 8]) async {
  for (var i = 0; i < turns; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// Lets a rating's hand-off pass (reduced motion: 120 ms) and the next item come.
Future<void> afterFlight() async {
  await Future<void>.delayed(const Duration(milliseconds: 160));
  await settle();
}

/// The right key of a recorded question (as the fake grades it).
String rightKey(LearnQuestionItem item) => LearnFixtures.key(item.question.id) ?? 'A';

/// A key that is not the right one.
String wrongKey(LearnQuestionItem item) {
  final right = rightKey(item);
  return item.question.options.firstWhere((o) => o.key != right).key;
}

/// Records every haptic the screen asks for.
class RunHaptics implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

/// The overrides the run needs under test: the recorded server, an in-memory store, a Saved list that reads nothing, recorded
/// haptics and the Pro nudges on or off.
List<Override> runOverrides(FixtureLearnApi api, {PrefsStore? store, RunHaptics? haptics, bool proNudges = false}) => [
  ...learnFixtureOverrides(api, store: store),
  savedRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState()),
  hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics ?? RunHaptics())),
  proNudgesOnProvider.overrideWithValue(proNudges),
];

/// A place the run opened: its location in words.
class RunPlace extends StatelessWidget {
  const RunPlace(this.location, {super.key});

  final String location;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('at $location'),
          TextButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('come back')),
        ],
      ),
    ),
  );
}

/// The page under the run (the host it was opened from).
class RunHost extends StatelessWidget {
  const RunHost({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('host')));
}

/// The run's screen state, for its controller.
LearnRunScreenState runState(WidgetTester tester) => tester.state<LearnRunScreenState>(find.byType(LearnRunScreen));

/// Pumps the run of [launch] pushed over a host page in a GoRouter, on a [size] phone.
Future<GoRouter> pumpRun(
  WidgetTester tester,
  FixtureLearnApi api, {
  RunLaunch launch = const RunLaunch(chapterKey: l2Pf),
  Size size = const Size(360, 800),
  Brightness brightness = Brightness.dark,
  bool reduced = true,
  double textScale = 1,
  PrefsStore? store,
  RunHaptics? haptics,
  bool proNudges = false,
  EdgeInsets padding = EdgeInsets.zero,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: '/host',
    routes: [
      GoRoute(path: '/host', builder: (context, state) => const RunHost()),
      GoRoute(
        path: '/learn/session',
        builder: (context, state) => LearnRunScreen(key: ValueKey('run-${state.uri.query}'), launch: RunLaunch.fromQuery(state.uri.queryParameters)),
      ),
    ],
    errorBuilder: (context, state) => RunPlace(state.uri.toString()),
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: runOverrides(api, store: store, haptics: haptics, proNudges: proNudges),
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(brightness),
        routerConfig: router,
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: reduced, textScaler: TextScaler.linear(textScale), padding: padding, viewPadding: padding),
          child: app!,
        ),
      ),
    ),
  );
  unawaited(router.push<void>(Learn2Links.run(launch)));
  await runSettle(tester);
  return router;
}

/// Pumps until the run has its answer and the stage has drawn (the reduced-motion swaps are 120 ms).
Future<void> runSettle(WidgetTester tester) async {
  await tester.pump();
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 120));
  }
}

/// The system Back key.
Future<void> systemBack(WidgetTester tester) async {
  // ignore: invalid_use_of_protected_member
  await tester.binding.handlePopRoute();
  await runSettle(tester);
}

/// Keeps a key's [SystemChannels] quiet in a test (the platform's haptics and announcements).
void quietPlatform() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async => null);
}
