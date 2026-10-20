// Mob V4 sheets A6 and A7 (MOB-MINIMAL 3.5): the Shelf sheet and the Mob settings sheet, opened over a screen.
// Everything that used to open a second sheet opens in place: a Fold's detail and Play as, the member menu,
// change my name or colour, Free and Pro in the Mob. Report and the confirmations stay small sheets.
// "Show my study time to my Mob" is off until turned on, PATCHes `share_study_time`, and is not drawn at
// all while the server has not shipped Mob hours.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmSwitch;
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/screens/shelf_screen.dart' show FoldTile;
import 'package:mockmob/features/social/v3/widgets/mob_settings_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/shelf_sheet.dart';

import '../../../unit/social/mob_test_kit.dart' show FakeMobActions;
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/sheets_test_kit.dart' show Host, keyLabel, noText, tapAt;
import '../../../unit/social/v3/social_test_kit.dart';
import '../../../helpers/golden_harness.dart';

class _Spy extends SocialServer {
  _Spy({super.scenario});

  @override
  Future<Object?> studyShare({required String mob, required bool on}) async {
    calls.add('studyShare:$on');
    return super.studyShare(mob: mob, on: on);
  }
}

FakeMobActions? _old;

Future<void> _open(
  WidgetTester tester,
  void Function(BuildContext) open,
  SocialServer server, {
  List<Override> extra = const [],
  Size size = const Size(360, 800),
  double scale = 1,
  Brightness b = Brightness.dark,
}) async {
  _old = null;
  await pumpMockmob(
    tester,
    Host(open: open),
    brightness: b,
    size: size,
    textScale: scale,
    disableAnimations: true,
    overrides: socialOverrides(server, actions: (ref) => _old = SocialMobActions(ref), extra: extra),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await settleSocial(tester);
}

bool _on(WidgetTester tester, String key) => tester.widget<MmSwitch>(find.descendant(of: find.byKey(ValueKey(key)), matching: find.byType(MmSwitch))).value;

void main() {
  setUpAll(loadFoldManifestForTest);

  group('A6 Shelf sheet', () {
    testWidgets('opens as a sheet with the lead, who you play as, Yours and Still to earn', (tester) async {
      await _open(tester, openShelfSheet, SocialServer());
      expect(find.text(MobV3Copy.shelfTitle), findsOneWidget);
      expect(find.text(MobV3Copy.shelfLead), findsOneWidget);
      expect(find.text(MobV3Copy.youPlayAs('Dart')), findsOneWidget);
      expect(find.text(MobV3Copy.shelfOwned), findsOneWidget);
    });

    testWidgets('a Fold opens in place, Play as sits you as it, and no second sheet opens', (tester) async {
      final server = SocialServer();
      await _open(tester, openShelfSheet, server);
      final tile = find.byType(FoldTile).at(1);
      await tapAt(tester, tile);
      expect(find.byType(FoldDetailInline), findsOneWidget);
      // Only the Shelf sheet is on screen: its title appears once, and the detail is part of its body.
      expect(find.text(MobV3Copy.shelfTitle), findsOneWidget);
      await tapAt(tester, find.byKey(const ValueKey('s1-play-as')));
      expect(server.calls, contains('profile:dogear:plain'));
      expect(find.text(MobV3Copy.youPlayAs('Dog-ear')), findsOneWidget);
      // Playing as it closes the detail but keeps the sheet.
      expect(find.byType(FoldDetailInline), findsNothing);
      expect(find.text(MobV3Copy.shelfTitle), findsOneWidget);
    });

    testWidgets('a locked Fold opens its rule with the true count and offers no Play as', (tester) async {
      await _open(tester, openShelfSheet, SocialServer());
      await tapAt(tester, find.byType(FoldTile).at(5));
      expect(find.byType(FoldDetailInline), findsOneWidget);
      expect(find.byKey(const ValueKey('s1-play-as')), findsNothing);
      expect(find.text('Crane. Your Mob fixes 3 traps together. 1 of 3, in Chai Circle.'), findsNWidgets(2));
    });

    testWidgets('large text on a narrow phone, Day: no overflow', (tester) async {
      await _open(tester, openShelfSheet, SocialServer(), size: const Size(320, 800), scale: 1.3, b: Brightness.light);
      expect(tester.takeException(), isNull);
    });
  });

  group('A7 Mob settings sheet', () {
    testWidgets('the owner sees the switches, members and the You group, with no price word', (tester) async {
      await _open(tester, openMobSettingsSheet, SocialServer());
      expect(find.text(MobV3Copy.settingsTitle), findsOneWidget);
      for (final k in ['set-podium', 'set-rest', 'set-share']) {
        expect(find.byKey(ValueKey(k)), findsOneWidget);
      }
      expect(find.text(MobV3Copy.membersHeading), findsOneWidget);
      expect(find.text(MobCopy.changeName), findsOneWidget);
      expect(find.text(MobCopy.leave), findsOneWidget);
    });

    group('Show my study time to my Mob', () {
      testWidgets('is off by default and says what it does', (tester) async {
        await _open(tester, openMobSettingsSheet, _Spy(scenario: 'quiet'));
        await tester.ensureVisible(find.byKey(const ValueKey('set-study')));
        expect(find.text(MobV3Copy.studyTimeTitle), findsOneWidget);
        expect(find.text(MobV3Copy.studyTimeNote), findsOneWidget);
        expect(_on(tester, 'set-study'), isFalse);
      });

      testWidgets('turning it on sends share_study_time and the switch stays on; turning it off sends false', (tester) async {
        final server = _Spy(scenario: 'quiet');
        await _open(tester, openMobSettingsSheet, server);
        await tapAt(tester, find.descendant(of: find.byKey(const ValueKey('set-study')), matching: find.byType(MmSwitch)));
        expect(server.calls, contains('studyShare:true'));
        expect(_on(tester, 'set-study'), isTrue);
        await tapAt(tester, find.descendant(of: find.byKey(const ValueKey('set-study')), matching: find.byType(MmSwitch)));
        expect(server.calls, contains('studyShare:false'));
        expect(_on(tester, 'set-study'), isFalse);
      });

      testWidgets('is not drawn at all while the server has not shipped Mob hours', (tester) async {
        final server = _Spy(scenario: 'quiet');
        server.hoursShipped = false;
        await _open(tester, openMobSettingsSheet, server);
        expect(find.byKey(const ValueKey('set-study')), findsNothing);
        expect(find.text(MobV3Copy.studyTimeTitle), findsNothing);
      });
    });

    testWidgets('the member menu opens under the member, not in a sheet; Remove asks first', (tester) async {
      await _open(tester, openMobSettingsSheet, SocialServer());
      await tapAt(tester, find.byTooltip(MobV3Copy.memberMenu('Kabir')));
      expect(keyLabel(MobCopy.report), findsOneWidget);
      expect(keyLabel(MobCopy.leaveAndBlock), findsOneWidget);
      expect(keyLabel(MobCopy.removeMember), findsOneWidget);
      // The settings sheet is still the only sheet.
      expect(find.text(MobV3Copy.settingsTitle), findsOneWidget);
      await tapAt(tester, keyLabel(MobCopy.removeMember));
      expect(find.text(MobCopy.removeTitle('Kabir')), findsOneWidget);
      await tester.tap(keyLabel(MobCopy.removeMember).last);
      await settleSocial(tester);
      expect(_old!.calls, contains('remove:KABIR0000003'));
    });

    testWidgets('a second tap on the menu key closes it', (tester) async {
      await _open(tester, openMobSettingsSheet, SocialServer());
      await tapAt(tester, find.byTooltip(MobV3Copy.memberMenu('Riya')));
      expect(keyLabel(MobCopy.report), findsOneWidget);
      await tapAt(tester, find.byTooltip(MobV3Copy.memberMenu('Riya')));
      expect(keyLabel(MobCopy.report), findsNothing);
    });

    testWidgets('Change my name or colour opens in place, saves through the old call and keeps the sheet', (tester) async {
      await _open(tester, openMobSettingsSheet, SocialServer());
      expect(find.byKey(const ValueKey('set-edit-save')), findsNothing);
      await tapAt(tester, find.text(MobCopy.changeName));
      expect(find.byKey(const ValueKey('set-edit-save')), findsOneWidget);
      await tapAt(tester, find.byKey(const ValueKey('set-edit-save')));
      expect(_old!.calls.where((c) => c.startsWith('me:')), isNotEmpty);
      expect(find.byKey(const ValueKey('set-edit-save')), findsNothing);
      expect(find.text(MobV3Copy.settingsTitle), findsOneWidget);
    });

    group('How the Mob works', () {
      testWidgets('is drawn by default (wired to the explainer replay) and not drawn when nothing can open it', (tester) async {
        await _open(tester, openMobSettingsSheet, SocialServer());
        expect(find.text(MobV3Copy.howMobWorks), findsOneWidget);
      });

      testWidgets('is not drawn when the replay is not available (no dead rows)', (tester) async {
        await _open(tester, openMobSettingsSheet, SocialServer(), extra: [mobHowItWorksProvider.overrideWithValue(null)]);
        expect(find.text(MobV3Copy.howMobWorks), findsNothing);
      });

      testWidgets('opens the explainer replay when it is wired', (tester) async {
        var opened = 0;
        await _open(tester, openMobSettingsSheet, SocialServer(), extra: [mobHowItWorksProvider.overrideWithValue((_) async => opened++)]);
        await tapAt(tester, find.text(MobV3Copy.howMobWorks));
        expect(opened, 1);
      });
    });

    group('Free and Pro in the Mob', () {
      testWidgets('a Free member reads both lists, the full mock rule with 50 credits and a Get Pro key', (tester) async {
        await _open(tester, openMobSettingsSheet, SocialServer(scenario: 'formats', billing: 'free'), extra: [proNudgesOnProvider.overrideWithValue(true)]);
        expect(find.byKey(const ValueKey('set-mock-rule')), findsNothing);
        await tapAt(tester, find.text(MobV3Copy.freeProTitle));
        expect(find.text(MobV3Copy.freeAlways), findsOneWidget);
        expect(find.text(MobV3Copy.proAdds), findsOneWidget);
        expect(find.text(MobV3Copy.mockRuleFor(50)), findsOneWidget);
        expect(find.byKey(const ValueKey('set-get-pro')), findsOneWidget);
        expect(noText(tester, RegExp(r'₹|\bRs\b|per month')), isTrue);
      });

      testWidgets('opening it scrolls the panel into view, so a Free member sees Get Pro', (tester) async {
        await _open(tester, openMobSettingsSheet, SocialServer(scenario: 'formats', billing: 'free'), extra: [proNudgesOnProvider.overrideWithValue(true)]);
        await tapAt(tester, find.text(MobV3Copy.freeProTitle));
        final key = tester.getRect(find.byKey(const ValueKey('set-get-pro')));
        expect(key.bottom, lessThanOrEqualTo(800));
        expect(key.top, greaterThanOrEqualTo(0));
      });

      testWidgets('opening it scrolls the panel into view for a Pro member too', (tester) async {
        await _open(tester, openMobSettingsSheet, SocialServer(scenario: 'formats', billing: 'pro'), extra: [proNudgesOnProvider.overrideWithValue(false)]);
        await tapAt(tester, find.text(MobV3Copy.freeProTitle));
        final line = tester.getRect(find.text(MobV3Copy.proIncluded));
        expect(line.bottom, lessThanOrEqualTo(800));
        expect(line.top, greaterThanOrEqualTo(0));
      });

      testWidgets('a Pro member reads that every full mock is included and is offered nothing to buy', (tester) async {
        await _open(tester, openMobSettingsSheet, SocialServer(scenario: 'formats', billing: 'pro'), extra: [proNudgesOnProvider.overrideWithValue(false)]);
        await tapAt(tester, find.text(MobV3Copy.freeProTitle));
        expect(find.text(MobV3Copy.proIncluded), findsOneWidget);
        expect(find.byKey(const ValueKey('set-get-pro')), findsNothing);
      });

      testWidgets('with billing off the row is not drawn and no plan word shows', (tester) async {
        await _open(tester, openMobSettingsSheet, SocialServer());
        expect(find.text(MobV3Copy.freeProTitle), findsNothing);
      });
    });

    testWidgets('Leave the Mob asks first, then leaves through the old call', (tester) async {
      await _open(tester, openMobSettingsSheet, SocialServer());
      await tapAt(tester, find.text(MobCopy.leave));
      expect(find.text(MobCopy.leaveConfirm), findsNWidgets(2));
      await tester.tap(find.text(MobCopy.leaveConfirm).last);
      await settleSocial(tester);
      expect(_old!.calls, contains('leave:-'));
    });

    testWidgets('large text on a narrow phone, Day: no overflow, with every panel open', (tester) async {
      await _open(tester, openMobSettingsSheet, SocialServer(scenario: 'formats', billing: 'free'), size: const Size(320, 800), scale: 1.3, b: Brightness.light, extra: [proNudgesOnProvider.overrideWithValue(true)]);
      await tapAt(tester, find.text(MobCopy.changeName));
      await tapAt(tester, find.text(MobV3Copy.freeProTitle));
      await tapAt(tester, find.byTooltip(MobV3Copy.memberMenu('Riya')));
      expect(tester.takeException(), isNull);
    });
  });
}
