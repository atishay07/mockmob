// The tools' second motion pass: Compass hero reactions and delta, unlock previews, ranked rows
// arriving, chips springing in, the combo planner's words and Mobi's outcome, figures and bars.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiAct;
import 'package:mockmob/features/tools/combo/combo_results.dart';
import 'package:mockmob/features/tools/compass/compass_hero.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/domain/du_combos.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';
import 'package:mockmob/features/tools/guide/guide_content.dart';
import 'package:mockmob/features/tools/widgets/chip_flight.dart';
import 'package:mockmob/features/tools/widgets/pop_on_select.dart';
import 'package:mockmob/features/tools/widgets/ranked_reveal.dart';
import 'package:mockmob/features/tools/widgets/tools_parts.dart';

import 'tools_test_support.dart' show duIndexJson;

Widget _app(Widget child, {bool reduced = false}) => MaterialApp(
  builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
  home: Scaffold(body: Center(child: child)),
);

DuCombo _combo({int met = 0, int unlocked = 10, int papers = 3, List<DuMissedTarget> missed = const []}) => DuCombo(
  items: [for (var i = 0; i < papers; i++) DuPick.domain('d$i')],
  selection: DuSelection.empty,
  unlocked: unlocked,
  met: [for (var i = 0; i < met; i++) 't$i'],
  missed: missed,
);

void main() {
  group('Compass hero reaction', () {
    test('the delta chip shows the real difference, and nothing for a first count', () {
      expect(CompassReaction.deltaText(before: 10, after: 22), '+12');
      expect(CompassReaction.deltaText(before: 22, after: 18), '-4');
      expect(CompassReaction.deltaText(before: 7, after: 7), isNull);
      expect(CompassReaction.deltaText(before: 0, after: 12), isNull);
    });
  });

  group('words', () {
    test('an unlock previews its first two programmes, then how many more', () {
      expect(ToolsCopy.unlockPreview(['A'], 1), 'Opens A.');
      expect(ToolsCopy.unlockPreview(['A', 'B'], 2), 'Opens A and B.');
      expect(ToolsCopy.unlockPreview(['A', 'B'], 5), 'Opens A, B and 3 more.');
    });

    test('compared with best uses only real differences', () {
      expect(
        ComboWords.comparedWithBest(
          targetsMet: 2,
          bestTargetsMet: 3,
          programmes: 40,
          bestProgrammes: 35,
          papers: 4,
          bestPapers: 3,
          hasTargets: true,
        ),
        'Compared with best: 1 fewer target, 5 more programmes, 1 more paper.',
      );
      expect(
        ComboWords.comparedWithBest(
          targetsMet: 0,
          bestTargetsMet: 0,
          programmes: 3,
          bestProgrammes: 3,
          papers: 3,
          bestPapers: 3,
          hasTargets: false,
        ),
        'Compared with best: the same programmes and papers.',
      );
    });

    test('the planner reaction names the missed target or what the nearest still needs', () {
      expect(ComboWords.reaction(met: 3, targets: 3), 'These subjects open all 3 of your targets.');
      expect(ComboWords.reaction(met: 1, targets: 3, missedName: 'Psychology'), contains('Psychology'));
      expect(ComboWords.reaction(met: 0, targets: 2, needs: 'Economics'), contains('still needs Economics'));
      expect(ComboWords.reaction(met: 0, targets: 0), '');
    });
  });

  group('combo outcome', () {
    test('all met is a cheer; none met is encouragement; no targets, no outcome', () {
      final all = ComboOutcome.of([_combo(met: 2)], 2, _catalogStub());
      expect(all?.act, MobiAct.cheer);
      expect(ComboOutcome.of([_combo(met: 0)], 2, _catalogStub())?.act, MobiAct.encourage);
      expect(ComboOutcome.of([_combo(met: 1)], 2, _catalogStub())?.act, MobiAct.nudge);
      expect(ComboOutcome.of([_combo()], 0, _catalogStub()), isNull);
      expect(ComboOutcome.of(const [], 2, _catalogStub()), isNull);
      expect(ComboOutcome.hold, const Duration(milliseconds: 2400));
    });
  });

  group('RankedReveal', () {
    testWidgets('a row new to the list arrives with a fade and an 8 dp rise', (tester) async {
      await tester.pumpWidget(_app(const RankedReveal(index: 0, child: Text('row'))));
      final top0 = tester.getTopLeft(find.text('row')).dy;
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.widget<Opacity>(find.ancestor(of: find.text('row'), matching: find.byType(Opacity)).first).opacity, lessThan(1));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.text('row')).dy, lessThan(top0), reason: 'it rose into place');
      expect(find.ancestor(of: find.text('row'), matching: find.byType(Opacity)), findsNothing, reason: 'no layer once landed');
    });

    testWidgets('a row on screen as the page opens does not play', (tester) async {
      await tester.pumpWidget(_app(const RankedReveal(index: 3, animateOnMount: false, child: Text('row'))));
      expect(find.ancestor(of: find.text('row'), matching: find.byType(Opacity)), findsNothing);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a changed replay key plays it again; reduced motion never does', (tester) async {
      Widget row(Object key, {bool reduced = false}) =>
          _app(RankedReveal(index: 0, animateOnMount: false, replayKey: key, child: const Text('row')), reduced: reduced);
      await tester.pumpWidget(row('a'));
      await tester.pumpWidget(row('b'));
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.ancestor(of: find.text('row'), matching: find.byType(Opacity)), findsWidgets);
      await tester.pumpAndSettle();
      await tester.pumpWidget(row('c', reduced: true));
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.ancestor(of: find.text('row'), matching: find.byType(Opacity)), findsNothing);
    });

    test('the first eight stagger 40 ms apart and the rest arrive with the eighth', () {
      expect(RankedReveal.delayFor(0), Duration.zero);
      expect(RankedReveal.delayFor(2), const Duration(milliseconds: 80));
      expect(RankedReveal.delayFor(30), RankedReveal.delayFor(8));
    });
  });

  group('PopOnSelect and ChipFlight', () {
    test('a chosen chip overshoots 1 and settles; an unchosen one dips and returns', () {
      expect(PopOnSelect.scaleAt(0, selected: true), closeTo(0.9, 0.001));
      expect(PopOnSelect.scaleAt(0.7, selected: true), greaterThan(1));
      expect(PopOnSelect.scaleAt(1, selected: true), 1);
      expect(PopOnSelect.scaleAt(0.4, selected: false), lessThan(1));
      expect(PopOnSelect.scaleAt(1, selected: false), 1);
    });

    testWidgets('a toggled chip pops, a chip drawn with the page does not', (tester) async {
      Widget chip(bool on) => _app(PopOnSelect(selected: on, child: const Text('chip')));
      await tester.pumpWidget(chip(false));
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pumpWidget(chip(true));
      await tester.pump(const Duration(milliseconds: 40));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
    });

    test('a launch rect is taken once and goes stale', () {
      ChipFlight.launch('language:english', const Rect.fromLTWH(0, 0, 10, 10));
      expect(ChipFlight.take('language:english'), const Rect.fromLTWH(0, 0, 10, 10));
      expect(ChipFlight.take('language:english'), isNull);
    });

    testWidgets('a chip added after the page flies from its unlock chip and then springs in', (tester) async {
      ChipFlight.launch('domain:maths', const Rect.fromLTWH(20, 500, 90, 40));
      await tester.pumpWidget(
        _app(const FlyInChip(id: 'domain:maths', label: 'Mathematics', arrives: true, child: Text('real chip'))),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Mathematics'), findsOneWidget, reason: 'the ghost is in flight');
      expect(tester.widget<Opacity>(find.ancestor(of: find.text('real chip'), matching: find.byType(Opacity)).first).opacity, 0);
      await tester.pumpAndSettle();
      expect(find.text('Mathematics'), findsNothing, reason: 'the ghost is gone');
      expect(find.text('real chip'), findsOneWidget);
    });

    testWidgets('under reduced motion the chip is simply there', (tester) async {
      ChipFlight.launch('domain:maths', const Rect.fromLTWH(20, 500, 90, 40));
      await tester.pumpWidget(
        _app(const FlyInChip(id: 'domain:maths', label: 'Mathematics', arrives: true, child: Text('real chip')), reduced: true),
      );
      await tester.pump();
      expect(find.ancestor(of: find.text('real chip'), matching: find.byType(Opacity)), findsNothing);
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('guide days and nudge', () {
    final plan = GuideMilestone(when: 'a', title: 'Baseline', body: '', start: DateTime(2026, 9), end: DateTime(2027));
    final next = GuideMilestone(when: 'b', title: 'More practice', body: '', start: DateTime(2027), end: DateTime(2027, 3));
    final forecast = GuideMilestone(when: 'c', title: 'Registration', body: '', start: DateTime(2027, 2), end: DateTime(2027, 4), expected: true);

    test('the days-left chip is for the current plan window only, never an unconfirmed date', () {
      expect(guideDaysLeftChip(plan, DateTime(2026, 10, 15)), '78 days left');
      expect(guideDaysLeftChip(plan, DateTime(2026, 12, 31, 12)), '1 day left');
      expect(guideDaysLeftChip(next, DateTime(2026, 10, 15)), isNull, reason: 'not begun');
      expect(guideDaysLeftChip(plan, DateTime(2027, 1, 2)), isNull, reason: 'passed');
      expect(guideDaysLeftChip(forecast, DateTime(2027, 3)), isNull, reason: 'a date nobody has announced');
    });

    test('Mobi speaks only within 7 days of a plan milestone, never of an expected one', () {
      final timeline = [plan, next, forecast];
      expect(guideNudge(DateTime(2026, 10, 15), timeline: timeline), isNull);
      expect(guideNudge(DateTime(2026, 12, 28), timeline: timeline)?.line, 'Baseline ends in 4 days.');
      expect(guideNudge(DateTime(2027, 2, 15), timeline: timeline), isNull, reason: 'the only milestone near is a forecast');
      expect(guideNudge(DateTime(2027, 2, 27), timeline: timeline)?.line, 'More practice ends in 2 days.');
    });
  });

  group('ToolsRing', () {
    testWidgets('travels from the previous fraction to the new one, not from zero', (tester) async {
      Widget ring(double f) => _app(ToolsRing(fraction: f, child: const SizedBox()));
      double drawn() {
        final paint = tester.widgetList<CustomPaint>(find.byType(CustomPaint)).firstWhere((p) => p.painter.toString().contains('RingPainter'));
        return (paint.painter! as dynamic).fraction as double;
      }

      await tester.pumpWidget(ring(0.2));
      await tester.pumpAndSettle();
      expect(drawn(), closeTo(0.2, 0.001));
      await tester.pumpWidget(ring(0.6));
      await tester.pump(const Duration(milliseconds: 1));
      expect(drawn(), closeTo(0.2, 0.05), reason: 'it starts at the old fraction');
      await tester.pump(const Duration(milliseconds: 350));
      expect(drawn(), inExclusiveRange(0.2, 0.6));
      await tester.pumpAndSettle();
      expect(drawn(), closeTo(0.6, 0.001));
    });
  });
}

DuCatalog _catalogStub() => DuCatalog.fromJson((jsonDecode(duIndexJson) as Map).cast<String, dynamic>());
