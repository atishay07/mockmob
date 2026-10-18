// Fakes shared by the Play billing unit, widget and golden tests: a Google Play store that records
// what the app asked of it, and a server that says yes, no or nothing on demand.

import 'dart:async';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/data/play_store.dart';
import 'package:mockmob/features/billing/data/play_verifier.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const AppConfig playOnConfig = AppConfig(apiBaseUrl: 'http://localhost', supabaseUrl: '', supabaseAnonKey: '', playBilling: true);
const AppConfig playOffConfig = AppConfig(apiBaseUrl: 'http://localhost', supabaseUrl: '', supabaseAnonKey: '');

ProductDetails productDetails(String id, String price) => ProductDetails(
      id: id,
      title: id,
      description: id,
      price: price,
      rawPrice: double.tryParse(price.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0,
      currencyCode: 'INR',
    );

/// The prices Google Play's own details carry in these tests. They are fixtures: the app never
/// writes a price.
Map<String, String> fixturePrices() => {
      PlayProducts.proId: '₹149.00',
      'ai_credits_prepos_10_50': '₹15.00',
      'ai_credits_prepos_20_150': '₹30.00',
      'ai_credits_prepos_50_400': '₹75.00',
      'practice_credits_19_100': '₹25.00',
      'practice_credits_49_300': '₹60.00',
    };

PurchaseDetails purchase(
  String productId, {
  PurchaseStatus status = PurchaseStatus.purchased,
  String? token,
  String orderId = 'GPA.1234-5678',
  bool pendingComplete = true,
}) {
  return PurchaseDetails(
    purchaseID: orderId,
    productID: productId,
    verificationData: PurchaseVerificationData(localVerificationData: '{}', serverVerificationData: token ?? 'token-$productId', source: 'google_play'),
    transactionDate: '1760000000000',
    status: status,
  )..pendingCompletePurchase = pendingComplete;
}

class FakePlayStore implements PlayStore {
  FakePlayStore({this.available = true, Map<String, String>? prices}) : prices = prices ?? fixturePrices();

  final StreamController<List<PurchaseDetails>> stream = StreamController<List<PurchaseDetails>>.broadcast();
  bool available;
  Map<String, String> prices;
  Set<String> missing = {};
  bool queryError = false;
  bool listened = false;
  int queries = 0;

  /// What [buy] returns.
  bool buyStarts = true;

  /// What Google Play holds for this account: [restore] emits it.
  List<PurchaseDetails> owned = [];

  final List<({String productId, bool consumable, String accountHash})> buys = [];
  final List<({String productId, bool consumable})> finished = [];
  final List<String> restoreHashes = [];

  /// Called when the student's purchase sheet would open; a test may push stream events from it.
  void Function(ProductDetails product)? onBuy;

  @override
  Stream<List<PurchaseDetails>> get purchases {
    listened = true;
    return stream.stream;
  }

  /// While set, [isAvailable] waits for it: the sheet is then in its "checking Google Play" state.
  Completer<void>? gate;

  @override
  Future<bool> isAvailable() async {
    await gate?.future;
    return available;
  }

  @override
  Future<ProductDetailsResponse> queryProducts(Set<String> ids) async {
    queries++;
    if (queryError) {
      return ProductDetailsResponse(productDetails: const [], notFoundIDs: ids.toList(), error: IAPError(source: 'google_play', code: 'x', message: 'x'));
    }
    final found = [for (final id in ids) if (prices.containsKey(id) && !missing.contains(id)) productDetails(id, prices[id]!)];
    return ProductDetailsResponse(productDetails: found, notFoundIDs: [for (final id in ids) if (!prices.containsKey(id) || missing.contains(id)) id]);
  }

  @override
  Future<bool> buy(ProductDetails product, {required bool consumable, required String accountHash}) async {
    buys.add((productId: product.id, consumable: consumable, accountHash: accountHash));
    onBuy?.call(product);
    return buyStarts;
  }

  @override
  Future<void> finish(PurchaseDetails purchase, {required bool consumable}) async {
    finished.add((productId: purchase.productID, consumable: consumable));
  }

  @override
  Future<void> restore({required String accountHash}) async {
    restoreHashes.add(accountHash);
    if (owned.isNotEmpty) stream.add(List.of(owned));
  }

  void emit(PurchaseDetails p) => stream.add([p]);
}

class FakeVerifier implements PlayVerifier {
  /// Null: the server confirms. Otherwise this is thrown.
  Object? failWith;

  /// The server answers 2xx but says it did not grant.
  bool denies = false;

  /// While set, [verify] waits for it: the purchase is then "being confirmed".
  Completer<void>? gate;
  final List<({String userId, String productId, String purchaseToken, String orderId})> calls = [];

  @override
  Future<PlayVerifyResult> verify({required String userId, required String productId, required String purchaseToken, required String orderId}) async {
    calls.add((userId: userId, productId: productId, purchaseToken: purchaseToken, orderId: orderId));
    await gate?.future;
    final failure = failWith;
    if (failure != null) throw failure;
    return PlayVerifyResult(confirmed: !denies);
  }
}

const ApiError serverNotOpen = ApiError(kind: ApiErrorKind.notFound, code: 'not_found', status: 404);
const ApiError serverOffline = ApiError(kind: ApiErrorKind.network, code: 'network');
const ApiError serverBroken = ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500);

/// The overrides for a Play billing test: the flag on, a signed-in user, the fakes, and a refresh
/// that only counts.
class BillingRig {
  BillingRig({this.userId = 'user-1', this.on = true, FakePlayStore? store, FakeVerifier? verifier})
      : store = store ?? FakePlayStore(),
        verifier = verifier ?? FakeVerifier();

  final String? userId;
  final bool on;
  final FakePlayStore store;
  final FakeVerifier verifier;
  int refreshes = 0;

  List<Override> get overrides => [
        appConfigProvider.overrideWithValue(on ? playOnConfig : playOffConfig),
        playStoreProvider.overrideWithValue(store),
        playVerifierProvider.overrideWithValue(verifier),
        playBillingUserIdProvider.overrideWithValue(userId),
        playBillingRefreshProvider.overrideWithValue(() async => refreshes++),
      ];

  ProviderContainer container() {
    final c = ProviderContainer(overrides: overrides);
    addTearDownContainer(c);
    return c;
  }
}

final List<ProviderContainer> _toDispose = [];
void addTearDownContainer(ProviderContainer c) => _toDispose.add(c);
void disposeContainers() {
  for (final c in _toDispose) {
    c.dispose();
  }
  _toDispose.clear();
}

/// Lets the stream, the queue and the verifier run.
Future<void> settle() async {
  for (var i = 0; i < 12; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}
