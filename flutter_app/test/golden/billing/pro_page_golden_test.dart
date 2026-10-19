// Goldens for the full-screen Pro page (owner I6, 20 Oct 2026) at 360 by 800 and 412 by 915, Night
// and Day, in every state it has today, plus the whole scrolling page at 360 and the open and
// confirm motion as frame sequences. Prices are Google Play fixture strings; the app writes none.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/core/models/auth_me.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/widgets/pro_page.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/you/you_test_support.dart';
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

/// The body font has no rupee sign (Android draws it from the system font): "Rs" stands in.
final Map<String, String> _prices = {
  PlayProducts.proId: 'Rs 149.00',
  'credits_10_50': 'Rs 15.00',
  'credits_29_150': 'Rs 45.00',
  'credits_49_300': 'Rs 75.00',
};

final DateTime _paidTo = DateTime(2026, 11, 19, 15);

typedef _Prepare = Future<void> Function(WidgetTester tester, BillingRig rig);

Future<void> _settle(WidgetTester tester, {int rounds = 8}) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 80));
  }
}

BillingRig _rig({PlaySubscriptionInfo? sub, FakePlayStore? store}) => BillingRig(store: store ?? FakePlayStore(prices: _prices), subscription: sub);

Future<BillingRig> _pump(
  WidgetTester tester, {
  required Brightness brightness,
  required Size size,
  BillingRig Function()? rig,
  bool pro = false,
  ProPageArgs args = const ProPageArgs(),
  bool animate = false,
}) async {
  final r = (rig ?? _rig)();
  await pumpMockmob(
    tester,
    ProPage(args: args),
    brightness: brightness,
    size: size,
    wrapInScaffold: false,
    disableAnimations: !animate,
    overrides: [...youOverrides(credits: creditsState(pro: pro, proUntil: pro ? '2026-11-19' : null)), ...r.overrides],
  );
  return r;
}

void _golden(String name, {BillingRig Function()? rig, bool pro = false, ProPageArgs args = const ProPageArgs(), _Prepare? prepare, List<Size>? sizes}) {
  for (final size in sizes ?? const [Size(360, 800), Size(412, 915)]) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      final file = 'pro_page_${name}_${size.width.toInt()}x${size.height.toInt()}_$tag';
      testWidgets(file, (tester) async {
        final r = await _pump(tester, brightness: brightness, size: size, rig: rig, pro: pro, args: args);
        await _settle(tester);
        if (prepare != null) await prepare(tester, r);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
      });
    }
  }
}

Future<void> _buy(WidgetTester tester, BillingRig rig, void Function(ProductDetails p) onBuy) async {
  rig.store.onBuy = onBuy;
  await tester.tap(find.text('Get Pro').last);
  await _settle(tester);
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  // Selling.
  _golden('ready');
  _golden('full', sizes: const [Size(360, 2500)]);
  _golden(
    'reason',
    args: ProPageArgs(
      headline: 'Sit the exam before the exam',
      lede: 'Rehearse on the exam-day screen, against the clock, as many times as you want.',
      personal: (_) => const ['You have sat 3 full mocks. With Pro, sit as many as it takes.'],
      personalHeading: 'Built around your prep',
    ),
    sizes: const [Size(360, 1100)],
  );
  _golden('checking', rig: () => _rig(store: FakePlayStore(prices: _prices)..gate = Completer<void>()), sizes: const [Size(360, 2500)]);
  _golden('unavailable', rig: () => _rig(store: FakePlayStore(available: false)), sizes: const [Size(360, 2500)]);
  _golden('pending', prepare: (tester, rig) => _buy(tester, rig, (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.pending))));
  _golden('verify_failed', rig: () => _rig()..verifier.failWith = serverBroken, prepare: (tester, rig) => _buy(tester, rig, (p) => rig.store.emit(purchase(p.id))));

  // Pro is on.
  _golden('just_confirmed', prepare: (tester, rig) async {
    await _buy(tester, rig, (p) => rig.store.emit(purchase(p.id)));
    await _settle(tester, rounds: 6);
  });
  _golden('renewing', pro: true, rig: () => _rig(sub: playSub(expiresAt: _paidTo)));
  _golden('renewal_off', pro: true, rig: () => _rig(sub: playSub(state: 'canceled', autoRenewing: false, expiresAt: _paidTo)));

  // Fixed in Google Play.
  _golden('grace', pro: true, rig: () => _rig(sub: playSub(state: 'in_grace_period', grace: true, expiresAt: _paidTo)));
  _golden('on_hold', rig: () => _rig(sub: playSub(state: 'on_hold', active: false, hold: true)));

  // Motion: the open (rise, stagger, the lamp light across the hero) and the confirm (the seal
  // pressing down, the ring, the light across the new seal), at fixed steps.
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('pro_page_motion_open_$tag', (tester) async {
      await _pump(tester, brightness: brightness, size: const Size(360, 800), animate: true);
      const steps = [0, 120, 240, 400, 600, 900, 1300, 1900];
      for (final (i, ms) in steps.indexed) {
        if (i > 0) await tester.pump(Duration(milliseconds: ms - steps[i - 1]));
        if (i == 1) await tester.runAsync(() => Future<void>.delayed(Duration.zero));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/motion/pro_page_open_${tag}_${ms.toString().padLeft(4, '0')}.png'));
      }
      await tester.pump(const Duration(seconds: 3));
    });
    testWidgets('pro_page_motion_confirm_$tag', (tester) async {
      final rig = await _pump(tester, brightness: brightness, size: const Size(360, 800), animate: true);
      await tester.pump(const Duration(seconds: 3));
      await tester.runAsync(() => Future<void>.delayed(Duration.zero));
      await tester.pump(const Duration(milliseconds: 100));
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await tester.tap(find.text('Get Pro').last);
      for (var i = 0; i < 4; i++) {
        await tester.runAsync(() => Future<void>.delayed(Duration.zero));
        await tester.pump(const Duration(milliseconds: 16));
      }
      const steps = [0, 150, 300, 500, 750, 1100, 1500];
      for (final (i, ms) in steps.indexed) {
        if (i > 0) await tester.pump(Duration(milliseconds: ms - steps[i - 1]));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/motion/pro_page_confirm_${tag}_${ms.toString().padLeft(4, '0')}.png'));
      }
      await tester.pump(const Duration(seconds: 3));
    });
  }
}
