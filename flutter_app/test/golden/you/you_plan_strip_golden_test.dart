// K3 and K6 (owner, 20 Oct 2026): the plan strip under the name on You, at 360 dp with text at 1.0 and 1.3, Night and
// Day: a Free student with Google Play on ("Free plan", "Upgrade to Pro"), a Pro student (their plan), a Free student
// with Google Play off (no upgrade key), and a balance that has not loaded (never a 0).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/credits/data/credits_models.dart';
import 'package:mockmob/features/you/hub/plan_strip.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/you/you_test_support.dart';
import 'you_golden_kit.dart' show setUpGoldenFonts;

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  final cases = <(String, RemoteState<CreditsOverview>, bool, double)>[
    ('free', oneBalanceState(), true, 1.0),
    ('free', oneBalanceState(), true, 1.3),
    ('pro', oneBalanceState(pro: true), true, 1.0),
    ('pro', oneBalanceState(pro: true), true, 1.3),
    ('free_play_off', oneBalanceState(), false, 1.0),
    ('not_loaded', oneBalanceState(total: null), true, 1.0),
  ];
  for (final (name, credits, playOn, scale) in cases) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      final file = 'plan_strip_${name}_360_text${(scale * 100).round()}_$tag';
      testWidgets(file, (tester) async {
        final List<Override> overrides = [...youOverrides(credits: credits), ...BillingRig(on: playOn).overrides];
        await pumpMockmob(
          tester,
          const Padding(padding: EdgeInsets.all(16), child: Align(alignment: Alignment.topCenter, child: YouPlanStrip())),
          brightness: brightness,
          size: const Size(360, 200),
          textScale: scale,
          overrides: overrides,
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
      });
    }
  }
}
