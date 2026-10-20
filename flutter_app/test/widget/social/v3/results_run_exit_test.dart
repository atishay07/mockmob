// A10 (MOB-MINIMAL 3.4): an X on every screen of the results run returns to the den. On a celebration screen in the
// middle of the run, the X leaves the run (it never moves on to the next screen).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/features/social/v3/screens/results_run.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';
import 'package:mockmob/features/social/v3/widgets/results_parts.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';

Future<void> _tapContinue(WidgetTester t) async {
  for (final key in const ['podium-primary', 'moments-continue', 'fix-later']) {
    final f = find.byKey(ValueKey(key));
    if (f.evaluate().isNotEmpty) {
      await t.ensureVisible(f.first);
      await t.tap(f.first, warnIfMissed: false);
      return;
    }
  }
  await t.tap(find.text('Continue').last, warnIfMissed: false);
}

void main() {
  setUpAll(() {
    loadFoldManifestForTest();
    FoilSheenProgram.enabled = false;
  });

  testWidgets('the X on a celebration screen mid-run pops the run to the den', (t) async {
    final server = v3Server(scenario: 'questdone');
    await pumpMockmob(
      t,
      Builder(builder: (c) => Center(child: TextButton(onPressed: () => Navigator.of(c).push(ResultsRun.route(gameId: 'game-zoya-closed')), child: const Text('den')))),
      size: const Size(360, 780),
      disableAnimations: true,
      overrides: v3Overrides(server),
    );
    await t.tap(find.text('den'));
    for (var k = 0; k < 12; k++) {
      await t.pump(const Duration(milliseconds: 500));
    }
    // Podium, everyone's moment, Fix it together, then the first achievement (step 4).
    for (var step = 0; step < 3; step++) {
      expect(find.byType(RunStepDots), findsWidgets);
      await _tapContinue(t);
      for (var k = 0; k < 8; k++) {
        await t.pump(const Duration(milliseconds: 500));
      }
    }
    final dots = t.widget<RunStepDots>(find.byType(RunStepDots).first);
    expect(dots.index, 3);
    expect(dots.total, greaterThan(4));
    await t.tap(find.byIcon(LucideIcons.x).last);
    for (var k = 0; k < 4; k++) {
      await t.pump(const Duration(milliseconds: 300));
    }
    expect(find.byType(ResultsRun), findsNothing);
    expect(find.text('den'), findsOneWidget);
  });
}
