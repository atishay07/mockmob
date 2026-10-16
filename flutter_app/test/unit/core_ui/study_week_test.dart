import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

Widget _app(Widget child, {bool reduced = false, double textScale = 1, Brightness brightness = Brightness.dark}) {
  return ProviderScope(
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(brightness),
      builder: (context, app) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reduced, textScaler: TextScaler.linear(textScale)),
        child: app!,
      ),
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Align(alignment: Alignment.topCenter, child: child),
        ),
      ),
    ),
  );
}

List<WeekBubbleDay> _days({int? today = 3}) => [
  const WeekBubbleDay(mark: WeekDayMark.done, date: 12),
  const WeekBubbleDay(mark: WeekDayMark.done, date: 13),
  const WeekBubbleDay(mark: WeekDayMark.rest, date: 14),
  WeekBubbleDay(mark: WeekDayMark.done, isToday: today == 3, date: 15),
  const WeekBubbleDay(mark: WeekDayMark.planned, date: 16),
  const WeekBubbleDay(mark: WeekDayMark.open, date: 17),
  const WeekBubbleDay(mark: WeekDayMark.rest, date: 18),
];

void main() {
  group('StudyWeek key', () {
    testWidgets('shows on the first view, folds after four seconds, and a long press brings it back', (tester) async {
      final memory = StudyWeekLegendMemory();
      await tester.pumpWidget(_app(StudyWeek(days: _days(), legendMemory: memory)));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Counted'), findsOneWidget);
      expect(find.text('Planned'), findsOneWidget);
      expect(find.text('Rest'), findsOneWidget);
      expect(find.text('Not counted'), findsOneWidget);
      expect(memory.seen, isTrue);

      await tester.pump(StudyWeek.legendHold);
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Counted'), findsNothing, reason: 'the key folds away on its own');

      await tester.longPress(find.byType(StudyWeek));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Counted'), findsOneWidget);
      await tester.pump(StudyWeek.legendHold);
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Counted'), findsNothing);
    });

    testWidgets('a second week in the same session does not show the key by itself', (tester) async {
      final memory = StudyWeekLegendMemory();
      await tester.pumpWidget(
        _app(
          Column(
            children: [
              StudyWeek(days: _days(), legendMemory: memory),
              StudyWeek(days: _days(), legendMemory: memory),
            ],
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Counted'), findsOneWidget, reason: 'only the first week explains itself');
      await tester.pump(StudyWeek.legendHold + const Duration(milliseconds: 400));
    });

    testWidgets('shows only the marks the week uses', (tester) async {
      await tester.pumpWidget(
        _app(
          StudyWeek(
            days: const [
              WeekBubbleDay(mark: WeekDayMark.done),
              WeekBubbleDay(),
              WeekBubbleDay(),
              WeekBubbleDay(),
              WeekBubbleDay(),
              WeekBubbleDay(),
              WeekBubbleDay(),
            ],
            legend: StudyWeekLegendMode.always,
          ),
        ),
      );
      expect(find.text('Counted'), findsOneWidget);
      expect(find.text('Not counted'), findsOneWidget);
      expect(find.text('Planned'), findsNothing);
      expect(find.text('Rest'), findsNothing);
    });

    testWidgets('always keeps it; never has none and ignores a long press', (tester) async {
      await tester.pumpWidget(_app(StudyWeek(days: _days(), legend: StudyWeekLegendMode.always)));
      await tester.pump(StudyWeek.legendHold * 2);
      expect(find.text('Counted'), findsOneWidget);

      await tester.pumpWidget(_app(StudyWeek(days: _days(), legend: StudyWeekLegendMode.never)));
      await tester.longPress(find.byType(StudyWeek));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Counted'), findsNothing);
    });

    testWidgets('screen readers read the week in words and can ask for the key', (tester) async {
      final handle = tester.ensureSemantics();
      final memory = StudyWeekLegendMemory()..markSeen();
      await tester.pumpWidget(_app(StudyWeek(days: _days(), legendMemory: memory)));
      expect(
        find.bySemanticsLabel(RegExp('Studied Monday, Tuesday and Thursday.*Planned Friday.*Rest Wednesday and Sunday.*Today is Thursday')),
        findsOneWidget,
      );
      final node = tester.getSemantics(find.bySemanticsLabel(RegExp('^Studied')));
      expect(node.getSemanticsData().customSemanticsActionIds, isNotEmpty);
      handle.dispose();
    });
  });

  group('StudyWeek variants', () {
    testWidgets('compact: seven 12 sp weekday letters and seven bubbles, one height at 1x', (tester) async {
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(days: _days(), legend: StudyWeekLegendMode.never),
          ),
        ),
      );
      expect(find.text('M'), findsOneWidget);
      expect(find.text('T'), findsNWidgets(2));
      expect(find.text('W'), findsOneWidget);
      expect(find.text('F'), findsOneWidget);
      expect(find.text('S'), findsNWidgets(2));
      final letter = tester.widget<Text>(find.text('M'));
      expect(letter.style!.fontSize, 12, reason: 'a floor of 12 sp for text a student reads');
      expect(find.byType(CustomPaint), findsAtLeastNWidgets(7));
    });

    testWidgets('ring: the count, the headline and the caption, with one hairline and the week beneath', (tester) async {
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(
              variant: StudyWeekVariant.ring,
              days: _days(),
              done: 3,
              goal: 4,
              headline: '3 of 4 study days',
              caption: 'Thursday is today',
              legend: StudyWeekLegendMode.never,
            ),
          ),
        ),
      );
      expect(find.text('3'), findsOneWidget);
      expect(find.text('3 of 4 study days'), findsOneWidget);
      expect(find.text('Thursday is today'), findsOneWidget);
      expect(find.text('M'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('ring: goal and count default from the days', (tester) async {
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(variant: StudyWeekVariant.ring, days: _days(), legend: StudyWeekLegendMode.never),
          ),
        ),
      );
      // Three counted days; goal is counted plus planned (four).
      expect(find.text('3'), findsOneWidget);
    });

    testWidgets('ring: a paused week draws no count and a one-segment goal does not throw', (tester) async {
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(variant: StudyWeekVariant.ring, days: _days(), done: 2, goal: 1, paused: true, legend: StudyWeekLegendMode.never),
          ),
        ),
      );
      expect(find.text('2'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('full: dates under the bubbles, a chosen day on a well, each column a 48 dp button that reports its index', (tester) async {
      final taps = <int>[];
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(variant: StudyWeekVariant.full, days: _days(), selected: 3, onDay: taps.add, legend: StudyWeekLegendMode.never),
          ),
        ),
      );
      expect(find.text('12'), findsOneWidget);
      expect(find.text('18'), findsOneWidget);
      final column = tester.getSize(find.ancestor(of: find.text('15'), matching: find.byType(ConstrainedBox)).first);
      expect(column.height, greaterThanOrEqualTo(48));
      await tester.tap(find.text('F'));
      await tester.pump();
      await tester.tap(find.text('12'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(taps, [4, 0]);
    });

    testWidgets('full: each day is its own screen-reader stop', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(variant: StudyWeekVariant.full, days: _days(), onDay: (_) {}, legend: StudyWeekLegendMode.never),
          ),
        ),
      );
      expect(find.bySemanticsLabel('Thursday, today, study day, counted'), findsOneWidget);
      expect(find.bySemanticsLabel('Friday, planned study day'), findsOneWidget);
      expect(find.bySemanticsLabel('Wednesday, rest day'), findsOneWidget);
      expect(find.bySemanticsLabel('Saturday, not counted'), findsOneWidget);
      handle.dispose();
    });

    for (final variant in StudyWeekVariant.values) {
      testWidgets('${variant.name}: no overflow at 2x text on a 320 dp column, Night and Day', (tester) async {
        for (final b in Brightness.values) {
          await tester.pumpWidget(
            _app(
              SizedBox(
                width: 288,
                child: StudyWeek(
                  variant: variant,
                  days: _days(),
                  headline: '3 of 4 study days',
                  caption: 'Thursday is today',
                  legend: StudyWeekLegendMode.always,
                ),
              ),
              textScale: 2,
              brightness: b,
            ),
          );
          await tester.pump(const Duration(milliseconds: 400));
          expect(tester.takeException(), isNull, reason: '${variant.name} ${b.name}');
        }
      });
    }

    testWidgets('animateIn inks the counted days one after another and settles', (tester) async {
      final memory = StudyWeekLegendMemory()..markSeen();
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(days: _days(), animateIn: true, legendMemory: memory),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isTrue);
      // 120 ms of lead, 260 ms each, 70 ms apart: three counted days are inked inside 520 ms.
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('under reduced motion the week is drawn settled at once', (tester) async {
      final memory = StudyWeekLegendMemory()..markSeen();
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 352,
            child: StudyWeek(days: _days(), animateIn: true, legendMemory: memory),
          ),
          reduced: true,
        ),
      );
      expect(tester.hasRunningAnimations, isFalse, reason: 'nothing runs under reduced motion');
    });

    testWidgets('the older WeekBubbles row still draws, and draws a planned day as open', (tester) async {
      await tester.pumpWidget(_app(WeekBubbles(days: _days())));
      expect(tester.takeException(), isNull);
      expect(find.byType(WeekBubbles), findsOneWidget);
    });
  });
}
