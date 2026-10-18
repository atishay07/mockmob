import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/billing/billing.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/widgets/get_pro_sheet.dart';
import 'package:mockmob/features/credits/data/credits_models.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../you/you_test_support.dart';
import 'billing_test_support.dart';

Widget _sheet() => const SingleChildScrollView(padding: EdgeInsets.all(20), child: GetProSheetBody());

Future<ProviderContainer> _pump(WidgetTester tester, BillingRig rig, {Widget? child, Brightness brightness = Brightness.light, Size size = kGoldenSize, bool free = true}) async {
  await pumpMockmob(
    tester,
    child ?? _sheet(),
    brightness: brightness,
    size: size,
    overrides: [
      ...youOverrides(credits: creditsState(pro: !free, proUntil: free ? null : '2027-07-31')),
      ...rig.overrides,
    ],
    disableAnimations: true,
  );
  await tester.pump();
  return ProviderScope.containerOf(tester.element(find.byType(Scaffold).first));
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 60));
  }
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  testWidgets('shows what Pro includes, the price Google Play returned, one key and Restore purchases', (tester) async {
    final rig = BillingRig();
    await _pump(tester, rig);
    await _settle(tester);
    expect(find.text('₹149.00'), findsOneWidget);
    expect(find.textContaining('One payment for the CUET 2027 cycle'), findsOneWidget);
    expect(find.text('Pro includes'), findsOneWidget);
    for (final line in BillingCopy.proIncludes) {
      expect(find.text(line), findsOneWidget);
    }
    expect(find.text('Get Pro'), findsWidgets);
    expect(find.text('Restore purchases'), findsWidgets);
    expect(find.text('Payment is handled by Google Play.'), findsOneWidget);
  });

  testWidgets('the price on screen is whatever Google Play returns, not a number from the app', (tester) async {
    final rig = BillingRig(store: FakePlayStore(prices: {...fixturePrices(), PlayProducts.proId: 'Rs 1,234.50'}));
    await _pump(tester, rig);
    await _settle(tester);
    expect(find.text('Rs 1,234.50'), findsOneWidget);
    expect(find.text('₹149.00'), findsNothing);
  });

  testWidgets('checking Google Play: no price yet, the key cannot be pressed', (tester) async {
    final store = FakePlayStore()..gate = Completer<void>();
    final rig = BillingRig(store: store);
    await _pump(tester, rig);
    await _settle(tester);
    expect(find.text('Checking Google Play'), findsWidgets);
    expect(find.text('₹149.00'), findsNothing);
    await tester.tap(find.text('Get Pro').first, warnIfMissed: false);
    await _settle(tester);
    expect(rig.store.buys, isEmpty);
    store.gate!.complete();
    await _settle(tester);
    expect(find.text('₹149.00'), findsOneWidget);
  });

  testWidgets('Google Play not on this phone: says so, no price, a way to try again', (tester) async {
    final rig = BillingRig(store: FakePlayStore(available: false));
    await _pump(tester, rig);
    await _settle(tester);
    expect(find.text(BillingCopy.storeUnavailable), findsOneWidget);
    expect(find.textContaining('₹'), findsNothing);
    expect(find.text('Try again'), findsWidgets);
  });

  testWidgets('the product is missing from Google Play: says so and nothing can be bought', (tester) async {
    final rig = BillingRig(store: FakePlayStore()..missing = {PlayProducts.proId});
    await _pump(tester, rig);
    await _settle(tester);
    expect(find.text(BillingCopy.productUnavailable), findsOneWidget);
    await tester.tap(find.text('Get Pro').first, warnIfMissed: false);
    await _settle(tester);
    expect(rig.store.buys, isEmpty);
  });

  testWidgets('Google Play cannot be reached: nothing was charged, try again', (tester) async {
    final rig = BillingRig(store: FakePlayStore()..queryError = true);
    await _pump(tester, rig);
    await _settle(tester);
    expect(find.text(BillingCopy.storeUnreachable), findsOneWidget);
  });

  testWidgets('pending: says the payment is still processing and that nothing is added yet', (tester) async {
    final rig = BillingRig();
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.pending));
    await _pump(tester, rig);
    await _settle(tester);
    await tester.tap(find.text('Get Pro').first);
    await _settle(tester);
    expect(find.text(BillingCopy.pending), findsOneWidget);
    expect(find.text('Pro is on'), findsNothing);
    expect(rig.verifier.calls, isEmpty);
  });

  testWidgets('the server is checking: "Pro is on" is not said until it answers', (tester) async {
    final rig = BillingRig();
    rig.verifier.gate = Completer<void>();
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
    await _pump(tester, rig);
    await _settle(tester);
    await tester.tap(find.text('Get Pro').first);
    await _settle(tester);
    expect(find.text(BillingCopy.verifying), findsOneWidget);
    expect(find.text('Pro is on'), findsNothing);
    expect(rig.store.finished, isEmpty);

    rig.verifier.gate!.complete();
    await _settle(tester);
    expect(find.text('Pro is on'), findsOneWidget);
    expect(find.text('Done'), findsWidgets);
    expect(rig.store.finished, hasLength(1));
    expect(rig.refreshes, 1);
  });

  testWidgets('cancelled: says no payment was made and the sheet stays usable', (tester) async {
    final rig = BillingRig();
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.canceled));
    await _pump(tester, rig);
    await _settle(tester);
    await tester.tap(find.text('Get Pro').first);
    await _settle(tester);
    expect(find.text(BillingCopy.cancelled), findsOneWidget);
    expect(find.text('Get Pro'), findsWidgets);
    expect(find.text('Pro is on'), findsNothing);
  });

  testWidgets('the server cannot confirm: the failure says the payment went through and offers Try again, which succeeds', (tester) async {
    final rig = BillingRig();
    rig.verifier.failWith = serverBroken;
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
    await _pump(tester, rig);
    await _settle(tester);
    await tester.tap(find.text('Get Pro').first);
    await _settle(tester);
    expect(find.text(BillingCopy.failCouldNotConfirm), findsOneWidget);
    expect(find.text('Pro is on'), findsNothing);
    expect(rig.store.finished, isEmpty);

    rig.verifier.failWith = null;
    await tester.tap(find.text('Try again').first);
    await _settle(tester);
    expect(find.text('Pro is on'), findsOneWidget);
    expect(rig.store.finished, hasLength(1));
  });

  testWidgets('restore: nothing owned says so; owned Pro is confirmed by the server first', (tester) async {
    final rig = BillingRig();
    await _pump(tester, rig);
    await _settle(tester);
    await tester.tap(find.text('Restore purchases').first);
    await _settle(tester);
    expect(find.text(BillingCopy.nothingToRestore), findsOneWidget);

    rig.store.owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)];
    await tester.tap(find.text('Restore purchases').first);
    await _settle(tester);
    expect(rig.verifier.calls, hasLength(1));
    expect(find.text('Pro is on'), findsOneWidget);
  });

  testWidgets('a student who is already Pro sees that, not a price', (tester) async {
    final rig = BillingRig();
    await _pump(tester, rig, free: false);
    await _settle(tester);
    expect(find.text('Pro is on'), findsOneWidget);
    expect(find.textContaining('₹'), findsNothing);
    expect(find.text('Restore purchases'), findsNothing);
  });

  testWidgets('every key has a 48 dp target: the primary key is drawn at 48, the quiet link at 40 inside a 48 dp hit box', (tester) async {
    final rig = BillingRig();
    await _pump(tester, rig);
    await _settle(tester);
    final primary = tester.getSize(find.ancestor(of: find.text('Get Pro').first, matching: find.byType(KeyButton)).first);
    expect(primary.height, greaterThanOrEqualTo(48));
    final link = find.ancestor(of: find.text('Restore purchases').first, matching: find.byType(KeyButton)).first;
    expect(tester.getSize(link).height, greaterThanOrEqualTo(40));
    final handle = tester.ensureSemantics();
    expect(tester.getSemantics(find.bySemanticsLabel('Restore purchases')).rect.height, greaterThanOrEqualTo(48));
    handle.dispose();
  });

  testWidgets('the words never name the website, a cheaper price or the web checkout', (tester) async {
    final all = [
      ...BillingCopy.proIncludes,
      BillingCopy.proTerms, BillingCopy.googlePlayNote, BillingCopy.pending, BillingCopy.verifying, BillingCopy.cancelled,
      BillingCopy.failStore, BillingCopy.failCouldNotConfirm, BillingCopy.failOffline, BillingCopy.failNotOpenYet,
      BillingCopy.proOnBody, BillingCopy.creditsAddedBody, BillingCopy.aiPacksNote, BillingCopy.storeUnavailable,
      BillingCopy.storeUnreachable, BillingCopy.productUnavailable, BillingCopy.nothingToRestore,
    ];
    for (final s in all) {
      final lower = s.toLowerCase();
      for (final banned in ['website', 'web ', 'mockmob.in', 'cheaper', 'checkout', 'pricing', 'discount', 'save ', '!', '₹', ' rs.', ' rs ', ' inr']) {
        expect(lower.contains(banned), isFalse, reason: '"$s" contains "$banned"');
      }
    }
  });

  group('flag off', () {
    testWidgets('the Get Pro sheet does not open and the entries draw nothing', (tester) async {
      final rig = BillingRig(on: false);
      await _pump(
        tester,
        rig,
        child: Builder(
          builder: (context) => Column(
            children: [
              const GetProEntry.key(topGap: 12),
              const GetProEntry.quiet(),
              const WalletTopUpEntry(),
              TextButton(onPressed: () => showGetProSheet(context), child: const Text('open')),
            ],
          ),
        ),
      );
      expect(find.text('Get Pro'), findsNothing);
      expect(find.text(BillingCopy.getCredits), findsNothing);
      await tester.tap(find.text('open'));
      await _settle(tester);
      expect(find.text('Pro includes'), findsNothing);
      expect(find.text('Restore purchases'), findsNothing);
      expect(rig.store.listened, isFalse);
    });
  });

  group('flag on, entries', () {
    testWidgets('Get Pro shows for a Free student and opens the sheet; a Pro student sees none', (tester) async {
      final rig = BillingRig();
      await _pump(
        tester,
        rig,
        child: Builder(builder: (context) => const Column(children: [GetProEntry.key()])),
      );
      expect(find.text('Get Pro'), findsWidgets);
      await tester.tap(find.text('Get Pro').first);
      await _settle(tester);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Pro includes'), findsOneWidget);
    });

    testWidgets('a Pro student sees no Get Pro entry', (tester) async {
      final rig = BillingRig();
      await _pump(tester, rig, free: false, child: const Column(children: [GetProEntry.key()]));
      await _settle(tester);
      expect(find.text('Get Pro'), findsNothing);
    });
  });
}
