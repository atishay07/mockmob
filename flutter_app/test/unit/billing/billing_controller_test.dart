import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';

import 'billing_test_support.dart';

class _Id extends Notifier<String?> {
  @override
  String? build() => 'user-1';

  void set(String? v) => state = v;
}

void main() {
  tearDown(disposeContainers);

  PlayBillingController ctl(ProviderContainer c) => c.read(playBillingProvider.notifier);
  PlayBillingState st(ProviderContainer c) => c.read(playBillingProvider);

  Future<ProviderContainer> ready(BillingRig rig) async {
    final c = rig.container();
    c.listen(playBillingProvider, (_, _) {});
    await settle();
    await ctl(c).loadProducts();
    return c;
  }

  group('flag off', () {
    test('nothing starts: the store is never opened and a purchase does nothing', () async {
      final rig = BillingRig(on: false);
      final c = rig.container();
      c.listen(playBillingProvider, (_, _) {});
      await settle();
      await ctl(c).loadProducts();
      await ctl(c).buy(PlayProducts.proId);
      await ctl(c).restore();
      expect(rig.store.listened, isFalse);
      expect(rig.store.queries, 0);
      expect(rig.store.buys, isEmpty);
      expect(rig.store.restoreHashes, isEmpty);
      expect(st(c).stage, BillingStage.idle);
      expect(c.read(playBillingEnabledProvider), isFalse);
    });
  });

  group('products', () {
    test('the price is the string Google Play returned, never one the app wrote', () async {
      final c = await ready(BillingRig());
      expect(st(c).store, StoreAvailability.available);
      expect(st(c).priceOf(PlayProducts.proId), '₹149.00');
      expect(st(c).priceOf('ai_credits_prepos_50_400'), '₹75.00');
      expect(st(c).priceOf('nope'), isNull);
    });

    test('a store that is not available says so', () async {
      final c = await ready(BillingRig(store: FakePlayStore(available: false)));
      expect(st(c).store, StoreAvailability.unavailable);
      expect(st(c).products, isEmpty);
    });

    test('an error from Google Play is a failed query, a missing product is just missing', () async {
      final store = FakePlayStore()..queryError = true;
      final c = await ready(BillingRig(store: store));
      expect(st(c).productsFailed, isTrue);
      store.queryError = false;
      store.missing = {PlayProducts.proId};
      await ctl(c).loadProducts(force: true);
      expect(st(c).productsFailed, isFalse);
      expect(st(c).priceOf(PlayProducts.proId), isNull);
      expect(st(c).priceOf('ai_credits_prepos_10_50'), isNotNull);
    });
  });

  group('buying', () {
    test('Pro: Google Play opens with the hashed account id; the server confirms; only then is it acknowledged', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy(PlayProducts.proId);
      await settle();

      expect(rig.store.buys.single.productId, PlayProducts.proId);
      expect(rig.store.buys.single.consumable, isFalse);
      expect(rig.store.buys.single.accountHash, playAccountHash('user-1'));
      expect(rig.store.buys.single.accountHash, hasLength(64));
      expect(rig.store.buys.single.accountHash, isNot(contains('user-1')));
      expect(rig.verifier.calls.single.productId, PlayProducts.proId);
      expect(rig.verifier.calls.single.purchaseToken, 'token-${PlayProducts.proId}');
      expect(rig.verifier.calls.single.orderId, 'GPA.1234-5678');
      expect(rig.verifier.calls.single.userId, 'user-1');
      expect(rig.store.finished.single, (productId: PlayProducts.proId, consumable: false));
      expect(st(c).stage, BillingStage.confirmed);
      expect(rig.refreshes, 1);
      expect(st(c).unconfirmed, 0);
    });

    test('a credit pack is a consumable and is consumed after the server confirms', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy('ai_credits_prepos_20_150');
      await settle();
      expect(rig.store.buys.single.consumable, isTrue);
      expect(rig.store.finished.single, (productId: 'ai_credits_prepos_20_150', consumable: true));
      expect(st(c).stage, BillingStage.confirmed);
    });

    test('nothing is finished and nothing said before the server answers', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      var sawVerifying = false;
      c.listen(playBillingProvider, (_, next) {
        if (next.stage == BillingStage.verifying) {
          sawVerifying = true;
          expect(rig.store.finished, isEmpty);
        }
        if (next.stage == BillingStage.confirmed) expect(rig.store.finished, hasLength(1));
      });
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(sawVerifying, isTrue);
    });

    test('the student closing Google Play is a cancel, not an error, and nothing is sent', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.canceled));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.cancelled);
      expect(st(c).failure, isNull);
      expect(rig.verifier.calls, isEmpty);
      expect(rig.store.finished, isEmpty);
    });

    test('an error from Google Play is a failure with a way out, and nothing is sent', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(PurchaseDetails(
            purchaseID: '',
            productID: '',
            verificationData: PurchaseVerificationData(localVerificationData: '', serverVerificationData: '', source: 'google_play'),
            transactionDate: null,
            status: PurchaseStatus.error,
          )..error = IAPError(source: 'google_play', code: 'purchase_error', message: 'BillingResponse.error'));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(st(c).failure, BillingFailure.store);
      expect(rig.verifier.calls, isEmpty);
      ctl(c).clearOutcome();
      expect(st(c).stage, BillingStage.idle);
    });

    test('pending: Google Play has not finished the payment, so nothing is sent; it is delivered when it lands', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.pending));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.pending);
      expect(st(c).productId, PlayProducts.proId);
      expect(rig.verifier.calls, isEmpty);
      expect(st(c).busy, isTrue);

      rig.store.emit(purchase(PlayProducts.proId));
      await settle();
      expect(rig.verifier.calls, hasLength(1));
      expect(st(c).stage, BillingStage.confirmed);
    });

    test('already owned: Google Play will not open, so the owned purchase is found and delivered', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.buyStarts = false;
      rig.store.owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)];
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(rig.verifier.calls.single.productId, PlayProducts.proId);
      expect(st(c).stage, BillingStage.confirmed);
    });

    test('Google Play will not open and owns nothing: a plain failure', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.buyStarts = false;
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(st(c).failure, BillingFailure.store);
    });

    test('a product Google Play did not return cannot be bought', () async {
      final store = FakePlayStore()..missing = {PlayProducts.proId};
      final rig = BillingRig(store: store);
      final c = await ready(rig);
      await ctl(c).buy(PlayProducts.proId);
      expect(rig.store.buys, isEmpty);
      expect(st(c).stage, BillingStage.idle);
    });

    test('signed out: nothing can be bought', () async {
      final rig = BillingRig(userId: null);
      final c = await ready(rig);
      await ctl(c).buy(PlayProducts.proId);
      expect(rig.store.buys, isEmpty);
    });
  });

  group('the server cannot confirm', () {
    test('a server error: the purchase is not finished, it is held, and Try again sends it once more', () async {
      final rig = BillingRig();
      rig.verifier.failWith = serverBroken;
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(st(c).failure, BillingFailure.couldNotConfirm);
      expect(rig.store.finished, isEmpty);
      expect(st(c).unconfirmed, 1);
      expect(rig.refreshes, 0);

      rig.verifier.failWith = null;
      await ctl(c).retry();
      await settle();
      expect(rig.verifier.calls, hasLength(2));
      expect(rig.verifier.calls.last.purchaseToken, rig.verifier.calls.first.purchaseToken);
      expect(rig.store.finished, hasLength(1));
      expect(st(c).stage, BillingStage.confirmed);
      expect(st(c).unconfirmed, 0);
    });

    test('offline says offline; the server flag off (404) says it is not open yet', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      rig.verifier.failWith = serverOffline;
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).failure, BillingFailure.offline);
      ctl(c).clearOutcome();

      rig.verifier.failWith = serverNotOpen;
      await ctl(c).retry();
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(st(c).failure, BillingFailure.notOpenYet);
      expect(rig.store.finished, isEmpty);
    });

    test('a 2xx that says it did not grant is not a confirmation', () async {
      final rig = BillingRig();
      rig.verifier.denies = true;
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(rig.store.finished, isEmpty);
      expect(rig.refreshes, 0);
    });

    test('next launch: the unfinished purchase comes back from Google Play and is sent again', () async {
      // Launch one: the server fails.
      final first = BillingRig();
      first.verifier.failWith = serverBroken;
      final c1 = await ready(first);
      first.store.onBuy = (p) => first.store.emit(purchase(p.id));
      await ctl(c1).buy(PlayProducts.proId);
      await settle();
      expect(first.store.finished, isEmpty);
      final unfinished = purchase(PlayProducts.proId, status: PurchaseStatus.restored);
      c1.dispose();

      // Launch two: Google Play still holds it, unacknowledged. The check at start-up delivers it.
      final second = BillingRig(store: FakePlayStore()..owned = [unfinished]);
      final c2 = second.container();
      c2.listen(playBillingProvider, (_, _) {});
      await settle();
      expect(second.store.restoreHashes.single, playAccountHash('user-1'));
      expect(second.verifier.calls.single.purchaseToken, 'token-${PlayProducts.proId}');
      expect(second.store.finished.single, (productId: PlayProducts.proId, consumable: false));
      expect(second.refreshes, 1);
      // The student never opened a sheet, so nothing on a sheet changed.
      expect(c2.read(playBillingProvider).stage, BillingStage.idle);
    });

    test('a quiet check at start-up leaves a purchase that is already acknowledged alone', () async {
      final rig = BillingRig(store: FakePlayStore()..owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)]);
      final c = rig.container();
      c.listen(playBillingProvider, (_, _) {});
      await settle();
      expect(rig.store.restoreHashes, hasLength(1));
      expect(rig.verifier.calls, isEmpty);
      expect(rig.store.finished, isEmpty);
    });

    test('a pack that is still owned is consumed on the quiet check, so it can be bought again', () async {
      final rig = BillingRig(store: FakePlayStore()..owned = [purchase('ai_credits_prepos_10_50', status: PurchaseStatus.restored, pendingComplete: false)]);
      final c = rig.container();
      c.listen(playBillingProvider, (_, _) {});
      await settle();
      expect(rig.verifier.calls.single.productId, 'ai_credits_prepos_10_50');
      expect(rig.store.finished.single, (productId: 'ai_credits_prepos_10_50', consumable: true));
    });

    test('a failure on the quiet check shows nothing and is tried again next launch', () async {
      final rig = BillingRig(store: FakePlayStore()..owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored)]);
      rig.verifier.failWith = serverOffline;
      final c = rig.container();
      c.listen(playBillingProvider, (_, _) {});
      await settle();
      expect(rig.store.finished, isEmpty);
      expect(c.read(playBillingProvider).stage, BillingStage.idle);
      expect(c.read(playBillingProvider).unconfirmed, 1);
    });
  });

  group('restore', () {
    test('sends what the account owns to the server and says so only when it confirms', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)];
      await ctl(c).restore();
      await settle();
      expect(rig.verifier.calls.single.productId, PlayProducts.proId);
      expect(st(c).stage, BillingStage.confirmed);
      expect(rig.refreshes, 1);
    });

    test('nothing to restore is said plainly', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      await ctl(c).restore();
      await settle();
      expect(st(c).stage, BillingStage.restoredNothing);
      expect(rig.verifier.calls, isEmpty);
    });

    test('a restore the server cannot confirm is a failure, not a success', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.verifier.failWith = serverBroken;
      rig.store.owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)];
      await ctl(c).restore();
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(rig.store.finished, isEmpty);
    });
  });

  group('accounts', () {
    test('the account hash is a SHA-256 of the user id and nothing else', () {
      expect(playAccountHash('user-1'), hasLength(64));
      expect(playAccountHash('a'), isNot(playAccountHash('b')));
      expect(playAccountHash('a'), 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
    });

    test('purchases held for one account are dropped when the student signs out', () async {
      final rig = BillingRig();
      rig.verifier.failWith = serverBroken;
      final id = NotifierProvider<_Id, String?>(_Id.new);
      final c = ProviderContainer(overrides: [
        ...rig.overrides.where((o) => o.origin != playBillingUserIdProvider),
        playBillingUserIdProvider.overrideWith((ref) => ref.watch(id)),
      ]);
      addTearDownContainer(c);
      c.listen(playBillingProvider, (_, _) {});
      await settle();
      await ctl(c).loadProducts();
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).unconfirmed, 1);
      c.read(id.notifier).set(null);
      await settle();
      expect(st(c).unconfirmed, 0);
      expect(st(c).stage, BillingStage.idle);
    });
  });
}
