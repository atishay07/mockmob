import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/runner/logic/sheet_cells.dart';
import 'package:mockmob/features/runner/widgets/timing_track.dart';

List<SheetCell> _cells(int n, int current, {Set<int> answered = const {}}) => [
  for (var i = 0; i < n; i++)
    SheetCell(number: i + 1, answered: answered.contains(i), visited: i <= current, marked: false, unsynced: false, current: i == current),
];

Future<void> _pump(WidgetTester tester, List<SheetCell> cells, double width, {ValueChanged<int>? onJump, Brightness b = Brightness.dark}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: buildTheme(b),
      home: Scaffold(
        body: Align(
          alignment: Alignment.topLeft,
          child: SizedBox(width: width, child: TimingTrack(cells: cells, onJump: onJump)),
        ),
      ),
    ),
  );
}

RenderBox _paintBox(WidgetTester tester) => tester.renderObject<RenderBox>(find.descendant(of: find.byType(TimingTrack), matching: find.byType(CustomPaint)).first);

void main() {
  group('geometry from the real width', () {
    test('a 20-question paper fits 328 and 288 dp with every cell as a bubble', () {
      for (final w in [328.0, 288.0, 360.0]) {
        final g = TrackGeometry(count: 20, width: w);
        expect(g.marks, isFalse, reason: 'width $w');
        expect(g.pitch, lessThanOrEqualTo(18));
        expect(g.pitch, greaterThanOrEqualTo(TrackGeometry.marksBelow));
        for (var i = 0; i < 20; i++) {
          final c = g.centerX(i);
          expect(c - 5, greaterThanOrEqualTo(0), reason: 'cell $i at $w');
          expect(c + 5, lessThanOrEqualTo(w + 0.001), reason: 'cell ${i + 1} at $w must not fall off the edge');
          if (i > 0) expect(c - g.centerX(i - 1), closeTo(g.pitch, 0.001));
        }
      }
    });

    test('a short practice keeps the airy 18 dp pitch, and a mock switches to timing marks', () {
      expect(TrackGeometry(count: 5, width: 328).pitch, 18);
      expect(TrackGeometry(count: 10, width: 328).pitch, 18);
      expect(TrackGeometry(count: 15, width: 328).marks, isFalse);
      expect(TrackGeometry(count: 50, width: 328).marks, isTrue);
      // The switch is by pitch, not by a fixed question count.
      expect(TrackGeometry(count: 20, width: 200).marks, isTrue);
      expect(TrackGeometry(count: 27, width: 328).marks, isFalse);
      expect(TrackGeometry(count: 29, width: 328).marks, isTrue);
    });

    test('slots tile the strip without overlap and every one is reachable', () {
      for (final n in [5, 20, 50]) {
        final g = TrackGeometry(count: n, width: 328);
        var edge = -1.0;
        for (var i = 0; i < n; i++) {
          final (a, b) = g.slot(i);
          expect(b, greaterThan(a));
          expect(a, greaterThanOrEqualTo(edge - 0.001), reason: 'cell $i overlaps its neighbour');
          edge = b;
        }
      }
    });
  });

  group('the strip draws the current cell for every index', () {
    for (final width in [328.0, 288.0]) {
      testWidgets('20 questions at ${width.toInt()} dp', (tester) async {
        for (var current = 0; current < 20; current++) {
          await _pump(tester, _cells(20, current, answered: {for (var i = 0; i < current; i++) i}), width);
          final g = TrackGeometry(count: 20, width: width);
          final y = TimingTrack.tappableHeight / 2;
          // Every cell has a ring; the current one is the thicker paper-white ring.
          final pattern = paints;
          for (var i = 0; i < 20; i++) {
            if (i < current) pattern.circle(x: g.centerX(i), y: y, style: PaintingStyle.fill);
            pattern.circle(x: g.centerX(i), y: y, style: PaintingStyle.stroke, strokeWidth: i == current ? 1.5 : 1.0);
          }
          expect(_paintBox(tester), pattern, reason: 'all 20 cells drawn with Q${current + 1} current');
        }
      });
    }

    testWidgets('50 questions draw 50 timing marks with a taller current mark', (tester) async {
      await _pump(tester, _cells(50, 49), 328);
      final g = TrackGeometry(count: 50, width: 328);
      expect(g.marks, isTrue);
      final box = _paintBox(tester);
      var rects = 0;
      for (var i = 0; i < 50; i++) {
        final x = g.centerX(i);
        expect(x, inInclusiveRange(0, 328));
        rects++;
      }
      expect(rects, 50);
      expect(box, paints..rrect()..rrect());
      expect(tester.getSize(find.byType(TimingTrack)).height, TimingTrack.marksHeight);
    });
  });

  group('a labelled, tappable strip', () {
    testWidgets('reads "Question 3 of 20, answered" and jumps on a tap with a 44 dp box', (tester) async {
      final handle = tester.ensureSemantics();
      final jumps = <int>[];
      await _pump(tester, _cells(20, 2, answered: {0, 1, 2}), 328, onJump: jumps.add);
      expect(find.bySemanticsLabel('Question 3 of 20, answered'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('^Question 8, not visited')), findsOneWidget);

      final cell = find.byKey(const ValueKey('track-cell-7'));
      expect(tester.getSize(cell).height, 44);
      await tester.tap(cell);
      expect(jumps, [7]);
      // The current cell is not a jump.
      await tester.tap(find.byKey(const ValueKey('track-cell-2')));
      expect(jumps, [7]);
      handle.dispose();
    });

    testWidgets('a question that is not answered says so', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, _cells(10, 4, answered: {0}), 328);
      expect(find.bySemanticsLabel('Question 5 of 10, not answered'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('without a jump handler it is a plain labelled indicator', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, _cells(10, 1), 328);
      expect(find.byKey(const ValueKey('track-cell-3')), findsNothing);
      expect(find.bySemanticsLabel('Question 2 of 10, not answered'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('on a long paper timing marks are too fine to tap, but TalkBack gets the cells around the current one', (tester) async {
      final handle = tester.ensureSemantics();
      final jumps = <int>[];
      await _pump(tester, _cells(50, 24), 328, onJump: jumps.add);
      expect(find.bySemanticsLabel('Question 25 of 50, not answered'), findsOneWidget);
      for (var i = 21; i <= 27; i++) {
        expect(find.byKey(ValueKey('track-cell-$i')), findsOneWidget, reason: 'cell $i is in the window');
      }
      expect(find.byKey(const ValueKey('track-cell-3')), findsNothing);
      expect(find.byKey(const ValueKey('track-cell-40')), findsNothing);
      // A finger on the marks does nothing; the Questions key holds the whole sheet.
      await tester.tapAt(tester.getTopLeft(find.byType(TimingTrack)) + const Offset(100, 9));
      expect(jumps, isEmpty);
      handle.dispose();
    });
  });
}
