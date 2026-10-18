import 'package:in_app_purchase_android/in_app_purchase_android.dart' show InAppPurchaseAndroidPlatformAddition;
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';

/// What the billing controller needs from Google Play, in one small seam. The real one is
/// [PluginPlayStore] (the official `in_app_purchase` plugin); tests pass a fake.
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

  /// Tells Google Play the purchase was delivered: acknowledges a non-consumable and consumes a
  /// consumable (so it can be bought again). Called only after the server confirmed the purchase.
  Future<void> finish(PurchaseDetails purchase, {required bool consumable});

  /// Asks Google Play for the purchases this account owns; they arrive on [purchases].
  Future<void> restore({required String accountHash});
}

/// The official `in_app_purchase` plugin, through its platform interface (so a test can hand it a
/// fake platform).
class PluginPlayStore implements PlayStore {
  PluginPlayStore({InAppPurchasePlatform? platform, InAppPurchasePlatformAddition? addition})
      : _platform = platform ?? InAppPurchasePlatform.instance,
        _addition = addition ?? InAppPurchasePlatformAddition.instance;

  final InAppPurchasePlatform _platform;
  final InAppPurchasePlatformAddition? _addition;

  @override
  Stream<List<PurchaseDetails>> get purchases => _platform.purchaseStream;

  @override
  Future<bool> isAvailable() => _platform.isAvailable();

  @override
  Future<ProductDetailsResponse> queryProducts(Set<String> ids) => _platform.queryProductDetails(ids);

  @override
  Future<bool> buy(ProductDetails product, {required bool consumable, required String accountHash}) {
    // On Android the application user name becomes the purchase's obfuscated account id.
    final param = PurchaseParam(productDetails: product, applicationUserName: accountHash);
    // autoConsume off: the plugin would otherwise consume a pack the moment Google Play reports
    // it, before the server has granted anything.
    return consumable ? _platform.buyConsumable(purchaseParam: param, autoConsume: false) : _platform.buyNonConsumable(purchaseParam: param);
  }

  @override
  Future<void> finish(PurchaseDetails purchase, {required bool consumable}) async {
    final addition = _addition;
    if (consumable && addition is InAppPurchaseAndroidPlatformAddition) {
      await addition.consumePurchase(purchase);
      return;
    }
    await _platform.completePurchase(purchase);
  }

  @override
  Future<void> restore({required String accountHash}) => _platform.restorePurchases(applicationUserName: accountHash);
}
