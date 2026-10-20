// D0 No Mob (spec 5.3): the words, the states, the two ways in and the quiet "How the Mob works" link.
// Start and Join show the Mob explainer the first time (its own tests); once it was seen on this phone
// they go straight on. The one-question setup that replaced the D0a sheet has its own tests
// (mob_setup_screen_test.dart).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/logic/explainer_flow.dart';
import 'package:mockmob/features/social/v3/screens/den_start_screen.dart';
import 'package:mockmob/features/social/v3/screens/join_v3_screen.dart';
import 'package:mockmob/features/social/v3/screens/mob_setup_screen.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

Future<SocialServer> _open(WidgetTester tester, {bool seen = false}) async {
  final server = SocialServer(scenario: 'fresh');
  await pumpSocial(tester, const DenStartScreen(), server);
  await tester.pumpAndSettle();
  if (seen) {
    // The explainer was watched on this phone (the per-account flag in the Mob prefs).
    await ProviderScope.containerOf(tester.element(find.byType(DenStartScreen))).read(explainerSeenProvider).mark();
  }
  return server;
}

void main() {
  setUpAll(loadFoldManifestForTest);

  group('D0', () {
    testWidgets('says what a Mob is, with the two ways in, and nothing else is volt', (tester) async {
      await _open(tester);
      expect(find.text(MobV3Copy.title), findsOneWidget);
      expect(find.text(MobV3Copy.d0Lead), findsOneWidget);
      expect(find.text(MobV3Copy.startMob), findsOneWidget);
      expect(find.text(MobV3Copy.joinWithCode), findsOneWidget);
      expect(find.text(MobV3Copy.chooseSubjects), findsNothing);
      expect(find.bySemanticsLabel(MobV3Copy.denPreviewLabel), findsOneWidget);
    });

    testWidgets('no subjects: one sentence and one way forward, never a dead Start key', (tester) async {
      final server = SocialServer(scenario: 'fresh');
      await pumpSocial(tester, const DenStartScreen(), server, auth: noSubjectsAuth);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.noSubjects), findsOneWidget);
      expect(find.text(MobV3Copy.chooseSubjects), findsOneWidget);
      expect(find.text(MobV3Copy.startMob), findsNothing);
      expect(find.text(MobV3Copy.joinWithCode), findsOneWidget);
    });

    testWidgets('once the explainer was seen, Join with a code opens J1', (tester) async {
      await _open(tester, seen: true);
      await tester.tap(find.byKey(const ValueKey('d0-join')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.byType(JoinV3Screen), findsOneWidget);
      expect(find.text(MobV3Copy.joinTitle), findsOneWidget);
    });

    testWidgets('once the explainer was seen, Start a Mob opens the one-question setup (no sheet)', (tester) async {
      await _open(tester, seen: true);
      await tester.tap(find.byKey(const ValueKey('d0-start')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.byType(MobSetupScreen), findsOneWidget);
      expect(find.byType(BottomSheet), findsNothing);
      expect(find.text(MobExplainerCopy.foldTitle), findsOneWidget);
    });

    testWidgets('"How the Mob works" is a quiet link under the two keys', (tester) async {
      await _open(tester);
      final how = find.byKey(const ValueKey('d0-how'));
      expect(how, findsOneWidget);
      expect(tester.widget<KeyButton>(how).variant, KeyVariant.quiet);
      expect(find.text(MobExplainerCopy.howItWorks), findsOneWidget);
      expect(tester.getRect(how).top, greaterThan(tester.getRect(find.byKey(const ValueKey('d0-join'))).bottom));
    });

    testWidgets('large text and a narrow phone: no overflow', (tester) async {
      final server = SocialServer(scenario: 'fresh');
      await pumpSocial(tester, const DenStartScreen(), server, scale: 1.3, size: const Size(320, 700));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('motion reduced: nothing keeps drawing frames', (tester) async {
      await _open(tester);
      await tester.pumpAndSettle(); // would time out if a loop kept running
      expect(tester.binding.hasScheduledFrame, isFalse);
    });
  });
}
