import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

List<WeekStripDay> _week(List<int> study, {int? today}) => [
      for (var i = 0; i < 7; i++) WeekStripDay(studyDay: study.contains(i), isToday: i == today),
    ];

List<QuestionCell> _sheet() {
  const pattern = [
    QuestionCell.right,
    QuestionCell.right,
    QuestionCell.wrong,
    QuestionCell.blank,
    QuestionCell.right,
    QuestionCell.changed,
    QuestionCell.repaired,
    QuestionCell.wrong,
    QuestionCell.right,
    QuestionCell.blank,
  ];
  return [for (var i = 0; i < 50; i++) pattern[(i * 3 + i ~/ 7) % pattern.length]];
}

Widget _weeks() {
  return SampleColumn(
    gap: 12,
    children: [
      Sample('Empty week', WeekStrip(days: _week([], today: 2), label: '0 of 4 study days')),
      Sample('Partial week', WeekStrip(days: _week([0, 2], today: 3), label: '2 of 4 study days')),
      Sample(
        'Goal met, today is a study day',
        WeekStrip(days: _week([0, 1, 3, 4], today: 4), label: '4 of 4 study days. This week is done.'),
      ),
      Sample('Extra days', WeekStrip(days: _week([0, 1, 2, 3, 5], today: 6), label: '5 days this week')),
    ],
  );
}

Widget _questions() {
  return Builder(
    builder: (context) {
      final type = context.mmType;
      return SampleColumn(
        children: [
          Sample(
            'All cell states, 5 columns',
            Align(alignment: Alignment.centerLeft, child: QuestionStrip(cells: _sheet(), columns: 5)),
          ),
          Sample(
            'Same sheet, 10 columns',
            Align(alignment: Alignment.centerLeft, child: QuestionStrip(cells: _sheet())),
          ),
          Sample(
            'Sealed sheet (dimmed, uncoloured)',
            Align(alignment: Alignment.centerLeft, child: QuestionStrip(cells: _sheet(), dimmed: true)),
          ),
          Sample(
            'Each cell state',
            Wrap(
              spacing: 16,
              runSpacing: 4,
              children: [
                for (final entry in {
                  'right': QuestionCell.right,
                  'wrong': QuestionCell.wrong,
                  'blank': QuestionCell.blank,
                  'changed': QuestionCell.changed,
                  'repaired': QuestionCell.repaired,
                }.entries)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      QuestionStrip(cells: [entry.value], columns: 1, cellSize: 20),
                      const SizedBox(width: 6),
                      Text(entry.key, style: type.small),
                    ],
                  ),
              ],
            ),
          ),
        ],
      );
    },
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in Brightness.values) {
    testWidgets('week strip, ${brightness.name}', (tester) async {
      await pumpMockmob(tester, _weeks(), brightness: brightness);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/week_strip_${brightness.name}.png'));
    });

    testWidgets('question strip, ${brightness.name}', (tester) async {
      await pumpMockmob(tester, _questions(), brightness: brightness);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/question_strip_${brightness.name}.png'));
    });
  }
}
