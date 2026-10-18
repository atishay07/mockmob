// The adapter over the official plugin's platform interface, against a fake Google Play platform:
// what the app asks Google Play for when it buys, finishes and restores.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
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

  test('finishing a non-consumable completes (acknowledges) it', () async {
    await store.finish(purchase('pro_cuet_2027'), consumable: false);
    expect(platform.calls.single, 'complete pro_cuet_2027');
  });

  test('without the Android addition (a phone with no Google Play add-on) a pack is still completed, never silently dropped', () async {
    await store.finish(purchase('credits_29_150'), consumable: true);
    expect(platform.calls.single, 'complete credits_29_150');
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
