import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/features/billing/widgets/top_ups.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/json_helpers.dart' show Json;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';
import 'package:mockmob/features/wallet/wallet_copy.dart';
import 'package:mockmob/features/credits/credits_copy.dart';
import 'package:mockmob/features/credits/credits_screen.dart';
import 'package:mockmob/features/wallet/wallet_gate.dart';
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
    // The balance split honestly: this month's free credits with the refill day, and the kept credits.
    expect(find.text(WalletCopy.freePart), findsOneWidget);
    expect(find.text('40 of 50 left. Refills 1 November'), findsOneWidget);
    expect(find.text(WalletCopy.keptPart), findsOneWidget);
    expect(find.text(WalletCopy.keptPartNote), findsOneWidget);
    // What credits buy, as tiles; the first full mock is free only because the server's line says so.
    await tester.scrollUntilVisible(find.text(WalletCopy.costShows), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text(WalletCopy.buysTitle), findsOneWidget);
    expect(find.text(WalletCopy.buyMockFirstFree), findsOneWidget);
    expect(find.text(WalletCopy.costShows), findsOneWidget);
    // No second balance and no pool names.
    expect(find.text('Practice credits'), findsNothing);
  });

  testWidgets('a balance that did not load is Not loaded, never 0', (tester) async {
    await _pump(tester, rig: BillingRig(), read: walletState({'ok': true, 'history': <Object?>[], 'historyState': 'ready'}));
    expect(find.text('Not loaded'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text(WalletCopy.freePart), findsNothing);
  });

  testWidgets('I8: a new account shows 150 as one figure, split into 50 free this month and 100 kept', (tester) async {
    await _pump(tester, rig: BillingRig(), read: walletState(walletBody(freeLeft: 50, held: 100, history: false)));
    expect(find.text('150'), findsWidgets);
    expect(find.text('50 of 50 left. Refills 1 November'), findsOneWidget);
    expect(find.text('100'), findsOneWidget);
    expect(find.text(WalletCopy.keptPartNote), findsOneWidget);
  });

  testWidgets('zero is a real 0 with the low line, never Not loaded', (tester) async {
    await _pump(tester, rig: BillingRig(), read: walletState(walletBody(freeLeft: 0, held: 0)));
    expect(find.text('0'), findsWidgets);
    expect(find.text(WalletCopy.lowNote), findsOneWidget);
    expect(find.text('Not loaded'), findsNothing);
  });

  testWidgets('a balance above the low line says nothing about running low', (tester) async {
    await _pump(tester, rig: BillingRig());
    expect(find.text(WalletCopy.lowNote), findsNothing);
  });

  testWidgets('without the server saying so, no tile says the first full mock is free', (tester) async {
    final body = walletBody();
    (body['credits']! as Map<String, Object?>)['buys'] = '1 credit buys 1 practice question or 1 chat reply. A full mock costs 50 credits.';
    await _pump(tester, rig: BillingRig(), read: walletState(body));
    expect(find.text(WalletCopy.buyMockFirstFree), findsNothing);
  });

  test('the read follows the server nested shape: credits, plan, history and historyState', () {
    final read = WalletRead.fromJson(walletBody());
    expect(read.total, 46);
    expect(read.freeLeft, 40);
    expect(read.freeAllowance, 50);
    expect(read.held, 6);
    expect(read.resetAt, DateTime.utc(2026, 10, 31, 18, 30));
    expect(read.buys, '1 credit buys 1 practice question or 1 chat reply. A full mock costs 50, and your first one in each subject is free. Deeper analysis costs 3. The cost shows before you start.');
    expect(read.planIsPro, isFalse);
    expect(read.history, hasLength(4));
    expect(read.historyUnavailable, isFalse);
    final pro = WalletRead.fromJson(walletBody(pro: true));
    expect(pro.planIsPro, isTrue);
    expect(pro.planUntil, DateTime(2027, 7, 31));
  });

  test('the total is the free credits left plus held when the server sends no total', () {
    Json credits(Map<String, Object?> c) => {'credits': c};
    expect(WalletRead.fromJson(credits({'freeLeft': 12, 'held': 8, 'freeAllowance': 50})).total, 20);
    expect(WalletRead.fromJson(credits({'freeLeft': 12})).total, isNull);
    expect(WalletRead.fromJson(credits({'total': 7, 'freeLeft': 12, 'held': 8})).total, 7);
    // An unreadable balance is null, never 0, and a body with no credits at all reads as nothing known.
    expect(WalletRead.fromJson(credits({'total': null, 'freeLeft': null, 'held': null})).total, isNull);
    expect(WalletRead.fromJson(const {}).total, isNull);
    expect(WalletRead.fromJson(const {}).planIsPro, isNull);
  });

  test('a history the server could not read is unavailable, an empty one is not', () {
    expect(WalletRead.fromJson(walletBody(historyReadable: false)).historyUnavailable, isTrue);
    expect(WalletRead.fromJson(walletBody(historyReadable: false)).history, isEmpty);
    expect(WalletRead.fromJson(walletBody(history: false)).historyUnavailable, isFalse);
    expect(WalletRead.fromJson({'historyState': 'unavailable'}).historyUnavailable, isTrue);
  });

  testWidgets('the balance stays when the history could not be read; only the lines say so', (tester) async {
    await _pump(tester, rig: BillingRig(on: false), read: walletState(walletBody(historyReadable: false)));
    expect(find.text('46'), findsWidgets);
    expect(find.text('40 of 50 left. Refills 1 November'), findsOneWidget);
    expect(find.text(WalletCopy.historyFailedTitle), findsOneWidget);
    expect(find.text('Not loaded'), findsNothing);
  });

  testWidgets('the plan comes from the wallet read: Pro has no Pro bridge and says practice is unlimited', (tester) async {
    await _pump(tester, rig: BillingRig(), read: walletState(walletBody(pro: true)));
    expect(find.text(WalletCopy.proBridgeTitle), findsNothing);
    expect(find.textContaining(WalletCopy.practiceUnlimitedNote), findsOneWidget);
    // Practice and full mocks are included on Pro; the top-up says what it is for, with no equivalence line.
    await tester.scrollUntilVisible(find.text(WalletCopy.costShows), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text(WalletCopy.includedOnPro), findsNWidgets(2));
    expect(find.text(BillingCopy.topUpsTitlePro), findsOneWidget);
    expect(find.text(BillingCopy.topUpsLeadPro(50)), findsOneWidget);
    expect(find.text(BillingCopy.packUse(150)), findsOneWidget);
    expect(find.textContaining('full mocks or'), findsNothing);
    expect(find.textContaining('full mock or'), findsNothing);
  });

  for (final on in [true, false]) {
    testWidgets('the website prices in the read (packs, proOffer) never reach the screen, with Google Play ${on ? 'on' : 'off'}', (tester) async {
      await _pump(tester, rig: BillingRig(on: on));
      for (final web in ['₹10', '₹29', '₹49', '₹99', 'Rs 10', 'Rs 29', 'Rs 49', 'Rs 99', 'mockmob.in', 'checkout']) {
        expect(find.textContaining(web), findsNothing, reason: web);
      }
      // Off: no top-up section at all (no "open soon" promise) and no purchase key of any kind.
      expect(find.text(BillingCopy.topUpsSoon), findsNothing);
      expect(find.text(BillingCopy.topUpsTitleFree), on ? findsOneWidget : findsNothing);
      if (!on) expect(find.text('Get Pro'), findsNothing);
      expect(find.text('Add credits'), findsNothing);
    });
  }

  testWidgets('flag on: one set of packs with Google Play prices, the Pro bridge, no pool rows', (tester) async {
    await _pump(tester, rig: BillingRig());
    expect(find.byType(PackCard), findsNWidgets(3));
    for (final label in ['50', '150', '300']) {
      expect(find.descendant(of: find.byType(PackCard), matching: find.text(label)), findsOneWidget, reason: label);
    }
    // Fixture prices 15, 30 and 75: per credit 0.30, 0.20 and 0.25, so the 150 pack is the best value
    // (33% less a credit than the 50 pack) and the 300 pack saves 16%. Real maths, not the biggest pack.
    final best = tester.widget<PackCard>(find.byType(PackCard).at(1));
    expect(best.best, isTrue);
    expect(best.savePercent, 33);
    expect(tester.widget<PackCard>(find.byType(PackCard).at(2)).best, isFalse);
    expect(tester.widget<PackCard>(find.byType(PackCard).at(2)).savePercent, 16);
    expect(tester.widget<PackCard>(find.byType(PackCard).at(0)).savePercent, isNull);
    expect(find.text(BillingCopy.bestValue), findsOneWidget);
    expect(find.text(BillingCopy.topUpsTitleFree), findsOneWidget);
    expect(find.text(BillingCopy.topUpsLeadFree), findsOneWidget);
    for (final n in [50, 150, 300]) {
      expect(find.text(BillingCopy.packUse(n)), findsOneWidget, reason: '$n');
    }
    expect(find.textContaining('questions'), findsNothing);
    expect(find.text('₹15.00'), findsOneWidget);
    expect(find.text('₹30.00'), findsOneWidget);
    expect(find.text('₹75.00'), findsOneWidget);
    expect(find.text(WalletCopy.proBridgeTitle), findsOneWidget);
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
    final pack300 = find.descendant(of: find.byType(PackCard), matching: find.text('300'));
    await tester.ensureVisible(pack300);
    await tester.tap(pack300);
    await _settle(tester);
    expect(rig.store.buys.single.productId, 'credits_49_300');
    expect(rig.store.buys.single.consumable, isTrue);
    expect(rig.verifier.calls.single.productId, 'credits_49_300');
    expect(find.text('300 credits added'), findsOneWidget);
    expect(rig.refreshes, 1);
    // Before the server's new figure arrives, no balance is named (the old one would be stale).
    expect(find.textContaining('Your balance is now'), findsNothing);
    // The server's new figure arrives: the line says the new balance and the hero shows it.
    final repo = ProviderScope.containerOf(tester.element(find.byType(WalletScreen))).read(walletRepositoryProvider.notifier) as FakeWalletRepo;
    repo.serve(walletState(walletBody(held: 306)));
    await _settle(tester);
    await tester.pump(const Duration(seconds: 2));
    expect(find.text(BillingCopy.balanceNow(346)), findsOneWidget);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 3000));
    await _settle(tester);
    expect(find.text('346'), findsWidgets);
  });

  testWidgets('a pending purchase adds nothing and says Google Play is still processing', (tester) async {
    final rig = BillingRig();
    rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.pending));
    await _pump(tester, rig: rig);
    final pack50 = find.descendant(of: find.byType(PackCard), matching: find.text('50'));
    await tester.ensureVisible(pack50);
    await tester.tap(pack50);
    await _settle(tester);
    expect(find.text(BillingCopy.pending), findsOneWidget);
    expect(find.textContaining('credits added'), findsNothing);
    expect(rig.verifier.calls, isEmpty);
  });

  testWidgets('flag on: the Pro row opens the Pro page', (tester) async {
    await _pump(tester, rig: BillingRig());
    await tester.ensureVisible(find.text(WalletCopy.proBridgeTitle));
    await tester.tap(find.text(WalletCopy.proBridgeTitle));
    await _settle(tester);
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text(BillingCopy.proPageTitle), findsOneWidget);
  });

  testWidgets('Pro: no Pro bridge, practice is unlimited, the packs are still there', (tester) async {
    await _pump(tester, rig: BillingRig(), pro: true, read: walletState(walletBody(pro: true)));
    expect(find.text(WalletCopy.proBridgeTitle), findsNothing);
    expect(find.textContaining(WalletCopy.practiceUnlimitedNote), findsOneWidget);
    expect(find.byType(PackCard), findsNWidgets(3));
  });

  // New contract (final fix pass, 18 Oct): with PLAY_BILLING off the APK sells nothing, so the Wallet draws
  // no top-up section at all; before, a "Top-ups open soon." line promised what the app cannot do yet.
  testWidgets('flag off: balance and history as ever, no top-up section, no key that does nothing, no price', (tester) async {
    final rig = BillingRig(on: false);
    await _pump(tester, rig: rig);
    expect(find.text('46'), findsWidgets);
    expect(find.text(BillingCopy.topUpsSoon), findsNothing);
    expect(find.text(BillingCopy.topUpsTitleFree), findsNothing);
    expect(find.text(BillingCopy.topUpsTitlePro), findsNothing);
    expect(find.byType(PackCard), findsNothing);
    expect(find.text('Get Pro'), findsNothing);
    expect(find.text(WalletCopy.proBridgeTitle), findsNothing);
    expect(find.textContaining('₹'), findsNothing);
    expect(find.text('Practice set, Accountancy'), findsOneWidget);
    expect(rig.store.listened, isFalse);
  });

  testWidgets('history: the latest lines with their time, the change and what is left', (tester) async {
    await _pump(tester, rig: BillingRig(on: false));
    expect(find.text('Ask Mobi reply'), findsOneWidget);
    expect(find.text('Free credits for the month'), findsOneWidget);
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

  group('production without /api/wallet (404 or no network, nothing kept)', () {
    for (final kind in [ApiErrorKind.notFound, ApiErrorKind.network]) {
      testWidgets('${kind.name}: the page quietly becomes the Credits page, with no error and no Not loaded', (tester) async {
        await pumpMockmob(
          tester,
          const WalletOrCreditsScreen(),
          size: const Size(360, 1100),
          wrapInScaffold: false,
          disableAnimations: true,
          overrides: walletOverrides(rig: BillingRig(on: false), read: RemoteState<WalletRead>(error: ApiError(kind: kind, code: kind.name))),
        );
        await _settle(tester);
        expect(find.byType(CreditsScreen), findsOneWidget);
        expect(find.byType(WalletScreen), findsNothing);
        expect(find.text(CreditsCopy.title), findsWidgets);
        expect(find.text('Not loaded'), findsNothing);
        expect(find.text(WalletCopy.historyFailedTitle), findsNothing);
        // With PLAY_BILLING off: no purchase key and no web price.
        expect(find.text(BillingCopy.getCredits), findsNothing);
        expect(find.text(BillingCopy.getPro), findsNothing);
        expect(find.textContaining('₹'), findsNothing);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('a read that works is still the Wallet', (tester) async {
      await pumpMockmob(
        tester,
        const WalletOrCreditsScreen(),
        size: const Size(360, 1100),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: walletOverrides(rig: BillingRig(on: false)),
      );
      await _settle(tester);
      expect(find.byType(WalletScreen), findsOneWidget);
      expect(find.byType(CreditsScreen), findsNothing);
    });
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
      WalletCopy.freePartNote(40, 50, DateTime(2026, 11, 1)), WalletCopy.keptPartNote, WalletCopy.lowNote, WalletCopy.proBridgeTitle,
      WalletCopy.proBridgeBody, WalletCopy.proBridgeKey, WalletCopy.costShows, WalletCopy.buyMockFirstFree, BillingCopy.topUpsLeadPro(50), BillingCopy.topUpsLeadPro(null), BillingCopy.topUpsLeadFree,
      BillingCopy.topUpsTitlePro, BillingCopy.topUpsTitleFree, BillingCopy.packUse(150),
      BillingCopy.bestValue, BillingCopy.savePercent(16), BillingCopy.balanceNow(346),
    ];
    for (final s in all) {
      final lower = s.toLowerCase();
      for (final banned in ['₹', '!', 'website', 'mockmob.in', 'cheaper', 'checkout', ' rs.', '·', '—']) {
        expect(lower.contains(banned), isFalse, reason: '"$s" contains "$banned"');
      }
    }
  });

  group('PackValue: the best value is real maths from Google Play raw prices', () {
    const credits = {'a': 50, 'b': 150, 'c': 300};
    test('15, 45, 75: the 300 pack is best and saves 16% (rounded down)', () {
      final v = PackValue.of({'a': 15, 'b': 45, 'c': 75}, credits);
      expect(v.bestId, 'c');
      expect(v.savePercent, {'c': 16});
    });
    test('10, 29, 49: the 300 pack is best; each saving rounds down', () {
      final v = PackValue.of({'a': 10, 'b': 29, 'c': 49}, credits);
      expect(v.bestId, 'c');
      expect(v.savePercent, {'b': 3, 'c': 18});
    });
    test('equal price a credit marks nothing', () {
      final v = PackValue.of({'a': 10, 'b': 30, 'c': 60}, credits);
      expect(v.bestId, isNull);
      expect(v.savePercent, isEmpty);
    });
    test('a tie for cheapest goes to the bigger pack', () {
      final v = PackValue.of({'a': 15, 'b': 30, 'c': 60}, credits);
      expect(v.bestId, 'c');
      expect(v.savePercent, {'b': 33, 'c': 33});
    });
    test('missing or zero prices are left out; one price alone marks nothing', () {
      expect(PackValue.of({'a': 15, 'b': 0}, credits).bestId, isNull);
      expect(PackValue.of(const {}, credits).bestId, isNull);
    });
  });
}
