// Goldens for the V4 den (pass-1020 MOB-MINIMAL 3.1, 3.6, 4.2; build list A1 to A4): one per Now card
// ladder step (1 to 9) in Night and Day, the main steps again at 1.3x text, Mob hours absent (the server
// has not shipped it: every Mob hours element hides), Mob hours off for everyone, the studying-now desk,
// and a frame strip of the studying desk's arrival (bulb, beam, two hops, the tag).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
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
  await tester.pump(const Duration(milliseconds: 400));
}

/// The fixture for each ladder step.
MobV3FakeServer _step(String name) {
  switch (name) {
    case 'step1_live':
      return v3Server(scenario: 'live');
    case 'step2_fix':
      return v3Server(scenario: 'played')..denFix = {'gameId': 'game-kabir-round', 'question': 4, 'state': 'ready'};
    case 'step3_check':
      return v3Server(scenario: 'played')..denFix = {'gameId': 'game-kabir-round', 'question': 4, 'state': 'check'};
    case 'step4_open':
      return v3Server(scenario: 'open');
    case 'step5_paper':
      return v3Server(scenario: 'played')..setPaperSat(false);
    case 'step6_played':
      return v3Server(scenario: 'played');
    case 'step7_fresh':
      return v3Server(scenario: 'quiet')
        ..makeNew()
        ..setPaperSat(false);
    case 'step8_ask':
      return v3Server(scenario: 'quiet', billing: 'used');
    case 'step9_one':
      return v3Server(scenario: 'one');
    case 'hours_absent':
      return v3Server(scenario: 'open')..hoursShipped = false;
  }
  throw ArgumentError(name);
}

void main() {
  setUpGoldenFonts();

  const steps = ['step1_live', 'step2_fix', 'step3_check', 'step4_open', 'step5_paper', 'step6_played', 'step7_fresh', 'step8_ask', 'step9_one', 'hours_absent'];
  for (final b in [Brightness.dark, Brightness.light]) {
    for (final s in steps) {
      testWidgets('den v4 $s 360 ${_tag(b)}', (tester) async {
        await pumpDen(tester, _step(s), brightness: b, height: 1560);
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/den_v4_${s}_360_${_tag(b)}.png'));
      });
    }
    for (final s in ['step4_open', 'step7_fresh', 'step9_one']) {
      testWidgets('den v4 $s 360 x13 ${_tag(b)}', (tester) async {
        await pumpDen(tester, _step(s), brightness: b, height: 1760, textScale: 1.3);
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/den_v4_${s}_360_x13_${_tag(b)}.png'));
      });
    }
  }

  // The studying desk arriving (4.2): bulb 0-150 ms, beam 150-450, two hops 450-1450, the tag 1450-1750.
  deskStrip();
}

/// The studying desk's arrival as a frame strip (4.2): 0 (dark), 120 (bulb), 400 (beam), 700 (first hop),
/// 1200 (second hop), 1500 (landed, think), 1800 (tag up). Pumped on its own over a plain ground.
void deskStrip() {
  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('den v4 studying desk strip ${_tag(b)}', (tester) async {
      loadFoldManifestForTest();
      final riya = MobV3Member(memberId: 'R', name: 'Riya', colour: 3, fold: FoldKey.patang);
      final show = ValueNotifier<bool>(false);
      addTearDown(show.dispose);
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => ColoredBox(
            color: context.mmColors.ground,
            child: SizedBox(
              width: 360,
              height: 220,
              child: Stack(
                children: [
                  // Both poses decode before the strip starts (the think still swaps in on landing).
                  Offstage(child: Row(children: [FoldPuppet(fold: riya.fold, size: 61), FoldPuppet(fold: riya.fold, size: 61, pose: FoldPose.think)])),
                  ValueListenableBuilder<bool>(
                    valueListenable: show,
                    builder: (context, on, _) => on
                        ? StudyDesk(member: riya, since: DateTime.utc(2026, 10, 22, 10, 22), size: 61, deskTop: const Offset(300, 110), width: 360, tagTop: 116)
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),
        ),
        brightness: b,
        size: const Size(360, 220),
      );
      await settleImages(tester);
      show.value = true;
      await tester.pump();
      var at = 0;
      for (final ms in [0, 120, 400, 700, 1200, 1500, 1800]) {
        if (ms > at) await tester.pump(Duration(milliseconds: ms - at));
        at = ms;
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/den_v4_desk_${ms}ms_${_tag(b)}.png'));
      }
    });
  }
}
