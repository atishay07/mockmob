// D0 No Mob and D0a Start a Mob (spec 5.3): the words, the states, the create flow with the server's own
// errors (FOLD_LOCKED, NAME_KEY_INVALID), the name chips six at a time, the first-time Fold cards and the
// later "You play as", and the name field staying in view with the keyboard open.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/mob_names.dart';
import 'package:mockmob/features/social/v3/screens/den_start_screen.dart';
import 'package:mockmob/features/social/v3/screens/join_v3_screen.dart';
import 'package:mockmob/features/social/v3/widgets/fold_picker.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

/// Taps a widget inside the scrolling sheet: scroll it into view first.
Future<void> _tapVisible(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
}

Future<SocialServer> _open(WidgetTester tester, {Map<String, String> failures = const {}, FoldKey? seat, bool tapStart = true}) async {
  final server = SocialServer(scenario: 'fresh', failures: failures);
  if (seat != null) await server.profile(seat);
  server.calls.clear();
  await pumpSocial(tester, const DenStartScreen(), server);
  await tester.pumpAndSettle();
  if (tapStart) {
    await tester.tap(find.byKey(const ValueKey('d0-start')));
    await settleSocial(tester);
    await tester.pumpAndSettle();
  }
  return server;
}

void main() {
  setUpAll(loadFoldManifestForTest);

  group('D0', () {
    testWidgets('says what a Mob is, with the two ways in, and nothing else is volt', (tester) async {
      await _open(tester, tapStart: false);
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

    testWidgets('Join with a code opens J1', (tester) async {
      await _open(tester, tapStart: false);
      await tester.tap(find.byKey(const ValueKey('d0-join')));
      await tester.pumpAndSettle();
      expect(find.byType(JoinV3Screen), findsOneWidget);
      expect(find.text(MobV3Copy.joinTitle), findsOneWidget);
    });

    testWidgets('large text and a narrow phone: no overflow', (tester) async {
      final server = SocialServer(scenario: 'fresh');
      await pumpSocial(tester, const DenStartScreen(), server, scale: 1.3, size: const Size(320, 700));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('motion reduced: nothing keeps drawing frames', (tester) async {
      await _open(tester, tapStart: false);
      await tester.pumpAndSettle(); // would time out if a loop kept running
      expect(tester.binding.hasScheduledFrame, isFalse);
    });
  });

  group('D0a', () {
    testWidgets('title, name chips six at a time, the kind note, subjects, Fold cards and the key', (tester) async {
      await _open(tester);
      expect(find.text(MobV3Copy.pickName), findsOneWidget);
      for (var i = 0; i < 6; i++) {
        expect(find.text(mobNames[i]), findsOneWidget);
      }
      expect(find.text(mobNames[6]), findsNothing);
      expect(find.text(MobV3Copy.namesKind), findsOneWidget);
      expect(find.text(MobV3Copy.showSixMore), findsOneWidget);
      expect(find.text(MobV3Copy.subjectYouPlay), findsOneWidget);
      expect(find.text('Accountancy'), findsOneWidget);
      expect(find.text('Business Studies'), findsOneWidget);
      expect(find.text(MobV3Copy.startKey('Chai Circle')), findsOneWidget);
      expect(find.text(MobV3Copy.startNext), findsOneWidget);
      expect(find.text(MobV3Copy.marksNote), findsOneWidget);
    });

    testWidgets('Show six more pages through the 24 names, then goes back to the first six; Night Owls is gone', (tester) async {
      await _open(tester);
      final seen = <String>{};
      for (var page = 0; page < 4; page++) {
        for (var i = page * 6; i < page * 6 + 6; i++) {
          expect(find.text(mobNames[i]), findsOneWidget, reason: 'page $page shows ${mobNames[i]}');
          seen.add(mobNames[i]);
        }
        await tester.ensureVisible(find.textContaining('six'));
        await tester.tap(find.textContaining('six'));
        await tester.pumpAndSettle();
      }
      expect(seen.length, 24);
      expect(seen.contains('Night Owls'), isFalse);
      // Back on the first page after the fourth.
      expect(find.text(mobNames[0]), findsOneWidget);
      expect(find.text(MobV3Copy.showSixMore), findsOneWidget);
    });

    testWidgets('the last page offers the way back to the first six', (tester) async {
      await _open(tester);
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text(MobV3Copy.showSixMore));
        await tester.pumpAndSettle();
      }
      expect(find.text(MobV3Copy.showFirstSix), findsOneWidget);
    });

    testWidgets('choosing a name changes the key', (tester) async {
      await _open(tester);
      await tester.tap(find.text('Quiet Comets'));
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.startKey('Quiet Comets')), findsOneWidget);
      expect(find.text(MobV3Copy.startKey('Chai Circle')), findsNothing);
    });

    testWidgets('first time: the four starters with their lines, and no locked Fold', (tester) async {
      await _open(tester);
      expect(find.text(MobV3Copy.pickFold), findsOneWidget);
      expect(find.byType(FoldCard), findsNWidgets(4));
      for (final f in FoldKey.starters) {
        expect(find.text(MobV3Copy.foldName(f)), findsOneWidget);
        expect(find.text(MobV3Copy.foldLine(f)), findsOneWidget);
      }
      expect(find.text(MobV3Copy.foldName(FoldKey.hop)), findsNothing);
    });

    testWidgets('later: "You play as Dart" with Change, no cards; Change offers only owned Folds', (tester) async {
      await _open(tester, seat: FoldKey.dart);
      expect(find.text(MobV3Copy.pickFold), findsNothing);
      expect(find.byType(FoldCard), findsNothing);
      expect(find.text(MobV3Copy.youPlayAs('Dart')), findsOneWidget);
      await _tapVisible(tester, find.byKey(const ValueKey('d0a-change-fold')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.changeFoldTitle), findsOneWidget);
      // The fresh account owns the four starters only.
      for (final f in FoldKey.starters) {
        expect(find.text(MobV3Copy.foldName(f)), findsWidgets);
      }
      expect(find.text(MobV3Copy.foldName(FoldKey.hop)), findsNothing);
      await _tapVisible(tester, find.text('Hexa').last);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.youPlayAs('Hexa')), findsOneWidget);
    });

    testWidgets('start: one call with the subject, the first name, the colour, the name key and the Fold', (tester) async {
      final server = await _open(tester);
      await _tapVisible(tester, find.text('Quiet Comets'));
      await _tapVisible(tester, find.text('Hexa'));
      await _tapVisible(tester, find.text('Economics'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('d0a-start')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      final calls = server.calls.where((c) => c.startsWith('createMob')).toList();
      expect(calls, hasLength(1));
      expect(calls.single, 'createMob:economics:Aarav:3:1:hexa');
      // The sheet closed.
      expect(find.text(MobV3Copy.pickName), findsNothing);
    });

    testWidgets('a name that fails the rule is said under the field and nothing is sent', (tester) async {
      final server = await _open(tester);
      await tester.ensureVisible(find.byType(TextField));
      await tester.enterText(find.byType(TextField), 'A');
      await tester.tap(find.byKey(const ValueKey('d0a-start')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.nameRule), findsOneWidget);
      expect(server.calls.where((c) => c.startsWith('createMob')), isEmpty);
    });

    testWidgets('FOLD_LOCKED: the server sentence, inline, and the sheet stays open', (tester) async {
      await _open(tester, failures: {'createMob': 'FOLD_LOCKED'});
      await tester.tap(find.byKey(const ValueKey('d0a-start')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.errors['FOLD_LOCKED']!), findsOneWidget);
      expect(find.text(MobV3Copy.pickName), findsOneWidget);
      // The key is back, ready for another try.
      expect(find.text(MobV3Copy.startKey('Chai Circle')), findsOneWidget);
    });

    testWidgets('NAME_KEY_INVALID: the server sentence, inline', (tester) async {
      await _open(tester, failures: {'createMob': 'NAME_KEY_INVALID'});
      await tester.tap(find.byKey(const ValueKey('d0a-start')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.errors['NAME_KEY_INVALID']!), findsOneWidget);
    });

    testWidgets('keyboard open: the name field stays above the keys', (tester) async {
      await _open(tester);
      // 300 dp of keyboard on a 780 dp phone (physical pixels at ratio 2).
      tester.view.viewInsets = const FakeViewPadding(bottom: 600);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      await _tapVisible(tester, find.byType(TextField));
      await tester.pumpAndSettle();
      final field = tester.getRect(find.byType(TextField));
      expect(field.bottom, lessThanOrEqualTo(780 - 300), reason: 'the field must end above the keyboard');
      expect(field.top, greaterThan(0));
      // The pinned key is above the keys too.
      final key = tester.getRect(find.byKey(const ValueKey('d0a-start')));
      expect(key.bottom, lessThanOrEqualTo(780 - 300));
    });
  });
}
