// AP2-03: the marks bar fills with the ink, so the practice finish has no empty band while the sheet
// inks. Every right bubble adds its marks to the volt segment, every wrong one what it cost, every
// blank what was left; the bar is full when the figure stamps.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show QuestionCell;
import 'package:mockmob/features/practice/model/finish_reaction.dart';
import 'package:mockmob/features/practice/widgets/finish_stage.dart';
import 'package:mockmob/features/practice/widgets/marks_bar.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;

import '../../helpers/fonts.dart';
import 'support/harness.dart';

const _cells = [
  QuestionCell.right,
  QuestionCell.right,
  QuestionCell.wrong,
  QuestionCell.blank,
  QuestionCell.right,
  QuestionCell.wrong,
  QuestionCell.right,
  QuestionCell.right,
  QuestionCell.blank,
  QuestionCell.right,
];

Widget _stage({bool fresh = true}) => ProviderScope(
  overrides: [celebrationModeProvider.overrideWithValue(CelebrationMode.full), ...practiceOverrides()],
  child: MaterialApp(
    theme: buildTheme(Brightness.dark),
    home: Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: FinishStage(
          marks: const FinishMarks(correct: 6, wrong: 2, blank: 2, total: 10),
          cells: _cells,
          tone: FinishTone.mixed,
          recordedAt: DateTime(2026, 10, 14, 21, 30),
          fresh: fresh,
          subject: 'Accountancy',
        ),
      ),
    ),
  ),
);

double _filled(MarksFill f, FinishMarks m) => (f.right * m.scored + f.wrong * m.lostToWrong + f.blank * m.leftOnBlanks) / m.max;

void main() {
  setUpAll(loadAppFonts);

  const marks = FinishMarks(correct: 6, wrong: 2, blank: 2, total: 10);

  test('before any bubble has inked nothing is filled; after the last, everything is', () {
    final none = MarksFill.after(_cells, 0);
    expect((none.right, none.wrong, none.blank), (0.0, 0.0, 0.0));
    final all = MarksFill.after(_cells, _cells.length);
    expect((all.right, all.wrong, all.blank), (1.0, 1.0, 1.0));
    expect(_filled(all, marks), 1.0);
  });

  test('each bubble fills its own share of its own segment (right, wrong or blank)', () {
    // After the first three bubbles (right, right, wrong): 10 scored and 6 lost.
    final f = MarksFill.after(_cells, 3);
    expect(f.right, closeTo(2 / 6, 1e-9));
    expect(f.wrong, closeTo(1 / 2, 1e-9));
    expect(f.blank, 0);
    // Marks drawn: 2 right bubbles of 6 fill a third of the volt 28 (it is net of the 1 each wrong answer takes), 1 wrong of 2 fills half the 12.
    expect(_filled(f, marks), closeTo((2 / 6 * 28 + 1 / 2 * 12) / 50, 1e-9));
  });

  test('the fill never goes backwards as the sheet inks', () {
    var last = -1.0;
    for (var n = 0; n <= _cells.length; n++) {
      final now = _filled(MarksFill.after(_cells, n), marks);
      expect(now, greaterThanOrEqualTo(last));
      last = now;
    }
  });

  testWidgets('while the sheet inks the bar fills with it, with no empty bar before the stamp, and it is full once the last bubble has inked', (tester) async {
    await tester.pumpWidget(_stage());
    await tester.pump();
    final seen = <double>[];
    for (var t = 0; t <= 1000; t += 50) {
      final bar = tester.widget<MarksBar>(find.byType(MarksBar));
      seen.add(bar.fill == null ? 1 : _filled(bar.fill!, marks));
      await tester.pump(const Duration(milliseconds: 50));
    }
    // Empty in the 200 ms lead, then rising with the ink, never falling.
    expect(seen.first, 0);
    for (var i = 1; i < seen.length; i++) {
      expect(seen[i], greaterThanOrEqualTo(seen[i - 1]));
    }
    expect(seen.last, 1.0);
    // A mid-ink frame is part filled (the plan's 400 and 900 ms goldens show a partly filled bar).
    expect(seen[8], inExclusiveRange(0.0, 1.0));
    await tester.pump(const Duration(seconds: 4));
  });

  testWidgets('a result opened again shows the bar full at once', (tester) async {
    await tester.pumpWidget(_stage(fresh: false));
    await tester.pump();
    final bar = tester.widget<MarksBar>(find.byType(MarksBar));
    expect(_filled(bar.fill!, marks), 1.0);
    await tester.pump(const Duration(seconds: 4));
  });
}
