import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/widgets/edge_fade.dart';

const _labels = [
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

Widget _app(Widget child, {bool reduced = false}) {
  return ProviderScope(
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.dark),
      builder: (context, app) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
        child: app!,
      ),
      home: Scaffold(
        body: Align(alignment: Alignment.topCenter, child: child),
      ),
    ),
  );
}

/// Chips as the rail lays them out: [start] in, [gap] between.
List<ChipSpan> _spans(List<double> widths, {double start = 16, double gap = 8}) {
  final out = <ChipSpan>[];
  var x = start;
  for (final w in widths) {
    out.add(ChipSpan(x, x + w));
    x += w + gap;
  }
  return out;
}

double _maxExtent(List<ChipSpan> chips, double viewport, {double end = 16}) => math.max(0, chips.last.right + end - viewport);

void main() {
  group('ChipRailGeometry', () {
    test('the right fade stays 24 dp for a clean peek and widens over a cut label', () {
      expect(ChipRailGeometry.peekFadeExtent(null), 24);
      expect(ChipRailGeometry.peekFadeExtent(30), 24);
      expect(ChipRailGeometry.peekFadeExtent(48), 24);
      expect(ChipRailGeometry.peekFadeExtent(64), 64);
      expect(ChipRailGeometry.peekFadeExtent(140), ChipRailGeometry.peekFadeMax);
    });

    test('a rail that fits has one rest and no peek to make', () {
      final chips = _spans([80, 90, 100]);
      expect(ChipRailGeometry.restStops(chips: chips, viewport: 384, maxExtent: 0, startInset: 16), [0]);
    });

    test('the peek is the cap and bubble of the next chip, never its letters', () {
      // 384 wide: chip 3 begins at 16+96+8+120+8+88+8 = 344, so 40 dp of it would show at rest.
      final chips = _spans([96, 120, 88, 140, 100, 100, 100]);
      final max = _maxExtent(chips, 384);
      final depth = ChipRailGeometry.peekDepth(chips, 0, 384)!;
      expect(depth, 40, reason: 'the natural first view cuts chip 3 after its bubble');
      final stops = ChipRailGeometry.restStops(chips: chips, viewport: 384, maxExtent: max, startInset: 16);
      expect(stops.first, lessThanOrEqualTo(12), reason: 'the first rest moves at most the first chip\'s cap');
      expect(ChipRailGeometry.isClean(chips, stops.first, 384, max), isTrue);
    });

    test('every rest is clean or the end, over many rails', () {
      final random = math.Random(16);
      var checked = 0;
      var unclean = 0;
      for (var round = 0; round < 400; round++) {
        final count = 4 + random.nextInt(14);
        final widths = [for (var i = 0; i < count; i++) 78 + random.nextInt(110).toDouble()];
        final viewport = [320.0, 360.0, 384.0, 412.0][random.nextInt(4)];
        final chips = _spans(widths);
        final max = _maxExtent(chips, viewport);
        final stops = ChipRailGeometry.restStops(chips: chips, viewport: viewport, maxExtent: max, startInset: 16);
        expect(stops.first, greaterThanOrEqualTo(0));
        expect((stops.last - max).abs(), lessThan(0.5), reason: 'the end is always a rest');
        for (var i = 1; i < stops.length; i++) {
          expect(stops[i], greaterThan(stops[i - 1]));
        }
        for (final s in stops.skip(1)) {
          checked++;
          if (!ChipRailGeometry.isClean(chips, s, viewport, max)) unclean++;
        }
        // Reachability: every chip is whole inside some rest.
        for (final chip in chips) {
          final seen = stops.any((s) => chip.left >= s - 0.5 && chip.right <= s + viewport + 0.5);
          expect(seen, isTrue, reason: 'chip $chip never shows whole; stops $stops, viewport $viewport, widths $widths');
        }
      }
      // The first rest is the start of the rail and cannot always be fixed. Every other rest is
      // clean except where a chip would otherwise never show whole.
      expect(unclean / checked, lessThan(0.04), reason: '$unclean of $checked rests are not clean');
    });

    test('the realistic subject rail rests clean at every stop after the first', () {
      // Widths of MmChip for _labels at 14 sp (about 7.4 dp a letter) plus 12+10+8+16 of chrome.
      final widths = [for (final l in _labels) 46 + l.length * 7.4];
      for (final viewport in [360.0, 384.0, 412.0]) {
        final chips = _spans(widths);
        final max = _maxExtent(chips, viewport);
        final stops = ChipRailGeometry.restStops(chips: chips, viewport: viewport, maxExtent: max, startInset: 16);
        for (final s in stops.skip(1)) {
          expect(
            ChipRailGeometry.isClean(chips, s, viewport, max),
            isTrue,
            reason: 'stop $s at $viewport, depth ${ChipRailGeometry.peekDepth(chips, s, viewport)}',
          );
        }
      }
    });
  });

  group('ChipRail', () {
    Widget rail({int? reveal, double width = 384, List<String> labels = _labels}) => SizedBox(
      width: width,
      child: ChipRail(
        revealIndex: reveal,
        children: [for (final l in labels) MmChip(label: l, selected: false, onTap: () {})],
      ),
    );

    ScrollPosition position(WidgetTester tester) => tester.state<ScrollableState>(find.byType(Scrollable)).position;

    /// How much of the chip the right edge cuts, or null when none is cut.
    double? cutDepth(WidgetTester tester) {
      final viewport = tester.getRect(find.byType(ChipRail));
      for (final chip in find.byType(MmChip).evaluate()) {
        final rect = tester.getRect(find.byWidget(chip.widget));
        if (rect.right > viewport.right + 0.5 && rect.left < viewport.right) return viewport.right - rect.left;
      }
      return null;
    }

    testWidgets('the first view never ends in a hard cut: a clean peek, or the cut chip dissolves', (tester) async {
      await tester.pumpWidget(_app(rail()));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.getSize(find.byType(ChipRail)).height, 48);
      final depth = cutDepth(tester);
      expect(depth, isNotNull, reason: 'more chips than fit: one is cut at the edge');
      final mask = tester.widget(find.byKey(const ValueKey('chip-rail-peek'))) as dynamic;
      if (depth! <= ChipRailGeometry.peekMax + 0.5) {
        expect(depth, inInclusiveRange(ChipRailGeometry.peekMin - 0.5, ChipRailGeometry.peekMax + 0.5));
      } else {
        expect(mask.extent as double, closeTo(math.min(depth, ChipRailGeometry.peekFadeMax), 0.5), reason: 'the fade covers the cut chip');
      }
      expect(tester.takeException(), isNull);
    });

    testWidgets('it fades the edge with more behind it, at 24 dp', (tester) async {
      await tester.pumpWidget(_app(rail()));
      await tester.pump();
      expect(find.byType(EdgeFade), findsOneWidget);
      expect(tester.widget<EdgeFade>(find.byType(EdgeFade)).extent, 24);
    });

    testWidgets('a fling comes to rest at a chip boundary with a clean peek, then again going back', (tester) async {
      await tester.pumpWidget(_app(rail()));
      await tester.pump();
      for (var i = 0; i < 3; i++) {
        await tester.fling(find.byType(ChipRail), const Offset(-120, 0), 900);
        await tester.pumpAndSettle();
        final p = position(tester);
        final depth = cutDepth(tester);
        if (p.pixels < p.maxScrollExtent - 1) {
          expect(depth, isNotNull, reason: 'offset ${p.pixels}');
          expect(depth, inInclusiveRange(ChipRailGeometry.peekMin - 0.5, ChipRailGeometry.peekMax + 0.5), reason: 'offset ${p.pixels}');
        }
      }
      expect(position(tester).pixels, greaterThan(0));
      await tester.fling(find.byType(ChipRail), const Offset(400, 0), 3000);
      await tester.pumpAndSettle();
      expect(position(tester).pixels, lessThan(30));
    });

    testWidgets('a slow drag settles on a rest, not between', (tester) async {
      await tester.pumpWidget(_app(rail()));
      await tester.pump();
      await tester.drag(find.byType(ChipRail), const Offset(-90, 0));
      await tester.pumpAndSettle();
      final pixels = position(tester).pixels;
      final geometry = _restsOf(tester);
      expect(geometry.any((s) => (s - pixels).abs() < 1.5), isTrue, reason: 'offset $pixels, rests $geometry');
    });

    testWidgets('revealIndex brings a far chip whole into view, on build and when it changes', (tester) async {
      await tester.pumpWidget(_app(rail(reveal: 8)));
      await tester.pump();
      await tester.pump();
      var chip = tester.getRect(find.widgetWithText(MmChip, 'Political Science'));
      var viewport = tester.getRect(find.byType(ChipRail));
      expect(chip.left, greaterThanOrEqualTo(viewport.left));
      expect(chip.right, lessThanOrEqualTo(viewport.right));

      await tester.pumpWidget(_app(rail(reveal: 1)));
      await tester.pumpAndSettle();
      chip = tester.getRect(find.widgetWithText(MmChip, 'Accountancy'));
      viewport = tester.getRect(find.byType(ChipRail));
      expect(chip.left, greaterThanOrEqualTo(viewport.left));
      expect(chip.right, lessThanOrEqualTo(viewport.right));
    });

    testWidgets('a long label does not throw in the unbounded row and never exceeds the rail', (tester) async {
      await tester.pumpWidget(
        _app(rail(width: 320, labels: const ['A very long subject name that needs more than the rail is wide to read in full', 'Short', 'Another'])),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(MmChip).first).width, lessThanOrEqualTo(320));
    });

    testWidgets('a rail that fits shows no peek and does not scroll', (tester) async {
      await tester.pumpWidget(_app(rail(labels: const ['10', '20', '30'])));
      await tester.pump();
      expect(position(tester).maxScrollExtent, 0);
      expect(cutDepth(tester), isNull);
    });

    testWidgets('chips keep their 48 dp target inside the rail', (tester) async {
      await tester.pumpWidget(_app(rail()));
      await tester.pump();
      final handle = tester.ensureSemantics();
      final node = tester.getSemantics(find.widgetWithText(MmChip, 'All'));
      expect(node.rect.height, greaterThanOrEqualTo(48));
      handle.dispose();
    });

    testWidgets('ChipRail.labelled chooses by index and reveals the choice', (tester) async {
      var chosen = 0;
      await tester.pumpWidget(
        _app(
          StatefulBuilder(
            builder: (context, set) {
              return SizedBox(
                width: 384,
                child: ChipRail.labelled(labels: _labels, selected: chosen, onSelected: (i) => set(() => chosen = i)),
              );
            },
          ),
        ),
      );
      await tester.pump();
      await tester.tap(find.widgetWithText(MmChip, 'Accountancy'));
      await tester.pumpAndSettle();
      expect(chosen, 1);
    });
  });

  group('snapping physics', () {
    test('a fling lands on the next rest in its direction, a slow release on the nearest', () {
      final stops = [0.0, 100.0, 220.0, 400.0];
      expect(_snap(stops, 110, 0), 100);
      expect(_snap(stops, 110, 400), 220);
      expect(_snap(stops, 110, -400), 0);
      expect(_snap(stops, 130, 0), 100);
      expect(_snap(stops, 150, -200), 100, reason: 'never a stop ahead of a backward fling');
      expect(_snap(stops, 390, 400), 400);
    });
  });
}

List<double> _restsOf(WidgetTester tester) {
  final scrollable = tester.state<ScrollableState>(find.byType(Scrollable));
  final viewport = scrollable.position.viewportDimension;
  final max = scrollable.position.maxScrollExtent;
  final chips = <ChipSpan>[];
  final railLeft = tester.getRect(find.byType(ChipRail)).left;
  for (final chip in find.byType(MmChip).evaluate()) {
    final rect = tester.getRect(find.byWidget(chip.widget));
    chips.add(ChipSpan(rect.left - railLeft + scrollable.position.pixels, rect.right - railLeft + scrollable.position.pixels));
  }
  return ChipRailGeometry.restStops(chips: chips, viewport: viewport, maxExtent: max, startInset: 16);
}

double _snap(List<double> stops, double pixels, double velocity) => ChipRailGeometry.snapTarget(stops, pixels, velocity);
