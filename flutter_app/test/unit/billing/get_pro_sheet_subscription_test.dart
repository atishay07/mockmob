// The Get Pro sheet for the monthly subscription (owner D135/D136, 19 Oct 2026): Google Play's price
// with "a month", the renewal line, what a subscriber sees (renewing, renewal off, a payment being
// retried) with Manage subscription, and the states fixed in Google Play (on hold, paused).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/auth_me.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, KeyVariant;
import 'package:mockmob/features/billing/billing.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/widgets/get_pro_sheet.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../you/you_test_support.dart';
import 'billing_test_support.dart';

Widget _sheet() => const SingleChildScrollView(padding: EdgeInsets.all(20), child: GetProSheetBody());

Future<ProviderContainer> _pump(WidgetTester tester, BillingRig rig, {bool free = true}) async {
  await pumpMockmob(
    tester,
    _sheet(),
    size: kGoldenSize,
    overrides: [
      ...youOverrides(credits: creditsState(pro: !free, proUntil: free ? null : '2026-11-19')),
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

KeyButton _key(WidgetTester tester, String label) => tester.widget<KeyButton>(find.widgetWithText(KeyButton, label));

ApiError _play(int status, String code) => ApiError.fromResponse(status, {'ok': false, 'error': 'x', 'code': code});

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('the words', () {
    test('the price is Google Play\'s own string with its period; nothing in the copy carries a price', () {
      expect(BillingCopy.pricePer('₹149.00', BillingCopy.periodWords('P1M')), '₹149.00 a month');
      expect(BillingCopy.periodWords(null), 'a month', reason: 'the base plan is monthly');
      expect(BillingCopy.periodWords('P1Y'), 'a year');
      expect(BillingCopy.periodWords('P2W'), isNull, reason: 'an unknown period says nothing rather than something wrong');
      expect(BillingCopy.proTerms, 'Renews every month. Cancel anytime in Google Play.');
      for (final line in [
        BillingCopy.proTerms,
        BillingCopy.subRenews('19 November'),
        BillingCopy.subRenewsNoDate,
        BillingCopy.subRenewalOff('19 November'),
        BillingCopy.subGrace('19 November'),
        BillingCopy.subOnHold,
        BillingCopy.subPaused,
        BillingCopy.subEnded,
        BillingCopy.manageOpenFailed,
      ]) {
        expect(line, isNot(contains('₹')), reason: line);
        expect(line, isNot(contains('99')), reason: 'never the web price');
        expect(line.toLowerCase(), isNot(contains('website')));
        expect(line, isNot(contains('!')));
      }
    });

    test('the subscriber line follows Google Play\'s state', () {
      final date = DateTime(2026, 11, 19, 15);
      expect(subscriptionLine(playSub(expiresAt: date)), BillingCopy.subRenews('19 November'));
      expect(subscriptionLine(playSub(state: 'canceled', autoRenewing: false, expiresAt: date)), BillingCopy.subRenewalOff('19 November'));
      expect(subscriptionLine(playSub(state: 'in_grace_period', grace: true, expiresAt: date)), BillingCopy.subGrace('19 November'));
      expect(subscriptionLine(const PlaySubscriptionInfo(productId: 'pro_monthly', state: 'active', active: true)), BillingCopy.subRenewsNoDate);
      // No date from the server: never "renews every month" when renewal is off or a payment failed.
      expect(subscriptionLine(const PlaySubscriptionInfo(productId: 'pro_monthly', state: 'canceled', active: true, autoRenewing: false)), BillingCopy.subRenewalOffNoDate);
      expect(subscriptionLine(const PlaySubscriptionInfo(productId: 'pro_monthly', state: 'in_grace_period', active: true, inGracePeriod: true)), BillingCopy.subGraceNoDate);
    });

    test('the server\'s subscription block is read, and nothing else is', () {
      final info = PlaySubscriptionInfo.fromJson({
        'productId': 'pro_monthly', 'state': 'canceled', 'active': true, 'autoRenewing': false,
        'expiresAt': '2026-11-19T10:00:00.000Z', 'inGracePeriod': false, 'onHold': false,
      })!;
      expect(info.renewalOff, isTrue);
      expect(info.expiresAt, DateTime.utc(2026, 11, 19, 10));
      expect(PlaySubscriptionInfo.fromJson(info.toJson()), info, reason: 'kept on the phone and read back the same');
      expect(PlaySubscriptionInfo.fromJson(null), isNull);
      expect(PlaySubscriptionInfo.fromJson({'state': 'active'}), isNull, reason: 'no product, no subscription');
      final me = AuthMe.fromJson({'user': {'id': 'u1', 'playSubscription': info.toJson()}, 'needsOnboarding': false});
      expect(me.user!.playSubscription, info);
      expect(AuthMe.fromJson({'user': {'id': 'u1'}}).user!.playSubscription, isNull, reason: 'an older server: no subscription');
    });
  });

  group('a Free student', () {
    testWidgets('sees the monthly price Google Play returned, the renewal line, and subscribes to pro_monthly', (tester) async {
      final rig = BillingRig();
      final c = await _pump(tester, rig);
      await _settle(tester);
      expect(find.text('₹149.00 a month'), findsOneWidget);
      expect(find.text('Renews every month. Cancel anytime in Google Play.'), findsOneWidget);
      expect(find.text(BillingCopy.manageSubscription), findsNothing);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await tester.tap(find.widgetWithText(KeyButton, 'Get Pro').first);
      await _settle(tester);
      expect(rig.store.buys.single.productId, 'pro_monthly');
      expect(rig.store.buys.single.consumable, isFalse);
      expect(rig.verifier.calls.single.productId, 'pro_monthly');
      expect(c.read(playBillingProvider).stage, BillingStage.confirmed);
      expect(find.text('Pro is on'), findsOneWidget, reason: 'Pro unlocks the moment the server confirms');
      expect(rig.refreshes, 1, reason: 'the plan and every Pro gate are read again at once');
    });

    testWidgets('a subscription on hold says what happened and offers Manage subscription, not a second subscription', (tester) async {
      final rig = BillingRig(subscription: playSub(state: 'on_hold', active: false, hold: true));
      await _pump(tester, rig);
      await _settle(tester);
      expect(find.text(BillingCopy.subOnHold), findsOneWidget);
      expect(find.text(BillingCopy.subOnHoldTitle), findsOneWidget, reason: 'its own plain heading');
      expect(find.text('Get Pro'), findsNothing);
      expect(_key(tester, BillingCopy.manageSubscription).variant, KeyVariant.primary);
      expect(_key(tester, BillingCopy.close).variant, KeyVariant.quiet, reason: 'a visible way out');
      await tester.tap(find.text(BillingCopy.manageSubscription));
      await _settle(tester);
      expect(rig.manageOpened, 1);
      expect(find.text(BillingCopy.manageOpenFailed), findsNothing);
    });

    testWidgets('the sheet opened for a subscription on hold has no sales title, and Close leaves it', (tester) async {
      final rig = BillingRig(subscription: playSub(state: 'on_hold', active: false, hold: true));
      await pumpMockmob(
        tester,
        Builder(builder: (context) => Center(child: TextButton(onPressed: () => showGetProSheet(context), child: const Text('open')))),
        size: kGoldenSize,
        overrides: [...youOverrides(credits: creditsState()), ...rig.overrides],
        disableAnimations: true,
      );
      await _settle(tester);
      await tester.tap(find.text('open'));
      await _settle(tester);
      expect(find.text(BillingCopy.subOnHoldTitle), findsOneWidget);
      expect(find.text(BillingCopy.proTitle), findsNothing, reason: 'no "Get Pro" above a payment problem');
      await tester.tap(find.text(BillingCopy.close));
      await _settle(tester);
      expect(find.text(BillingCopy.subOnHoldTitle), findsNothing);
    });

    testWidgets('a paused subscription says so; when Google Play does not open, the sheet says how to get there', (tester) async {
      final rig = BillingRig(subscription: playSub(state: 'paused', active: false), manageOpens: false);
      await _pump(tester, rig);
      await _settle(tester);
      expect(find.text(BillingCopy.subPaused), findsOneWidget);
      await tester.tap(find.text(BillingCopy.manageSubscription));
      await _settle(tester);
      expect(find.text(BillingCopy.manageOpenFailed), findsOneWidget);
    });

    testWidgets('an ended subscription leaves the ordinary sheet: subscribe again', (tester) async {
      final rig = BillingRig(subscription: playSub(state: 'expired', active: false, autoRenewing: false));
      await _pump(tester, rig);
      await _settle(tester);
      expect(find.text('₹149.00 a month'), findsOneWidget);
      expect(find.text('Get Pro'), findsWidgets);
    });

    testWidgets('verify answers on hold mid-purchase: the notice offers Manage subscription instead of Try again', (tester) async {
      final rig = BillingRig();
      rig.verifier.failWith = _play(409, 'subscription_on_hold');
      await _pump(tester, rig);
      await _settle(tester);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await tester.tap(find.widgetWithText(KeyButton, 'Get Pro').first);
      await _settle(tester);
      expect(find.text(BillingCopy.subOnHold), findsOneWidget);
      expect(find.text(BillingCopy.tryAgain), findsNothing);
      await tester.tap(find.text(BillingCopy.manageSubscription));
      await _settle(tester);
      expect(rig.manageOpened, 1);
      expect(rig.refreshes, 1, reason: 'the plan is read again so every screen says Pro is paused');
    });
  });

  group('a Pro subscriber', () {
    testWidgets('renewing: Pro is on, when it renews, and Manage subscription opens Google Play', (tester) async {
      final rig = BillingRig(subscription: playSub(expiresAt: DateTime(2026, 11, 19, 15)));
      await _pump(tester, rig, free: false);
      await _settle(tester);
      expect(find.text('Pro is on'), findsOneWidget);
      expect(find.text(BillingCopy.subRenews('19 November')), findsOneWidget);
      expect(find.text('Get Pro'), findsNothing, reason: 'already subscribed: nothing to buy twice');
      await tester.tap(find.text(BillingCopy.manageSubscription));
      await _settle(tester);
      expect(rig.manageOpened, 1);
    });

    testWidgets('cancelled but still active: Pro stays on until the paid date, and nothing more is charged', (tester) async {
      final rig = BillingRig(subscription: playSub(state: 'canceled', autoRenewing: false, expiresAt: DateTime(2026, 11, 19, 15)));
      await _pump(tester, rig, free: false);
      await _settle(tester);
      expect(find.text(BillingCopy.subRenewalOff('19 November')), findsOneWidget);
      expect(find.text(BillingCopy.manageSubscription), findsOneWidget);
    });

    testWidgets('in a grace period: a warning that asks the student to act, with Manage subscription as the main key', (tester) async {
      final rig = BillingRig(subscription: playSub(state: 'in_grace_period', grace: true, expiresAt: DateTime(2026, 11, 19, 15)));
      await _pump(tester, rig, free: false);
      await _settle(tester);
      expect(find.text(BillingCopy.subGrace('19 November')), findsOneWidget);
      expect(find.text(BillingCopy.subGraceTitle), findsOneWidget);
      expect(find.text('Pro is on'), findsNothing, reason: 'a screen that asks for action never looks finished');
      expect(_key(tester, BillingCopy.manageSubscription).variant, KeyVariant.primary);
      expect(_key(tester, BillingCopy.done).variant, KeyVariant.quiet);
      expect(find.byIcon(LucideIcons.check), findsNothing);
      await tester.tap(find.text(BillingCopy.manageSubscription));
      await _settle(tester);
      expect(rig.manageOpened, 1);
    });

    testWidgets('Pro from the website: Pro is on, with no Manage subscription (nothing to manage in Google Play)', (tester) async {
      final rig = BillingRig();
      await _pump(tester, rig, free: false);
      await _settle(tester);
      expect(find.text('Pro is on'), findsOneWidget);
      expect(find.text(BillingCopy.proOnBody), findsOneWidget);
      expect(find.text(BillingCopy.manageSubscription), findsNothing);
    });
  });

  test('the Manage subscription page is Google Play\'s own, for this subscription and this app', () {
    expect(PlayProducts.manageSubscriptionUrl.host, 'play.google.com');
    expect(PlayProducts.manageSubscriptionUrl.queryParameters, {'sku': 'pro_monthly', 'package': 'in.mockmob.app'});
  });
}
