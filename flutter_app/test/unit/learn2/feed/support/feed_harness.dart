// A harness for the Explore feed's tests: the controller over the recorded Learn server (FixtureLearnApi), the effects
// it asks for, the right and wrong keys of the recorded questions, and the feed screen inside a real GoRouter (so Close,
// Back and every key that opens another place can be followed) with the app's theme, a recording haptics driver,
// reduced motion and text scale on demand.
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
import 'package:mockmob/features/learn2/feed/feed_controller.dart';
import 'package:mockmob/features/learn2/feed/feed_screen.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

import '../../support/fixture_learn_api.dart';

export '../../support/fixture_learn_api.dart';

/// What the controller asked the screen to do.
class FeedEvents {
  final List<String> said = [];
  final List<String> kept = [];
  final List<String> seePro = [];
  int saved = 0;
}

/// A feed controller over [api] that records its effects in [events]. Reduced motion by default, so a turn's back
/// counts at once and no timer is left behind.
FeedController feedController(
  LearnApi api, {
  FeedLaunch launch = const FeedLaunch(chapterKey: l2Aop),
  FeedEvents? events,
  LearnPrefs? prefs,
  String? studentId,
  bool reduced = true,
}) {
  final e = events ?? FeedEvents();
  return FeedController(
    api: api,
    launch: launch,
    prefs: prefs,
    studentId: studentId,
    onSay: e.said.add,
    onKept: e.kept.add,
    onSaved: () => e.saved += 1,
    onSeePro: e.seePro.add,
  )..reduced = reduced;
}

/// Lets the fake server's answers land.
Future<void> settle([int turns = 6]) async {
  for (var i = 0; i < turns; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// The right key of a recorded question (as the fake grades it).
String rightKey(LearnQuestionItem item) => LearnFixtures.key(item.question.id) ?? 'A';

/// A key that is not the right one.
String wrongKey(LearnQuestionItem item) {
  final right = rightKey(item);
  return item.question.options.firstWhere((o) => o.key != right).key;
}

/// Records every haptic the screen asks for.
class FeedHaptics implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

/// The overrides the feed needs under test: the recorded server, an in-memory store, a Saved list that reads
/// nothing, recorded haptics and the Pro nudges on or off.
List<Override> feedOverrides(FixtureLearnApi api, {PrefsStore? store, FeedHaptics? haptics, bool proNudges = false}) => [
  ...learnFixtureOverrides(api, store: store),
  savedRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState()),
  hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics ?? FeedHaptics())),
  proNudgesOnProvider.overrideWithValue(proNudges),
];

/// A place the feed opened: its location in words.
class FeedPlace extends StatelessWidget {
  const FeedPlace(this.location, {super.key});

  final String location;

  @override
  Widget build(BuildContext context) => Scaffold(body: Center(child: Text('at $location')));
}

/// The page under the feed (the host it was opened from).
class FeedHost extends StatelessWidget {
  const FeedHost({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('host')));
}

/// The feed's screen state, for its controller.
FeedScreenState feedState(WidgetTester tester) => tester.state<FeedScreenState>(find.byType(FeedScreen));

/// Pumps the feed of [launch] pushed over a host page in a GoRouter, on a [size] phone.
Future<GoRouter> pumpFeed(
  WidgetTester tester,
  FixtureLearnApi api, {
  FeedLaunch launch = const FeedLaunch(chapterKey: l2Aop),
  Size size = const Size(360, 800),
  Brightness brightness = Brightness.dark,
  bool reduced = true,
  double textScale = 1,
  PrefsStore? store,
  FeedHaptics? haptics,
  bool proNudges = false,
  EdgeInsets padding = EdgeInsets.zero,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: '/host',
    routes: [
      GoRoute(path: '/host', builder: (context, state) => const FeedHost()),
      GoRoute(
        path: '/explore/feed',
        builder: (context, state) => FeedScreen(key: ValueKey('feed-${state.uri.query}'), launch: FeedLaunch.fromQuery(state.uri.queryParameters)),
      ),
    ],
    errorBuilder: (context, state) => FeedPlace(state.uri.toString()),
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: feedOverrides(api, store: store, haptics: haptics, proNudges: proNudges),
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(brightness),
        routerConfig: router,
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: reduced,
            textScaler: TextScaler.linear(textScale),
            padding: padding,
            viewPadding: padding,
          ),
          child: app!,
        ),
      ),
    ),
  );
  unawaited(router.push<void>(Learn2Links.feed(launch)));
  await feedSettle(tester);
  return router;
}

/// Pumps until the feed has its answer and the stage has drawn (the reduced-motion swaps are 120 ms).
Future<void> feedSettle(WidgetTester tester) async {
  await tester.pump();
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 120));
  }
}

/// The system Back key.
Future<void> systemBack(WidgetTester tester) async {
  // ignore: invalid_use_of_protected_member
  await tester.binding.handlePopRoute();
  await feedSettle(tester);
}

/// Keeps a key's [SystemChannels] quiet in a test (the platform's haptics and announcements).
void quietPlatform() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async => null);
}
