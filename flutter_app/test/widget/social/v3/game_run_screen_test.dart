// The run, state by state (spec 7.2 game_run_screen_test, 5.3 R1 to R6), on the fixture server and
// the fixed clock, game 'game-riya-sprint' (Riya, Kabir and Zoya have recorded runs; you have not
// played it).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/results_run.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';
import 'package:mockmob/features/social/v3/widgets/run_option.dart';
import 'package:mockmob/features/social/v3/widgets/ruler_race.dart';

import '../../../unit/social/v3/run_test_kit.dart';

const Duration _feedback = Duration(milliseconds: 1300);

RunOptionLook _look(WidgetTester tester, int i) => tester.widget<RunOption>(option(i)).look;

Future<void> _ready(WidgetTester tester, RecordingServer s, {bool reduced = false}) async {
  await pumpRun(tester, s, reduced: reduced);
  await pastCountdown(tester);
}

void main() {
  testWidgets('R1: question 1 of 5, the marks rule, the caption, Skip and the disabled key', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    expect(find.text('Question 1 of 5'), findsOneWidget);
    expect(find.text('+5 if right, -1 if wrong'), findsOneWidget);
    expect(find.text('Where everyone is. Never what they picked.'), findsOneWidget);
    expect(find.text('3 runs to race'), findsOneWidget);
    expect(find.text("Riya's sprint"), findsOneWidget);
    expect(find.text('Skip'), findsOneWidget);
    expect(find.text('Pick an answer'), findsOneWidget);
    // Four options, A to D, none marked.
    for (var i = 0; i < 4; i++) {
      expect(_look(tester, i), RunOptionLook.idle);
    }
    // No pace chip before the first answer.
    expect(find.byKey(const ValueKey('run-pace')), findsNothing);
    // The ruler: three ghosts and you, ghosts drawn as ghosts.
    final ghosts = tester.widgetList<FoldPuppet>(find.byType(FoldPuppet)).where((p) => p.ghost).length;
    expect(ghosts, 3);
  });

  testWidgets('a pick names the key "Lock in B"; lock-in sends one request, even when tapped twice', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    await tapOption(tester, 1);
    await tester.pump(const Duration(milliseconds: 150));
    expect(find.text('Lock in B'), findsOneWidget);
    expect(_look(tester, 1), RunOptionLook.picked);
    s.answerDelay = const Duration(milliseconds: 300);
    await tester.tap(find.byKey(const ValueKey('run-key-lock')));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('run-key-lock')), warnIfMissed: false);
    await tester.tap(option(2), warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(_feedback);
    expect(s.calls, [(0, 1)]);
  });

  testWidgets('"Saving your answer" shows only after 600 ms with no reply', (tester) async {
    final s = RecordingServer()..answerDelay = const Duration(seconds: 2);
    await _ready(tester, s);
    await tapOption(tester, 0);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.tap(find.byKey(const ValueKey('run-key-lock')));
    await tester.pump(const Duration(milliseconds: 550));
    expect(find.text('Saving your answer'), findsNothing);
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Saving your answer'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Saving your answer'), findsNothing);
  });

  testWidgets('a retry after a timeout sends the same question and pick', (tester) async {
    final s = RecordingServer(failAnswers: 1);
    await _ready(tester, s);
    await tapOption(tester, 2);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.tap(find.byKey(const ValueKey('run-key-lock')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('run-key-retry')), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const ValueKey('run-send-error'))).data, isNotEmpty);
    // The pick stays locked while it retries; nothing else can be picked.
    expect(_look(tester, 2), RunOptionLook.locked);
    await tester.tap(find.byKey(const ValueKey('run-key-retry')));
    await tester.pump();
    await tester.pump(_feedback);
    expect(s.calls, [(0, 2), (0, 2)]);
    expect(find.byKey(const ValueKey('run-panel')), findsOneWidget);
  });

  testWidgets('R2 right: the tick, "+5" from the server, the panel and "Next question"', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    await answerAt(tester, s, pick: correctOf(0), atSeconds: 42, next: false);
    expect(_look(tester, correctOf(0)), RunOptionLook.right);
    expect(find.text('Right.'), findsOneWidget);
    expect(find.text('+5 marks. Your Mob only sees that you moved on.'), findsOneWidget);
    expect(find.text('Next question'), findsOneWidget);
    // The pace chip appears after the first answer.
    expect(find.text('1 s behind Riya'), findsOneWidget);
  });

  testWidgets('M2: the picked option stays in full view above the panel (the last option, small phone)', (tester) async {
    final s = RecordingServer();
    await pumpRun(tester, s, size: const Size(360, 640), textScale: 1.3);
    await pastCountdown(tester);
    // The last option on a small phone at large text: it sits low, where the panel lands.
    await answerAt(tester, s, pick: 3, atSeconds: 30, next: false);
    await tester.pump(const Duration(milliseconds: 400));
    final opt = tester.getRect(option(3));
    final panel = tester.getRect(find.byKey(const ValueKey('run-panel')));
    expect(opt.bottom, lessThanOrEqualTo(panel.top + 0.5), reason: 'the option ($opt) is under the panel ($panel)');
    expect(opt.top, greaterThanOrEqualTo(0));
  });

  testWidgets('M5: the tick draws over 450 ms from 120 ms, steadily', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    final right = correctOf(0);
    await tapOption(tester, right);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.tap(find.byKey(const ValueKey('run-key-lock')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    // Sample the drawn share across the stroke through the option's own maths.
    double drawnAt(double ms) => RunOption.tickCurve.transform(((ms - 120) / 450).clamp(0.0, 1.0));
    expect(drawnAt(120), 0);
    expect(drawnAt(120 + 112), inInclusiveRange(0.1, 0.25));
    expect(drawnAt(120 + 225), closeTo(0.5, 0.02));
    expect(drawnAt(120 + 338), inInclusiveRange(0.75, 0.9));
    expect(drawnAt(570), 1);
    await tester.pump(_feedback);
    expect(_look(tester, right), RunOptionLook.right);
  });

  testWidgets('R3 "Not this one" never highlights another option (F1)', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    final wrong = wrongOf(0);
    await answerAt(tester, s, pick: wrong, atSeconds: 40, next: false);
    for (var t = 0; t < 4; t++) {
      // Every frame of the feedback: only your own pick changes.
      for (var i = 0; i < 4; i++) {
        expect(_look(tester, i), i == wrong ? RunOptionLook.wrong : RunOptionLook.idle);
      }
      await tester.pump(const Duration(milliseconds: 300));
    }
    final correct = tester.widget<RunOption>(option(correctOf(0)));
    expect(correct.look, RunOptionLook.idle);
    expect(find.text('Not this one.'), findsOneWidget);
    expect(find.textContaining('The right answer and why open for everyone when the game closes at'), findsOneWidget);
    expect(find.text('-1'), findsOneWidget);
    expect(find.text('+5'), findsNothing);
    expect(find.byIcon(Icons.check), findsNothing);
  });

  testWidgets('a skip costs 0: no marks either way, no option marked', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    await answerAt(tester, s, pick: -1, atSeconds: 30, next: false);
    expect(s.calls, [(0, -1)]);
    expect(find.text('Skipped. No marks either way.'), findsOneWidget);
    expect(find.text('-1'), findsNothing);
    expect(find.text('+5'), findsNothing);
    for (var i = 0; i < 4; i++) {
      expect(_look(tester, i), RunOptionLook.idle);
    }
    final res = (await tester.runAsync(() => s.answer(riyaSprint, q: 0, pick: -1)))!;
    expect(res.delta, 0);
    expect(res.marks, 0);
  });

  testWidgets('the pace chip flips from "4 s behind Kabir" to "4 s ahead of Kabir"', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    await answerAt(tester, s, pick: correctOf(0), atSeconds: 42);
    expect(find.text('1 s behind Riya'), findsOneWidget);
    await answerAt(tester, s, pick: correctOf(1), atSeconds: 88);
    expect(find.text('4 s behind Kabir'), findsOneWidget);
    await answerAt(tester, s, pick: correctOf(2), atSeconds: 122, next: false);
    expect(find.text('4 s ahead of Kabir'), findsOneWidget);
    expect(find.text('Question 3 of 5'), findsOneWidget);
  });

  testWidgets('three right in a row says so once per run, with the stamp', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    await answerAt(tester, s, pick: correctOf(0), atSeconds: 30);
    await answerAt(tester, s, pick: correctOf(1), atSeconds: 60);
    await answerAt(tester, s, pick: correctOf(2), atSeconds: 90, next: false);
    expect(find.text('Right. Three in a row.'), findsOneWidget);
    expect(find.byKey(const ValueKey('run-stamp')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('run-key-next')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await answerAt(tester, s, pick: correctOf(3), atSeconds: 120, next: false);
    expect(find.text('Right.'), findsOneWidget);
    expect(find.byKey(const ValueKey('run-stamp')), findsNothing);
  });

  testWidgets('R6: all 5 played, the marks the server sent, then the podium', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    await answerAt(tester, s, pick: correctOf(0), atSeconds: 30);
    await answerAt(tester, s, pick: wrongOf(1), atSeconds: 60);
    await answerAt(tester, s, pick: correctOf(2), atSeconds: 90);
    await answerAt(tester, s, pick: -1, atSeconds: 100);
    await answerAt(tester, s, pick: correctOf(4), atSeconds: 130, next: false);
    expect(find.text('See how you did'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('run-key-next')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('You played all 5.'), findsOneWidget);
    // 3 right, 1 wrong, 1 skipped: the server says 14. The app shows the server's number.
    final run = (await tester.runAsync(() => s.answer(riyaSprint, q: 4, pick: correctOf(4))))!;
    expect(run.marks, 14);
    final marks = tester.widget<Text>(find.byKey(const ValueKey('run-done-marks')));
    expect(marks.textSpan!.toPlainText(), '14 marks');
    // Your Fold stands at the flag.
    final ruler = tester.widget<RulerRace>(find.byType(RulerRace));
    expect(ruler.racers.firstWhere((r) => r.you).finished, isTrue);
    await tester.tap(find.text('See the podium'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    // V4 (A10): the run's end opens the results run, whose first screen is the podium.
    expect(find.byType(ResultsRun), findsOneWidget);
  });

  testWidgets('resume from stored answers: no countdown, the Fold at its question, no animation', (tester) async {
    final s = RecordingServer();
    await tester.runAsync(() async {
      await s.run(riyaSprint);
      s.skew = const Duration(seconds: 42);
      await s.answer(riyaSprint, q: 0, pick: correctOf(0));
      s.skew = const Duration(seconds: 88);
      await s.answer(riyaSprint, q: 1, pick: wrongOf(1));
    });
    s.calls.clear();
    await pumpRun(tester, s);
    expect(find.byKey(const ValueKey('run-countdown')), findsNothing);
    expect(find.text('Question 3 of 5'), findsOneWidget);
    final ruler = tester.widget<RulerRace>(find.byType(RulerRace));
    final you = ruler.racers.firstWhere((r) => r.you);
    // No animation: your Fold is already standing where it stays.
    final before = tester.getTopLeft(find.byKey(const ValueKey('ruler-fold-you')));
    await tester.pump(const Duration(milliseconds: 150));
    expect(tester.getTopLeft(find.byKey(const ValueKey('ruler-fold-you'))), before);
    expect(you.at, 3);
    expect(ruler.answered, 2);
    // The pace chip from the stored times.
    expect(find.text('4 s behind Kabir'), findsOneWidget);
    expect(s.calls, isEmpty);
  });

  testWidgets('RUN_DONE goes straight to the podium', (tester) async {
    final s = RecordingServer(scenario: 'played');
    await pumpRun(tester, s, gameId: 'game-kabir-round');
    await tester.pump(const Duration(milliseconds: 600));
    // V4 (A10): the run's end opens the results run, whose first screen is the podium.
    expect(find.byType(ResultsRun), findsOneWidget);
  });

  testWidgets('GAME_CLOSED shows its sentence and Back', (tester) async {
    final s = RecordingServer()..closeAllGames();
    await pumpRun(tester, s);
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('This game has closed. Its answers are open now.'), findsOneWidget);
    expect(find.text('Back'), findsOneWidget);
    expect(find.byType(RunOption), findsNothing);
  });

  testWidgets('a ghost reaching the flag: pennant, then the toast; never a count of who is left', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    // Riya's run reaches the flag at 190 s.
    await tester.pump(const Duration(seconds: 191));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byKey(const ValueKey('ruler-pennant-RIYA00000002')), findsOneWidget);
    expect(find.text("Riya's run reached the flag. Take your time."), findsOneWidget);
    expect(find.textContaining('still playing'), findsNothing);
    expect(find.textContaining('of you'), findsNothing);
    await tester.pump(const Duration(seconds: 30));
  });

  testWidgets('Leave this run asks first and keeps the answers', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s);
    await tester.tap(find.byTooltip('Leave this run'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Leave this run?'), findsOneWidget);
    expect(find.text('Your answers so far are saved. You can come back until your time runs out.'), findsOneWidget);
    await tester.tap(find.text('Keep playing'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Leave this run?'), findsNothing);
    expect(find.text('Question 1 of 5'), findsOneWidget);
  });

  testWidgets('reduced motion: the same states, no clip travel, no float, the right option still never marked', (tester) async {
    final s = RecordingServer();
    await _ready(tester, s, reduced: true);
    expect(find.text('Question 1 of 5'), findsOneWidget);
    await answerAt(tester, s, pick: wrongOf(0), atSeconds: 40, next: false);
    expect(find.text('Not this one.'), findsOneWidget);
    expect(_look(tester, correctOf(0)), RunOptionLook.idle);
    await tester.tap(find.byKey(const ValueKey('run-key-next')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await answerAt(tester, s, pick: correctOf(1), atSeconds: 80, next: false);
    expect(find.text('Right.'), findsOneWidget);
    expect(find.text('+5'), findsNothing); // no float in reduced motion
  });

  testWidgets('RUN_EXPIRED: its sentence and the stored marks it carries, then the podium', (tester) async {
    final s = _ExpiringServer();
    await _ready(tester, s);
    await tapOption(tester, 0);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.tap(find.byKey(const ValueKey('run-key-lock')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Your time on this game ran out. Questions you did not answer count as skipped.'), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const ValueKey('run-done-marks'))).textSpan!.toPlainText(), '9 marks');
    expect(find.text('See the podium'), findsOneWidget);
  });
}

class _ExpiringServer extends RecordingServer {
  @override
  Future<AnswerResult> answer(String id, {required int q, required int pick}) async {
    throw const ApiError(kind: ApiErrorKind.conflict, code: 'RUN_EXPIRED', status: 410, details: {
      'run': {'finished': true, 'marks': 9, 'answered': 2, 'count': 5},
    });
  }
}
