import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/config/app_config.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../credits/data/credits_data.dart';
import 'play_products.dart';
import 'play_store.dart';
import 'play_verifier.dart';

/// The Google Play flag (`PLAY_BILLING`). With it off the controller does nothing and no screen
/// shows any of it.
final playBillingEnabledProvider = Provider<bool>((ref) => ref.watch(appConfigProvider).playBilling);

final playStoreProvider = Provider<PlayStore>((ref) => PluginPlayStore());

final playVerifierProvider = Provider<PlayVerifier>((ref) => ApiPlayVerifier(ref.watch(apiClientProvider)));

/// The signed-in MockMob user id, or null. Replaceable in tests.
final playBillingUserIdProvider = Provider<String?>((ref) => ref.watch(authSnapshotProvider.select((s) => s.userId)));

/// Reads the plan and both balances again from the server, after it confirmed a purchase. The
/// server's answer is the only truth: nothing is granted on the phone.
final playBillingRefreshProvider = Provider<Future<void> Function()>((ref) {
  return () async {
    Future<void> quiet(Future<void> Function() read) async {
      try {
        await read();
      } on Object {
        // A read that fails leaves the figures as they were; the next screen read tries again.
      }
    }

    await quiet(() => ref.read(authSnapshotProvider.notifier).reload());
    await quiet(() => ref.read(meCreditsProvider.notifier).refresh(force: true));
    await quiet(() => ref.read(creditsRepositoryProvider.notifier).refresh(force: true));
  };
});

/// The obfuscated account id sent to Google Play with every purchase: the SHA-256 of the MockMob
/// user id as 64 lower-case hex characters. It never contains the id itself.
String playAccountHash(String userId) => sha256.convert(utf8.encode(userId)).toString();

enum StoreAvailability { checking, available, unavailable }

/// Where the purchase the student started (or the restore) stands.
enum BillingStage {
  idle,

  /// Google Play's own sheet is opening or open.
  starting,

  /// Google Play has the payment but has not finished it (a slow payment method).
  pending,

  /// Google Play says it is paid; the server is checking it. Nothing is granted yet.
  verifying,

  /// The server confirmed and granted it.
  confirmed,

  /// The student closed Google Play's sheet. No payment was made.
  cancelled,
  failed,
  restoring,

  /// A restore found nothing this account owns.
  restoredNothing,
}

enum BillingFailure {
  /// Google Play could not start or finish the purchase.
  store,

  /// Google Play has the payment but MockMob has not confirmed it yet.
  couldNotConfirm,

  /// No connection while confirming.
  offline,

  /// The server does not take Play purchases yet (it answers 404).
  notOpenYet,
}

class PlayBillingState {
  const PlayBillingState({
    this.store = StoreAvailability.checking,
    this.products = const {},
    this.productsLoading = false,
    this.productsFailed = false,
    this.stage = BillingStage.idle,
    this.productId,
    this.failure,
    this.unconfirmed = 0,
  });

  final StoreAvailability store;

  /// Google Play's own details for each product it knows. The price is [ProductDetails.price].
  final Map<String, ProductDetails> products;
  final bool productsLoading;

  /// Google Play answered the product query with an error (not a missing product).
  final bool productsFailed;
  final BillingStage stage;

  /// The product [stage] is about.
  final String? productId;
  final BillingFailure? failure;

  /// Purchases Google Play has paid but the server has not confirmed yet. They are sent again on
  /// the next try and the next launch.
  final int unconfirmed;

  /// Google Play's localized price string for [id], or null when Google did not return it.
  String? priceOf(String id) => products[id]?.price;

  bool get busy =>
      stage == BillingStage.starting || stage == BillingStage.pending || stage == BillingStage.verifying || stage == BillingStage.restoring;

  PlayBillingState copyWith({
    StoreAvailability? store,
    Map<String, ProductDetails>? products,
    bool? productsLoading,
    bool? productsFailed,
    BillingStage? stage,
    Object? productId = _keep,
    Object? failure = _keep,
    int? unconfirmed,
  }) =>
      PlayBillingState(
        store: store ?? this.store,
        products: products ?? this.products,
        productsLoading: productsLoading ?? this.productsLoading,
        productsFailed: productsFailed ?? this.productsFailed,
        stage: stage ?? this.stage,
        productId: identical(productId, _keep) ? this.productId : productId as String?,
        failure: identical(failure, _keep) ? this.failure : failure as BillingFailure?,
        unconfirmed: unconfirmed ?? this.unconfirmed,
      );

  static const Object _keep = Object();
}

/// Sells Pro and AI credit packs through Google Play Billing, and never grants anything itself.
///
/// * A purchase Google Play reports as paid is sent to the server (`POST /api/billing/play/verify`).
///   Only the server's yes finishes it with Google Play (acknowledge, or consume for a pack) and
///   only then does the app say it worked.
/// * When the server cannot confirm (offline, an error, its flag off) the purchase is not finished.
///   It stays with Google Play and is sent again on the next try and on the next launch, which
///   asks Google Play for what this account owns.
/// * Pending, cancelled, failed, already-owned and restore each have their own stage.
/// * With `PLAY_BILLING` off, [build] returns an empty state and starts nothing.
class PlayBillingController extends Notifier<PlayBillingState> {
  PlayStore? _store;
  StreamSubscription<List<PurchaseDetails>>? _sub;
  bool _alive = true;

  /// A student-started flow (a purchase or a restore) is open, so a failure is shown on the sheet.
  bool _flow = false;

  /// While true, a purchase Google Play already holds as acknowledged is sent to the server too
  /// (a restore the student asked for, or a purchase that turned out to be owned already).
  bool _includeCompleted = false;

  final Map<String, PurchaseDetails> _held = {};
  final Set<String> _inFlight = {};
  Future<void> _queue = Future<void>.value();

  @override
  PlayBillingState build() {
    _alive = true;
    ref.onDispose(() {
      _alive = false;
      unawaited(_sub?.cancel());
      _sub = null;
    });
    if (!ref.watch(playBillingEnabledProvider)) return const PlayBillingState(store: StoreAvailability.unavailable);

    try {
      _store = ref.read(playStoreProvider);
      _sub = _store!.purchases.listen(_onPurchases, onError: (Object _) {});
    } on Object {
      // Google Play's plugin is not on this phone (a desktop, a test): the sheet says so.
      _store = null;
      return const PlayBillingState(store: StoreAvailability.unavailable);
    }

    ref.listen<String?>(playBillingUserIdProvider, (previous, next) {
      if (next == null) {
        _held.clear();
        _flow = false;
        _set(stage: BillingStage.idle, productId: null, failure: null, unconfirmed: 0);
      } else if (previous != next) {
        unawaited(_syncOwned());
      }
    }, fireImmediately: true);
    return const PlayBillingState();
  }

  void _set({
    StoreAvailability? store,
    Map<String, ProductDetails>? products,
    bool? productsLoading,
    bool? productsFailed,
    BillingStage? stage,
    Object? productId = PlayBillingState._keep,
    Object? failure = PlayBillingState._keep,
    int? unconfirmed,
  }) {
    if (!_alive) return;
    state = state.copyWith(
      store: store,
      products: products,
      productsLoading: productsLoading,
      productsFailed: productsFailed,
      stage: stage,
      productId: productId,
      failure: failure,
      unconfirmed: unconfirmed,
    );
  }

  // Products.

  /// Asks Google Play whether it is available and for the products' details and prices.
  Future<void> loadProducts({bool force = false}) async {
    final store = _store;
    if (store == null || state.productsLoading) return;
    if (!force && state.products.isNotEmpty) return;
    _set(productsLoading: true, productsFailed: false);
    try {
      if (!await store.isAvailable()) {
        _set(store: StoreAvailability.unavailable, productsLoading: false);
        return;
      }
      final response = await store.queryProducts(PlayProducts.ids);
      final found = {for (final d in response.productDetails) d.id: d};
      _set(
        store: StoreAvailability.available,
        products: found,
        productsLoading: false,
        productsFailed: response.error != null && found.isEmpty,
      );
    } on Object {
      _set(store: StoreAvailability.unavailable, productsLoading: false);
    }
  }

  // Buying.

  /// Opens Google Play's purchase sheet for [productId]. The result arrives on the purchase
  /// stream; nothing is granted here.
  Future<void> buy(String productId) async {
    final store = _store;
    final product = PlayProducts.byId(productId);
    final userId = ref.read(playBillingUserIdProvider);
    if (store == null || product == null || userId == null || state.busy) return;
    var details = state.products[productId];
    if (details == null) {
      await loadProducts(force: true);
      details = state.products[productId];
      if (details == null) return;
    }
    _flow = true;
    _set(stage: BillingStage.starting, productId: productId, failure: null);
    bool started;
    try {
      started = await store.buy(details, consumable: product.consumable, accountHash: playAccountHash(userId));
    } on Object {
      _end(BillingStage.failed, productId, failure: BillingFailure.store);
      return;
    }
    if (!started && state.stage == BillingStage.starting) {
      // Google Play would not open the sheet. The usual reason is that this account already owns
      // the item: look for it, so a paid purchase that was never delivered is delivered now.
      await _syncOwned(includeCompleted: true);
      if (state.stage == BillingStage.starting) _end(BillingStage.failed, productId, failure: BillingFailure.store);
    }
  }

  /// The student's Restore purchases: asks Google Play for what this account owns and sends each
  /// purchase to the server.
  Future<void> restore() async {
    final store = _store;
    final userId = ref.read(playBillingUserIdProvider);
    if (store == null || userId == null || state.busy) return;
    _flow = true;
    _set(stage: BillingStage.restoring, productId: null, failure: null);
    try {
      await _syncOwned(includeCompleted: true, silent: false);
    } on Object {
      _end(BillingStage.failed, null, failure: BillingFailure.store);
      return;
    }
    if (state.stage == BillingStage.restoring) _end(BillingStage.restoredNothing, null);
  }

  /// Sends the purchases the server has not confirmed again (the sheet's Try again).
  Future<void> retry() async {
    if (state.busy) return;
    if (_held.isEmpty) {
      clearOutcome();
      return;
    }
    _flow = true;
    for (final p in _held.values.toList()) {
      _enqueue(p);
    }
    await _queue;
  }

  /// Closes a finished outcome (a confirmation, a cancel, a failure) so the sheet shows its
  /// ordinary state again. Never clears work in progress.
  void clearOutcome() {
    if (state.busy) return;
    _flow = false;
    _set(stage: BillingStage.idle, productId: null, failure: null);
  }

  /// Asks Google Play for what this account owns and delivers the purchases it finds. Quiet unless
  /// a student-started flow is open. Run on every launch and sign-in, which is how a purchase the
  /// server could not confirm last time is sent again.
  Future<void> _syncOwned({bool includeCompleted = false, bool silent = true}) async {
    final store = _store;
    final userId = ref.read(playBillingUserIdProvider);
    if (store == null || userId == null) return;
    final before = _includeCompleted;
    _includeCompleted = includeCompleted;
    try {
      if (!await store.isAvailable()) return;
      await store.restore(accountHash: playAccountHash(userId));
      // The purchases arrive on the stream; let them in, then wait for each to be handled.
      await Future<void>.delayed(Duration.zero);
      await _queue;
    } on Object {
      if (!silent) rethrow;
    } finally {
      _includeCompleted = before;
    }
  }

  // The purchase stream.

  void _onPurchases(List<PurchaseDetails> purchases) {
    for (final p in purchases) {
      switch (p.status) {
        case PurchaseStatus.pending:
          if (_flow || state.productId == p.productID) {
            _set(stage: BillingStage.pending, productId: p.productID.isEmpty ? state.productId : p.productID, failure: null);
          }
        case PurchaseStatus.canceled:
          if (_flow && state.stage != BillingStage.verifying) _end(BillingStage.cancelled, state.productId);
        case PurchaseStatus.error:
          final message = '${p.error?.message} ${p.error?.code} ${p.error?.details}'.toLowerCase();
          if (message.contains('alreadyowned') || message.contains('already_owned') || message.contains('already owned')) {
            // The account already owns it: find the purchase and deliver it.
            final wasFlow = _flow;
            _queue = _queue.then((_) => _syncOwned(includeCompleted: wasFlow)).catchError((Object _) {});
          } else if (_flow && state.stage != BillingStage.verifying) {
            _end(BillingStage.failed, state.productId, failure: BillingFailure.store);
          }
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          _enqueue(p);
      }
    }
  }

  void _enqueue(PurchaseDetails p) {
    // Capture now: [_includeCompleted] is only true while the restore that returned [p] runs.
    final include = _includeCompleted;
    _queue = _queue.then((_) => _deliver(p, include)).catchError((Object _) {});
  }

  /// One paid purchase: the server's yes, then Google Play's acknowledge or consume, then the
  /// figures are read again. Anything short of the server's yes leaves the purchase with Google
  /// Play, unfinished.
  Future<void> _deliver(PurchaseDetails p, bool includeCompleted) async {
    final store = _store;
    final product = PlayProducts.byId(p.productID);
    final token = p.verificationData.serverVerificationData;
    if (store == null || product == null || token.isEmpty) return;
    // A purchase already acknowledged and granted is left alone on a quiet check, except a pack,
    // which stays owned until it is consumed.
    final needsDelivery = p.pendingCompletePurchase || product.consumable || includeCompleted || _held.containsKey(token);
    if (!needsDelivery) return;
    if (!_inFlight.add(token)) return;

    final userId = ref.read(playBillingUserIdProvider);
    if (userId == null) {
      _inFlight.remove(token);
      _hold(p);
      return;
    }
    final interactive = _flow;
    if (interactive) _set(stage: BillingStage.verifying, productId: product.id, failure: null);
    try {
      final result = await ref.read(playVerifierProvider).verify(
            userId: userId,
            productId: product.id,
            purchaseToken: token,
            orderId: p.purchaseID ?? '',
          );
      if (!result.confirmed) throw const ApiError(kind: ApiErrorKind.unknown, code: 'not_confirmed');
      _held.remove(token);
      _set(unconfirmed: _held.length);
      try {
        await store.finish(p, consumable: product.consumable);
      } on Object {
        // The server already has the purchase and acknowledges it itself; a failed finish here is
        // retried by the next launch's check, and the grant does not depend on it.
      }
      if (interactive) _end(BillingStage.confirmed, product.id);
      unawaited(ref.read(playBillingRefreshProvider)().catchError((Object _) {}));
    } on ApiError catch (e) {
      _hold(p);
      if (interactive) _end(BillingStage.failed, product.id, failure: _failureFor(e));
    } on Object {
      _hold(p);
      if (interactive) _end(BillingStage.failed, product.id, failure: BillingFailure.couldNotConfirm);
    } finally {
      _inFlight.remove(token);
    }
  }

  void _hold(PurchaseDetails p) {
    _held[p.verificationData.serverVerificationData] = p;
    _set(unconfirmed: _held.length);
  }

  void _end(BillingStage stage, String? productId, {BillingFailure? failure}) {
    _flow = false;
    _set(stage: stage, productId: productId, failure: failure);
  }

  static BillingFailure _failureFor(ApiError e) {
    if (e.kind == ApiErrorKind.notFound) return BillingFailure.notOpenYet;
    if (e.isOffline) return BillingFailure.offline;
    return BillingFailure.couldNotConfirm;
  }
}

final playBillingProvider = NotifierProvider<PlayBillingController, PlayBillingState>(PlayBillingController.new);
