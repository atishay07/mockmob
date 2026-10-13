import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/data/pending_event.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/data/summary_loader.dart';
import 'package:mockmob/features/learn/models/chapter_summary.dart';
import 'package:mockmob/features/learn/screens/run_done_screen.dart';
import 'package:mockmob/features/learn/screens/summary_screen.dart';
import 'package:mockmob/features/learn/screens/unit_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/learn/support/learn_fixtures.dart';
import 'golden_support.dart';

Map<String, dynamic> _lesson({bool read = false, Map<String, dynamic>? inProgress, int cards = 6}) => {
      'id': 'acc-sacrifice',
      'version': 2,
      'contentHash': 'h',
      'subject': 'accountancy',
      'chapter': 'Change in Profit Sharing Ratio',
      'title': 'Sacrificing and gaining ratios',
      'summary': 'Work out who gave up profit share and who gained it, one partner at a time.',
      'estimatedMinutes': 7,
      'objectives': [
        'Calculate a partner’s sacrifice or gain from old and new shares',
        'Turn individual sacrifices into a sacrificing ratio',
        'Know when the old ratio is also the sacrificing ratio',
      ],
      'blocks': [
        readingBlock(),
        {
          'id': 'ratio-steps',
          'type': 'reading',
          'kind': 'steps',
          'title': 'The four-line method',
          'steps': [
            'Write each partner’s old share and new share as fractions.',
            'Put all of them over one common denominator.',
            'Subtract old − new for every partner.',
            'Positive results are sacrifices. Write them as a ratio in lowest terms.',
          ],
        },
        {
          'id': 'ratio-worked',
          'type': 'reading',
          'kind': 'worked_example',
          'title': 'Work one partner at a time',
          'body': 'A and B used to share 3:2. C joins, and the new ratio A:B:C is 5:3:2.',
          'rows': [
            ['Partner', 'Old share', 'New share', 'Sacrifice'],
            ['A', '6/10', '5/10', '1/10'],
            ['B', '4/10', '3/10', '1/10'],
          ],
        },
        {'id': 'ratio-check', 'type': 'numeric', 'kind': 'knowledge_check', 'prompt': 'Not shown on the lesson page'},
      ],
      'progress': {'status': read ? 'learned' : (inProgress != null ? 'in_progress' : 'new'), 'read': read, 'inProgress': inProgress},
      'recall': {'available': cards, 'due': 2},
    };

Future<void> _unit(WidgetTester tester, Brightness b, Map<String, dynamic> json, String file, {bool fromPhone = false}) async {
  await pumpScreen(
    tester,
    const LearnUnitScreen(unitId: 'acc-sacrifice'),
    brightness: b,
    overrides: [
      ...learnOverrides(),
      lessonProvider('acc-sacrifice').overrideWith((ref) => LessonLoad(json: json, fromPhone: fromPhone)),
    ],
  );
  await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/$file.png'));
}

Future<void> _done(WidgetTester tester, Brightness b, RunUiState ui, String file) async {
  await pumpScreen(
    tester,
    const LearnRunDoneScreen(runId: 'run-1'),
    brightness: b,
    overrides: learnOverrides(catalog: catalog(due: 4), runs: {'run-1': ui}),
  );
  await settleImages(tester);
  await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/$file.png'));
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in Brightness.values) {
    final n = b.name;

    testWidgets('lesson page, not started, $n', (tester) async {
      await _unit(tester, b, _lesson(), 'unit_new_$n');
    });

    testWidgets('lesson page, read, with cards to review and kept on this phone, $n', (tester) async {
      await _unit(tester, b, _lesson(read: true), 'unit_read_$n', fromPhone: true);
    });

    testWidgets('lesson page, every block kind (tall), $n', (tester) async {
      await pumpScreen(tester, const LearnUnitScreen(unitId: 'acc-sacrifice'), brightness: b, size: const Size(360, 1500), overrides: [
        ...learnOverrides(),
        lessonProvider('acc-sacrifice').overrideWith((ref) => LessonLoad(json: _lesson(), fromPhone: false)),
      ]);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/unit_tall_$n.png'));
    });

    testWidgets('run ending, 8 cards recorded, $n', (tester) async {
      final r = run(
        state: 'complete',
        cursor: 8,
        revision: 16,
        item: null,
        updatedAt: '2026-10-12T12:42:00.000Z',
        reviewed: [
          {'title': 'Sacrifice formula', 'rating': 1},
          {'title': 'Old ratio as sacrificing ratio', 'rating': 2},
          {'title': 'Gain formula', 'rating': 4},
        ],
      );
      await _done(tester, b, RunUiState(load: RunLoad.ready, run: r), 'done_recall_$n');
    });

    testWidgets('review ending, most cards forgot, Mobi points at the list, $n', (tester) async {
      final r = run(
        state: 'complete',
        cursor: 8,
        revision: 16,
        item: null,
        updatedAt: '2026-10-12T12:42:00.000Z',
        reviewed: [
          for (var i = 1; i <= 7; i++) {'title': 'Card $i of the ratio rules', 'rating': i <= 5 ? 1 : 2, 'unitId': 'acc-sacrifice'},
          {'title': 'Gain formula', 'rating': 3},
        ],
      );
      await pumpScreen(
        tester,
        const LearnRunDoneScreen(runId: 'run-1'),
        brightness: b,
        size: const Size(360, 1100),
        overrides: learnOverrides(catalog: catalog(due: 4), runs: {'run-1': RunUiState(load: RunLoad.ready, run: r)}),
      );
      await settleImages(tester);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/done_forgot_$n.png'));
    });

    testWidgets('chapter summary reader, $n', (tester) async {
      await pumpScreen(
        tester,
        const LearnSummaryScreen(subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio'),
        brightness: b,
        size: const Size(360, 1300),
        overrides: [
          ...learnOverrides(),
          chapterSummaryProvider(('accountancy', 'Change in Profit Sharing Ratio')).overrideWith(
            (ref) => ChapterSummary.fromJson(
              {
                'subject': 'accountancy',
                'chapter': 'Change in Profit Sharing Ratio',
                'units': [
                  {'id': 'acc-sacrifice', 'title': 'Sacrificing and gaining ratios', 'objectives': (_lesson()['objectives'] as List), 'blocks': [readingBlock()]},
                  {
                    'id': 'acc-gain',
                    'title': 'Gaining ratio on retirement',
                    'objectives': ['Work out what each remaining partner gains'],
                    'blocks': [
                      {'id': 'g1', 'type': 'reading', 'kind': 'mistake', 'title': 'Do not reuse the old ratio', 'body': 'On retirement the gaining ratio is new share minus old share for each remaining partner.'},
                    ],
                  },
                ],
              },
              subject: 'accountancy',
              chapter: 'Change in Profit Sharing Ratio',
            ),
          ),
        ],
      );
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/summary_reader_$n.png'));
    });

    testWidgets('run ending for a lesson, nothing marked, $n', (tester) async {
      final r = run(mode: 'learn', state: 'complete', cursor: 9, total: 9, revision: 20, item: null, updatedAt: '2026-10-12T12:42:00.000Z');
      await _done(tester, b, RunUiState(load: RunLoad.ready, run: r), 'done_lesson_$n');
    });

    testWidgets('run ending, the step is still on this phone, $n', (tester) async {
      final r = run(cursor: 7, revision: 15, revealed: true, feedback: {'answer': 'x'});
      final pending = PendingEvent.create(expectedRevision: 15, itemId: 'card-1', type: 'rate', rating: 3);
      await _done(tester, b, RunUiState(load: RunLoad.ready, run: r, pending: pending), 'done_pending_$n');
    });

    testWidgets('run ending, set aside for another lesson, $n', (tester) async {
      final r = run(state: 'set_aside', item: null);
      await _done(tester, b, RunUiState(load: RunLoad.ready, run: r), 'done_set_aside_$n');
    });
  }
}
