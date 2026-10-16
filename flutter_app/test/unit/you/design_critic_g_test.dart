// Design critic packet G (16 Oct): the You hub's week field rides the shared StudyWeek (finding 5),
// so the ring, the seven days and the key are the same ones Today, Rhythm and the week sheet draw.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show StudyWeek, StudyWeekVariant, WeekBubbleDay, WeekBubbles, WeekDayMark;
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/rhythm/widgets/week_dial.dart' show WeekDial;
import 'package:mockmob/features/you/hub/sheet_fields.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

List<WeekBubbleDay> _week() => [
  for (var i = 0; i < 7; i++)
    WeekBubbleDay(mark: i < 2 ? WeekDayMark.done : (i == 6 ? WeekDayMark.rest : WeekDayMark.planned), isToday: i == 2),
];

Future<void> _pump(WidgetTester tester, SheetWeek week) => pumpMockmob(
  tester,
  Padding(padding: const EdgeInsets.symmetric(vertical: 16), child: WeekField(week: week, onOpen: () {})),
  size: const Size(384, 400),
  disableAnimations: true,
);

void main() {
  setUpAll(loadAppFonts);

  group('5: the You hub week field is the shared study week', () {
    testWidgets('with a goal the ring says what it counts, over the shared seven days', (tester) async {
      await _pump(tester, SheetWeek.ready(days: _week(), count: '2 of 4 study days', description: 'This week', done: 2, goal: 4, note: 'Weeks in rhythm: 3'));
      final dial = tester.widget<WeekDial>(find.byType(WeekDial));
      expect(dial.done, 2);
      expect(dial.goal, 4);
      expect(find.text('of 4 study days'), findsOneWidget, reason: 'L06: the words name the goal inside the ring');
      expect(tester.widget<StudyWeek>(find.byType(StudyWeek)).variant, StudyWeekVariant.compact);
      expect(find.text(YouCopy.weekToGo(2)), findsOneWidget);
      expect(find.text('Weeks in rhythm: 3'), findsOneWidget);
      expect(find.byType(WeekBubbles), findsNothing, reason: 'the older seven-bubble row is not drawn on You');
      expect(tester.takeException(), isNull);
    });

    testWidgets('without a goal it is the compact variant and the line sits under it', (tester) async {
      await _pump(tester, SheetWeek.ready(days: _week(), count: '', description: 'This week', note: 'Weeks in rhythm: 3'));
      expect(tester.widget<StudyWeek>(find.byType(StudyWeek)).variant, StudyWeekVariant.compact);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a week that is not seven days draws no columns rather than asserting', (tester) async {
      await _pump(tester, const SheetWeek.ready(days: [], count: '', description: 'This week', done: 1, goal: 3));
      expect(find.byType(StudyWeek), findsNothing);
      expect(find.byType(WeekBubbles), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
