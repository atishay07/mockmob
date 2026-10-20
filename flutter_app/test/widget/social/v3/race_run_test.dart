// The race (D167): the 3, 2, 1 plays before the run is asked for (the server starts the clock at /run), the
// stopwatch counts the minutes down, questions come one at a time with no key between them, the ruler has no
// flag and grows with the leader, and the time running out ends it plainly with the server's marks.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/status_tint.dart' show statusTintColor;
import 'package:mockmob/dev/mob_v3_bank.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/countdown_stopwatch.dart' show CountdownStage;
import 'package:mockmob/features/social/v3/widgets/ruler_race.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/run_test_kit.dart';

const String kabirRace = 'game-kabir-race';

/// The race's pool order in the fixture: question i is bank question (i * 7) % bank.
int raceCorrect(int q) => mobV3Bank[(q * 7) % mobV3Bank.length].correct;

/// Answers the current race question ([right] or a wrong pick, or a skip with null) at run second [at]
/// and lets the beat pass so the next question arrives.
Future<void> raceAnswer(WidgetTester t, RecordingServer server, int q, {required bool? right, required int at}) async {
  server.skew = Duration(seconds: at);
  if (right == null) {
    await t.tap(find.byKey(const ValueKey('run-key-skip')));
  } else {
    final pick = right ? raceCorrect(q) : (raceCorrect(q) + 1) % 4;
    await tapOption(t, pick);
    await t.pump(const Duration(milliseconds: 120));
    await t.tap(find.byKey(const ValueKey('run-key-lock')));
  }
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
  // The beat (760 ms), the fade out and in.
  await t.pump(const Duration(milliseconds: 800));
  await t.pump(const Duration(milliseconds: 160));
  await t.pump(const Duration(milliseconds: 220));
}

String _text(WidgetTester t, Key key) {
  final w = t.widget(find.byKey(key)) as Text;
  return w.data ?? w.textSpan?.toPlainText() ?? '';
}

void main() {
  setUp(loadFoldManifestForTest);

  // v16 walk I-08: the app's 24 dp fade under the status bar sliced the tops off the fixed run header's title. The
  // run screen owns its top edge: the bar takes the ground solid while it is up, and lets go when it leaves.
  testWidgets('the run screen paints the status bar in the ground, so its title is never faded at the top', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await t.pump();
    expect(statusTintColor.value, isNotNull);
    await t.pumpWidget(const SizedBox.shrink());
    await t.pump();
    expect(statusTintColor.value, isNull);
  });

  testWidgets('the 3, 2, 1 plays before the run is asked for, over the runs it races, with the race line', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await t.pump();
    expect(find.byType(CountdownStage), findsOneWidget);
    expect(find.text('5 minutes start on Go. Answer as many as you can. +5 if right, -1 if wrong, 0 if you skip.'), findsOneWidget);
    expect(server.calls, isEmpty);
    // Before Go nothing has started on the server: your run does not exist yet.
    final before = await server.game(kabirRace);
    expect(before.you.run, YourRun.none);
    await pastCountdown(t);
    final after = await server.game(kabirRace);
    expect(after.you.run, YourRun.playing, reason: 'the clock started at Go');
    expect(find.byKey(const ValueKey('run-question-of')), findsOneWidget);
    expect(_text(t, const ValueKey('run-question-of')), 'Question 1');
    expect(find.text('+5 if right, -1 if wrong'), findsOneWidget);
  });

  testWidgets('the stopwatch counts the minutes down', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await pastCountdown(t);
    final start = _text(t, const ValueKey('run-clock'));
    expect(start, anyOf('5:00', '4:59'));
    await t.pump(const Duration(seconds: 30));
    await t.pump();
    expect(_text(t, const ValueKey('run-clock')), anyOf('4:30', '4:29'));
  });

  testWidgets('one question at a time: an answer brings the next with no key between them', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await pastCountdown(t);
    await raceAnswer(t, server, 0, right: true, at: 12);
    expect(_text(t, const ValueKey('run-question-of')), 'Question 2');
    expect(find.byKey(const ValueKey('run-key-next')), findsNothing, reason: 'a race moves on by itself');
    expect(find.byKey(const ValueKey('run-panel')), findsNothing);
    await raceAnswer(t, server, 1, right: false, at: 25);
    await raceAnswer(t, server, 2, right: null, at: 30);
    expect(_text(t, const ValueKey('run-question-of')), 'Question 4');
    expect(server.calls.map((c) => c.$1).toList(), [0, 1, 2]);
    // The served questions only: the run never held more than the one on screen.
    final rs = await server.run(kabirRace);
    expect(rs.questions.length, 4);
  });

  testWidgets('the ruler has no flag and grows with whoever is furthest', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await pastCountdown(t);
    final ruler = t.widget<RulerRace>(find.byType(RulerRace));
    expect(ruler.open, isTrue);
    expect(ruler.count, 10);
    expect(find.byKey(const ValueKey('ruler-pennant-RIYA00000002')), findsNothing);
    // Riya's recorded run reached 9 by 3:00 (her arrivals): the scale grows past her.
    await t.pump(const Duration(seconds: 165));
    await t.pump();
    final later = t.widget<RulerRace>(find.byType(RulerRace));
    expect(later.count, 15);
  });

  testWidgets('time up: the race ends plainly with the server\'s marks, and the podium is a tap away', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await pastCountdown(t);
    await raceAnswer(t, server, 0, right: true, at: 20);
    await raceAnswer(t, server, 1, right: true, at: 40);
    await raceAnswer(t, server, 2, right: false, at: 60);
    server.skew = const Duration(seconds: 301);
    await t.pump(const Duration(seconds: 260));
    for (var i = 0; i < 10; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
    expect(_text(t, const ValueKey('run-done-title')), 'Time is up.');
    expect(_text(t, const ValueKey('run-done-raced')), 'You answered 3 questions in 5 minutes.');
    expect(find.byKey(const ValueKey('run-done-marks')), findsOneWidget);
    expect(_text(t, const ValueKey('run-done-marks')), '9 marks', reason: 'the server marks: 5 + 5 - 1');
    expect(find.byKey(const ValueKey('run-key-podium')), findsOneWidget);
    expect(find.text("Time is up."), findsOneWidget);
    expect(find.textContaining('!'), findsNothing);
  });

  testWidgets('an answer after the time is up gets RUN_EXPIRED: the stored run, said plainly', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await pastCountdown(t);
    await raceAnswer(t, server, 0, right: true, at: 20);
    // The phone's clock is behind the server's: the server says the time is up.
    server.skew = const Duration(seconds: 320);
    await tapOption(t, raceCorrect(1));
    await t.pump(const Duration(milliseconds: 120));
    await t.tap(find.byKey(const ValueKey('run-key-lock')));
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
    expect(_text(t, const ValueKey('run-done-title')), 'Time is up.');
    expect(_text(t, const ValueKey('run-done-marks')), '5 marks');
  });

  testWidgets('a race already under way resumes at its question with no 3, 2, 1', (t) async {
    final server = RecordingServer(scenario: 'race');
    // Started and answered two on another visit (on the real loop: the fixture server awaits a delay).
    await t.runAsync(() async {
      await server.run(kabirRace);
      server.skew = const Duration(seconds: 10);
      await server.answer(kabirRace, q: 0, pick: raceCorrect(0));
      server.skew = const Duration(seconds: 20);
      await server.answer(kabirRace, q: 1, pick: raceCorrect(1));
    });
    server.calls.clear();
    await pumpRun(t, server, gameId: kabirRace);
    await t.pump();
    expect(find.byType(CountdownStage), findsNothing);
    expect(_text(t, const ValueKey('run-question-of')), 'Question 3');
  });

  testWidgets('leaving mid-race says the clock keeps running', (t) async {
    final server = RecordingServer(scenario: 'race');
    await pumpRun(t, server, gameId: kabirRace);
    await pastCountdown(t);
    await t.tap(find.byTooltip('Leave this run'));
    for (var i = 0; i < 8; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('Your answers so far are saved. The clock keeps running until your 5 minutes are up.'), findsOneWidget);
  });
}
