import 'package:flutter/material.dart';
import 'package:mockmob/core/widgets/lab/lab_sections.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';
import 'night_support.dart';

List<WeekStripDay> _week(List<int> study, {int? today, List<int> rest = const []}) => [
      for (var i = 0; i < 7; i++) WeekStripDay(studyDay: study.contains(i), isToday: i == today, rest: rest.contains(i)),
    ];

List<QuestionCell> _cells() {
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
  return [for (var i = 0; i < 20; i++) pattern[(i * 3 + i ~/ 7) % pattern.length]];
}

Widget _strips() {
  return SampleColumn(
    gap: 14,
    children: [
      Sample(
        'Week strip, today with a study day, two rest days',
        WeekStrip(days: _week([0, 1, 3], today: 3, rest: [2, 6]), label: '3 of 4 study days'),
      ),
      Sample('Week strip, empty week', WeekStrip(days: _week([], today: 0), label: '0 of 4 study days')),
      Sample('Question strip, 20 in rows of 10', Align(alignment: Alignment.centerLeft, child: QuestionStrip(cells: _cells()))),
      Sample('Question strip, sealed', Align(alignment: Alignment.centerLeft, child: QuestionStrip(cells: _cells(), dimmed: true))),
      Sample(
        'Question strip, large cells',
        Align(
          alignment: Alignment.centerLeft,
          child: QuestionStrip(cells: _cells().sublist(0, 7), columns: 7, cellSize: 32, gap: 8),
        ),
      ),
    ],
  );
}

void main() {
  nightGolden(
    'bubbles',
    () => const SingleChildScrollView(physics: NeverScrollableScrollPhysics(), padding: EdgeInsets.all(16), child: LabBubbles()),
  );
  nightGolden('strips', _strips);
}
