// Goldens for the Wallet and the Get Pro sheet at 360 and 412 dp, Night and Day. Every price on
// these pictures is a fixture standing in for Google Play's own string; the app writes none.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/widgets/get_pro_sheet.dart';
import 'package:mockmob/features/wallet/wallet_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/wallet/wallet_test_support.dart';
import '../you/you_golden_kit.dart' show loadMaterialIcons;

/// The app's body font has no rupee sign (Android draws it from the system font), so the pictures
/// use "Rs" fixtures: they only stand in for Google Play's own strings.
final Map<String, String> goldenPrices = {
  PlayProducts.proId: 'Rs 150.00',
  'credits_10_50': 'Rs 15.00',
  'credits_29_150': 'Rs 40.00',
  'credits_49_300': 'Rs 75.00',
};

typedef Prepare = Future<void> Function(WidgetTester tester, BillingRig rig);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 60));
  }
}

/// One golden per width and theme: `goldens/<name>_<360|412>_<night|day>.png`.
void _golden(
  String name,
  Widget Function() screen, {
  BillingRig Function()? rig,
  bool pro = false,
  double height = 1500,
  bool padded = false,
  Prepare? prepare,
}) {
  for (final width in [360.0, 412.0]) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('$name, ${width.toInt()}, $tag', (tester) async {
        final r = (rig ?? () => BillingRig(store: FakePlayStore(prices: goldenPrices)))();
        await pumpMockmob(
          tester,
          padded ? SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 16, 20, 20), child: screen()) : screen(),
          brightness: brightness,
          size: Size(width, height),
          wrapInScaffold: padded,
          disableAnimations: true,
          overrides: walletOverrides(pro: pro, rig: r),
        );
        await _settle(tester);
        if (prepare != null) await prepare(tester, r);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${width.toInt()}_$tag.png'));
      });
    }
  }
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIcons();
  });
  tearDown(disposeContainers);

  // The Wallet.
  _golden('wallet_play_on', () => const WalletScreen(), height: 1250);
  _golden('wallet_play_off', () => const WalletScreen(), rig: () => BillingRig(on: false), height: 1000);
  _golden('wallet_pro', () => const WalletScreen(), pro: true, height: 1250);

  // The Get Pro sheet's states. The last one is how another screen calls it: a reason line and its own benefit lines.
  _golden(
    'pro_sheet_reason',
    () => const GetProSheetBody(
      reason: 'NTA mode is the exam-day screen, and it comes with Pro.',
      benefits: ['The exam-day screen, as you will meet it.', 'Unlimited mocks.'],
    ),
    padded: true,
    height: 700,
  );
  _golden('pro_sheet_ready', () => const GetProSheetBody(), padded: true, height: 780);
  _golden(
    'pro_sheet_checking',
    () => const GetProSheetBody(),
    padded: true,
    height: 780,
    rig: () => BillingRig(store: FakePlayStore(prices: goldenPrices)..gate = Completer<void>()),
  );
  _golden(
    'pro_sheet_unavailable',
    () => const GetProSheetBody(),
    padded: true,
    height: 780,
    rig: () => BillingRig(store: FakePlayStore(available: false)),
  );
  _golden(
    'pro_sheet_pending',
    () => const GetProSheetBody(),
    padded: true,
    height: 780,
    rig: () => BillingRig(store: FakePlayStore(prices: goldenPrices)),
    prepare: (tester, rig) async {
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.pending));
      await tester.tap(find.text('Get Pro').first);
      await _settle(tester);
    },
  );
  _golden(
    'pro_sheet_failed',
    () => const GetProSheetBody(),
    padded: true,
    height: 820,
    rig: () => BillingRig(store: FakePlayStore(prices: goldenPrices))..verifier.failWith = serverBroken,
    prepare: (tester, rig) async {
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await tester.tap(find.text('Get Pro').first);
      await _settle(tester);
    },
  );
  _golden(
    'pro_sheet_confirmed',
    () => const GetProSheetBody(),
    padded: true,
    height: 420,
    rig: () => BillingRig(store: FakePlayStore(prices: goldenPrices)),
    prepare: (tester, rig) async {
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      // The key sits below this 420 dp picture: bring it into view, or the tap misses and the
      // picture shows the selling sheet instead of "Pro is on".
      await tester.ensureVisible(find.text('Get Pro').first);
      await tester.pump();
      await tester.tap(find.text('Get Pro').first);
      await _settle(tester);
    },
  );
}
