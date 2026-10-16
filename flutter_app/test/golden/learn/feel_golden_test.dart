// The moment after a concept check is answered on this phone: the right row's outline and check
// inked, the feedback panel with its words and Mobi beside them. Taken 2.2 s after the server's
// acknowledgement, when every mark has landed and Mobi's act has played.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/screens/run_screen.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;

import '../../helpers/fonts.dart';
import '../../unit/learn/support/learn_fixtures.dart';
import 'golden_support.dart';

class _Quiet implements HapticDriver {
  @override
  Future<void> lightImpact() async {}
  @override
  Future<void> mediumImpact() async {}
  @override
  Future<void> selectionClick() async {}
}

class _ScriptedRun extends RunController {
  _ScriptedRun(super.runId, this.initial);

  final RunUiState initial;
  @override
  RunUiState build() => initial;

  void show(RunUiState next) => state = next;
}

void main() {
  setUpAll(loadAppFonts);
  setUp(MobiRation.reset);

  final live = RunUiState(load: RunLoad.ready, run: run(cursor: 1, revision: 2, item: choiceCard()));

  Future<void> answered(WidgetTester tester, Brightness b, RunUiState next, String file) async {
    late _ScriptedRun scripted;
    await pumpScreen(
      tester,
      const LearnRunScreen(runId: 'run-1'),
      brightness: b,
      size: const Size(360, 1000),
      overrides: [
        ...learnOverrides(),
        runControllerProvider('run-1').overrideWith(() => scripted = _ScriptedRun('run-1', live)),
        celebrationModeProvider.overrideWithValue(CelebrationMode.full),
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: _Quiet())),
      ],
    );
    scripted.show(next);
    await tester.pump();
    for (var i = 0; i < 22; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/$file.png'));
  }

  for (final b in Brightness.values) {
    final n = b.name;

    testWidgets('a right answer just landed, $n', (tester) async {
      final right = RunUiState(
        load: RunLoad.ready,
        run: run(
          cursor: 1,
          revision: 3,
          revealed: true,
          item: choiceCard(revealed: true, answer: 0),
          feedback: {'correct': true, 'answer': '3:2', 'chosen': '3:2', 'explanation': 'C takes the share in the old ratio, so the old ratio is the sacrificing ratio.'},
        ),
      );
      await answered(tester, b, right, 'run_choice_right_landed_$n');
    });

    testWidgets('a miss just landed, $n', (tester) async {
      final missed = RunUiState(
        load: RunLoad.ready,
        run: run(
          cursor: 1,
          revision: 3,
          revealed: true,
          item: choiceCard(revealed: true, answer: 0),
          feedback: {
            'correct': false,
            'answer': '3:2',
            'chosen': '1:1',
            'whyChosen': '1:1 would be right only if A and B gave up equal amounts.',
            'explanation': 'C takes the share in the old ratio, so the old ratio is the sacrificing ratio.',
          },
        ),
      );
      await answered(tester, b, missed, 'run_choice_miss_landed_$n');
    });
  }
}
