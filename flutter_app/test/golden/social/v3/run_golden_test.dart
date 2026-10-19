// Goldens for the run (spec 7.3): R1 (3 ghosts at question 3, and 5 players compact), R2 Right,
// R3 Not this one, R5 a ghost reaching the flag, R6 done, at 360 dp Night and Day (R1 also at 412
// and 1.3x text); and G-4, the countdown frames at 0, 180, 450, 600, 780, 1200, 1800 and 2400 ms
// (Night). Every frame comes from the fixture server on the fixed clock.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/screens/game_run_screen.dart';

import '../../../unit/social/v3/run_test_kit.dart';
import '../../you/you_golden_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Finder get _app => find.byType(GameRunScreen);

/// Plays to question 3 like the fixture's walk: question 1 right at 42 s, question 2 right at 88 s.
Future<MobV3FakeServer> _toQuestion3(WidgetTester tester, {Brightness b = Brightness.dark, Size size = const Size(360, 780), double scale = 1, MobV3FakeServer? server}) async {
  final s = server ?? RecordingServer();
  await pumpRun(tester, s, brightness: b, size: size, textScale: scale);
  await precacheRunArt(tester);
  await pastCountdown(tester);
  await answerAt(tester, s, pick: correctOf(0), atSeconds: 42);
  await answerAt(tester, s, pick: correctOf(1), atSeconds: 88);
  await tester.pump(const Duration(milliseconds: 600));
  return s;
}

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('R1 the run, 3 ghosts, question 3 ${_tag(b)}', (tester) async {
      await _toQuestion3(tester, b: b);
      await tester.tap(option(1));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 500));
      await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_r1_360_${_tag(b)}.png'));
    });
  }

  testWidgets('R1 the run 412 night', (tester) async {
    await _toQuestion3(tester, size: const Size(412, 860));
    await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_r1_412_night.png'));
  });

  testWidgets('R1 the run 360 x1.3 night', (tester) async {
    await _toQuestion3(tester, size: const Size(360, 1100), scale: 1.3);
    await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_r1_360_x13_night.png'));
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('R2 right ${_tag(b)}', (tester) async {
      final s = await _toQuestion3(tester, b: b);
      await answerAt(tester, s, pick: correctOf(2), atSeconds: 122, next: false);
      await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_r2_right_360_${_tag(b)}.png'));
    });

    testWidgets('R3 not this one ${_tag(b)}', (tester) async {
      final s = await _toQuestion3(tester, b: b);
      await answerAt(tester, s, pick: wrongOf(2), atSeconds: 122, next: false);
      await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_r3_wrong_360_${_tag(b)}.png'));
    });
  }

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('R5 a ghost reaches the flag ${_tag(b)}', (tester) async {
      final s = await _toQuestion3(tester, b: b);
      await answerAt(tester, s, pick: correctOf(2), atSeconds: 122);
      await answerAt(tester, s, pick: -1, atSeconds: 186);
      // Riya's recorded run reaches the flag at 190 s; the frame after the pennant and the toast.
      await tester.pump(const Duration(seconds: 4));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_r5_flag_360_${_tag(b)}.png'));
      await tester.pump(const Duration(seconds: 5));
    });

    testWidgets('R6 your run is done ${_tag(b)}', (tester) async {
      final s = await _toQuestion3(tester, b: b);
      await answerAt(tester, s, pick: correctOf(2), atSeconds: 122);
      await answerAt(tester, s, pick: wrongOf(3), atSeconds: 160);
      await answerAt(tester, s, pick: correctOf(4), atSeconds: 199);
      await tester.pump(const Duration(milliseconds: 800));
      await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_r6_done_360_${_tag(b)}.png'));
      await tester.pump(const Duration(seconds: 5));
    });
  }

  // Countdown frames, G-4 (Night).
  for (final ms in [0, 180, 450, 600, 780, 1200, 1800, 2400]) {
    testWidgets('G-4 countdown at $ms ms', (tester) async {
      await pumpRun(tester, RecordingServer());
      await precacheRunArt(tester);
      await tester.pump(Duration(milliseconds: ms));
      await precacheRunArt(tester, rounds: 3);
      await expectLater(_app, matchesGoldenFile('goldens/run_g4_countdown_$ms.png'));
    });
  }
}
