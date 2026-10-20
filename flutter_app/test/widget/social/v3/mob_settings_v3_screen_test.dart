// SET Mob settings (spec 5.3): "Show a podium" and the Mob's name for the owner, text for everyone else,
// "Resting this week" (and its STEP_OUT_DONE sentence), "Share my marks in games" (the old show-score call),
// and today's members with the old sheets for Report, Leave and block, Remove and Leave.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmSwitch;
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_repository.dart' show mobRepositoryProvider;
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/mob_settings_v3_screen.dart';

import '../../../unit/social/mob_test_kit.dart' show FakeMobActions;
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

FakeMobActions? _old;

Future<SocialServer> _open(WidgetTester tester, {SocialServer? server, bool member = false}) async {
  final s = server ?? SocialServer();
  if (member) {
    // Aarav joins Riya's Mob: Riya started it, so she owns its settings.
    await s.join(code: 'K7P2M9', name: 'Aarav', colour: 1, fold: FoldKey.dart);
    s.calls.clear();
  }
  _old = null;
  await pumpSocial(tester, const MobSettingsV3Screen(), s, size: const Size(360, 1500), actions: (ref) => _old = SocialMobActions(ref));
  await settleSocial(tester);
  return s;
}

bool _on(WidgetTester tester, String key) => tester.widget<MmSwitch>(find.descendant(of: find.byKey(ValueKey(key)), matching: find.byType(MmSwitch))).value;

Future<void> _flip(WidgetTester tester, String key) async {
  await tester.tap(find.descendant(of: find.byKey(ValueKey(key)), matching: find.byType(MmSwitch)));
  await settleSocial(tester);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadFoldManifestForTest);

  group('the owner', () {
    testWidgets('sees the podium switch with its note, the name chips, resting and sharing marks', (tester) async {
      await _open(tester);
      expect(find.text(MobV3Copy.settingsTitle), findsOneWidget);
      expect(find.text(MobV3Copy.showPodium), findsOneWidget);
      expect(find.text(MobV3Copy.showPodiumNote), findsOneWidget);
      expect(find.text(MobV3Copy.mobName), findsOneWidget);
      expect(find.text('Chai Circle'), findsWidgets);
      expect(find.text(MobV3Copy.restingWeek), findsOneWidget);
      expect(find.text(MobV3Copy.shareMarks), findsOneWidget);
      expect(find.byKey(const ValueKey('set-podium-text')), findsNothing);
      expect(_on(tester, 'set-podium'), isTrue);
      expect(_on(tester, 'set-rest'), isFalse);
      expect(_on(tester, 'set-share'), isTrue);
    });

    testWidgets('Show a podium off sends showPodium false and the switch stays off', (tester) async {
      final server = await _open(tester);
      await _flip(tester, 'set-podium');
      expect(server.calls, contains('settings:false:null'));
      expect(_on(tester, 'set-podium'), isFalse);
    });

    testWidgets('picking another Mob name sends its key from the list', (tester) async {
      final server = await _open(tester);
      await tester.tap(find.text('Quiet Comets'));
      await settleSocial(tester);
      expect(server.calls, contains('settings:null:1'));
      final container = ProviderScope.containerOf(tester.element(find.byType(MobSettingsV3Screen)));
      expect(container.read(mobRepositoryProvider).value?.v3?.name.text, 'Quiet Comets');
    });

    testWidgets('NAME_KEY_INVALID from the server is said in its sentence', (tester) async {
      await _open(tester, server: SocialServer(failures: {'settings': 'NAME_KEY_INVALID'}));
      await tester.tap(find.text('Quiet Comets'));
      await settleSocial(tester);
      expect(find.text(MobV3Copy.errors['NAME_KEY_INVALID']!), findsOneWidget);
    });

    testWidgets('can remove a member, and leave and block, and report', (tester) async {
      await _open(tester);
      await tester.tap(find.byTooltip(MobV3Copy.memberMenu('Riya')));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.report), findsOneWidget);
      expect(find.text(MobCopy.leaveAndBlock), findsOneWidget);
      expect(find.text(MobCopy.removeMember), findsOneWidget);
    });

    testWidgets('Remove asks first, then removes through the old call', (tester) async {
      await _open(tester);
      await tester.tap(find.byTooltip(MobV3Copy.memberMenu('Kabir')));
      await tester.pumpAndSettle();
      await tester.tap(find.text(MobCopy.removeMember));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.removeTitle('Kabir')), findsOneWidget);
      await tester.tap(find.text(MobCopy.removeMember).last);
      await settleSocial(tester);
      expect(_old!.calls, contains('remove:KABIR0000003'));
    });
  });

  group('a member who did not start the Mob', () {
    testWidgets('reads who decided the podium, with no switch, no name chips', (tester) async {
      await _open(tester, member: true);
      expect(find.text('Steady Kites shows a podium. Riya can change this.'), findsOneWidget);
      expect(find.byKey(const ValueKey('set-podium')), findsNothing);
      expect(find.text(MobV3Copy.mobName), findsNothing);
      expect(find.text('Quiet Comets'), findsNothing);
      // Resting and sharing marks are everyone's.
      expect(find.byKey(const ValueKey('set-rest')), findsOneWidget);
      expect(find.byKey(const ValueKey('set-share')), findsOneWidget);
    });

    testWidgets('the member menu has Report and Leave and block, and no Remove', (tester) async {
      await _open(tester, member: true);
      await tester.tap(find.byTooltip(MobV3Copy.memberMenu('Zoya')));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.report), findsOneWidget);
      expect(find.text(MobCopy.leaveAndBlock), findsOneWidget);
      expect(find.text(MobCopy.removeMember), findsNothing);
    });

    test('the sentence says does not show when it is off', () {
      expect(MobV3Copy.podiumNotOwner('Steady Kites', false, 'Riya'), 'Steady Kites does not show a podium. Riya can change this.');
    });
  });

  group('resting this week', () {
    testWidgets('the switch steps you out and back in through the Mob v3 call', (tester) async {
      // A Mob of one, so stepping out cannot finish the quest on its own.
      final server = await _open(tester, server: SocialServer(scenario: 'one'));
      await _flip(tester, 'set-rest');
      expect(server.calls, contains('stepOut:true'));
      expect(_on(tester, 'set-rest'), isTrue);
      await _flip(tester, 'set-rest');
      expect(server.calls, contains('stepOut:false'));
      expect(_on(tester, 'set-rest'), isFalse);
    });

    testWidgets('STEP_OUT_DONE: the sentence, and the switch goes back off', (tester) async {
      await _open(tester, server: SocialServer(failures: {'stepOut': 'STEP_OUT_DONE'}));
      await _flip(tester, 'set-rest');
      expect(find.text(MobV3Copy.errors['STEP_OUT_DONE']!), findsOneWidget);
      expect(_on(tester, 'set-rest'), isFalse);
    });

    testWidgets('the note says the quest gets smaller without your name, and names nobody', (tester) async {
      await _open(tester);
      expect(find.text(MobV3Copy.restingNote), findsOneWidget);
    });
  });

  group('share my marks in games', () {
    testWidgets('is the old show-score switch: off sends showScore false through the old call', (tester) async {
      await _open(tester);
      await _flip(tester, 'set-share');
      expect(_old!.calls, contains('me:false:null'));
    });

    testWidgets('says what Private means', (tester) async {
      await _open(tester);
      expect(find.text(MobV3Copy.shareMarksNote), findsOneWidget);
    });
  });

  group('the rest of the page', () {
    testWidgets('lists today\'s members, with You marked and no menu on yourself, and no played tag', (tester) async {
      await _open(tester);
      for (final n in ['Aarav', 'Riya', 'Kabir', 'Zoya']) {
        expect(find.textContaining(n, findRichText: true), findsWidgets);
      }
      // The tag as a whole word: the share note's "Your right answers" is not the tag.
      expect(find.textContaining(RegExp(r'\b' + MobV3Copy.youTag + r'\b'), findRichText: true), findsOneWidget);
      expect(find.byTooltip(MobV3Copy.memberMenu('Aarav')), findsNothing);
      expect(find.byTooltip(MobV3Copy.memberMenu('Riya')), findsOneWidget);
      expect(find.text('Played'), findsNothing);
    });

    testWidgets('Leave Mob asks first, then leaves through the old call', (tester) async {
      await _open(tester);
      await tester.ensureVisible(find.text(MobCopy.leave));
      await tester.tap(find.text(MobCopy.leave));
      await tester.pumpAndSettle();
      // The row and the confirm key say the same two words.
      expect(find.text(MobCopy.leaveConfirm), findsNWidgets(2));
      await tester.tap(find.text(MobCopy.leaveConfirm).last);
      await settleSocial(tester);
      expect(_old!.calls, contains('leave:-'));
    });

    testWidgets('large text and a narrow phone: no overflow', (tester) async {
      final server = SocialServer();
      await pumpSocial(tester, const MobSettingsV3Screen(), server, size: const Size(320, 2200), scale: 1.3, brightness: Brightness.light);
      await settleSocial(tester);
      expect(tester.takeException(), isNull);
    });
  });
}
