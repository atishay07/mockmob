import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';
import 'package:mockmob/features/wallet/wallet_copy.dart';
import 'package:mockmob/features/wallet/wallet_screen.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import 'wallet_test_support.dart';

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 60));
  }
}

Future<void> _pump(WidgetTester tester, {required BillingRig rig, bool pro = false, double textScale = 1, RemoteState<WalletRead>? read}) async {
  await pumpMockmob(
    tester,
    const WalletScreen(),
    size: const Size(360, 1100),
    wrapInScaffold: false,
    disableAnimations: true,
    textScale: textScale,
    overrides: walletOverrides(pro: pro, rig: rig, read: read),
  );
  await _settle(tester);
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  testWidgets('one Credits number, what a credit buys, the free allowance with its reset, and what is held', (tester) async {
    await _pump(tester, rig: BillingRig());
    expect(find.text('Wallet'), findsOneWidget);
    expect(find.text('Credits'), findsOneWidget);
    expect(find.text('46'), findsWidgets);
    expect(find.text('1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.'), findsOneWidget);
    expect(find.text('40 of 50 free credits left this month'), findsOneWidget);
    expect(find.text('Free credits reset 1 November, 12:00 AM'), findsOneWidget);
    expect(find.text('6 held credits. Held credits do not expire.'), findsOneWidget);
    // No second balance and no pool names.
    expect(find.text('Practice credits'), findsNothing);
    expect(find.text('AI credits'), findsNothing);
  });

  testWidgets('a balance that did not load is Not loaded, never 0', (tester) async {
    await _pump(tester, rig: BillingRig(), read: walletState({'history': <Object?>[]}));
    expect(find.text('Not loaded'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.textContaining('free credits left'), findsNothing);
  });

  test('the total is the free credits left plus held when the server sends no total', () {
    expect(WalletRead.fromJson({'freeLeft': 12, 'held': 8, 'freeAllowance': 50}).total, 20);
    expect(WalletRead.fromJson({'freeLeft': 12}).total, isNull);
    expect(WalletRead.fromJson({'total': 7, 'freeLeft': 12, 'held': 8}).total, 7);
  });

  testWidgets('flag on: one set of packs with Google Play prices, a quiet Pro row, no pool rows', (tester) async {
    await _pump(tester, rig: BillingRig());
    for (final label in ['50 credits', '150 credits', '300 credits']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('₹15.00'), findsOneWidget);
    expect(find.text('₹30.00'), findsOneWidget);
    expect(find.text('₹75.00'), findsOneWidget);
    expect(find.text(WalletCopy.proRowNote), findsOneWidget);
    expect(find.textContaining('AI credits'), findsNothing);
    expect(find.textContaining('practice credits'), findsNothing);
    // The website's own prices in the read are never shown.
    expect(find.text('₹29'), findsNothing);
    expect(find.text('29'), findsNothing);
  });

  testWidgets('flag on: a pack starts a consumable purchase; the added line appears only after the server confirms', (tester) async {
    final rig = BillingRig();
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
    await _pump(tester, rig: rig);
    await tester.ensureVisible(find.text('300 credits'));
    await tester.tap(find.text('300 credits'));
    await _settle(tester);
    expect(rig.store.buys.single.productId, 'credits_49_300');
    expect(rig.store.buys.single.consumable, isTrue);
    expect(rig.verifier.calls.single.productId, 'credits_49_300');
    expect(find.text('300 credits added'), findsOneWidget);
    expect(rig.refreshes, 1);
  });

  testWidgets('flag on: the Pro row opens the Get Pro sheet', (tester) async {
    await _pump(tester, rig: BillingRig());
    await tester.ensureVisible(find.text(WalletCopy.proRowNote));
    await tester.tap(find.text(WalletCopy.proRowNote));
    await _settle(tester);
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Pro includes'), findsOneWidget);
  });

  testWidgets('Pro: no Pro row, practice is unlimited, the packs are still there', (tester) async {
    await _pump(tester, rig: BillingRig(), pro: true);
    expect(find.text(WalletCopy.proRowNote), findsNothing);
    expect(find.text(WalletCopy.practiceUnlimitedNote), findsOneWidget);
    expect(find.text('50 credits'), findsOneWidget);
  });

  testWidgets('flag off: balance and history as ever, top-ups open soon, no key that does nothing, no price', (tester) async {
    final rig = BillingRig(on: false);
    await _pump(tester, rig: rig);
    expect(find.text('46'), findsWidgets);
    expect(find.text(BillingCopy.topUpsSoon), findsOneWidget);
    expect(find.text('50 credits'), findsNothing);
    expect(find.text('Get Pro'), findsNothing);
    expect(find.text(WalletCopy.proRowNote), findsNothing);
    expect(find.textContaining('₹'), findsNothing);
    expect(find.text('Practice set, Accountancy'), findsOneWidget);
    expect(rig.store.listened, isFalse);
  });

  testWidgets('history: the latest lines with their time, the change and what is left', (tester) async {
    await _pump(tester, rig: BillingRig(on: false));
    expect(find.text('Ask Mobi reply'), findsOneWidget);
    expect(find.text('Monthly free credits'), findsOneWidget);
    expect(find.text('−10'), findsOneWidget);
    expect(find.text('46 left'), findsOneWidget);
    expect(find.text('+50'), findsOneWidget);
  });

  testWidgets('no history yet says so plainly', (tester) async {
    await _pump(tester, rig: BillingRig(on: false), read: walletState(walletBody(history: false)));
    expect(find.text(WalletCopy.historyEmptyTitle), findsOneWidget);
  });

  testWidgets('a read that failed offers Try again and never shows a zero', (tester) async {
    await _pump(
      tester,
      rig: BillingRig(on: false),
      read: const RemoteState<WalletRead>(error: ApiError(kind: ApiErrorKind.network, code: 'network')),
    );
    expect(find.text(WalletCopy.historyFailedTitle), findsOneWidget);
    expect(find.text('Not loaded'), findsOneWidget);
    expect(find.text(WalletCopy.tryAgain), findsWidgets);
  });

  testWidgets('large text: nothing overflows', (tester) async {
    await _pump(tester, rig: BillingRig(), textScale: 1.6);
    expect(tester.takeException(), isNull);
  });

  test('the words of the Wallet carry no price, no exclamation mark and no web pointer', () {
    final all = [
      WalletCopy.creditsFor, WalletCopy.practiceUnlimitedNote, WalletCopy.heldNote, WalletCopy.stale, WalletCopy.proRowNote,
      WalletCopy.historyEmptyBody, WalletCopy.historyFailedBody, BillingCopy.topUpsSoon, BillingCopy.topUpsNote,
      WalletCopy.freeLeft(40, 50), WalletCopy.held(6), WalletCopy.resets(DateTime(2026, 11, 1)),
    ];
    for (final s in all) {
      final lower = s.toLowerCase();
      for (final banned in ['₹', '!', 'website', 'mockmob.in', 'cheaper', 'checkout', ' rs.', '·', '—']) {
        expect(lower.contains(banned), isFalse, reason: '"$s" contains "$banned"');
      }
    }
  });
}
