// The Mob explainer (owner D166, K9): the flow through seven slides (Next, swipe, taps, a short drag
// that snaps back), Skip on slides 1 to 6 going where the student was heading, the end keys per way in,
// the per-account seen flag (set on slide 7 or Skip, never by leaving with Back), replay from D0 and
// Mob settings, the invite gate, the who-can-start line by billing, large text and reduced motion.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/billing/billing.dart' show playBillingEnabledProvider;
import 'package:mockmob/features/social/data/mob_repository.dart' show mobPrefsStoreProvider;
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/logic/explainer_flow.dart';
import 'package:mockmob/features/social/v3/screens/den_start_screen.dart';
import 'package:mockmob/features/social/v3/screens/join_v3_screen.dart';
import 'package:mockmob/features/social/v3/screens/mob_explainer_screen.dart';
import 'package:mockmob/features/social/v3/screens/mob_settings_v3_screen.dart';
import 'package:mockmob/features/social/v3/screens/mob_setup_screen.dart';

import '../../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

PrefsStore _store(WidgetTester tester) => ProviderScope.containerOf(tester.element(find.byType(Navigator).first)).read(mobPrefsStoreProvider);

Future<bool> _seen(WidgetTester tester, {String user = 'u1'}) async => await _store(tester).getBool(explainerSeenKey(user)) ?? false;

/// Plays the current slide to its end (its timeline is at most 4.9 s).
Future<void> _play(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
}

Future<SocialServer> _open(WidgetTester tester, ExplainerVia via, {String code = '', bool reduced = true, Size size = const Size(360, 780), double scale = 1, List<Override> extra = const []}) async {
  final server = SocialServer(scenario: 'fresh');
  await pumpSocial(tester, MobExplainerScreen(via: via, code: code), server, reduced: reduced, size: size, scale: scale, extra: extra);
  await _play(tester);
  return server;
}

Future<void> _next(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('ex-next')));
  await _play(tester);
}

int _index(WidgetTester tester) => tester.state<MobExplainerScreenState>(find.byType(MobExplainerScreen)).index;

void main() {
  // The real fonts: the stage is art drawn at fixed sizes, measured as the phone measures it.
  setUpGoldenFonts();
  setUpAll(loadFoldManifestForTest);

  group('the slides', () {
    testWidgets('slide 1 says what a Mob is, plainly (K9), with Skip and Next', (tester) async {
      await _open(tester, ExplainerVia.start);
      expect(find.text(MobExplainerCopy.titles[0]), findsOneWidget);
      expect(find.text(MobExplainerCopy.body1), findsOneWidget);
      expect(MobExplainerCopy.body1, contains('Start a quick game any time. Your friends get 24 hours to play the same questions, and you see who did best.'));
      expect(find.byKey(const ValueKey('ex-skip')), findsOneWidget);
      expect(find.byKey(const ValueKey('ex-next')), findsOneWidget);
      expect(find.text(MobExplainerCopy.startYourMob), findsNothing);
    });

    testWidgets('Next walks all seven, in order, with every title and body; live rooms only as Coming soon on slide 3', (tester) async {
      await _open(tester, ExplainerVia.start);
      for (var i = 0; i < 7; i++) {
        expect(_index(tester), i);
        expect(find.text(MobExplainerCopy.titles[i]), findsOneWidget, reason: 'slide ${i + 1} title');
        expect(find.text(MobExplainerCopy.body(i, billingOn: false)), findsOneWidget, reason: 'slide ${i + 1} body');
        expect(find.byKey(const ValueKey('ex-coming-soon')), i == 2 ? findsOneWidget : findsNothing);
        if (i < 6) await _next(tester);
      }
      // Slide 3 names the four games with their real numbers.
    });

    testWidgets('slide 3 shows the four games with their numbers', (tester) async {
      await _open(tester, ExplainerVia.start);
      await _next(tester);
      await _next(tester);
      for (final s in [MobExplainerCopy.sprint, MobExplainerCopy.ownRound, MobExplainerCopy.rematch, MobExplainerCopy.paper, MobExplainerCopy.paperLine, MobExplainerCopy.ownRoundLine]) {
        expect(find.text(s), findsOneWidget, reason: s);
      }
      expect(find.text(MobExplainerCopy.open24), findsNWidgets(3));
      expect(find.textContaining('Live rooms'), findsOneWidget);
    });

    testWidgets('who can start: billing off says anyone; billing on names Pro, Free and the mic', (tester) async {
      await _open(tester, ExplainerVia.start, extra: [playBillingEnabledProvider.overrideWithValue(false)]);
      await _next(tester);
      await _next(tester);
      expect(find.text(MobExplainerCopy.body3BillingOff), findsOneWidget);
      expect(find.text(MobExplainerCopy.body3BillingOn), findsNothing);
    });

    testWidgets('billing on (Play Billing on, no Mob yet): the Pro and Free line', (tester) async {
      await _open(tester, ExplainerVia.start, extra: [playBillingEnabledProvider.overrideWithValue(true)]);
      await _next(tester);
      await _next(tester);
      expect(find.text(MobExplainerCopy.body3BillingOn), findsOneWidget);
    });

    testWidgets('swipe left goes on, swipe right goes back, a short slow drag snaps back', (tester) async {
      await _open(tester, ExplainerVia.start, reduced: false);
      await tester.drag(find.byType(MobExplainerScreen), const Offset(-160, 0));
      await _play(tester);
      expect(_index(tester), 1);
      await tester.drag(find.byType(MobExplainerScreen), const Offset(160, 0));
      await _play(tester);
      expect(_index(tester), 0);
      await tester.timedDrag(find.byType(MobExplainerScreen), const Offset(-40, 0), const Duration(milliseconds: 600));
      await _play(tester);
      expect(_index(tester), 0);
    });

    testWidgets('a tap on the right two thirds goes on, on the left third goes back', (tester) async {
      await _open(tester, ExplainerVia.start);
      await tester.tapAt(const Offset(300, 300));
      await _play(tester);
      expect(_index(tester), 1);
      await tester.tapAt(const Offset(40, 300));
      await _play(tester);
      expect(_index(tester), 0);
    });

    testWidgets('interruptible: Next mid-motion lands the old slide and plays the new one', (tester) async {
      final server = SocialServer(scenario: 'fresh');
      await pumpSocial(tester, const MobExplainerScreen(via: ExplainerVia.start), server, reduced: false);
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byKey(const ValueKey('ex-next')));
      await tester.pump();
      final s = tester.state<MobExplainerScreenState>(find.byType(MobExplainerScreen));
      expect(s.clocks[0].value, 1);
      expect(s.clocks[1].isAnimating, isTrue);
      await _play(tester);
    });
  });

  group('Skip and the end keys', () {
    testWidgets('Skip from Start goes to the setup and sets the flag', (tester) async {
      await _open(tester, ExplainerVia.start);
      expect(await _seen(tester), isFalse);
      await tester.tap(find.byKey(const ValueKey('ex-skip')));
      await _play(tester);
      expect(find.byType(MobSetupScreen), findsOneWidget);
      expect(find.byType(MobExplainerScreen), findsNothing);
      expect(await _seen(tester), isTrue);
    });

    testWidgets('Skip from Join goes to the code screen', (tester) async {
      await _open(tester, ExplainerVia.join);
      await tester.tap(find.byKey(const ValueKey('ex-skip')));
      await _play(tester);
      expect(find.byType(JoinV3Screen), findsOneWidget);
    });

    testWidgets('slide 7 sets the flag, hides Skip and leads with the way the student came', (tester) async {
      await _open(tester, ExplainerVia.join);
      for (var i = 0; i < 6; i++) {
        await _next(tester);
      }
      expect(await _seen(tester), isTrue);
      final skip = tester.widget<Visibility>(find.ancestor(of: find.byKey(const ValueKey('ex-skip')), matching: find.byType(Visibility)));
      expect(skip.visible, isFalse);
      expect(find.text(MobExplainerCopy.joinWithCode), findsOneWidget);
      expect(find.text(MobExplainerCopy.startYourMob), findsOneWidget);
      final first = tester.getRect(find.byKey(const ValueKey('ex-end-0')));
      final second = tester.getRect(find.byKey(const ValueKey('ex-end-1')));
      expect(first.top, lessThan(second.top));
      expect(find.descendant(of: find.byKey(const ValueKey('ex-end-0')), matching: find.text(MobExplainerCopy.joinWithCode)), findsOneWidget);
    });

    testWidgets('Start your Mob on slide 7 opens the setup', (tester) async {
      await _open(tester, ExplainerVia.start);
      for (var i = 0; i < 6; i++) {
        await _next(tester);
      }
      await tester.tap(find.text(MobExplainerCopy.startYourMob));
      await _play(tester);
      expect(find.byType(MobSetupScreen), findsOneWidget);
    });

    testWidgets('an invite leads with joining the Mob the code names', (tester) async {
      await _open(tester, ExplainerVia.invite, code: 'K7P2M9');
      for (var i = 0; i < 6; i++) {
        await _next(tester);
      }
      expect(find.text(MobExplainerCopy.joinNamed('Steady Kites')), findsOneWidget);
      await tester.tap(find.text(MobExplainerCopy.joinNamed('Steady Kites')));
      await _play(tester);
      expect(find.byType(JoinV3Screen), findsOneWidget);
    });
  });

  group('the seen flag', () {
    test('the key is per account', () {
      expect(explainerSeenKey('u1'), 'mob.explainer.v1.seen.u1');
      expect(explainerSeenKey('u2'), isNot(explainerSeenKey('u1')));
      expect(explainerSeenKey(null), 'mob.explainer.v1.seen.anon');
    });

    test('the flow: skip targets and end keys per way in', () {
      expect(ExplainerFlow.skipTo(ExplainerVia.start), ExplainerExit.setup);
      expect(ExplainerFlow.skipTo(ExplainerVia.join), ExplainerExit.join);
      expect(ExplainerFlow.skipTo(ExplainerVia.invite), ExplainerExit.join);
      expect(ExplainerFlow.skipTo(ExplainerVia.replay), ExplainerExit.den);
      expect(ExplainerFlow.endKeys(ExplainerVia.replay).map((k) => k.label), [MobExplainerCopy.backToMob]);
      expect(ExplainerFlow.endKeys(ExplainerVia.start).first.label, MobExplainerCopy.startYourMob);
      expect(ExplainerFlow.endKeys(ExplainerVia.invite).first.label, MobExplainerCopy.joinThisMob);
      expect(ExplainerFlow.endKeys(ExplainerVia.invite, mobName: 'Chai Circle').first.label, 'Join Chai Circle');
      expect(ExplainerFlow.skipVisible(5), isTrue);
      expect(ExplainerFlow.skipVisible(6), isFalse);
    });

    testWidgets('D0 Start the first time opens the explainer; once seen, straight to the setup', (tester) async {
      await pumpSocial(tester, const DenStartScreen(), SocialServer(scenario: 'fresh'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('d0-start')));
      await settleSocial(tester);
      expect(find.byType(MobExplainerScreen), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('ex-skip')));
      await _play(tester);
      expect(find.byType(MobSetupScreen), findsOneWidget);
      // Back to D0; now Start skips the explainer.
      Navigator.of(tester.element(find.byType(MobSetupScreen))).pop();
      await _play(tester);
      await tester.tap(find.byKey(const ValueKey('d0-start')));
      await settleSocial(tester);
      expect(find.byType(MobExplainerScreen), findsNothing);
      expect(find.byType(MobSetupScreen), findsOneWidget);
    });

    testWidgets('leaving with Back before slide 7 keeps the flag unset', (tester) async {
      await pumpSocial(tester, const DenStartScreen(), SocialServer(scenario: 'fresh'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('d0-join')));
      await settleSocial(tester);
      expect(find.byType(MobExplainerScreen), findsOneWidget);
      await tester.binding.handlePopRoute();
      await _play(tester);
      expect(find.byType(MobExplainerScreen), findsNothing);
      expect(await _seen(tester), isFalse);
    });

    testWidgets('another account on this phone sees it once more', (tester) async {
      await pumpSocial(tester, const DenStartScreen(), SocialServer(scenario: 'fresh'));
      await tester.pumpAndSettle();
      await _store(tester).setBool(explainerSeenKey('someone-else'), true);
      await tester.tap(find.byKey(const ValueKey('d0-start')));
      await settleSocial(tester);
      expect(find.byType(MobExplainerScreen), findsOneWidget);
    });
  });

  group('replay', () {
    testWidgets('D0 "How the Mob works" opens it with both end keys', (tester) async {
      await pumpSocial(tester, const DenStartScreen(), SocialServer(scenario: 'fresh'));
      await tester.pumpAndSettle();
      expect(find.text(MobExplainerCopy.howItWorks), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('d0-how')));
      await settleSocial(tester);
      expect(find.byType(MobExplainerScreen), findsOneWidget);
      expect(tester.widget<MobExplainerScreen>(find.byType(MobExplainerScreen)).via, ExplainerVia.start);
    });

    testWidgets('Mob settings "How the Mob works" replays it; slide 7 has one key back, Skip returns to the den', (tester) async {
      await pumpSocial(tester, const MobSettingsV3Screen(), SocialServer());
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.byKey(const ValueKey('set-how')), 300, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(find.byKey(const ValueKey('set-how')));
      await tester.pumpAndSettle();
      expect(find.text(MobExplainerCopy.howItWorksLine), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('set-how')));
      await settleSocial(tester);
      expect(tester.widget<MobExplainerScreen>(find.byType(MobExplainerScreen)).via, ExplainerVia.replay);
      await tester.tap(find.byKey(const ValueKey('ex-skip')));
      await _play(tester);
      expect(find.byType(MobExplainerScreen), findsNothing);
      expect(find.byType(MobSettingsV3Screen), findsOneWidget);
    });

    testWidgets('replay slide 7: "Back to your Mob" only', (tester) async {
      await _open(tester, ExplainerVia.replay);
      for (var i = 0; i < 6; i++) {
        await _next(tester);
      }
      expect(find.text(MobExplainerCopy.backToMob), findsOneWidget);
      expect(find.text(MobExplainerCopy.startYourMob), findsNothing);
      expect(find.text(MobExplainerCopy.joinWithCode), findsNothing);
    });
  });

  group('invite gate', () {
    testWidgets('the first invite link shows the explainer, then the code screen with the code', (tester) async {
      await pumpSocial(tester, const MobJoinGate(code: 'K7P2M9'), SocialServer(scenario: 'fresh'));
      await _play(tester);
      expect(find.byType(MobExplainerScreen), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('ex-skip')));
      await _play(tester);
      expect(find.byType(JoinV3Screen), findsOneWidget);
      expect(tester.widget<JoinV3Screen>(find.byType(JoinV3Screen)).code, 'K7P2M9');
    });

    testWidgets('a student already in a Mob goes straight to the code screen', (tester) async {
      await pumpSocial(tester, const MobJoinGate(code: 'K7P2M9'), SocialServer());
      await _play(tester);
      expect(find.byType(MobExplainerScreen), findsNothing);
      expect(find.byType(JoinV3Screen), findsOneWidget);
    });
  });

  group('fit and motion', () {
    for (final (size, scale) in [(const Size(360, 780), 1.0), (const Size(320, 640), 1.3), (const Size(412, 915), 1.0)]) {
      testWidgets('every slide fits at ${size.width.round()} x ${size.height.round()} at ${scale}x text', (tester) async {
        await _open(tester, ExplainerVia.start, size: size, scale: scale, extra: [playBillingEnabledProvider.overrideWithValue(true)]);
        for (var i = 0; i < 7; i++) {
          expect(tester.takeException(), isNull, reason: 'slide ${i + 1}');
          final body = tester.getRect(find.byKey(ValueKey('ex-body-$i')));
          final bottomKey = i < 6 ? tester.getRect(find.byKey(const ValueKey('ex-next'))) : tester.getRect(find.byKey(const ValueKey('ex-end-0')));
          if (body.bottom > bottomKey.top - 8) {
            // A small phone with large text: the words scroll above the keys.
            await tester.drag(find.ancestor(of: find.byKey(ValueKey('ex-body-$i')), matching: find.byType(SingleChildScrollView)), const Offset(0, -300));
            await tester.pump();
            final moved = tester.getRect(find.byKey(ValueKey('ex-body-$i')));
            expect(moved.bottom, lessThanOrEqualTo(bottomKey.top - 8), reason: 'slide ${i + 1}: the body scrolls clear of the keys');
          }
          if (i < 6) await _next(tester);
        }
      });
    }

    testWidgets('full motion: a slide comes to rest and its clock stops', (tester) async {
      await _open(tester, ExplainerVia.start, reduced: false);
      final s = tester.state<MobExplainerScreenState>(find.byType(MobExplainerScreen));
      expect(s.clocks[0].isCompleted, isTrue);
    });

    testWidgets('reduced motion: nothing keeps drawing frames once a slide has played', (tester) async {
      await _open(tester, ExplainerVia.start);
      await _next(tester);
      await tester.pumpAndSettle();
      expect(tester.binding.hasScheduledFrame, isFalse);
    });
  });
}
