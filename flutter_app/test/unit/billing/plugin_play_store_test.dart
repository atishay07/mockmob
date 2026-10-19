// The adapter over the official plugin's platform interface, against a fake Google Play platform:
// what the app asks Google Play for when it buys and restores. It never acknowledges or consumes:
// the server does that after the grant (PLAY-BILLING-PLAN-1018, contract step 3).

import 'dart:async';

import 'package:flutter/foundation.dart' show TargetPlatform;
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart' show PurchaseStateWrapper, PurchaseWrapper;
import 'package:in_app_purchase_android/in_app_purchase_android.dart' show GooglePlayPurchaseDetails;
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

  test('Pro is bought as a non-consumable with the hashed account id as the application user name', () async {
    await store.buy(productDetails('pro_cuet_2027', 'Rs 150.00'), consumable: false, accountHash: 'a' * 64);
    expect(platform.calls.single, 'buyNonConsumable');
    expect(platform.lastParam!.applicationUserName, 'a' * 64);
    expect(platform.lastParam!.productDetails.id, 'pro_cuet_2027');
  });

  test('a credit pack is bought as a consumable that Google Play does not consume by itself', () async {
    await store.buy(productDetails('credits_10_50', 'Rs 15.00'), consumable: true, accountHash: 'b' * 64);
    expect(platform.calls.single, 'buyConsumable');
    expect(platform.lastAutoConsume, isFalse);
    expect(platform.lastParam!.applicationUserName, 'b' * 64);
  });

  test('buying, restoring and listening never acknowledge or consume anything: the server does', () async {
    await store.buy(productDetails('pro_cuet_2027', 'Rs 150.00'), consumable: false, accountHash: 'a' * 64);
    await store.buy(productDetails('credits_10_50', 'Rs 15.00'), consumable: true, accountHash: 'a' * 64);
    await store.restore(accountHash: 'a' * 64);
    final sub = store.purchases.listen((_) {});
    platform.stream.add([purchase('pro_cuet_2027'), purchase('credits_10_50')]);
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();
    expect(platform.calls.where((c) => c.startsWith('complete')), isEmpty);
  });

  test('a restore that returns a payment Google Play is still waiting for passes it on as pending, not as paid', () async {
    final seen = <PurchaseDetails>[];
    final sub = store.purchases.listen(seen.addAll);
    platform.stream.add([_google('pro_cuet_2027', PurchaseStateWrapper.pending), _google('credits_10_50', PurchaseStateWrapper.purchased)]);
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();
    expect(seen.firstWhere((p) => p.productID == 'pro_cuet_2027').status, PurchaseStatus.pending);
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
    expect(await refusing.buy(productDetails('pro_cuet_2027', 'Rs 150.00'), consumable: false, accountHash: 'd' * 64), isFalse);
    expect(await refusing.buy(productDetails('credits_10_50', 'Rs 15.00'), consumable: true, accountHash: 'd' * 64), isFalse);
  });

  test('restore passes the account hash; products and purchases pass straight through', () async {
    await store.restore(accountHash: 'c' * 64);
    expect(platform.restoreName, 'c' * 64);
    final response = await store.queryProducts({'pro_cuet_2027'});
    expect(response.productDetails.single.price, 'Rs 1.00');
    final seen = <List<PurchaseDetails>>[];
    final sub = store.purchases.listen(seen.add);
    platform.stream.add([purchase('pro_cuet_2027')]);
    await Future<void>.delayed(Duration.zero);
    expect(seen.single.single.productID, 'pro_cuet_2027');
    await sub.cancel();
  });
}
