import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show BubbleState;
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/recap/first_fix_card.dart';
import 'package:mockmob/features/result/recap/reveal_tally.dart';
import 'package:mockmob/features/result/recap/sheet_share.dart';
import 'package:mockmob/features/result/sheet/read_line.dart';
import 'package:mockmob/features/result/widgets/marks_flow.dart';
import 'package:mockmob/features/result/widgets/breakdown_section.dart';
import 'package:mockmob/core/domain/domain.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

void main() {
  setUpAll(loadAppFonts);

  group('the reader (card 1)', () {
    const rows = GridRows(count: 5, columns: 10, questions: 50, bubble: 20, rowGap: 10, numberSpace: 16);

    test('ink follows the line row by row and ends on the whole paper', () {
      var last = -1.0;
      for (var s = 0.0; s <= 1.0; s += 0.01) {
        final v = rows.inkAt(rows.lineY(s));
        expect(v, greaterThanOrEqualTo(last), reason: 'never runs backwards');
        last = v;
      }
      expect(rows.inkAt(rows.lineY(0)), 0);
      expect(rows.inkAt(rows.lineY(1)), 1);
      // While the line is above row 2's bubbles, rows 0 and 1 are done and row 2 has not begun.
      final y = rows.bandTop(2) - 1;
      expect(rows.inkAt(y), closeTo(20 / 50, 1e-9));
    });

    test('a short last row still fills', () {
      const short = GridRows(count: 2, columns: 10, questions: 13, bubble: 20, rowGap: 10, numberSpace: 16);
      expect(short.inRow(1), 3);
      expect(short.inkAt(short.lineY(1)), 1);
    });

    test('the tally counts only what has inked, and ends on the real counts', () {
      final cells = mock7().cells;
      final none = RevealTally.countsUpTo(cells, 0);
      expect(none[BubbleState.filled], 0);
      expect(none[BubbleState.wrong], 0);
      final all = RevealTally.countsUpTo(cells, cells.length);
      expect(all[BubbleState.filled], 26);
      expect(all[BubbleState.wrong], 15);
      expect(all[BubbleState.blank], 9);
    });
  });

  group('where the marks went, as a flow (card 2)', () {
    testWidgets('every part keeps its row, with its exact value, even at zero', (tester) async {
      final b = markBreakdown(10, 0, 0);
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: BreakdownSection(breakdown: b, flow: true)),
        brightness: Brightness.dark,
        size: const Size(384, 853),
        disableAnimations: true,
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.byType(MarksFlow), findsOneWidget);
      expect(find.text('50 marks'), findsOneWidget);
      expect(find.text('0 marks'), findsNWidgets(3));
      expect(find.text('All 50 marks on the paper'), findsOneWidget);
    });

    testWidgets('each number counts up with its ribbon and lands on its exact value (motion-08)', (tester) async {
      final b = mock7().breakdown;
      final grow = AnimationController(vsync: const TestVSync(), duration: MarksFlow.duration);
      addTearDown(grow.dispose);
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: MarksFlow(breakdown: b, rows: breakdownLabels(b), grow: grow)),
        brightness: Brightness.dark,
        size: const Size(384, 853),
      );
      // Part way: the scored row's words have arrived but its number is still counting, while
      // TalkBack already hears the final value.
      grow.value = 0.38;
      await tester.pump();
      expect(MarksFlow.countAt(0.38, 0), inExclusiveRange(0, 1));
      expect(find.text('115 marks'), findsNothing);
      expect(find.text('115'), findsOneWidget, reason: 'the final number holds the space while the count runs');
      expect(find.bySemanticsLabel(RegExp('115 marks')), findsOneWidget);
      // The count lands exactly when the ribbon does.
      for (var i = 0; i < 4; i++) {
        final end = 0.60 + i * 0.09;
        expect(MarksFlow.countAt(end, i), closeTo(1, 1e-6));
        expect(MarksFlow.ribbonAt(end, i), closeTo(1, 1e-6));
      }
      grow.value = 1;
      await tester.pump();
      expect(find.text('115 marks'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('rows never overlap at 1.3x text on a 360 dp phone', (tester) async {
      final b = mock7().breakdown;
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: MarksFlow(breakdown: b, rows: breakdownLabels(b))),
        brightness: Brightness.dark,
        size: const Size(360, 720),
        textScale: 1.3,
        disableAnimations: true,
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
      final labels = ['Scored', 'Taken off by wrong answers', 'Not earned on wrong answers', 'Not earned on blank answers'];
      for (var i = 1; i < labels.length; i++) {
        final above = tester.getRect(find.text(labels[i - 1])).bottom;
        final below = tester.getRect(find.text(labels[i])).top;
        expect(below, greaterThan(above), reason: '${labels[i]} must sit below ${labels[i - 1]}');
      }
    });
  });

  group('the first thing to fix (card 3)', () {
    testWidgets('the cost figure is the chapter\'s observed marks against everything missed', (tester) async {
      final m = mock7();
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        FirstFixCard(model: m, onNext: () {}, onBack: () {}),
        brightness: Brightness.dark,
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: resultOverrides(attemptId: m.attemptId, data: RecapData(model: m)),
      );
      await tester.pump(const Duration(milliseconds: 300));
      // Admission of a partner: 4 wrong and 2 blank, 4 x 6 + 2 x 5 = 34 of the 135 missed.
      expect(find.bySemanticsLabel('34 of the 135 marks you missed were in this chapter.'), findsOneWidget);
      handle.dispose();
    });
  });

  group('your sheet, to keep (card 4)', () {
    test('the share card shows answered or not, never right or wrong', () {
      final cells = mock7().cells;
      final shared = SheetShareCard.answeredCells(cells);
      expect(shared.contains(BubbleState.wrong), isFalse);
      expect(shared.where((c) => c == BubbleState.filled).length, 41);
      expect(SheetShareCard.answered(cells), 41);
    });

    testWidgets('the card says the mock, the answered count and the day, and no marks', (tester) async {
      final m = mock7();
      await pumpMockmob(
        tester,
        Center(child: SheetShareCard(model: m)),
        brightness: Brightness.light,
        size: const Size(400, 600),
        disableAnimations: true,
      );
      await tester.pump();
      expect(find.text('Mock 7'), findsOneWidget);
      expect(find.text('41 of 50 answered'), findsOneWidget);
      expect(find.textContaining('115'), findsNothing);
      expect(find.text('Accountancy'), findsNothing, reason: 'the subject is off until the student adds it');
    });
  });
}
