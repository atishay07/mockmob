// The adapter over the official plugin's platform interface, against a fake Google Play platform:
// what the app asks Google Play for when it buys and restores. It never acknowledges or consumes:
// the server does that after the grant (PLAY-BILLING-PLAN-1018, contract step 3).

import 'dart:async';

import 'package:flutter/foundation.dart' show TargetPlatform;
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart'
    show PricingPhaseWrapper, ProductDetailsWrapper, ProductType, PurchaseStateWrapper, PurchaseWrapper, RecurrenceMode, SubscriptionOfferDetailsWrapper;
import 'package:in_app_purchase_android/in_app_purchase_android.dart' show GooglePlayProductDetails, GooglePlayPurchaseDetails, GooglePlayPurchaseParam;
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/features/billing/data/play_store.dart';

import 'billing_test_support.dart';

class _FakePlatform extends InAppPurchasePlatform {
  final stream = StreamController<List<PurchaseDetails>>.broadcast();
  final calls = <String>[];
  PurchaseParam? lastParam;
  bool? lastAutoConsume;
  String? restoreName;

  @override
  Stream<List<PurchaseDetails>> get purchaseStream => stream.stream;

  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<ProductDetailsResponse> queryProductDetails(Set<String> identifiers) async {
    calls.add('query');
    return ProductDetailsResponse(productDetails: [for (final id in identifiers) productDetails(id, 'Rs 1.00')], notFoundIDs: const []);
  }

  @override
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam}) async {
    calls.add('buyNonConsumable');
    lastParam = purchaseParam;
    return true;
  }

  @override
  Future<bool> buyConsumable({required PurchaseParam purchaseParam, bool autoConsume = true}) async {
    calls.add('buyConsumable');
    lastParam = purchaseParam;
    lastAutoConsume = autoConsume;
    return true;
  }

  @override
  Future<void> completePurchase(PurchaseDetails purchase) async => calls.add('complete ${purchase.productID}');

  @override
  Future<void> restorePurchases({String? applicationUserName}) async {
    calls.add('restore');
    restoreName = applicationUserName;
  }
}

GooglePlayPurchaseDetails _google(String productId, PurchaseStateWrapper state) {
  final wrapper = PurchaseWrapper(
    orderId: 'GPA.1',
    packageName: 'in.mockmob.app',
    purchaseTime: 0,
    purchaseToken: 'token-$productId-${state.name}',
    signature: '',
    products: [productId],
    isAutoRenewing: false,
    originalJson: '{}',
    isAcknowledged: false,
    purchaseState: state,
  );
  return GooglePlayPurchaseDetails.fromPurchase(wrapper).single..status = PurchaseStatus.restored;
}

class _RefusingPlatform extends _FakePlatform {
  @override
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam}) async => false;

  @override
  Future<bool> buyConsumable({required PurchaseParam purchaseParam, bool autoConsume = true}) async => false;
}

void main() {
  late _FakePlatform platform;
  late PluginPlayStore store;
  setUp(() {
    platform = _FakePlatform();
    store = PluginPlayStore(platform: platform);
  });

  test('Pro (the subscription) is bought as a non-consumable with the hashed account id as the application user name', () async {
    await store.buy(productDetails('pro_monthly', 'Rs 149.00'), consumable: false, accountHash: 'a' * 64);
    expect(platform.calls.single, 'buyNonConsumable');
    expect(platform.lastParam!.applicationUserName, 'a' * 64);
    expect(platform.lastParam!.productDetails.id, 'pro_monthly');
  });

  test('a credit pack is bought as a consumable that Google Play does not consume by itself', () async {
    await store.buy(productDetails('credits_10_50', 'Rs 15.00'), consumable: true, accountHash: 'b' * 64);
    expect(platform.calls.single, 'buyConsumable');
    expect(platform.lastAutoConsume, isFalse);
    expect(platform.lastParam!.applicationUserName, 'b' * 64);
  });

  test('buying, restoring and listening never acknowledge or consume anything: the server does', () async {
    await store.buy(productDetails('pro_monthly', 'Rs 149.00'), consumable: false, accountHash: 'a' * 64);
    await store.buy(productDetails('credits_10_50', 'Rs 15.00'), consumable: true, accountHash: 'a' * 64);
    await store.restore(accountHash: 'a' * 64);
    final sub = store.purchases.listen((_) {});
    platform.stream.add([purchase('pro_monthly'), purchase('credits_10_50')]);
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();
    expect(platform.calls.where((c) => c.startsWith('complete')), isEmpty);
  });

  test('a restore that returns a payment Google Play is still waiting for passes it on as pending, not as paid', () async {
    final seen = <PurchaseDetails>[];
    final sub = store.purchases.listen(seen.addAll);
    platform.stream.add([_google('pro_monthly', PurchaseStateWrapper.pending), _google('credits_10_50', PurchaseStateWrapper.purchased)]);
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();
    expect(seen.firstWhere((p) => p.productID == 'pro_monthly').status, PurchaseStatus.pending);
    expect(seen.firstWhere((p) => p.productID == 'credits_10_50').status, PurchaseStatus.restored);
  });

  test('the Android implementation is registered (once) before it is used: without it nothing could ever be bought', () {
    var registrations = 0;
    final android = _FakePlatform();
    // Not Android: nothing is registered, and asking for the platform fails (the controller then says
    // Google Play is not ready).
    expect(() => PluginPlayStore.androidPlatform(platform: TargetPlatform.iOS, register: () => registrations++), throwsA(anything));
    expect(registrations, 0);
    final first = PluginPlayStore.androidPlatform(
      platform: TargetPlatform.android,
      register: () {
        registrations++;
        InAppPurchasePlatform.instance = android;
      },
    );
    final second = PluginPlayStore.androidPlatform(platform: TargetPlatform.android, register: () => registrations++);
    expect(registrations, 1);
    expect(first, same(android));
    expect(second, same(android));
  });

  test('buy returns what the platform says: false when the sheet could not open', () async {
    final refusing = PluginPlayStore(platform: _RefusingPlatform());
    expect(await refusing.buy(productDetails('pro_monthly', 'Rs 149.00'), consumable: false, accountHash: 'd' * 64), isFalse);
    expect(await refusing.buy(productDetails('credits_10_50', 'Rs 15.00'), consumable: true, accountHash: 'd' * 64), isFalse);
  });

  test('restore passes the account hash; products and purchases pass straight through', () async {
    await store.restore(accountHash: 'c' * 64);
    expect(platform.restoreName, 'c' * 64);
    final response = await store.queryProducts({'pro_monthly'});
    expect(response.productDetails.single.price, 'Rs 1.00');
    final seen = <List<PurchaseDetails>>[];
    final sub = store.purchases.listen(seen.add);
    platform.stream.add([purchase('pro_monthly')]);
    await Future<void>.delayed(Duration.zero);
    expect(seen.single.single.productID, 'pro_monthly');
    await sub.cancel();
  });

  group('the monthly subscription (owner D135/D136)', () {
    PricingPhaseWrapper phase(String price, int micros, {String period = 'P1M'}) => PricingPhaseWrapper(
          billingCycleCount: 0,
          billingPeriod: period,
          formattedPrice: price,
          priceAmountMicros: micros,
          priceCurrencyCode: 'INR',
          recurrenceMode: RecurrenceMode.infiniteRecurring,
        );
    // Google Play's answer for pro_monthly: an introductory offer listed first, then the base plan,
    // then another base plan the app does not sell.
    final wrapper = ProductDetailsWrapper(
      description: 'MockMob Pro',
      name: 'MockMob Pro',
      productId: 'pro_monthly',
      productType: ProductType.subs,
      title: 'MockMob Pro (MockMob)',
      subscriptionOfferDetails: [
        SubscriptionOfferDetailsWrapper(basePlanId: 'monthly', offerId: 'intro', offerTags: const [], offerIdToken: 'intro-token', pricingPhases: [phase('₹49.00', 49000000), phase('₹149.00', 149000000)]),
        SubscriptionOfferDetailsWrapper(basePlanId: 'monthly', offerTags: const [], offerIdToken: 'base-token', pricingPhases: [phase('₹149.00', 149000000)]),
        SubscriptionOfferDetailsWrapper(basePlanId: 'yearly', offerTags: const [], offerIdToken: 'yearly-token', pricingPhases: [phase('₹1,299.00', 1299000000, period: 'P1Y')]),
      ],
    );

    test('only the base plan "monthly" with no offer on top is sold: its price and its offer token', () {
      final all = GooglePlayProductDetails.fromProductDetails(wrapper);
      expect(all, hasLength(3), reason: 'Google lists one entry per offer');
      final picked = sellableDetails([...all, productDetails('credits_10_50', '₹15.00'), productDetails('not_ours', '₹1.00')]);
      expect(picked.keys, unorderedEquals(['pro_monthly', 'credits_10_50']));
      final pro = picked['pro_monthly']! as GooglePlayProductDetails;
      expect(pro.offerToken, 'base-token');
      expect(pro.price, '₹149.00', reason: 'the base plan price, never the introductory one');
      expect(billingPeriodOf(pro), 'P1M');
      expect(billingPeriodOf(productDetails('credits_10_50', '₹15.00')), isNull);
      // Without the base plan, nothing is sold rather than an offer the owner did not ask for.
      expect(sellableDetails([all[0], all[2]]), isEmpty);
    });

    test('the purchase carries the base plan offer token and the hashed account id', () async {
      final pro = sellableDetails(GooglePlayProductDetails.fromProductDetails(wrapper))['pro_monthly']!;
      await store.buy(pro, consumable: false, accountHash: 'e' * 64);
      expect(platform.calls.single, 'buyNonConsumable', reason: 'a subscription is never a consumable');
      final param = platform.lastParam! as GooglePlayPurchaseParam;
      expect(param.offerToken, 'base-token');
      expect(param.applicationUserName, 'e' * 64);
      expect(param.changeSubscriptionParam, isNull);
      expect(platform.calls, isNot(contains(startsWith('complete'))), reason: 'the app never acknowledges: the server does');
    });
  });
}
