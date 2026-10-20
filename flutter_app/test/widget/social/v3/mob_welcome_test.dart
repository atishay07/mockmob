// The Mob welcome (V16 A3): it opens over the Mob tab the first time its root shows, once per account on this
// phone; Skip, the keys and leaving mark it seen; "See how it works" hands to the explainer with the right `via`; an
// invite that opens the explainer stands in for it; a hidden tab waits; the demo build plays it only when fresh.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/data/mob_repository.dart' show mobPrefsStoreProvider;
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/logic/explainer_flow.dart';
import 'package:mockmob/features/social/v3/logic/mob_welcome.dart';
import 'package:mockmob/features/social/v3/screens/den_screen.dart';
import 'package:mockmob/features/social/v3/screens/den_start_screen.dart';
import 'package:mockmob/features/social/v3/screens/mob_explainer_screen.dart';
import 'package:mockmob/features/social/v3/screens/mob_welcome_screen.dart';
import 'package:mockmob/features/social/v3/widgets/welcome_stage.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

/// The social overrides with the welcome on and [store] as this phone's Mob prefs (so a second "app run" can share
/// it), and the demo scenario [demo] (null: the app).
List<Override> _overrides(MobV3FakeServer server, PrefsStore store, {String? demo}) => [
  for (final o in socialOverrides(server))
    if (!identical(o.origin, mobPrefsStoreProvider)) o,
  mobPrefsStoreProvider.overrideWithValue(store),
  mobWelcomeOnProvider.overrideWithValue(true),
  mobWelcomeDemoProvider.overrideWithValue(demo),
];

Future<void> _pump(WidgetTester t, Widget root, {PrefsStore? store, String scenario = 'fresh', bool reduced = true, String? demo}) => pumpMockmob(
  t,
  root,
  brightness: Brightness.dark,
  size: const Size(360, 780),
  wrapInScaffold: false,
  disableAnimations: reduced,
  overrides: _overrides(SocialServer(scenario: scenario), store ?? MemoryPrefsStore(), demo: demo),
);

Future<bool> _seen(PrefsStore store) async => await store.getBool(mobWelcomeSeenKey('u1')) ?? false;

/// Lets the hook ask (post-frame, then the prefs read) and the welcome's route come in.
Future<void> _settle(WidgetTester t, [int ms = 600]) async {
  await t.pump();
  await t.pump();
  for (var i = 0; i < ms ~/ 50; i++) {
    await t.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  setUpAll(loadFoldManifestForTest);

  group('first open', () {
    testWidgets('the first Mob tab open pushes the welcome; the second open does not', (t) async {
      final store = MemoryPrefsStore();
      await _pump(t, const DenStartScreen(), store: store);
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
      expect(find.text(MobWelcomeCopy.headline), findsOneWidget);
      // The reduced timeline is over in 1.2 s; then "Not now" takes the student back to D0.
      await _settle(t, 1400);
      await t.tap(find.byKey(const ValueKey('welcome-not-now')));
      await _settle(t, 500);
      expect(find.byType(MobWelcomeScreen), findsNothing);
      expect(find.byKey(const ValueKey('d0-start')), findsOneWidget);
      expect(await _seen(store), isTrue);

      // A new app run on the same phone and account: the tab opens straight to D0.
      await t.pumpWidget(const SizedBox.shrink());
      await _pump(t, const DenStartScreen(), store: store);
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsNothing);
    });

    testWidgets('it plays once per account: another account on this phone sees it too', (t) async {
      final store = MemoryPrefsStore();
      await store.setBool(mobWelcomeSeenKey('someone-else'), true);
      await _pump(t, const DenStartScreen(), store: store);
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
    });

    testWidgets('a hidden tab waits; the welcome opens when the tab comes back', (t) async {
      final shown = ValueNotifier<bool>(false);
      addTearDown(shown.dispose);
      await _pump(
        t,
        ValueListenableBuilder<bool>(
          valueListenable: shown,
          builder: (_, on, _) => TickerMode(enabled: on, child: const DenStartScreen()),
        ),
      );
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsNothing);
      shown.value = true;
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
    });

    testWidgets('a route over the tab (onboarding, a sheet, a run) holds it until the tab is on top again', (t) async {
      // An onboarding route covers the root from its first frame, before the hook asks.
      await _pump(t, const _CoverFirst(child: DenStartScreen()));
      await _settle(t);
      expect(find.text('onboarding'), findsOneWidget);
      expect(find.byType(MobWelcomeScreen), findsNothing);
      t.state<NavigatorState>(find.byType(Navigator).first).pop();
      await _settle(t, 1200);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
    });

    testWidgets('a pushed Mob page (not the tab) never plays it', (t) async {
      await _pump(t, const DenStartScreen(asTab: false));
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsNothing);
    });

    testWidgets('a member den on the tab plays it too', (t) async {
      await _pump(t, const DenScreen(asTab: true), scenario: 'quiet');
      await settleSocial(t);
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
    });
  });

  group('leaving', () {
    testWidgets('Skip shows from 600 ms, lands the end state in 200 ms and marks seen', (t) async {
      final store = MemoryPrefsStore();
      await _pump(t, const DenStartScreen(), store: store, reduced: false);
      await _settle(t, 300);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
      // The room holds dark while the art decodes (at most 450 ms), then the clock runs.
      await _settle(t, 1000);
      final state = t.state<MobWelcomeScreenState>(find.byType(MobWelcomeScreen));
      expect(state.ms, greaterThan(WelcomeTimeline.skipAt));
      expect(state.ms, lessThan(WelcomeTimeline.keysAt));
      expect(await _seen(store), isFalse);
      await t.tap(find.byKey(const ValueKey('welcome-skip')));
      await t.pump();
      await t.pump(const Duration(milliseconds: 220));
      expect(state.ms, WelcomeTimeline.total);
      expect(await _seen(store), isTrue);
      // The keys are live: "Not now" goes back to the tab.
      await t.tap(find.byKey(const ValueKey('welcome-not-now')));
      await _settle(t, 400);
      expect(find.byType(MobWelcomeScreen), findsNothing);
    });

    testWidgets('a tap on the room finishes the motion in 200 ms', (t) async {
      await _pump(t, const DenStartScreen(), reduced: false);
      await _settle(t, 1200);
      final state = t.state<MobWelcomeScreenState>(find.byType(MobWelcomeScreen));
      expect(state.ms, lessThan(WelcomeTimeline.total));
      await t.tap(find.byKey(const ValueKey('welcome-room')));
      await t.pump();
      await t.pump(const Duration(milliseconds: 220));
      expect(state.ms, WelcomeTimeline.total);
    });

    testWidgets('Back marks it seen too (it never loops)', (t) async {
      final store = MemoryPrefsStore();
      await _pump(t, const DenStartScreen(), store: store);
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
      await t.binding.handlePopRoute();
      await _settle(t, 400);
      expect(find.byType(MobWelcomeScreen), findsNothing);
      expect(await _seen(store), isTrue);
    });
  });

  group('See how it works', () {
    testWidgets('in no Mob: the explainer follows as Start, and the welcome is seen', (t) async {
      final store = MemoryPrefsStore();
      await _pump(t, const DenStartScreen(), store: store);
      await _settle(t, 1600);
      await t.tap(find.byKey(const ValueKey('welcome-see-how')));
      await _settle(t, 600);
      expect(find.byType(MobWelcomeScreen), findsNothing);
      expect(t.widget<MobExplainerScreen>(find.byType(MobExplainerScreen)).via, ExplainerVia.start);
      expect(await _seen(store), isTrue);
    });

    testWidgets('a member: the explainer follows as a replay (one key back to the den)', (t) async {
      await _pump(t, const DenScreen(asTab: true), scenario: 'quiet');
      await settleSocial(t);
      await _settle(t, 1600);
      await t.tap(find.byKey(const ValueKey('welcome-see-how')));
      await _settle(t, 600);
      expect(t.widget<MobExplainerScreen>(find.byType(MobExplainerScreen)).via, ExplainerVia.replay);
    });

    testWidgets('"How the Mob works" on D0 still replays only the explainer', (t) async {
      final store = MemoryPrefsStore();
      await store.setBool(mobWelcomeSeenKey('u1'), true);
      await _pump(t, const DenStartScreen(), store: store);
      await _settle(t);
      await t.tap(find.byKey(const ValueKey('d0-how')));
      await settleSocial(t);
      expect(find.byType(MobWelcomeScreen), findsNothing);
      expect(find.byType(MobExplainerScreen), findsOneWidget);
    });
  });

  group('invite and demo', () {
    testWidgets('an invite link that opens the explainer marks the welcome seen', (t) async {
      final store = MemoryPrefsStore();
      await _pump(t, const MobJoinGate(code: 'K7P2M9'), store: store);
      await settleSocial(t);
      expect(find.byType(MobExplainerScreen), findsOneWidget);
      expect(find.byType(MobWelcomeScreen), findsNothing);
      expect(await _seen(store), isTrue);
    });

    testWidgets('the demo build plays it in the fresh scenario, once a run', (t) async {
      await _pump(t, const DenStartScreen(), demo: 'fresh');
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsOneWidget);
    });

    testWidgets('the demo build keeps it seen in every other scenario', (t) async {
      await _pump(t, const DenScreen(asTab: true), scenario: 'heavy', demo: 'heavy');
      await settleSocial(t);
      await _settle(t);
      expect(find.byType(MobWelcomeScreen), findsNothing);
    });
  });
}

/// Pushes an onboarding route over [child] in its first frame.
class _CoverFirst extends StatefulWidget {
  const _CoverFirst({required this.child});
  final Widget child;

  @override
  State<_CoverFirst> createState() => _CoverFirstState();
}

class _CoverFirstState extends State<_CoverFirst> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('onboarding')),
          settings: const RouteSettings(name: '/onboarding/subject'),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
