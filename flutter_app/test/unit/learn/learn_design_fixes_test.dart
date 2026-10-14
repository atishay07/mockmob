// Design review fixes for Learn: one dominant action per state, honest empty states, and nothing
// clipped at 1.3x text on 360 dp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/data/summary_loader.dart';
import 'package:mockmob/features/learn/models/chapter_summary.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/screens/learn_screen.dart';
import 'package:mockmob/features/learn/screens/run_done_screen.dart';
import 'package:mockmob/features/learn/screens/run_screen.dart';
import 'package:mockmob/features/learn/screens/summary_screen.dart';
import 'package:mockmob/features/learn/widgets/run_step.dart';

import '../../golden/learn/golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/learn_fixtures.dart';

class _Host extends StatelessWidget {
  const _Host({required this.ui, this.onReveal});

  final RunUiState ui;
  final VoidCallback? onReveal;

  @override
  Widget build(BuildContext context) => RunStep(
        ui: ui,
        isLast: false,
        actions: RunStepActions(reveal: onReveal ?? () {}, answer: (v, {assisted = false}) {}, rate: (_) {}, advance: () {}, retry: () {}),
      );
}

LearnCatalog _noLessons() => LearnCatalog.fromJson({...catalogJson(due: 0), 'units': <Object>[], 'nextUnit': null});

void main() {
  setUpAll(loadAppFonts);

  group('a card whose answer is hidden', () {
    testWidgets('has one pinned Show the answer key, and it reveals', (tester) async {
      var revealed = 0;
      await pumpMockmob(
        tester,
        _Host(ui: RunUiState(load: RunLoad.ready, run: run(cursor: 1, revision: 2)), onReveal: () => revealed++),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text(LearnCopy.showAnswer), findsOneWidget);
      await tester.tap(find.text(LearnCopy.showAnswer));
      expect(revealed, 1);
    });

    testWidgets('the tile above the key still reveals when tapped', (tester) async {
      var revealed = 0;
      await pumpMockmob(
        tester,
        _Host(ui: RunUiState(load: RunLoad.ready, run: run(cursor: 1, revision: 2)), onReveal: () => revealed++),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      await tester.tap(find.text(LearnCopy.tapToReveal));
      expect(revealed, 1);
    });
  });

  group('a step this build cannot open', () {
    testWidgets('leads with the newer-version message and says skipping leaves the other cards alone', (tester) async {
      final r = run(cursor: 2, revision: 4, item: {'id': 'card-x', 'type': 'drag_match', 'prompt': 'Match each partner to their share.'});
      await pumpMockmob(tester, _Host(ui: RunUiState(load: RunLoad.ready, run: r)), brightness: Brightness.dark, disableAnimations: true);
      expect(find.text(LearnCopy.unknownStep), findsOneWidget);
      expect(find.text(LearnCopy.skipNote), findsOneWidget);
      expect(find.text(LearnCopy.skipStep), findsOneWidget);
    });
  });

  group('Concepts with no lessons yet', () {
    testWidgets('has one hero, no "Nothing is due" card, and the Practise keys in view', (tester) async {
      await pumpScreen(tester, const LearnScreen(), brightness: Brightness.dark, size: const Size(360, 1100), overrides: learnOverrides(catalog: _noLessons()));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(LearnCopy.noLessonsTitle), findsOneWidget);
      expect(find.text(LearnCopy.nothingDue), findsNothing);
      expect(find.text(LearnCopy.practiseKey), findsWidgets);
      expect(LearnCopy.noLessonsMobi, isNot(contains('!')));
    });

    testWidgets('does not clip at 1.3x text', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: Brightness.light,
        size: const Size(360, 1100),
        textScale: 1.3,
        overrides: learnOverrides(catalog: _noLessons()),
      );
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.takeException(), isNull);
    });
  });

  group('Concepts with nothing due and new cards ready', () {
    testWidgets('leads with the good news, and shows the suggested lesson once', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: Brightness.dark,
        size: const Size(360, 1500),
        overrides: learnOverrides(catalog: catalog(due: 0, newCount: 3), firstVisit: true),
      );
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(LearnCopy.newReadyHeadline(3)), findsOneWidget);
      expect(find.text(LearnCopy.nothingDue), findsNothing);
      // The lesson is not repeated as a card above its own row.
      expect(find.text(LearnCopy.nextLessonHeading), findsNothing);
      expect(find.text('Sacrificing and gaining ratios'), findsOneWidget);
      expect(find.textContaining(LearnCopy.upNext), findsOneWidget);
    });

    testWidgets('with nothing to start at all it still says nothing is due', (tester) async {
      await pumpScreen(tester, const LearnScreen(), brightness: Brightness.dark, overrides: learnOverrides(catalog: catalog(due: 0)));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(LearnCopy.nothingDue), findsOneWidget);
    });

    test('the headline names the count and ends with a full stop', () {
      expect(LearnCopy.newReadyHeadline(3), '3 new cards ready.');
      expect(LearnCopy.newReadyHeadline(1), '1 new card ready.');
    });
  });

  group('the run ending after a poor review', () {
    testWidgets('keeps every row and the Open the lesson key inside the screen at 1.3x text', (tester) async {
      final r = run(
        state: 'complete',
        cursor: 8,
        revision: 16,
        item: null,
        updatedAt: '2026-10-12T12:42:00.000Z',
        reviewed: [
          for (var i = 1; i <= 7; i++) {'title': 'Card $i of the ratio rules', 'rating': i == 2 ? 2 : 1, 'unitId': 'acc-sacrifice'},
          {'title': 'Gain formula', 'rating': 3},
        ],
      );
      await pumpScreen(
        tester,
        const LearnRunDoneScreen(runId: 'run-1'),
        brightness: Brightness.dark,
        size: const Size(360, 1100),
        textScale: 1.3,
        overrides: learnOverrides(catalog: catalog(due: 4), runs: {'run-1': RunUiState(load: RunLoad.ready, run: r)}),
      );
      await tester.pump(const Duration(seconds: 6));
      expect(tester.takeException(), isNull);
      expect(find.text(LearnCopy.openLesson), findsOneWidget);
      final key = tester.getRect(find.text(LearnCopy.openLesson));
      expect(key.right, lessThanOrEqualTo(360));
      expect(key.left, greaterThanOrEqualTo(0));
      expect(find.text('Forgot'), findsWidgets);
      expect(find.text('Hard'), findsWidgets);
      expect(find.text(LearnCopy.doneAgainHeading), findsOneWidget);
      expect(LearnCopy.doneAgainHeading, 'Marked forgot or hard');
    });
  });

  group('the chapter reader', () {
    testWidgets('pins one Practise this chapter key', (tester) async {
      await pumpScreen(
        tester,
        const LearnSummaryScreen(subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio'),
        brightness: Brightness.dark,
        textScale: 1.3,
        overrides: [
          ...learnOverrides(),
          chapterSummaryProvider(('accountancy', 'Change in Profit Sharing Ratio')).overrideWith(
            (ref) => ChapterSummary.fromJson(
              {
                'subject': 'accountancy',
                'chapter': 'Change in Profit Sharing Ratio',
                'units': [
                  {
                    'id': 'acc-sacrifice',
                    'title': 'Sacrificing and gaining ratios',
                    'objectives': ['Calculate a partner’s sacrifice or gain from old and new shares'],
                    'blocks': [readingBlock()],
                  },
                ],
              },
              subject: 'accountancy',
              chapter: 'Change in Profit Sharing Ratio',
            ),
          ),
        ],
      );
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text(LearnCopy.practiseChapter), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  testWidgets('the run screen shows the pinned key for a hidden answer too', (tester) async {
    await pumpScreen(
      tester,
      const LearnRunScreen(runId: 'run-1'),
      brightness: Brightness.light,
      textScale: 1.3,
      overrides: learnOverrides(runs: {'run-1': RunUiState(load: RunLoad.ready, run: run(cursor: 3, revision: 6))}),
    );
    expect(find.text(LearnCopy.showAnswer), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
