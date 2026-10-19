import 'package:in_app_purchase_android/billing_client_wrappers.dart' show PurchaseStateWrapper;
import 'package:in_app_purchase_android/in_app_purchase_android.dart' show GooglePlayPurchaseDetails;
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';

/// What the billing controller needs from Google Play, in one small seam. The real one is
/// [PluginPlayStore] (the official `in_app_purchase` plugin); tests pass a fake.
///
/// There is deliberately no way to acknowledge or consume a purchase here. The server does that
/// after it has granted the purchase (PLAY-BILLING-PLAN-1018, contract step 3): Pro is
/// acknowledged, a credit pack consumed. A purchase the server never grants is refunded by Google
/// after three days, which is the safety net for one it refused.
abstract class PlayStore {
  /// Every purchase update Google Play delivers: new purchases, pending ones, cancellations,
  /// errors and the purchases a restore returns.
  Stream<List<PurchaseDetails>> get purchases;

  /// False when Google Play is not on this phone or cannot be reached.
  Future<bool> isAvailable();

  Future<ProductDetailsResponse> queryProducts(Set<String> ids);

  /// Opens Google Play's own purchase sheet. [accountHash] travels as the obfuscated account id.
  /// False when the sheet could not be opened (for example the item is already owned).
  Future<bool> buy(ProductDetails product, {required bool consumable, required String accountHash});

  /// Asks Google Play for the purchases this account owns (`queryPurchasesAsync`); they arrive on
  /// [purchases].
  Future<void> restore({required String accountHash});
}

/// The official `in_app_purchase` plugin, through its platform interface (so a test can hand it a
/// fake platform).
class PluginPlayStore implements PlayStore {
  PluginPlayStore({InAppPurchasePlatform? platform}) : _platform = platform ?? InAppPurchasePlatform.instance;

  final InAppPurchasePlatform _platform;

  @override
  Stream<List<PurchaseDetails>> get purchases => _platform.purchaseStream.map((list) => [for (final p in list) settleStatus(p)]);

  /// The plugin marks every purchase a restore returns as `restored`, including one whose payment
  /// Google Play is still waiting for. Such a purchase is pending: it must not be sent to the server
  /// as paid, and the student must not be told it is.
  static PurchaseDetails settleStatus(PurchaseDetails p) {
    if (p is GooglePlayPurchaseDetails && p.status == PurchaseStatus.restored && p.billingClientPurchase.purchaseState == PurchaseStateWrapper.pending) {
      p.status = PurchaseStatus.pending;
    }
    return p;
  }

  @override
  Future<bool> isAvailable() => _platform.isAvailable();

  @override
  Future<ProductDetailsResponse> queryProducts(Set<String> ids) => _platform.queryProductDetails(ids);

  @override
  Future<bool> buy(ProductDetails product, {required bool consumable, required String accountHash}) {
    // On Android the application user name becomes the purchase's obfuscated account id.
    final param = PurchaseParam(productDetails: product, applicationUserName: accountHash);
    // autoConsume off: the plugin would otherwise consume a pack the moment Google Play reports
    // it, before the server has granted anything. The server consumes it after the grant.
    return consumable ? _platform.buyConsumable(purchaseParam: param, autoConsume: false) : _platform.buyNonConsumable(purchaseParam: param);
  }

  @override
  Future<void> restore({required String accountHash}) => _platform.restorePurchases(applicationUserName: accountHash);
}
