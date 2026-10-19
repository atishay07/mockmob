// Goldens for every state a Google Play purchase can be in (A2 money audit, 19 Oct PM), on the
// Upgrade sheet (the NTA gate) and the Wallet's packs, Night and Day at 360 by 800: Google Play not
// ready, unreachable, the product not listed, a pending payment, the server confirming, a failure
// that can be tried again, a final answer (another account), Pro on, packs paused, and a pack
// added. Prices are Google Play's fixture strings; the app never writes one.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart';
import 'package:mockmob/features/wallet/wallet_screen.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/pro_nudge/pro_nudge_test_support.dart';
import '../../unit/wallet/wallet_test_support.dart';
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

const _size = Size(360, 800);

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text('open'));
  await settleNudges(tester, rounds: 14);
}

Future<void> _buy(WidgetTester tester) async {
  final key = find.text('Get Pro').last;
  await tester.ensureVisible(key);
  await tester.tap(key);
  await settleNudges(tester, rounds: 14);
}

void _sheet(String name, void Function(NudgeRig rig) arrange, {bool buy = false}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    final file = 'billing_${name}_${tag}_360x800';
    testWidgets(file, (tester) async {
      final rig = NudgeRig();
      arrange(rig);
      await pumpNudges(tester, const OpenSheetHost(reason: ProReason.ntaMode), rig, brightness: brightness, size: _size);
      await _open(tester);
      if (buy) await _buy(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
      final gate = rig.billing.verifier.gate;
      if (gate != null && !gate.isCompleted) gate.complete();
      await settleNudges(tester);
    });
  }
}

void _wallet(String name, BillingRig Function() makeRig, {RemoteState<AiCredits>? aiCredits, String? tapPack}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    final file = 'billing_${name}_${tag}_360x800';
    testWidgets(file, (tester) async {
      final rig = makeRig();
      await pumpMockmob(tester, const WalletScreen(), brightness: brightness, size: _size, wrapInScaffold: false, disableAnimations: true, overrides: walletOverrides(rig: rig, aiCredits: aiCredits));
      await settleNudges(tester, rounds: 12);
      final top = find.text('Top up');
      if (top.evaluate().isNotEmpty) await tester.ensureVisible(top);
      if (tapPack != null) {
        await tester.ensureVisible(find.text(tapPack));
        await tester.tap(find.text(tapPack));
        await settleNudges(tester, rounds: 12);
        await tester.ensureVisible(find.text('Top up'));
        await settleNudges(tester, rounds: 4);
      }
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
    });
  }
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  _sheet('play_not_ready', (rig) => rig.billing.store.available = false);
  _sheet('play_unreachable', (rig) => rig.billing.store.queryError = true);
  _sheet('product_not_listed', (rig) => rig.billing.store.missing = {PlayProducts.proId});
  _sheet('pending', (rig) => rig.billing.store.onBuy = (p) => rig.billing.store.emit(purchase(p.id, status: PurchaseStatus.pending)), buy: true);
  _sheet('confirming', (rig) {
    rig.billing.verifier.gate = Completer<void>();
    rig.billing.store.onBuy = (p) => rig.billing.store.emit(purchase(p.id));
  }, buy: true);
  _sheet('verify_failed', (rig) {
    rig.billing.verifier.failWith = serverBroken;
    rig.billing.store.onBuy = (p) => rig.billing.store.emit(purchase(p.id));
  }, buy: true);
  _sheet('other_account', (rig) {
    rig.billing.verifier.failWith = ApiError.fromResponse(403, {'ok': false, 'error': 'x', 'code': 'account_mismatch'});
    rig.billing.store.onBuy = (p) => rig.billing.store.emit(purchase(p.id));
  }, buy: true);
  _sheet('pro_on', (rig) => rig.billing.store.onBuy = (p) => rig.billing.store.emit(purchase(p.id)), buy: true);

  _wallet(
    'packs_paused',
    BillingRig.new,
    aiCredits: RemoteState<AiCredits>(value: AiCredits.fromJson({'ok': true, 'state': 'available', 'checkout': {'open': false}})),
  );
  _wallet('pack_added', () {
    final rig = BillingRig();
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
    return rig;
  }, tapPack: '150 credits');
}
