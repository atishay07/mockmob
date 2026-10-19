import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/config/app_config.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../credits/data/credits_data.dart';
import '../../practice/data/practice_quote.dart';
import '../../wallet/data/wallet_data.dart';
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

/// Reads the plan and the balance again from the server, after it confirmed a purchase. The
/// server's answer is the only truth: nothing is granted on the phone.
///
/// Every place that draws the plan or the balance is read again: the profile (`/api/me`, Pro and
/// the Pro-only modes), the credit figures, the Ask wallet, the Wallet page (where packs are bought)
/// and Practice's quotes (whose Pro gate and credit gate were priced before the purchase), so a
/// mode Pro holds opens at once (D101: locked, then unlocked) and the new balance shows where the
/// pack was bought.
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
    await quiet(() => ref.read(walletRepositoryProvider.notifier).refresh(force: true));
    await quiet(() async => ref.invalidate(practiceQuoteProvider));
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

  /// Google Play has the payment but MockMob has not confirmed it yet (a 5xx, Google unreachable
  /// from the server, an answer the app could not read). Try again; it is also sent at each launch.
  couldNotConfirm,

  /// No connection while confirming.
  offline,

  /// Google Play is not ready on this phone (no Play Store, signed out, or out of date), so nothing
  /// could be bought or restored.
  notReady,

  /// The server does not take Play purchases yet (its flag is off: a 404 with no Play code).
  notOpenYet,

  /// Too many tries in a few minutes (429). Try again later.
  rateLimited,

  /// The purchase was made while signed in to another MockMob account (`account_mismatch`), or it
  /// is already that account's (`purchase_already_used`). Nothing is added here, ever.
  otherAccount,

  /// Google Play cancelled or refunded it (`purchase_canceled`, `purchase_voided`).
  refunded,

  /// The pass can no longer be bought (`product_expired`).
  ended,

  /// The server refused the purchase for good (a token, product, package or quantity it does not
  /// accept). Nothing was added; Google refunds a purchase nobody confirms within three days.
  refused;

  /// The server's answer is final for this account: sending it again cannot change it.
  bool get isFinal => this == otherAccount || this == refunded || this == ended || this == refused;
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
  AppLifecycleListener? _life;
  bool _alive = true;

  /// Purchase tokens the server confirmed, or refused for good, in this run of the app: a quiet
  /// check does not send them again (a student's Restore still does).
  final Set<String> _settled = {};

  /// Products Google Play reported as pending during the check that is running, or null when no
  /// check is running.
  Set<String>? _pendingSeen;
  DateTime? _lastResumeCheck;

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
      _life?.dispose();
      _life = null;
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
      if (next == null || (previous != null && previous != next)) _settled.clear();
      if (next == null) {
        _held.clear();
        _flow = false;
        _set(stage: BillingStage.idle, productId: null, failure: null, unconfirmed: 0);
      } else if (previous != next) {
        unawaited(_syncOwned());
      }
    });
    // On every launch with a signed-in student: ask Google Play what this account owns, which sends
    // again anything the server could not confirm last time. Quiet.
    Future<void>.microtask(() {
      if (_alive && ref.read(playBillingUserIdProvider) != null) unawaited(_syncOwned());
    });
    // Google Play's own guidance: ask again whenever the app comes back to the front, because a
    // pending payment can complete (or a purchase be made elsewhere) while the app is away.
    try {
      _life = AppLifecycleListener(onResume: () => unawaited(checkOnResume()));
    } on Object {
      _life = null; // No widgets binding (a plain unit test): launches and sign-ins still check.
    }
    return const PlayBillingState();
  }

  /// The app came back to the front: a quiet check of what Google Play holds, at most once every
  /// [minGap]. Skipped while the student is in Google Play's own sheet (its result arrives on the
  /// purchase stream), except when the purchase is pending, which this check is for.
  Future<void> checkOnResume({Duration minGap = const Duration(seconds: 30)}) async {
    if (_store == null || ref.read(playBillingUserIdProvider) == null) return;
    if (_flow && state.stage != BillingStage.pending) return;
    final now = DateTime.now();
    final last = _lastResumeCheck;
    if (last != null && now.difference(last) < minGap) return;
    _lastResumeCheck = now;
    await _syncOwned();
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
    var reached = false;
    try {
      if (!await store.isAvailable()) {
        _set(store: StoreAvailability.unavailable, productsLoading: false);
        return;
      }
      reached = true;
      final response = await store.queryProducts(PlayProducts.ids);
      final found = {for (final d in response.productDetails) d.id: d};
      _set(
        store: StoreAvailability.available,
        products: found,
        productsLoading: false,
        productsFailed: response.error != null && found.isEmpty,
      );
    } on Object {
      // Google Play answered and then the product query broke (a dropped connection): that is
      // "could not reach", not "not on this phone".
      _set(store: reached ? StoreAvailability.available : StoreAvailability.unavailable, productsLoading: false, productsFailed: reached);
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
    if (userId == null || state.busy || !ref.read(playBillingEnabledProvider)) return;
    if (store == null) {
      // Never a key that does nothing: say why nothing can be restored here.
      _end(BillingStage.failed, null, failure: BillingFailure.notReady);
      return;
    }
    _flow = true;
    _set(stage: BillingStage.restoring, productId: null, failure: null);
    try {
      await _syncOwned(includeCompleted: true, silent: false);
    } on _PlayNotReady {
      _end(BillingStage.failed, null, failure: BillingFailure.notReady);
      return;
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
  /// ordinary state again. Never clears work in progress. A payment that was pending is looked up
  /// again instead: it may have been paid, or Google Play may have dropped it, while the sheet was
  /// closed.
  void clearOutcome() {
    if (state.stage == BillingStage.pending) {
      unawaited(_syncOwned());
      return;
    }
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
    final seen = <String>{};
    _pendingSeen = seen;
    var answered = false;
    try {
      if (!await store.isAvailable()) {
        if (!silent) throw const _PlayNotReady();
        return;
      }
      await store.restore(accountHash: playAccountHash(userId));
      // The purchases arrive on the stream; let them in, then wait for each to be handled.
      await Future<void>.delayed(Duration.zero);
      await _queue;
      answered = true;
    } on Object {
      if (!silent) rethrow;
    } finally {
      _includeCompleted = before;
      if (identical(_pendingSeen, seen)) _pendingSeen = null;
      // A payment shown as pending that Google Play no longer holds as pending was either paid (and
      // delivered above) or dropped by Google Play: the sheet stops saying it is processing.
      final waiting = state.productId;
      if (answered && _alive && state.stage == BillingStage.pending && waiting != null && !seen.contains(waiting)) {
        _end(BillingStage.idle, null);
      }
    }
  }

  // The purchase stream.

  void _onPurchases(List<PurchaseDetails> purchases) {
    for (final p in purchases) {
      switch (p.status) {
        case PurchaseStatus.pending:
          if (p.productID.isNotEmpty) _pendingSeen?.add(p.productID);
          if (_flow || state.productId == p.productID) {
            _set(stage: BillingStage.pending, productId: p.productID.isEmpty ? state.productId : p.productID, failure: null);
          }
        case PurchaseStatus.canceled:
          if (_flow && state.stage != BillingStage.verifying) _end(BillingStage.cancelled, state.productId);
        case PurchaseStatus.error:
          final message = '${p.error?.message} ${p.error?.code} ${p.error?.details}'.toLowerCase();
          if (message.contains('alreadyowned') || message.contains('already_owned') || message.contains('already owned')) {
            // The account already owns it: find the purchase and deliver it. The check runs beside
            // the delivery queue, never on it: it waits for that queue itself, so chaining it there
            // would wait on itself and stop every delivery after it.
            final wasFlow = _flow;
            final about = state.productId;
            unawaited(_syncOwned(includeCompleted: wasFlow).then((_) {
              if (wasFlow && _flow && state.stage == BillingStage.starting) _end(BillingStage.failed, about, failure: BillingFailure.store);
            }).catchError((Object _) {}));
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
    // which stays owned until the server has consumed it. One the server already answered for good
    // in this run is not sent again unless the student asked (Restore).
    if (_settled.contains(token) && !includeCompleted) return;
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
      if (result.pending) {
        // The server asked Google, and Google is still waiting for the money: nothing is granted
        // and nothing went wrong. It is sent again when Google Play says it is paid, or next time.
        _hold(p);
        if (interactive) _set(stage: BillingStage.pending, productId: product.id, failure: null);
        return;
      }
      if (!result.confirmed) throw const ApiError(kind: ApiErrorKind.unknown, code: 'not_confirmed');
      // Granted. The server acknowledges (Pro) or consumes (a pack) the purchase with Google itself;
      // the app never does. If that step failed on the server (`finished: false`) the purchase is
      // still unfinished with Google Play, so the next check sends it again and the server finishes it.
      _held.remove(token);
      if (result.body['finished'] != false) _settled.add(token);
      _set(unconfirmed: _held.length);
      if (interactive) _end(BillingStage.confirmed, product.id);
      unawaited(ref.read(playBillingRefreshProvider)().catchError((Object _) {}));
    } on ApiError catch (e) {
      final failure = _failureFor(e);
      if (failure.isFinal) {
        // A final no: holding it would only send it again at every launch.
        _held.remove(token);
        _settled.add(token);
        _set(unconfirmed: _held.length);
      } else {
        _hold(p);
      }
      if (interactive) _end(BillingStage.failed, product.id, failure: failure);
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

  /// What a refusal from `POST /api/billing/play/verify` means for the student.
  static BillingFailure failureFor(ApiError e) => _failureFor(e);

  static BillingFailure _failureFor(ApiError e) {
    if (e.isOffline) return BillingFailure.offline;
    if (e.isRateLimited) return BillingFailure.rateLimited;
    if (e.hasCode('account_mismatch') || e.hasCode('purchase_already_used')) return BillingFailure.otherAccount;
    if (e.hasCode('purchase_voided') || e.hasCode('purchase_canceled')) return BillingFailure.refunded;
    if (e.hasCode('product_expired')) return BillingFailure.ended;
    const refusedCodes = {'unknown_product', 'bad_token', 'wrong_package', 'order_mismatch', 'product_mismatch', 'unsupported_quantity', 'purchase_invalid'};
    if (refusedCodes.any(e.hasCode)) return BillingFailure.refused;
    // A 404 with a Play code is about the purchase (Google has not seen it yet): try again. A bare
    // 404 is the server's flag being off.
    if (e.kind == ApiErrorKind.notFound && !ApiCodes.play.contains(e.code)) return BillingFailure.notOpenYet;
    return BillingFailure.couldNotConfirm;
  }
}

final playBillingProvider = NotifierProvider<PlayBillingController, PlayBillingState>(PlayBillingController.new);

class _PlayNotReady implements Exception {
  const _PlayNotReady();
}
