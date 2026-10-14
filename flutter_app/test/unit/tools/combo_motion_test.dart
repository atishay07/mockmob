// The Combo planner's moments: ranked cards ink in, in order, when a plan lands (a cross-fade
// under reduced motion), and Mobi waits (the loading pose) while a new plan is being checked
// instead of the old list sitting there dimmed.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/mobi.dart';
import 'package:mockmob/features/tools/combo/combo_card.dart';
import 'package:mockmob/features/tools/combo/combo_controller.dart';
import 'package:mockmob/features/tools/combo/combo_results.dart';
import 'package:mockmob/features/tools/combo/combo_screen.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/domain/du_combos.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

Finder _mobi(MobiPose pose) => find.byWidgetPredicate((w) => w is Mobi && w.pose == pose);

double _opacityOf(WidgetTester tester, Finder inside) =>
    tester.widget<Opacity>(find.descendant(of: inside, matching: find.byType(Opacity)).first).opacity;

void main() {
  setUpAll(loadAppFonts);

  group('ComboReveal', () {
    Widget pair(bool reduced) => MaterialApp(
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
          home: Column(
            children: [
              for (var i = 0; i < 2; i++)
                ComboReveal(key: ValueKey('card$i'), index: i, builder: (context, inked) => Text(inked ? 'inked $i' : 'wet $i')),
            ],
          ),
        );

    testWidgets('cards ink in rank order, each a beat after the one above', (tester) async {
      await tester.pumpWidget(pair(false));
      expect(find.text('wet 0'), findsOneWidget);
      expect(_opacityOf(tester, find.byKey(const ValueKey('card1'))), 0);

      await tester.pump(const Duration(milliseconds: 160));
      final first = _opacityOf(tester, find.byKey(const ValueKey('card0')));
      final second = _opacityOf(tester, find.byKey(const ValueKey('card1')));
      expect(first, greaterThan(second), reason: 'the best fit lands first');
      expect(find.text('inked 0'), findsOneWidget);
      expect(find.text('wet 1'), findsOneWidget, reason: 'the second card inks after the first');

      await tester.pump(const Duration(milliseconds: 600));
      expect(_opacityOf(tester, find.byKey(const ValueKey('card0'))), 1);
      expect(_opacityOf(tester, find.byKey(const ValueKey('card1'))), 1);
      expect(find.text('inked 1'), findsOneWidget);
    });

    testWidgets('under reduced motion the cards cross-fade in and are inked at once', (tester) async {
      await tester.pumpWidget(pair(true));
      expect(find.text('inked 0'), findsOneWidget);
      expect(find.text('inked 1'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 60));
      final mid = _opacityOf(tester, find.byKey(const ValueKey('card1')));
      expect(mid, inExclusiveRange(0, 1));
      await tester.pump(const Duration(milliseconds: 100));
      expect(_opacityOf(tester, find.byKey(const ValueKey('card1'))), 1);
      // Nothing moves: no vertical offset under reduced motion.
      final shift = tester.widget<Transform>(find.descendant(of: find.byKey(const ValueKey('card1')), matching: find.byType(Transform)).first);
      expect(shift.transform.getTranslation().y, 0);
    });
  });

  testWidgets('Mobi waits while a plan is checked, the old list stays until the beat, the new one inks in', (tester) async {
    final gates = <Completer<DuComboPlan>>[];
    await pumpMockmob(
      tester,
      const ComboScreen(),
      size: const Size(384, 3200),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: toolsOverrides(
        prefs: savedCombo(
          ['b-com-hons', 'b-a-hons-economics'],
          ['language:english', 'domain:accountancy', 'domain:business_studies', 'domain:economics', 'domain:mathematics', 'gat:gat'],
        ),
        comboRunner: (groups, pool, targets, maxPapers) {
          final c = Completer<DuComboPlan>();
          gates.add(c);
          return c.future;
        },
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));

    // First plan: nothing to show yet, so Mobi waits at once.
    expect(gates, hasLength(1));
    expect(_mobi(MobiPose.loading), findsOneWidget);
    expect(find.text(ToolsCopy.checking), findsOneWidget);
    expect(find.byType(ComboCard), findsNothing);

    final container = ProviderScope.containerOf(tester.element(find.byType(ComboScreen)));
    final catalog = container.read(comboControllerProvider).value!.catalog;
    final state = container.read(comboControllerProvider).value!;
    DuComboPlan plan(int papers) => duPlanCombos(groups: catalog.groups, pool: state.pool, targets: state.targets, maxPapers: papers);

    gates[0].complete(plan(5));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(_mobi(MobiPose.loading), findsNothing);
    expect(find.byType(ComboCard), findsWidgets);
    expect(find.text('Best fit'), findsOneWidget);

    // A new answer is being checked: the old list holds still, undimmed, for a beat.
    container.read(comboControllerProvider.notifier).setMaxPapers(4);
    await tester.pump(const Duration(milliseconds: 50));
    expect(gates, hasLength(2));
    expect(find.byType(ComboCard), findsWidgets);
    expect(tester.widgetList<AnimatedOpacity>(find.byType(AnimatedOpacity)).every((w) => w.opacity == 1), isTrue, reason: 'no dimmed stale list');

    // Then Mobi takes its place.
    await tester.pump(ComboResults.beat + const Duration(milliseconds: 50));
    expect(_mobi(MobiPose.loading), findsOneWidget);
    expect(find.byType(ComboCard), findsNothing);

    gates[1].complete(plan(4));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(_mobi(MobiPose.loading), findsNothing);
    expect(find.byType(ComboCard), findsWidgets);
  });
}
