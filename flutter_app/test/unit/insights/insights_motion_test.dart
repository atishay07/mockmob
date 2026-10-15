import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/last_look.dart';
import 'package:mockmob/features/insights/data/trend.dart';
import 'package:mockmob/features/insights/widgets/answer_sheet.dart';
import 'package:mockmob/features/insights/widgets/ledger_hero.dart';
import 'package:mockmob/features/insights/widgets/motion_bits.dart';
import 'package:mockmob/features/insights/widgets/trend_chart.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/golden_harness.dart';
import 'support/insights_fixtures.dart';

PrepInsights _record(int pct) {
  final json = richInsightsJson();
  final insights = json['insights']! as Map<String, dynamic>;
  insights['accuracy'] = {'pct': pct, 'low': pct - 9, 'high': pct + 7, 'n': 90};
  return PrepInsights.fromJson(json);
}

SheetPainter _painter(WidgetTester tester) {
  final paint = tester.widgetList<CustomPaint>(find.descendant(of: find.byType(AnswerSheet), matching: find.byType(CustomPaint))).firstWhere((p) => p.painter is SheetPainter);
  return paint.painter! as SheetPainter;
}

void main() {
  group('the answer sheet under a finger', () {
    test('the lift is a bell: full under the finger and gone a few bubbles away', () {
      const pitch = 28.5;
      expect(SheetPainter.lift(0, pitch), 1);
      expect(SheetPainter.lift(pitch, pitch), greaterThan(SheetPainter.lift(2 * pitch, pitch)));
      expect(SheetPainter.lift(4 * pitch, pitch), lessThan(0.02));
    });

    testWidgets('pressing names the kind under the finger with its real count, and dragging changes it', (tester) async {
      await pumpMockmob(
        tester,
        const Padding(padding: EdgeInsets.all(16), child: AnswerSheet(right: 69, wrong: 21, blank: 22)),
        brightness: Brightness.dark,
      );
      final origin = tester.getTopLeft(find.byType(AnswerSheet));
      // Bubble 0 is right; the geometry is 12 columns across 336 dp.
      final gesture = await tester.startGesture(origin + const Offset(11, 11));
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Right, 69 of 90 answered'), findsOneWidget);
      // The lift starts on the first frame after the press and runs 140 ms.
      await tester.pump(const Duration(milliseconds: 200));
      expect(_painter(tester).touch, greaterThan(0.5));

      // Index 70 is a wrong bubble (row 5, column 10).
      await gesture.moveTo(origin + const Offset(296, 153));
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('Wrong, 21 of 90 answered'), findsOneWidget);

      // Index 108 is a blank bubble (row 9, column 0).
      await gesture.moveTo(origin + const Offset(11, 267));
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('Left blank, 22 of 112 questions'), findsOneWidget);

      await gesture.up();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.textContaining('of 112 questions'), findsNothing);
      expect(_painter(tester).touch, 0);
    });

    testWidgets('a legend key ripples that kind of bubble once', (tester) async {
      final controller = AnswerSheetController();
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: AnswerSheet(right: 69, wrong: 21, blank: 22, controller: controller)),
        brightness: Brightness.dark,
      );
      await tester.pump(const Duration(seconds: 1));
      expect(_painter(tester).ripple, 1);
      controller.ripple(SheetKind.wrong);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      final mid = _painter(tester);
      expect(mid.rippleKind, SheetKind.wrong);
      expect(mid.ripple, inExclusiveRange(0.0, 1.0));
      await tester.pump(const Duration(seconds: 1));
      expect(_painter(tester).ripple, 1);
    });

    testWidgets('new counts re-ink only the bubbles that changed', (tester) async {
      final right = ValueNotifier<int>(69);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<int>(
          valueListenable: right,
          builder: (context, n, _) => Padding(padding: const EdgeInsets.all(16), child: AnswerSheet(right: n, wrong: 90 - n + 21 - 21, blank: 22)),
        ),
        brightness: Brightness.dark,
      );
      await tester.pump(const Duration(seconds: 1));
      expect(_painter(tester).changed, isNull, reason: 'the first visit inks every bubble');
      right.value = 70;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(_painter(tester).changed!.keys, [69], reason: 'one wrong became right: one bubble inks again');
      await tester.pump(const Duration(seconds: 1));
    });
  });

  group('the record reacts to a real change', () {
    Future<ValueNotifier<PrepInsights>> pump(WidgetTester tester, int pct) async {
      final record = ValueNotifier<PrepInsights>(_record(pct));
      await pumpMockmob(
        tester,
        ValueListenableBuilder<PrepInsights>(
          valueListenable: record,
          builder: (context, v, _) => SingleChildScrollView(child: LedgerHero(insights: v)),
        ),
        brightness: Brightness.dark,
        size: const Size(384, 1100),
        overrides: insightsOverrides(),
        wrapInScaffold: false,
      );
      await tester.pump(const Duration(seconds: 1));
      return record;
    }

    testWidgets('nothing is said on a first look, then a rise of 5 says so for 4 s with a small rising mark and no Mobi', (tester) async {
      final record = await pump(tester, 77);
      expect(find.textContaining('since your last look'), findsNothing);
      expect(find.byType(MobiCharacter), findsNothing);

      record.value = _record(82);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Up 5 points since your last look'), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing, reason: 'Mobi stands once on the record, on the lead finding');
      expect(find.byKey(const ValueKey('rise-mark')), findsOneWidget);

      await tester.pump(LedgerHero.noteFor + const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.textContaining('since your last look'), findsNothing);
      expect(find.byKey(const ValueKey('rise-mark')), findsNothing);
    });

    testWidgets('a smaller rise is only said in words, and a fall is said calmly without the mark', (tester) async {
      final record = await pump(tester, 77);
      record.value = _record(80);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Up 3 points since your last look'), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing);
      expect(find.byKey(const ValueKey('rise-mark')), findsNothing, reason: 'under 5 points there is no mark');

      record.value = _record(79);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Down 1 point since your last look'), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing);
      await tester.pump(LedgerHero.noteFor + const Duration(milliseconds: 600));
    });

    testWidgets('a later visit compares with the look before it', (tester) async {
      final record = ValueNotifier<PrepInsights>(_record(70));
      final open = ValueNotifier<bool>(true);
      await pumpMockmob(
        tester,
        ListenableBuilder(
          listenable: Listenable.merge([record, open]),
          builder: (context, _) => open.value ? SingleChildScrollView(child: LedgerHero(insights: record.value)) : const SizedBox(),
        ),
        brightness: Brightness.dark,
        size: const Size(384, 1100),
        overrides: insightsOverrides(),
        wrapInScaffold: false,
      );
      await tester.pump(const Duration(seconds: 1));
      // The student leaves the record; it has moved by the next visit.
      open.value = false;
      await tester.pump();
      record.value = _record(74);
      open.value = true;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Up 4 points since your last look'), findsOneWidget);
      await tester.pump(LedgerHero.noteFor + const Duration(milliseconds: 600));
    });

    test('shareChange reads only a real change between two known shares', () {
      expect(shareChange(70, 75), 5);
      expect(shareChange(75, 70), -5);
      expect(shareChange(70, 70), isNull);
      expect(shareChange(null, 70), isNull);
      expect(shareChange(70, null), isNull);
      expect(hopRise, 5);
    });
  });

  group('the trend chart under a finger', () {
    Future<void> pump(WidgetTester tester) => pumpMockmob(
          tester,
          Padding(padding: const EdgeInsets.all(16), child: TrendSection(series: trendSeries(trendAttempts()))),
          brightness: Brightness.dark,
          size: const Size(384, 900),
          overrides: insightsOverrides(),
          wrapInScaffold: true,
        );

    testWidgets('dragging snaps to real sessions, says which and how it stands against the one before, and lets go quietly', (tester) async {
      await pump(tester);
      await tester.pump(const Duration(seconds: 1));
      final chart = find.byWidgetPredicate((w) => w is CustomPaint && w.painter != null && w.painter.runtimeType.toString() == '_TrendPainter');
      expect(chart, findsOneWidget);
      final box = tester.getRect(chart);
      final gesture = await tester.startGesture(Offset(box.left + 60, box.center.dy));
      await gesture.moveBy(const Offset(30, 0));
      await tester.pump(const Duration(milliseconds: 60));
      expect(find.byKey(const ValueKey('trend-scrub')), findsOneWidget);
      final first = tester.widget<Text>(find.descendant(of: find.byKey(const ValueKey('trend-scrub')), matching: find.byType(Text))).data!;
      expect(first, contains(' of '));
      expect(first, contains(' on '));

      await gesture.moveBy(const Offset(120, 0));
      await tester.pump(const Duration(milliseconds: 60));
      final second = tester.widget<Text>(find.descendant(of: find.byKey(const ValueKey('trend-scrub')), matching: find.byType(Text))).data!;
      expect(second, isNot(first), reason: 'another session is under the finger now');

      await gesture.up();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byKey(const ValueKey('trend-scrub')), findsNothing);
    });

    test('the chip says how a session stands against the one before, from real marks', () {
      expect(InsightsCopy.trendScrub(38, 50, '12 Oct', 6), '38 of 50 on 12 Oct, 6 up on the session before');
      expect(InsightsCopy.trendScrub(30, 50, '13 Oct', -8), '30 of 50 on 13 Oct, 8 down on the session before');
      expect(InsightsCopy.trendScrub(30, 50, '13 Oct', 0), '30 of 50 on 13 Oct, level with the session before');
      expect(InsightsCopy.trendScrub(30, 50, '10 Oct', null), '30 of 50 on 10 Oct');
    });
  });

  group('the lead finding', () {
    testWidgets('a leak has a small Mobi, and the key sweeps once when it is told to', (tester) async {
      final v = rich();
      final leak = v.findings.firstWhere((f) => f.isLeak);
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: FindingsPanel(findings: [leak], onAction: (_) => () {}, evidence: (_) => const []),
        ),
        brightness: Brightness.dark,
        size: const Size(384, 900),
      );
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(find.byType(KeySweep), findsOneWidget);
    });

    testWidgets('the sweep crosses the key once and is gone', (tester) async {
      final tick = ValueNotifier<int>(0);
      await pumpMockmob(
        tester,
        SizedBox(width: 300, height: 56, child: KeySweep(tick: tick, child: const ColoredBox(color: Colors.grey))),
        brightness: Brightness.dark,
      );
      expect(find.byType(SweepPainter, skipOffstage: false), findsNothing);
      tick.value++;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(
        tester.widgetList<CustomPaint>(find.descendant(of: find.byType(KeySweep), matching: find.byType(CustomPaint))).any((p) => p.painter is SweepPainter),
        isTrue,
      );
      await tester.pump(const Duration(milliseconds: 800));
      expect(
        tester.widgetList<CustomPaint>(find.descendant(of: find.byType(KeySweep), matching: find.byType(CustomPaint))).any((p) => p.painter is SweepPainter),
        isFalse,
      );
    });
  });
}
