import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/study.dart';
import 'package:mockmob/features/learn/data/pending_event.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/screens/run_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/learn/support/learn_fixtures.dart';
import 'golden_support.dart';

RunUiState _ready(StudyRun run, {PendingEvent? pending, RunNotice notice = RunNotice.none, bool sending = false}) =>
    RunUiState(load: RunLoad.ready, run: run, pending: pending, notice: notice, sending: sending);

Future<void> _show(WidgetTester tester, Brightness b, RunUiState ui, String file, {double textScale = 1, Size size = kGoldenSize}) async {
  await pumpScreen(
    tester,
    const LearnRunScreen(runId: 'run-1'),
    brightness: b,
    size: size,
    textScale: textScale,
    overrides: learnOverrides(runs: {'run-1': ui}),
  );
  await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/$file.png'));
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in Brightness.values) {
    final n = b.name;

    testWidgets('recall card, answer hidden, $n', (tester) async {
      await _show(tester, b, _ready(run(cursor: 3, revision: 6)), 'run_card_hidden_$n');
    });

    testWidgets('recall card, answer shown with the rating keys, $n', (tester) async {
      final r = run(cursor: 3, revision: 7, revealed: true, feedback: {'answer': 'Old share − New share', 'explanation': 'A sacrifice is how much a share fell, so start from the old share.'});
      await _show(tester, b, _ready(r), 'run_card_shown_$n');
    });

    testWidgets('recall card, a rating is on its way, $n', (tester) async {
      final r = run(cursor: 3, revision: 7, revealed: true, feedback: {'answer': 'Old share − New share'});
      final pending = PendingEvent.create(expectedRevision: 7, itemId: 'card-1', type: 'rate', rating: 3);
      await _show(tester, b, _ready(r, pending: pending, sending: true), 'run_card_sending_$n');
    });

    testWidgets('recall card, reviewed offline and waiting, $n', (tester) async {
      final r = run(cursor: 3, revision: 7, revealed: true, feedback: {'answer': 'Old share − New share'});
      final pending = PendingEvent.create(expectedRevision: 7, itemId: 'card-1', type: 'rate', rating: 3);
      await _show(tester, b, _ready(r, pending: pending, notice: RunNotice.queuedOffline), 'run_card_offline_$n');
    });

    testWidgets('a step answered on another device, $n', (tester) async {
      await _show(tester, b, _ready(run(cursor: 4, revision: 9), notice: RunNotice.supersededElsewhere), 'run_superseded_$n');
    });

    testWidgets('a step type this build cannot open, $n', (tester) async {
      final r = run(cursor: 2, revision: 4, item: {'id': 'card-x', 'type': 'drag_match', 'prompt': 'Match each partner to their share.'});
      await _show(tester, b, _ready(r), 'run_unknown_step_$n');
    });

    testWidgets('recall card, no network to reveal, $n', (tester) async {
      await _show(tester, b, _ready(run(cursor: 1, revision: 2), notice: RunNotice.connectToReveal), 'run_card_connect_$n');
    });

    testWidgets('choice question, one option picked, $n', (tester) async {
      final r = run(cursor: 1, revision: 2, item: choiceCard());
      await tester.binding.setSurfaceSize(null);
      await pumpScreen(
        tester,
        const LearnRunScreen(runId: 'run-1'),
        brightness: b,
        overrides: learnOverrides(runs: {'run-1': _ready(r)}),
      );
      await tester.tap(find.text('1:1'));
      await tester.pump(const Duration(milliseconds: 300));
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/run_choice_picked_$n.png'));
    });

    testWidgets('choice question, a wrong answer with the reason, $n', (tester) async {
      final r = run(
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
      );
      await _show(tester, b, _ready(r), 'run_choice_wrong_$n', size: const Size(360, 1100));
    });

    testWidgets('gap fill with the hint shown, $n', (tester) async {
      final r = run(cursor: 4, revision: 8, item: textCard());
      await pumpScreen(
        tester,
        const LearnRunScreen(runId: 'run-1'),
        brightness: b,
        overrides: learnOverrides(runs: {'run-1': _ready(r)}),
      );
      await tester.tap(find.text('Show a hint'));
      await tester.pump();
      await tester.enterText(find.byType(TextField), 'scrutinise');
      await tester.pump();
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/run_gap_fill_$n.png'));
    });

    testWidgets('guided lesson, a reading block, $n', (tester) async {
      final r = run(id: 'run-1', mode: 'learn', cursor: 1, revision: 1, total: 9, item: readingBlock(), title: 'Sacrificing and gaining ratios');
      await _show(tester, b, _ready(r), 'run_lesson_block_$n');
    });

    testWidgets('the lesson was updated, $n', (tester) async {
      await _show(tester, b, const RunUiState(load: RunLoad.changed), 'run_changed_$n');
    });

    testWidgets('a run that is not on this phone, $n', (tester) async {
      await _show(tester, b, const RunUiState(load: RunLoad.offlineMissing), 'run_offline_missing_$n');
    });
  }

  testWidgets('recall card at 200 percent text keeps the rating keys reachable', (tester) async {
    final r = run(cursor: 3, revision: 7, revealed: true, feedback: {'answer': 'Old share − New share', 'explanation': 'A sacrifice is how much a share fell.'});
    await _show(tester, Brightness.light, _ready(r), 'run_card_shown_large', textScale: 2, size: const Size(360, 640));
    expect(tester.takeException(), isNull);
  });
}
