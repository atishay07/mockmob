// Goldens for the monthly subscription on the Get Pro sheet (owner D135/D136, 19 Oct 2026), Night and
// Day at 360 by 800: the Free sheet with Google Play's monthly price and the renewal line, a renewing
// subscriber, a subscriber who turned renewal off (Pro until the paid date), a payment Google Play is
// retrying (grace period), and a subscription on account hold. Prices are Google Play's fixture
// strings; the app never writes one. The You plan card for a renewing subscriber, a payment being
// retried and a subscription on hold.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/auth_me.dart';
import 'package:mockmob/features/billing/billing.dart';
import 'package:mockmob/features/you/account/plan_card.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/pro_nudge/pro_nudge_test_support.dart' show settleNudges;
import '../../unit/you/you_test_support.dart';
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

const _size = Size(360, 800);

class _Host extends StatelessWidget {
  const _Host();

  @override
  Widget build(BuildContext context) => Center(child: TextButton(onPressed: () => showGetProSheet(context), child: const Text('open')));
}

void _golden(String name, {PlaySubscriptionInfo? sub, bool pro = false}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    final file = 'billing_sub_${name}_${tag}_360x800';
    testWidgets(file, (tester) async {
      final rig = BillingRig(subscription: sub);
      await pumpMockmob(
        tester,
        const _Host(),
        brightness: brightness,
        size: _size,
        overrides: [...youOverrides(credits: creditsState(pro: pro, proUntil: pro ? '2026-11-19' : null)), ...rig.overrides],
        disableAnimations: true,
      );
      await settleNudges(tester);
      await tester.tap(find.text('open'));
      await settleNudges(tester, rounds: 14);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
    });
  }
}

/// The You plan card for a Play subscriber, Night and Day at 360 dp.
void _planGolden(String name, {required PlaySubscriptionInfo sub, required bool pro}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    final file = 'plan_card_sub_${name}_${tag}_360x800';
    testWidgets(file, (tester) async {
      final rig = BillingRig(subscription: sub);
      final auth = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', isPro: pro, creditBalance: pro ? null : 40);
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: PlanCard(auth: auth)),
        brightness: brightness,
        size: _size,
        wrapInScaffold: true,
        overrides: [...youOverrides(auth: auth, credits: creditsState(pro: pro, proUntil: pro ? '2026-11-19' : null)), ...rig.overrides],
        disableAnimations: true,
      );
      await settleNudges(tester, rounds: 14);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
    });
  }
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  final paidTo = DateTime(2026, 11, 19, 15);
  _golden('free_monthly');
  _golden('renewing', pro: true, sub: playSub(expiresAt: paidTo));
  _golden('renewal_off', pro: true, sub: playSub(state: 'canceled', autoRenewing: false, expiresAt: paidTo));
  _golden('grace', pro: true, sub: playSub(state: 'in_grace_period', grace: true, expiresAt: paidTo));
  _golden('on_hold', sub: playSub(state: 'on_hold', active: false, hold: true));

  _planGolden('renewing', pro: true, sub: playSub(expiresAt: paidTo));
  _planGolden('grace', pro: true, sub: playSub(state: 'in_grace_period', grace: true, expiresAt: paidTo));
  _planGolden('on_hold', pro: false, sub: playSub(state: 'on_hold', active: false, hold: true));
}
