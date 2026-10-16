// AP3-07 A21: the submit page's sheet legend has four entries, each with its glyph and count, and
// the four counts add up to the total.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/runner/logic/sheet_cells.dart';
import 'package:mockmob/features/runner/widgets/submit_sheet_card.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';

FakeRunnerSession _session() => FakeRunnerSession(
  questions: accountancyQuestions(50),
  currentIndex: 49,
  // 46 answered, one of them marked; 4 without an answer, one of them marked.
  answers: {for (var i = 1; i <= 46; i++) 'q$i': 0},
  marked: {'q1', 'q47'},
  visited: {for (var i = 1; i <= 50; i++) 'q$i'},
);

void main() {
  setUpAll(loadAppFonts);

  test('the four legend counts are exclusive and add up to the total', () {
    final cells = sheetCellsOf(_session());
    final n = sheetLegendCountsOf(cells);
    expect(n.answered, 45);
    expect(n.notAnswered, 3);
    expect(n.markedAnswered, 1);
    expect(n.markedNotAnswered, 1);
    expect(n.answered + n.notAnswered + n.markedAnswered + n.markedNotAnswered, cells.length);
  });

  for (final scale in [1.0, 1.3]) {
    testWidgets('the legend shows four 12 sp entries with their counts, in at most two lines at 360 dp (text $scale)', (tester) async {
      tester.view.physicalSize = const Size(360, 800) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)), child: child!),
            home: Scaffold(
              body: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SubmitSheetCard(session: _session(), animateInk: false),
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));
      final labels = ['Answered 45', 'Not answered 3', 'Marked, answered 1', 'Marked, not answered 1'];
      final tops = <double>{};
      for (final l in labels) {
        expect(find.text(l), findsOneWidget, reason: l);
        final t = tester.widget<Text>(find.text(l));
        expect(t.style!.fontSize, 12 * 1.0, reason: 'the entry is 12 sp before scaling');
        tops.add(tester.getRect(find.text(l)).top.roundToDouble());
      }
      if (scale == 1.0) expect(tops.length, lessThanOrEqualTo(2), reason: 'two lines at most at 360 dp');
      await tester.pump(const Duration(seconds: 2));
    });
  }
}
