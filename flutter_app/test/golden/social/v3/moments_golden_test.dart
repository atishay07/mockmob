// Goldens for the moments K1 to K4 (spec 7.3) at 360 dp, Night and Day: the end states, K2 also at
// 412 and 1.3x text, and the frame goldens G-9 (the reveal at 300, 640, 900 and 1900 ms) and K2 at
// 0, 600, 1120 and 1900 ms.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/moment_test_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Future<void> _shoot(WidgetTester tester, String file) => expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('K2 quest done end 360 ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, brightness: b);
      await startMoment(tester, which, questKey(server));
      await pumpTo(tester, 2200);
      await _shoot(tester, 'k2_quest_done_360_${_tag(b)}');
    });

    testWidgets('K3 week stitched end 360 ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, brightness: b);
      await startMoment(tester, which, stitchKey(server));
      await pumpTo(tester, 2200);
      await _shoot(tester, 'k3_week_stitched_360_${_tag(b)}');
    });

    testWidgets('K4 reveal end 360 ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, brightness: b);
      await startMoment(tester, which, 'reveal:hop');
      await pumpTo(tester, 2200);
      await _shoot(tester, 'k4_reveal_360_${_tag(b)}');
    });

    testWidgets('K1 milestone end 360 ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'heavy');
      final which = await pumpMomentHost(tester, server: server, brightness: b, chain: chainAt(14, reward: 'rest_pass'));
      await startMoment(tester, which, 'chain:14');
      await pumpTo(tester, 2200);
      await _shoot(tester, 'k1_milestone_360_${_tag(b)}');
    });

    testWidgets('K1 milestone, no chip, long chain 360 ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'heavy');
      final which = await pumpMomentHost(tester, server: server, brightness: b, chain: chainAt(50, reward: 'ribbon'));
      await startMoment(tester, which, 'chain:50');
      await pumpTo(tester, 2200);
      await _shoot(tester, 'k1_milestone_50_360_${_tag(b)}');
    });

    testWidgets('G-9 reveal frames ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, brightness: b);
      await startMoment(tester, which, 'reveal:hop');
      var at = 0;
      for (final f in const [300, 640, 900, 1900]) {
        await pumpTo(tester, f, from: at);
        at = f;
        await _shoot(tester, 'g9_reveal_${f}_${_tag(b)}');
      }
    });

    testWidgets('K2 frames ${_tag(b)}', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, brightness: b);
      await startMoment(tester, which, questKey(server));
      var at = 0;
      for (final f in const [0, 600, 1120, 1900]) {
        await pumpTo(tester, f, from: at);
        at = f;
        await _shoot(tester, 'k2_frame_${f}_${_tag(b)}');
      }
    });
  }

  for (final shot in const [(w: 412.0, s: 1.0), (w: 360.0, s: 1.3)]) {
    testWidgets('K2 quest done end ${shot.w.round()} x${shot.s} night', (tester) async {
      final MobV3FakeServer server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, size: Size(shot.w, 780), textScale: shot.s);
      await startMoment(tester, which, questKey(server));
      await pumpTo(tester, 2200);
      await _shoot(tester, 'k2_quest_done_${shot.w.round()}${shot.s == 1 ? '' : '_x13'}_night');
    });
  }
}
