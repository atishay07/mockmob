import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/steps/plan_step.dart';
import 'package:mockmob/features/onboarding/widgets/hold_to_seal.dart';
import 'package:mockmob/features/onboarding/widgets/plan_seal_moment.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/golden_harness.dart';

void main() {
  testWidgets('dbg', (tester) async {
    await pumpMockmob(tester, const OnboardingFlow(skipColdOpen: true, startInDeck: true), size: kPhone, brightness: Brightness.dark,
        overrides: onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan)));
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    final steps = find.byType(PlanStep).evaluate().toList();
    print('plansteps ${steps.length} moment=${(steps.first.widget as PlanStep).moment}');
    final bd = tester.widget<PlanSealBackdrop>(find.byType(PlanSealBackdrop));
    print('backdrop moment ${bd.moment} same=${identical(bd.moment, (steps.first.widget as PlanStep).moment)}');
    print('holds ${find.byType(HoldToSeal).evaluate().length} at ${tester.getCenter(find.byType(HoldToSeal))}');
    final r = HitTestResult();
    tester.binding.hitTestInView(r, tester.getCenter(find.byType(HoldToSeal)), tester.view.viewId);
    print('path ${r.path.take(12).map((e) => e.target.runtimeType).join(' > ')}');
    final g = await tester.startGesture(tester.getCenter(find.byType(HoldToSeal)));
    await tester.pump(const Duration(milliseconds: 500));
    final hp = tester.widget<HoldToSeal>(find.byType(HoldToSeal)).progress;
    print('progress ${hp.value} ${hp.status} steps=${find.byType(PlanStep).evaluate().length} tm=${TickerMode.valuesOf(tester.element(find.byType(HoldToSeal))).enabled}');
    print('sealing label ${find.text(OnboardingCopy.sealing).evaluate().length} reveal=${bd.moment.reveal} press=${bd.moment.press}');
    await g.up();
    await tester.pump(const Duration(seconds: 2));
  });
}
