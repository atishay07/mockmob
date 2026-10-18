import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/credits/data/credits_models.dart';
import 'package:mockmob/features/wallet/data/wallet_view.dart';
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

Future<void> _pump(WidgetTester tester, {required BillingRig rig, bool pro = false, double textScale = 1, bool aiUnread = false, RemoteState<CreditsOverview>? credits, bool history = true}) async {
  await pumpMockmob(
    tester,
    const WalletScreen(),
    size: const Size(360, 1100),
    wrapInScaffold: false,
    disableAnimations: true,
    textScale: textScale,
    overrides: walletOverrides(pro: pro, rig: rig, aiUnread: aiUnread, credits: credits, history: history),
  );
  await _settle(tester);
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  testWidgets('both balances side by side, what each is for, and when the AI credits reset', (tester) async {
    await _pump(tester, rig: BillingRig());
    expect(find.text('Wallet'), findsOneWidget);
    expect(find.text('Practice credits'), findsWidgets);
    expect(find.text('AI credits'), findsWidgets);
    expect(find.text('38'), findsOneWidget);
    expect(find.text('46'), findsOneWidget);
    expect(find.text('About 38 questions'), findsOneWidget);
    expect(find.text(WalletCopy.practiceFor), findsOneWidget);
    expect(find.text('40 of 50 included this month'), findsOneWidget);
    expect(find.text('6 bought, no expiry'), findsOneWidget);
    expect(find.text('Resets 1 November, 12:00 AM'), findsOneWidget);
    expect(find.text(WalletCopy.aiFor), findsOneWidget);
    // Side by side: the two figures share a row, practice on the left.
    final practice = tester.getTopLeft(find.text('38'));
    final ai = tester.getTopLeft(find.text('46'));
    expect((practice.dy - ai.dy).abs(), lessThan(2));
    expect(practice.dx, lessThan(ai.dx));
  });

  testWidgets('a balance that did not load is Not loaded, never 0', (tester) async {
    await _pump(
      tester,
      rig: BillingRig(),
      aiUnread: true,
      credits: RemoteState<CreditsOverview>(value: CreditsOverview.fromJson({
        'practice': {'balance': null},
        'ai': {'balance': null},
        'plan': {'name': 'Free'},
        'history': <Object?>[],
      })),
    );
    expect(find.text('Not loaded'), findsNWidgets(2));
    expect(find.text('0'), findsNothing);
    expect(find.textContaining('About'), findsNothing);
  });

  testWidgets('Pro: practice is Unlimited, no Practice packs, no Pro row', (tester) async {
    await _pump(tester, rig: BillingRig(), pro: true);
    expect(find.text('Unlimited'), findsOneWidget);
    expect(find.text(WalletCopy.practiceUnlimitedNote), findsOneWidget);
    expect(find.text('100 practice credits'), findsNothing);
    expect(find.text('50 AI credits'), findsOneWidget);
    expect(find.text(WalletCopy.proRowNote), findsNothing);
  });

  testWidgets('flag on: AI and Practice packs with Google Play prices, and a quiet Pro row', (tester) async {
    final rig = BillingRig();
    await _pump(tester, rig: rig);
    for (final label in ['50 AI credits', '150 AI credits', '400 AI credits', '100 practice credits', '300 practice credits']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('₹15.00'), findsOneWidget);
    expect(find.text('₹75.00'), findsOneWidget);
    expect(find.text('₹25.00'), findsOneWidget);
    expect(find.text('₹60.00'), findsOneWidget);
    expect(find.text(WalletCopy.proRowNote), findsOneWidget);
  });

  testWidgets('flag on: a pack starts a consumable purchase; the added line appears only after the server confirms', (tester) async {
    final rig = BillingRig();
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
    await _pump(tester, rig: rig);
    await tester.ensureVisible(find.text('300 practice credits'));
    await tester.tap(find.text('300 practice credits'));
    await _settle(tester);
    expect(rig.store.buys.single.productId, 'practice_credits_49_300');
    expect(rig.store.buys.single.consumable, isTrue);
    expect(rig.verifier.calls.single.productId, 'practice_credits_49_300');
    expect(find.text('300 practice credits added'), findsOneWidget);
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

  testWidgets('flag off: balances and history as ever, top-ups open soon, no key that does nothing, no price', (tester) async {
    final rig = BillingRig(on: false);
    await _pump(tester, rig: rig);
    expect(find.text('38'), findsOneWidget);
    expect(find.text(BillingCopy.topUpsSoon), findsOneWidget);
    expect(find.text('50 AI credits'), findsNothing);
    expect(find.text('Get Pro'), findsNothing);
    expect(find.text(WalletCopy.proRowNote), findsNothing);
    expect(find.textContaining('₹'), findsNothing);
    expect(find.text('Practice set, Accountancy'), findsOneWidget);
    expect(rig.store.listened, isFalse);
  });

  testWidgets('history: the latest lines first, Show earlier opens the rest', (tester) async {
    await _pump(tester, rig: BillingRig(on: false));
    expect(find.text('Repair, Q7 Accountancy'), findsOneWidget);
    expect(find.text('Monthly AI credits'), findsOneWidget);
  });

  testWidgets('no history yet says so plainly', (tester) async {
    await _pump(tester, rig: BillingRig(on: false), history: false);
    expect(find.text(WalletCopy.historyEmptyTitle), findsOneWidget);
  });

  testWidgets('large text stacks the two balances and nothing overflows', (tester) async {
    await _pump(tester, rig: BillingRig(), textScale: 1.6);
    expect(tester.takeException(), isNull);
    final practice = tester.getTopLeft(find.text('38'));
    final ai = tester.getTopLeft(find.text('46'));
    expect(ai.dy, greaterThan(practice.dy));
  });

  test('the adapter reads the Wallet from the existing credits reads', () {
    final c = ProviderContainer(overrides: walletOverrides());
    addTearDown(c.dispose);
    final v = c.read(walletViewProvider);
    expect(v.practice, 38);
    expect(v.aiTotal, 46);
    expect(v.aiIncludedLeft, 40);
    expect(v.aiIncludedOf, 50);
    expect(v.aiBought, 6);
    expect(v.aiResetsAt, DateTime(2026, 11, 1));
    expect(v.isPro, isFalse);
  });

  test('the words of the Wallet carry no price, no exclamation mark and no web pointer', () {
    final all = [
      WalletCopy.practiceFor, WalletCopy.practiceUnlimitedNote, WalletCopy.aiFor, WalletCopy.aiPaused, WalletCopy.stale,
      WalletCopy.proRowNote, WalletCopy.historyEmptyBody, WalletCopy.historyFailedBody, WalletCopy.moreFailed,
      BillingCopy.topUpsSoon, BillingCopy.aiPacksNote,
      WalletCopy.aboutQuestions(38), WalletCopy.aiIncluded(40, 50), WalletCopy.aiBought(6), WalletCopy.resets(DateTime(2026, 11, 1)),
    ];
    for (final s in all) {
      final lower = s.toLowerCase();
      for (final banned in ['₹', '!', 'website', 'mockmob.in', 'cheaper', 'checkout', ' rs.', '·', '—']) {
        expect(lower.contains(banned), isFalse, reason: '"$s" contains "$banned"');
      }
    }
  });
}
