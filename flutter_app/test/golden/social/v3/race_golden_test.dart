// Goldens for the race (D167) at 360 dp, Night and Day: the race at question 4 against Riya's and Kabir's
// recorded runs (the open ruler, the minutes counting down), the last ten seconds, and time up with the
// server's marks. Frame strips (R5, Night): the race's 3, 2, 1 before the clock starts, and one answer moving
// on by itself (tint, mark, the next question, the Fold stepping on).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/dev/mob_v3_bank.dart';
import 'package:mockmob/features/social/v3/screens/game_run_screen.dart';

import '../../../unit/social/v3/run_test_kit.dart';
import '../../you/you_golden_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

const String _race = 'game-kabir-race';

Finder get _app => find.byType(GameRunScreen);

int _correct(int q) => mobV3Bank[(q * 7) % mobV3Bank.length].correct;

Future<void> _answer(WidgetTester t, RecordingServer s, int q, {required bool? right, required int at, bool settle = true}) async {
  s.skew = Duration(seconds: at);
  if (right == null) {
    await t.tap(find.byKey(const ValueKey('run-key-skip')));
  } else {
    await tapOption(t, right ? _correct(q) : (_correct(q) + 1) % 4);
    await t.pump(const Duration(milliseconds: 120));
    await t.tap(find.byKey(const ValueKey('run-key-lock')));
  }
  await t.pump();
  if (!settle) return;
  await t.pump(const Duration(milliseconds: 50));
  await t.pump(const Duration(milliseconds: 800));
  await t.pump(const Duration(milliseconds: 160));
  await t.pump(const Duration(milliseconds: 220));
}

/// The race to question 4: three answered by 0:41 on the clock.
Future<RecordingServer> _toQuestion4(WidgetTester t, {Brightness b = Brightness.dark}) async {
  final s = RecordingServer(scenario: 'race');
  await pumpRun(t, s, brightness: b, gameId: _race);
  await precacheRunArt(t);
  await pastCountdown(t);
  // The ruler is drawn only once the run arrives at Go: its Folds decode now, every pose a reaction can swap to.
  await precacheRunArt(t);
  await _answer(t, s, 0, right: true, at: 14);
  await _answer(t, s, 1, right: true, at: 27);
  await _answer(t, s, 2, right: false, at: 40);
  await t.pump(const Duration(milliseconds: 600));
  return s;
}

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('race at question 4 ${_tag(b)}', (t) async {
      await _toQuestion4(t, b: b);
      await precacheRunArt(t, rounds: 12);
      await expectLater(_app, matchesGoldenFile('goldens/formats/race_q4_360_${_tag(b)}.png'));
    });

    testWidgets('race, the last ten seconds ${_tag(b)}', (t) async {
      await _toQuestion4(t, b: b);
      // To 4:52 on the race's clock: the chip's edge turns ink.
      await t.pump(const Duration(seconds: 251));
      await t.pump();
      await precacheRunArt(t, rounds: 12);
      await expectLater(_app, matchesGoldenFile('goldens/formats/race_last10_360_${_tag(b)}.png'));
    });

    testWidgets('race, time up ${_tag(b)}', (t) async {
      final s = await _toQuestion4(t, b: b);
      s.skew = const Duration(seconds: 301);
      await t.pump(const Duration(seconds: 262));
      for (var i = 0; i < 12; i++) {
        await t.pump(const Duration(milliseconds: 100));
      }
      await precacheRunArt(t, rounds: 12);
      await expectLater(_app, matchesGoldenFile('goldens/formats/race_timeup_360_${_tag(b)}.png'));
    });
  }

  // Frame strip: the race's 3, 2, 1 (the clock starts at Go, so the run is asked for there).
  for (final ms in [0, 180, 600, 1200, 1800, 2100, 2400, 2700]) {
    testWidgets('race countdown frame at $ms ms', (t) async {
      final s = RecordingServer(scenario: 'race');
      await pumpRun(t, s, gameId: _race);
      await precacheRunArt(t);
      var at = 0;
      while (at + 20 <= ms) {
        await t.pump(const Duration(milliseconds: 20));
        at += 20;
      }
      if (ms > at) await t.pump(Duration(milliseconds: ms - at));
      await expectLater(_app, matchesGoldenFile('goldens/formats/race_frames/countdown_${ms.toString().padLeft(4, '0')}.png'));
    });
  }

  // Frame strip: one answer moving on by itself (question 4 right at 0:52): pick, lock, the server's tint and
  // +5, the beat, the fade, question 5 and your Fold one number on.
  for (final ms in [0, 120, 300, 520, 760, 900, 1060, 1300]) {
    testWidgets('race answer frame at $ms ms', (t) async {
      final s = await _toQuestion4(t);
      await precacheRunArt(t, rounds: 12);
      s.skew = const Duration(seconds: 52);
      await tapOption(t, _correct(3));
      await t.pump(const Duration(milliseconds: 120));
      await t.tap(find.byKey(const ValueKey('run-key-lock')));
      await t.pump();
      var at = 0;
      while (at + 20 <= ms) {
        await t.pump(const Duration(milliseconds: 20));
        at += 20;
      }
      if (ms > at) await t.pump(Duration(milliseconds: ms - at));
      await expectLater(_app, matchesGoldenFile('goldens/formats/race_frames/answer_${ms.toString().padLeft(4, '0')}.png'));
      // Let the answer and its beat finish so no timer is left behind.
      await t.pump(const Duration(seconds: 2));
    });
  }
}
