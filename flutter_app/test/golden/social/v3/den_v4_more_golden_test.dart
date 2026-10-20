// More Mob V4 den goldens (pass-1020 MOB-MINIMAL 3.1, 3.5, 3.6): the full den with Mob hours and the
// studying desk at text 1.0 and 1.3, Mob hours off for everyone, and the Invite and Your Mobs sheets, in
// Night and Day. The nine ladder steps are in den_v4_golden_test.dart.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/den_stage.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart';
import 'den_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 400));
  await settleImages(tester);
  await tester.pump(const Duration(milliseconds: 1400));
}

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    for (final scale in [1.0, 1.3]) {
      testWidgets('v4 den full heavy text $scale ${_tag(b)}', (tester) async {
        await pumpDen(tester, v3Server(scenario: 'heavy'), brightness: b, height: 1900, textScale: scale);
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_full_heavy_${scale == 1.0 ? '100' : '130'}_${_tag(b)}.png'));
      });
    }
    testWidgets('v4 den hours off for everyone ${_tag(b)}', (tester) async {
      await pumpDen(tester, v3Server(scenario: 'open')..seedSharers = false, brightness: b, height: 1700);
      await _settle(tester);
      expect(find.text(MobV4DenCopy.hoursOff), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_hours_off_${_tag(b)}.png'));
    });
    // Review fixes (pass-1020 den review): a 20-character Mob name at text 1.3 while someone studies.
    testWidgets('v4 den long name studying text 1.3 ${_tag(b)}', (tester) async {
      await pumpDen(tester, v3Server(scenario: 'open')..renameFixtureMob('Accountancy Avengers'), brightness: b, height: 900, textScale: 1.3);
      await _settle(tester);
      expect(find.byKey(const ValueKey('den-studying-tag')), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_long_name_studying_130_${_tag(b)}.png'));
    });
    // The pennant's caption never cuts the Mob's name: with nothing under it, a long name takes a second line.
    testWidgets('v4 den long name, nobody studying, text 1.3 ${_tag(b)}', (tester) async {
      // No seeded study sharers: nobody is at the desk.
      final server = v3Server(scenario: 'open')
        ..renameFixtureMob('Accountancy Avengers')
        ..seedSharers = false;
      await pumpDen(tester, server, brightness: b, height: 900, textScale: 1.3);
      await _settle(tester);
      expect(find.byKey(const ValueKey('den-studying-tag')), findsNothing);
      expect(find.text('Accountancy Avengers'), findsWidgets);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_long_name_130_${_tag(b)}.png'));
    });
    testWidgets('v4 den hours sharing no minutes yet ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'open')..studyMinutes.updateAll((_, _) => 0);
      server.denNow();
      server.studyingSince.clear();
      await pumpDen(tester, server, brightness: b, height: 1900);
      await _settle(tester);
      expect(find.text(MobV4DenCopy.hoursOff), findsNothing);
      expect(find.text(MobV4DenCopy.hoursLine), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_hours_no_minutes_${_tag(b)}.png'));
    });
    testWidgets('v4 den free member full mock now card ${_tag(b)}', (tester) async {
      // Night: 120 credits (enough): Sit Riya's full mock, Get Pro under it. Day: 20 credits (short by 30): Get Pro and
      // Add credits, as on the sit sheet (sit-v2).
      final balance = b == Brightness.dark ? 120 : 20;
      await pumpDen(tester, v3Server(scenario: 'mock', billing: 'free'), brightness: b, height: 1900, auth: AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', creditBalance: balance), nudges: true);
      await _settle(tester);
      expect(find.byKey(const ValueKey('den-sit-cost')), findsOneWidget);
      expect(find.text(MobV3Copy.sitPriceFigure(50)), findsOneWidget);
      expect(find.text(MobV3Copy.sitYouHave(balance)), findsOneWidget);
      expect(find.text(MobV3Copy.sitNeedMore(30)), b == Brightness.dark ? findsNothing : findsOneWidget);
      expect(find.byKey(const ValueKey('den-sit-pro')), findsOneWidget);
      expect(find.text(MobV4ResultsCopy.getPro), findsOneWidget);
      expect(find.byKey(const ValueKey('den-play-key')), b == Brightness.dark ? findsOneWidget : findsNothing);
      expect(find.byKey(const ValueKey('den-add-credits')), b == Brightness.dark ? findsNothing : findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_free_mock_card_${_tag(b)}.png'));
    });
    testWidgets('v4 den five sharing text 1.3 ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'open')
        ..addFixtureMember('MEERA0000005', 'Meera', 4, FoldKey.crane, minutes: 95, goal: 3)
        ..studyMinutes['ZOYA00000004'] = 50
        // Five heads (3 + 2 at 1.3x): you share too (the switch is off by default).
        ..setShareStudyTime(true);
      await pumpDen(tester, server, brightness: b, height: 2100, textScale: 1.3);
      await _settle(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_five_sharing_130_${_tag(b)}.png'));
    });
    testWidgets('v4 invite sheet ${_tag(b)}', (tester) async {
      await pumpDen(tester, v3Server(scenario: 'open'), brightness: b, height: 900);
      await _settle(tester);
      await tester.tap(find.bySemanticsLabel(RegExp('^Open seat')).first);
      await _settle(tester);
      expect(find.byKey(const ValueKey('invite-sheet-whatsapp')), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_invite_sheet_${_tag(b)}.png'));
    });
    testWidgets('v4 your mobs sheet ${_tag(b)}', (tester) async {
      // A Free member whose plan does not allow another Mob: the row stays, "With Pro".
      await pumpDen(tester, v3Server(scenario: 'open', billing: 'free'), brightness: b, height: 900);
      await _settle(tester);
      await tester.tap(find.byKey(const ValueKey('den-your-mobs')));
      await _settle(tester);
      expect(find.byKey(const ValueKey('your-mobs-join')), findsOneWidget);
      expect(find.byKey(const ValueKey('your-mobs-start-pro')), findsOneWidget);
      expect(find.textContaining(MobV4DenCopy.here), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_your_mobs_sheet_${_tag(b)}.png'));
    });
  }

  deskReducedAndExit();
}

Widget _deskFrame(Widget desk, {bool reduceInApp = false}) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SizedBox(width: 360, height: 220, child: ReducedMotionSetting(enabled: reduceInApp, child: desk)),
      ),
    );

/// The app's own reduced-motion setting (not the system's) stills the desk: frames at 0 and 120 ms. And the
/// exit when study stops (4.2): tag fades by 160, two hops back to the floor slot by 1160, lamp dims by 1760.
void deskReducedAndExit() {
  final riya = MobV3Member(memberId: 'R', name: 'Riya', colour: 3, fold: FoldKey.patang);
  final since = DateTime.utc(2026, 10, 22, 10, 22);
  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('v4 desk app reduced motion ${_tag(b)}', (tester) async {
      loadFoldManifestForTest();
      final show = ValueNotifier<bool>(false);
      addTearDown(show.dispose);
      await pumpMockmob(
        tester,
        _deskFrame(
          ValueListenableBuilder<bool>(
            valueListenable: show,
            builder: (context, on, _) => Stack(children: [
              Offstage(child: FoldPuppet(fold: riya.fold, size: 61, pose: FoldPose.think)),
              if (on) StudyDesk(member: riya, since: since, size: 61, deskTop: const Offset(300, 110), width: 360, tagTop: 116),
            ]),
          ),
          reduceInApp: true,
        ),
        brightness: b,
        size: const Size(360, 220),
      );
      await settleImages(tester);
      show.value = true;
      await tester.pump();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_desk_reduced_0ms_${_tag(b)}.png'));
      await tester.pump(const Duration(milliseconds: 120));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_desk_reduced_120ms_${_tag(b)}.png'));
    });
    testWidgets('v4 desk exit strip ${_tag(b)}', (tester) async {
      loadFoldManifestForTest();
      var left = 0;
      final show = ValueNotifier<bool>(false);
      addTearDown(show.dispose);
      await pumpMockmob(
        tester,
        _deskFrame(
          ValueListenableBuilder<bool>(
            valueListenable: show,
            builder: (context, on, _) => Stack(children: [
              Offstage(child: Row(children: [FoldPuppet(fold: riya.fold, size: 72), FoldPuppet(fold: riya.fold, size: 61)])),
              if (on) StudyDesk(member: riya, since: since, size: 61, deskTop: const Offset(300, 110), width: 360, tagTop: 116, leaving: true, floor: const Offset(150, 200), floorSize: 72, onLeft: () => left++),
            ]),
          ),
        ),
        brightness: b,
        size: const Size(360, 220),
      );
      await settleImages(tester);
      show.value = true;
      await tester.pump();
      var at = 0;
      for (final ms in [0, 160, 420, 660, 920, 1160, 1460, 1800]) {
        if (ms > at) await tester.pump(Duration(milliseconds: ms - at));
        at = ms;
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_desk_exit_${ms}ms_${_tag(b)}.png'));
      }
      expect(left, 1);
    });
  }
}
