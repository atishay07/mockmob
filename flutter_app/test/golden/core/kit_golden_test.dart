import 'package:flutter/material.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';
import 'night_support.dart';

// The shared kit of packet L (design critic 16 Oct, findings 5 and 15): the StudyWeek in its three
// variants with the key, and the ChipRail at its first view and at a scrolled rest.

List<WeekBubbleDay> _week({int today = 3}) => [
  const WeekBubbleDay(mark: WeekDayMark.done, date: 12),
  const WeekBubbleDay(mark: WeekDayMark.done, date: 13),
  const WeekBubbleDay(mark: WeekDayMark.rest, date: 14),
  WeekBubbleDay(mark: WeekDayMark.done, isToday: today == 3, date: 15),
  const WeekBubbleDay(mark: WeekDayMark.planned, date: 16),
  const WeekBubbleDay(mark: WeekDayMark.open, date: 17),
  const WeekBubbleDay(mark: WeekDayMark.rest, date: 18),
];

Widget _studyWeeks() {
  return SampleColumn(
    gap: 14,
    children: [
      Sample('Compact, with the key (first view and long press)', StudyWeek(days: _week(), legend: StudyWeekLegendMode.always)),
      Sample(
        'Ring, 3 of 4, headline and caption',
        StudyWeek(
          variant: StudyWeekVariant.ring,
          days: _week(),
          done: 3,
          goal: 4,
          headline: '3 of 4 study days',
          caption: 'Rest days still count',
          legend: StudyWeekLegendMode.never,
        ),
      ),
      Sample(
        'Ring, paused',
        StudyWeek(
          variant: StudyWeekVariant.ring,
          days: _week(),
          done: 0,
          goal: 4,
          paused: true,
          headline: 'Paused',
          caption: 'Resume when you are ready',
          legend: StudyWeekLegendMode.never,
        ),
      ),
      Sample('Full, Thursday chosen', StudyWeek(variant: StudyWeekVariant.full, days: _week(), selected: 3, onDay: (_) {}, legend: StudyWeekLegendMode.never)),
    ],
  );
}

const _subjects = [
  'All',
  'Accountancy',
  'Business Studies',
  'Economics, full mock',
  'English',
  'Mathematics',
  'General Aptitude Test',
  'Computer Science',
  'Political Science',
  'History',
];

Widget _rails() {
  Widget rail({int? reveal, List<String> labels = _subjects}) => ChipRail(
    revealIndex: reveal,
    children: [for (var i = 0; i < labels.length; i++) MmChip(label: labels[i], selected: i == (reveal ?? 0), onTap: () {})],
  );
  // Edge to edge, as in a screen: the labels sit in the gutter, the rails bleed to the screen edge.
  Widget row(String label, Widget rail) => Padding(
    padding: const EdgeInsets.only(top: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
          child: Builder(
            builder: (context) => Text(label, style: context.mmType.caption.copyWith(color: context.mmColors.ink3)),
          ),
        ),
        rail,
      ],
    ),
  );
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      row('First view: the next chip peeks', rail()),
      row('Scrolled to the middle: both edges fade', rail(reveal: 5)),
      row('Scrolled to the end', rail(reveal: 9)),
      row('Short rail: fits, no fade', rail(labels: const ['10', '20', '30', '45'])),
      row('Another first view', rail(labels: const ['All', 'Commerce', 'Humanities', 'Sciences', 'Languages', 'Domain subjects', 'General test'])),
    ],
  );
}

void main() {
  nightGolden('study_week', _studyWeeks);
  nightGolden('chip_rail', _rails);
}
