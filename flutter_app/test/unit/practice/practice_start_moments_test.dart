// Owner test of APK v8 (15 Oct): "the UI of NTA mode is a bit broken. Some boxes and checkboxes
// are going out of the area of the entire image", on the Practice tab and in the Start sheet,
// and "the full mock can have some animation of its own, like the clock doing a 360".
//
// Root cause of the first: the NTA glyph's panel was a fixed 19.6-unit square from y 2.4 to 22.0
// while its 3 by 3 grid of cells started at y 7.1 and ran to 23.3, so the bottom row of
// not-visited cells hung 1.3 units below the panel at every size (72 dp tile, 56 dp sheet row).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/hybrid/hybrid.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/widgets/choice_deck.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/features/practice/widgets/composer_ticket.dart';
import 'package:mockmob/features/practice/widgets/exam_sheet_start.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  double width = 384,
  double textScale = 1,
  Brightness brightness = Brightness.dark,
  bool reduceMotion = false,
}) async {
  tester.view.physicalSize = Size(width, 853) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(const Haptics(enabled: false))],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(brightness),
          builder: (context, app) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale), disableAnimations: reduceMotion),
            child: app!,
          ),
          home: Scaffold(body: SafeArea(child: child)),
        ),
      ),
    ),
  );
  await tester.pump();
}

ChoiceOption _option(String id, ChoiceGlyphKind glyph, String title, String note, {String? tag}) =>
    ChoiceOption(id: id, glyph: glyph, title: title, note: note, tag: tag, onTap: () {});

/// The Practice tab's exam band as the tab builds it: Full mock and NTA mode side by side, on the
/// 16 dp gutter with the band's ground bled to the screen edges.
Widget _examBand({String? ntaTag = 'Pro'}) => SingleChildScrollView(
  child: Padding(
    padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
    child: ChoiceDeck(
      animateIn: false,
      bleed: MmSpace.gutter,
      rows: [
        ChoiceRow.band(
          title: 'Exam conditions',
          rows: [
            ChoiceRow.pair(
              _option('full', ChoiceGlyphKind.mock, 'Full mock', '50 questions in 60 minutes, timed like the exam.'),
              _option('nta', ChoiceGlyphKind.nta, 'NTA mode', 'Comes with Pro. A Full mock is open to you now.', tag: ntaTag),
            ),
          ],
        ),
        // The Start sheet's NTA row is a wide row with the same glyph.
        ChoiceRow.wide(
          _option('nta-row', ChoiceGlyphKind.nta, 'NTA mode', 'The exam-day screen in Business Studies, as on the day.', tag: ntaTag),
        ),
      ],
    ),
  ),
);

void main() {
  setUpAll(loadAppFonts);

  group('the NTA palette glyph stays inside its panel', () {
    const panel = ChoiceGlyphPainter.ntaPanel;

    test('every cell, at every point of the wave, sits inside the panel and under its header', () {
      for (var step = 0; step <= 100; step++) {
        final p = step / 100;
        for (var row = 0; row < 3; row++) {
          for (var col = 0; col < 3; col++) {
            final cell = ChoiceGlyphPainter.ntaCellRect(row, col, dip: ChoiceGlyphPainter.ntaDipAt(row * 3 + col, p));
            expect(cell.left, greaterThanOrEqualTo(panel.left + 1), reason: 'cell $row,$col at $p, left');
            expect(cell.right, lessThanOrEqualTo(panel.right - 1), reason: 'cell $row,$col at $p, right');
            expect(cell.top, greaterThanOrEqualTo(panel.top + ChoiceGlyphPainter.ntaHeader + 1), reason: 'cell $row,$col at $p, top');
            expect(cell.bottom, lessThanOrEqualTo(panel.bottom - 1), reason: 'cell $row,$col at $p, bottom');
          }
        }
      }
    });

    test('the grid keeps the same margin on all four sides, and the panel is centred in the box', () {
      final first = ChoiceGlyphPainter.ntaCellRect(0, 0);
      final last = ChoiceGlyphPainter.ntaCellRect(2, 2);
      final left = first.left - panel.left;
      final right = panel.right - last.right;
      final top = first.top - (panel.top + ChoiceGlyphPainter.ntaHeader);
      final bottom = panel.bottom - last.bottom;
      for (final m in [left, right, top, bottom]) {
        expect(m, closeTo(ChoiceGlyphPainter.ntaMargin, 1e-9));
      }
      expect(panel.center.dx, closeTo(12, 1e-9));
      expect(panel.center.dy, closeTo(12, 1e-9));
      // The panel and its drop shadow (0.9 down, 0.9 blur) stay inside the glyph's widget box,
      // which is the 24-unit box plus 4% each side.
      const slack = (24 / 0.92 - 24) / 2;
      expect(panel.top, greaterThanOrEqualTo(-slack));
      expect(panel.bottom + 0.9 + 0.9, lessThanOrEqualTo(24 + slack));
      expect(panel.left, greaterThanOrEqualTo(0));
      expect(panel.right, lessThanOrEqualTo(24));
    });
  });

  group('the exam band and the Start sheet row fit every phone', () {
    for (final width in [360.0, 393.0, 430.0]) {
      for (final scale in [1.0, 1.3, 2.0]) {
        for (final b in Brightness.values) {
          testWidgets('${width.round()} dp, text x$scale, ${b.name}: nothing overflows and the tiles keep their objects', (tester) async {
            await _pump(tester, _examBand(), width: width, textScale: scale, brightness: b);
            await tester.pump(const Duration(milliseconds: 500));
            expect(tester.takeException(), isNull);
            // Each glyph sits inside its own tile, clear of the tile's edges.
            for (final id in ['full', 'nta']) {
              final tile = tester.getRect(find.byKey(ValueKey('choice-$id')));
              final glyph = tester.getRect(find.descendant(of: find.byKey(ValueKey('choice-$id')), matching: find.byType(ChoiceGlyph)));
              expect(
                tile.contains(glyph.topLeft) && tile.contains(glyph.bottomRight - const Offset(1, 1)),
                isTrue,
                reason: '$id glyph $glyph in tile $tile',
              );
            }
            // The Pro tag sits inside the NTA tile, never past its right edge.
            final ntaTile = tester.getRect(find.byKey(const ValueKey('choice-nta')));
            final tag = tester.getRect(find.descendant(of: find.byKey(const ValueKey('choice-nta')), matching: find.text('Pro')));
            expect(tag.right, lessThanOrEqualTo(ntaTile.right - MmSpace.s8));
            expect(tag.left, greaterThanOrEqualTo(ntaTile.left));
          });
        }
      }
    }

    testWidgets('a tile without a tag is unchanged: the object at the top left, nothing beside it', (tester) async {
      await _pump(tester, _examBand(ntaTag: null), width: 360);
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      expect(find.text('Pro'), findsNothing);
      final tile = tester.getRect(find.byKey(const ValueKey('choice-nta')));
      final glyph = tester.getRect(find.descendant(of: find.byKey(const ValueKey('choice-nta')), matching: find.byType(ChoiceGlyph)));
      // The object keeps its place: the tile's 16 dp padding, nudged 4 dp left into it.
      expect(glyph.left - tile.left, closeTo(MmSpace.s16 - 4, 0.01));
    });
  });

  group('the stopwatch laps once', () {
    test('a lap runs the long hand one full turn back round to 12 while the small hand holds', () {
      final sim = StopwatchSim()..jump(long: 0, short: 0, mode: StopwatchMode.done);
      sim.lap(1);
      expect(sim.mode, StopwatchMode.lap);
      expect(sim.longAt(1), closeTo(0, 1e-9));
      expect(sim.settledAt(1 + StopwatchSim.lapDuration / 2), isFalse);
      final mid = sim.longAt(1 + StopwatchSim.lapDuration / 2);
      expect(mid, greaterThan(0));
      expect(mid, lessThan(StopwatchSim.turn));
      expect(sim.longAt(1 + StopwatchSim.lapDuration), closeTo(StopwatchSim.turn, 1e-9));
      expect(sim.shortAt(1 + StopwatchSim.lapDuration / 2), closeTo(0, 1e-9));
      expect(sim.shortAt(1 + StopwatchSim.lapDuration), closeTo(0, 1e-9));
      expect(sim.settledAt(1 + StopwatchSim.lapDuration), isTrue);
      // The hand only ever goes forward.
      var last = -1.0;
      for (var i = 0; i <= 60; i++) {
        final a = sim.longAt(1 + StopwatchSim.lapDuration * i / 60);
        expect(a, greaterThanOrEqualTo(last - 1e-9));
        last = a;
      }
    });

    test('it lands inside the 260 ms the ticket already holds after the server says yes', () {
      final sim = StopwatchSim()..lap(0);
      expect(sim.longAt(0.26) / StopwatchSim.turn, greaterThan(0.97));
    });
  });

  group('a Full mock\'s ticket keeps a stopwatch under its stub', () {
    Widget ticket(TicketTear tear, {bool clock = true}) => Center(
      child: ComposerTicket(
        subjectId: 'accountancy',
        eyebrow: 'Mock 7',
        subject: 'Accountancy',
        count: 50,
        semanticsLabel: 'Mock 7, Accountancy',
        tear: tear,
        clock: clock,
      ),
    );

    HybridStopwatch watch(WidgetTester tester) => tester.widget<HybridStopwatch>(find.byType(HybridStopwatch));

    double clockOpacity(WidgetTester tester) =>
        tester.widget<Opacity>(find.ancestor(of: find.byType(HybridStopwatch), matching: find.byType(Opacity)).first).opacity;

    testWidgets('hidden at rest and while the request is out; on the yes it shows and laps', (tester) async {
      await _pump(tester, ticket(TicketTear.rest));
      await tester.pump(const Duration(milliseconds: 300));
      expect(watch(tester).mode, StopwatchMode.done);
      expect(clockOpacity(tester), 0);

      await _pump(tester, ticket(TicketTear.lifted));
      await tester.pump(const Duration(milliseconds: 200));
      expect(watch(tester).mode, StopwatchMode.done);
      expect(clockOpacity(tester), 0);

      await _pump(tester, ticket(TicketTear.torn));
      expect(watch(tester).mode, StopwatchMode.lap);
      await tester.pump(const Duration(milliseconds: 120));
      expect(clockOpacity(tester), greaterThan(0));
      await tester.pump(const Duration(milliseconds: 400));
      expect(clockOpacity(tester), closeTo(1, 1e-9));
      // The stopwatch sits inside the ticket, where the stub was.
      final card = tester.getRect(find.byType(ComposerTicket));
      final clock = tester.getRect(find.byType(HybridStopwatch));
      expect(card.contains(clock.topLeft) && card.contains(clock.bottomRight - const Offset(1, 1)), isTrue);
      expect(clock.left, greaterThanOrEqualTo(card.right - ComposerTicket.stubWidth));
      expect(tester.takeException(), isNull);
    });

    testWidgets('a start that fails puts the stub back over it', (tester) async {
      await _pump(tester, ticket(TicketTear.lifted));
      await tester.pump(const Duration(milliseconds: 200));
      await _pump(tester, ticket(TicketTear.rest));
      await tester.pumpAndSettle();
      expect(clockOpacity(tester), 0);
      expect(watch(tester).mode, StopwatchMode.done);
    });

    testWidgets('practice tickets have no stopwatch', (tester) async {
      await _pump(tester, ticket(TicketTear.torn, clock: false));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(HybridStopwatch), findsNothing);
    });

    testWidgets('under reduced motion it is simply there at the yes, still, and nothing runs on', (tester) async {
      await _pump(tester, ticket(TicketTear.rest), reduceMotion: true);
      await _pump(tester, ticket(TicketTear.torn), reduceMotion: true);
      await tester.pump();
      // No fade to wait for: it is there on the first frame after the yes.
      expect(clockOpacity(tester), 1);
      expect(watch(tester).mode, StopwatchMode.lap);
      await tester.pumpAndSettle();
      expect(clockOpacity(tester), 1);
      expect(tester.takeException(), isNull);
    });
  });

  test('the lap reads as a whole turn, not a flick: half the lap is past the quarter mark', () {
    final sim = StopwatchSim()..lap(0);
    expect(sim.longAt(StopwatchSim.lapDuration / 2), greaterThan(StopwatchSim.turn / 4));
    expect(sim.longAt(StopwatchSim.lapDuration / 2), lessThan(StopwatchSim.turn * 0.9));
  });

  group('NTA mode starts with its own moment: the exam sheet slides in and the mark settles', () {
    Widget ticket(TicketTear tear, {bool examSheet = true, bool clock = false, double? width}) => Center(
      child: ComposerTicket(
        subjectId: 'business_studies',
        eyebrow: 'NTA mode',
        subject: 'Business Studies',
        count: 50,
        semanticsLabel: 'NTA mode, Business Studies',
        tear: tear,
        examSheet: examSheet,
        clock: clock,
      ),
    );

    ExamSheetStart sheet(WidgetTester tester) => tester.widget<ExamSheetStart>(find.byType(ExamSheetStart));

    test('the sheet is in place before the mark comes down, and both have landed by the end', () {
      expect(ExamSheetStart.slideAt(0), 0);
      expect(ExamSheetStart.markAt(0.4), 0);
      expect(ExamSheetStart.slideAt(0.62), closeTo(1, 1e-9));
      expect(ExamSheetStart.markAt(1), closeTo(1, 1e-9));
    });

    test('it ends inside the tear and the hold the ticket already has after the yes', () {
      // 220 ms tear plus the 260 ms hold (PracticeComposerKeys.tearHold).
      expect(ExamSheetStart.duration.inMilliseconds, lessThanOrEqualTo(220 + 260));
    });

    testWidgets('waits unplayed at rest and while the request is out; plays on the yes and settles', (tester) async {
      await _pump(tester, ticket(TicketTear.rest));
      expect(sheet(tester).play, isFalse);
      await _pump(tester, ticket(TicketTear.lifted));
      await tester.pump(const Duration(milliseconds: 200));
      expect(sheet(tester).play, isFalse);
      await _pump(tester, ticket(TicketTear.torn));
      expect(sheet(tester).play, isTrue);
      await tester.pump(ExamSheetStart.duration);
      await tester.pump(const Duration(milliseconds: 100));
      final card = tester.getRect(find.byType(ComposerTicket));
      final art = tester.getRect(find.byType(ExamSheetStart));
      expect(art.left, greaterThanOrEqualTo(card.right - ComposerTicket.stubWidth));
      expect(card.contains(art.topLeft) && card.contains(art.bottomRight - const Offset(1, 1)), isTrue);
      expect(tester.hasRunningAnimations, isFalse);
      expect(tester.takeException(), isNull);
    });

    testWidgets('fits the stub at 360 dp with large text, Night and Day', (tester) async {
      for (final b in Brightness.values) {
        await _pump(tester, ticket(TicketTear.torn), width: 360, textScale: 1.3, brightness: b);
        await tester.pump(const Duration(milliseconds: 600));
        final card = tester.getRect(find.byType(ComposerTicket));
        final art = tester.getRect(find.byType(ExamSheetStart));
        expect(art.left, greaterThanOrEqualTo(card.right - ComposerTicket.stubWidth));
        expect(art.height, lessThanOrEqualTo(card.height));
        expect(tester.takeException(), isNull);
      }
    });

    testWidgets('a Full mock keeps its stopwatch and no sheet; practice has neither', (tester) async {
      await _pump(tester, ticket(TicketTear.torn, clock: true));
      expect(find.byType(HybridStopwatch), findsOneWidget);
      expect(find.byType(ExamSheetStart), findsNothing);
      await _pump(tester, ticket(TicketTear.torn, examSheet: false));
      expect(find.byType(HybridStopwatch), findsNothing);
      expect(find.byType(ExamSheetStart), findsNothing);
    });

    testWidgets('under reduced motion it is there at the yes, settled, and nothing runs on', (tester) async {
      await _pump(tester, ticket(TicketTear.rest), reduceMotion: true);
      await _pump(tester, ticket(TicketTear.torn), reduceMotion: true);
      await tester.pump();
      final painter =
          tester.widget<CustomPaint>(find.descendant(of: find.byType(ExamSheetStart), matching: find.byType(CustomPaint))).painter!
              as ExamSheetPainter;
      expect(painter.t, 1);
      // Nothing plays on: a later frame holds the same settled pose.
      await tester.pump(const Duration(milliseconds: 200));
      final later =
          tester.widget<CustomPaint>(find.descendant(of: find.byType(ExamSheetStart), matching: find.byType(CustomPaint))).painter!
              as ExamSheetPainter;
      expect(later.t, 1);
      expect(tester.takeException(), isNull);
    });
  });
}
