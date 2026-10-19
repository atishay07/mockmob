// The app against the server's Play billing contract (PLAY-BILLING-PLAN-1018, 19 Oct PM audit):
// what the server's answers mean for the student, that a pending payment is never called paid or
// failed, that nothing stalls after Google Play says an item is already owned, that the app asks
// Google Play again when it comes back to the front, and that every reader of the plan and the
// balance is read again after a grant (D101: a mode Pro holds opens at once).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/data/play_verifier.dart';
import 'package:mockmob/features/billing/widgets/billing_notice.dart';
import 'package:mockmob/features/credits/data/credits_data.dart';
import 'package:mockmob/features/practice/data/practice_quote.dart';
import 'package:mockmob/features/practice/model/cost_line.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';

import '../practice/support/harness.dart' show FakeQuoteRepository, creditsQuote, proGate;
import '../wallet/wallet_test_support.dart' show FakeWalletRepo, walletState;
import '../you/you_test_support.dart' show FakeAuth, FakeMeCredits, creditsState;
import 'billing_test_support.dart';

class _FakeCreditsRepo extends CreditsRepository {
  int refreshes = 0;

  @override
  RemoteState<AiCredits> build() => const RemoteState<AiCredits>();

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;
}

ApiError _playError(int status, String code) =>
    ApiError.fromResponse(status, {'ok': false, 'error': 'A sentence for people, never shown.', 'code': code});

PurchaseDetails _alreadyOwnedError() => PurchaseDetails(
      purchaseID: '',
      productID: '',
      verificationData: PurchaseVerificationData(localVerificationData: '', serverVerificationData: '', source: 'google_play'),
      transactionDate: null,
      status: PurchaseStatus.error,
    )..error = IAPError(source: 'google_play', code: 'purchase_error', message: 'BillingResponse.itemAlreadyOwned');

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

  group('the server\'s answers, read', () {
    test('the verify route\'s machine code is read from its top-level code; other routes are unchanged', () {
      final e = _playError(403, 'account_mismatch');
      expect(e.code, 'account_mismatch');
      expect(e.kind, ApiErrorKind.forbidden);
      expect(_playError(404, 'purchase_not_found').code, 'purchase_not_found');
      // Even when the sentence in `error` happens to be one word, the Play code is the code.
      expect(ApiError.fromResponse(403, {'ok': false, 'error': 'Forbidden', 'code': 'account_mismatch'}).code, 'account_mismatch');
      // A route that is not the Play route keeps its old reading: an unknown top-level code is not taken.
      expect(ApiError.fromResponse(409, {'error': 'Conflict here', 'code': 'SOMETHING_ELSE'}).code, isNot('SOMETHING_ELSE'));
    });

    test('202 purchase_pending is a wait, not a yes and not a failure; only ok: true is a yes', () {
      final pending = ApiPlayVerifier.readVerifyAnswer(202, {'ok': false, 'error': 'The payment is still pending.', 'code': 'purchase_pending', 'pending': true});
      expect(pending.pending, isTrue);
      expect(pending.confirmed, isFalse);
      final yes = ApiPlayVerifier.readVerifyAnswer(200, {'ok': true, 'idempotent': false, 'productId': 'pro_cuet_2027', 'kind': 'pro', 'finished': true});
      expect(yes.confirmed, isTrue);
      expect(yes.pending, isFalse);
      expect(ApiPlayVerifier.readVerifyAnswer(200, const {}).confirmed, isFalse, reason: 'an empty 200 is not the server saying yes');
    });

    test('each refusal says what happened; only the ones that can change offer Try again', () {
      final table = <ApiError, BillingFailure>{
        _playError(403, 'account_mismatch'): BillingFailure.otherAccount,
        _playError(409, 'purchase_already_used'): BillingFailure.otherAccount,
        _playError(409, 'purchase_voided'): BillingFailure.refunded,
        _playError(409, 'purchase_canceled'): BillingFailure.refunded,
        _playError(409, 'product_expired'): BillingFailure.ended,
        _playError(400, 'bad_token'): BillingFailure.refused,
        _playError(400, 'wrong_package'): BillingFailure.refused,
        _playError(409, 'unsupported_quantity'): BillingFailure.refused,
        _playError(404, 'purchase_not_found'): BillingFailure.couldNotConfirm,
        _playError(503, 'play_unavailable'): BillingFailure.couldNotConfirm,
        _playError(503, 'grant_unavailable'): BillingFailure.couldNotConfirm,
        ApiError.fromResponse(404, {'error': 'Not found'}): BillingFailure.notOpenYet,
        ApiError.fromResponse(429, {'error': 'Too many attempts. Wait a few minutes and try again.', 'code': 'rate_limited'}): BillingFailure.rateLimited,
        const ApiError(kind: ApiErrorKind.network, code: 'network'): BillingFailure.offline,
      };
      table.forEach((error, failure) => expect(PlayBillingController.failureFor(error), failure, reason: '${error.status} ${error.code}'));
      expect([for (final f in BillingFailure.values) if (f.isFinal) f], [BillingFailure.otherAccount, BillingFailure.refunded, BillingFailure.ended, BillingFailure.refused]);
      for (final f in BillingFailure.values) {
        final line = billingFailureMessage(f);
        expect(line, isNotEmpty);
        expect(line.toLowerCase(), isNot(contains('website')));
        expect(line, isNot(contains('₹')));
      }
      expect(billingFailureMessage(BillingFailure.otherAccount), BillingCopy.failOtherAccount);
    });
  });

  group('a pending payment', () {
    test('the server says pending: the sheet says it is processing, holds it, and it lands once paid', () async {
      final rig = BillingRig();
      rig.verifier.pending = true;
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.pending);
      expect(st(c).failure, isNull);
      expect(st(c).unconfirmed, 1);
      expect(rig.refreshes, 0);

      rig.verifier.pending = false;
      rig.store.emit(purchase(PlayProducts.proId));
      await settle();
      expect(st(c).stage, BillingStage.confirmed);
      expect(st(c).unconfirmed, 0);
      expect(rig.refreshes, 1);
    });

    test('a pending payment Google Play has since dropped stops saying "processing" when the sheet opens again', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.pending));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.pending);

      rig.store.owned = [];
      ctl(c).clearOutcome();
      await settle();
      expect(st(c).stage, BillingStage.idle);
      expect(st(c).busy, isFalse);
    });

    test('a payment Google Play still holds as pending stays pending', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, status: PurchaseStatus.pending));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      rig.store.owned = [purchase(PlayProducts.proId, status: PurchaseStatus.pending)];
      ctl(c).clearOutcome();
      await settle();
      expect(st(c).stage, BillingStage.pending);
      expect(rig.verifier.calls, isEmpty);
    });
  });

  group('Google Play not ready', () {
    test('Restore says Google Play is not ready instead of doing nothing', () async {
      final rig = BillingRig(store: FakePlayStore(available: false));
      final c = await ready(rig);
      await ctl(c).restore();
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(st(c).failure, BillingFailure.notReady);
      expect(billingFailureMessage(BillingFailure.notReady), BillingCopy.restoreNotReady);
    });

    test('with no Google Play plugin at all, Restore still answers', () async {
      final rig = BillingRig();
      final c = ProviderContainer(overrides: [
        appConfigProvider.overrideWithValue(playOnConfig),
        playStoreProvider.overrideWith((ref) => throw StateError('no plugin')),
        playVerifierProvider.overrideWithValue(rig.verifier),
        playBillingUserIdProvider.overrideWithValue('user-1'),
        playBillingRefreshProvider.overrideWithValue(() async {}),
      ]);
      addTearDownContainer(c);
      c.listen(playBillingProvider, (_, _) {});
      await settle();
      expect(st(c).store, StoreAvailability.unavailable);
      await ctl(c).restore();
      expect(st(c).failure, BillingFailure.notReady);
    });
  });

  group('final answers', () {
    test('another account\'s purchase: said plainly, not held, and not sent again on a quiet check', () async {
      final rig = BillingRig();
      rig.verifier.failWith = _playError(403, 'account_mismatch');
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(st(c).stage, BillingStage.failed);
      expect(st(c).failure, BillingFailure.otherAccount);
      expect(st(c).unconfirmed, 0);

      rig.store.owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored)];
      await ctl(c).checkOnResume(minGap: Duration.zero);
      await settle();
      expect(rig.verifier.calls, hasLength(1));
    });

    test('too many tries: held, so Try again and the next launch still send it', () async {
      final rig = BillingRig();
      rig.verifier.failWith = ApiError.fromResponse(429, {'error': 'Too many attempts.', 'code': 'rate_limited'});
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy('credits_10_50');
      await settle();
      expect(st(c).failure, BillingFailure.rateLimited);
      expect(st(c).unconfirmed, 1);
    });
  });

  group('Google Play says the item is already owned', () {
    test('the owned purchase is found and delivered, and later purchases are not stuck behind it', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      rig.store.owned = [purchase('credits_10_50', status: PurchaseStatus.restored, pendingComplete: false)];
      rig.store.onBuy = (_) => rig.store.emit(_alreadyOwnedError());
      await ctl(c).buy('credits_10_50');
      await settle();
      await settle();
      expect(rig.verifier.calls.map((v) => v.productId), contains('credits_10_50'));
      expect(st(c).stage, BillingStage.confirmed);

      // The queue still moves: a new purchase is verified.
      final before = rig.verifier.calls.length;
      rig.store.owned = [];
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id, token: 'token-fresh'));
      ctl(c).clearOutcome();
      await ctl(c).buy(PlayProducts.proId);
      await settle();
      expect(rig.verifier.calls.length, before + 1);
      expect(rig.verifier.calls.last.purchaseToken, 'token-fresh');
      expect(st(c).stage, BillingStage.confirmed);
    });
  });

  group('coming back to the front', () {
    test('asks Google Play again and sends what is unfinished; not more than once in the gap', () async {
      final rig = BillingRig();
      final c = await ready(rig);
      final restoresAtLaunch = rig.store.restoreHashes.length;
      rig.store.owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored)];
      await ctl(c).checkOnResume();
      await settle();
      expect(rig.store.restoreHashes.length, restoresAtLaunch + 1);
      expect(rig.verifier.calls.single.productId, PlayProducts.proId);
      expect(st(c).stage, BillingStage.idle, reason: 'a quiet check changes no sheet');

      await ctl(c).checkOnResume();
      await settle();
      expect(rig.store.restoreHashes.length, restoresAtLaunch + 1);
    });

    test('a grant the server could not finish with Google (finished: false) is sent again so the server finishes it', () async {
      final rig = BillingRig();
      rig.verifier.body = const {'ok': true, 'finished': false};
      final c = await ready(rig);
      rig.store.onBuy = (p) => rig.store.emit(purchase(p.id));
      await ctl(c).buy('credits_29_150');
      await settle();
      expect(st(c).stage, BillingStage.confirmed);

      rig.verifier.body = const {'ok': true, 'finished': true};
      rig.store.owned = [purchase('credits_29_150', status: PurchaseStatus.restored, pendingComplete: false)];
      await ctl(c).checkOnResume(minGap: Duration.zero);
      await settle();
      expect(rig.verifier.calls, hasLength(2));

      // Finished now: a quiet check leaves it alone.
      await ctl(c).checkOnResume(minGap: Duration.zero);
      await settle();
      expect(rig.verifier.calls, hasLength(2));
    });
  });

  group('after a grant', () {
    test('the plan, the balance, the Wallet and Practice\'s quotes are all read again, so a Pro mode opens at once (D101)', () async {
      final auth = FakeAuth(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Asha Verma'));
      final me = FakeMeCredits(creditsState());
      final credits = _FakeCreditsRepo();
      final wallet = FakeWalletRepo(walletState());
      var pro = false;
      final quotes = FakeQuoteRepository((subject, mode, count, purpose) => pro ? creditsQuote(mode: 'nta', count: 50) : proGate());
      final c = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(() => auth),
        meCreditsProvider.overrideWith(() => me),
        creditsRepositoryProvider.overrideWith(() => credits),
        walletRepositoryProvider.overrideWith(() => wallet),
        quoteRepositoryProvider.overrideWithValue(quotes),
      ]);
      addTearDownContainer(c);
      const q = QuoteQuery(subject: 'accountancy', apiMode: 'nta', count: 50);
      c.listen(practiceQuoteProvider(q), (_, _) {});
      final before = await c.read(practiceQuoteProvider(q).future);
      expect(practiceModeAccess(before, isPro: false), ModeAccess.locked);

      pro = true; // The server granted Pro.
      await c.read(playBillingRefreshProvider)();
      final after = await c.read(practiceQuoteProvider(q).future);

      expect(auth.reloads, 1);
      expect(me.refreshes, 1);
      expect(credits.refreshes, 1);
      expect(wallet.refreshes, 1);
      expect(quotes.calls, hasLength(2));
      expect(practiceModeAccess(after, isPro: true), ModeAccess.open);
    });
  });

  group('the products', () {
    test('the app sells exactly the server\'s products, with the website catalogue\'s credits', () {
      // The server's map (src/lib/payments/playProducts.js, from src/services/credits/creditPacks.mjs).
      expect(PlayProducts.ids, {'pro_cuet_2027', 'credits_10_50', 'credits_29_150', 'credits_49_300'});
      expect({for (final p in PlayProducts.packs) p.id: p.credits}, {'credits_10_50': 50, 'credits_29_150': 150, 'credits_49_300': 300});
      expect(PlayProducts.pro.consumable, isFalse);
      expect(PlayProducts.packs.every((p) => p.consumable), isTrue);
    });

    test('the obfuscated account id matches the server\'s test vector: lowercase hex SHA-256, 64 characters', () {
      expect(playAccountHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
  });
}
