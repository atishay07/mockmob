// The subscription on screen is the freshest word the app has (review of ui/1019pm-play-subs, 19 Oct
// 2026): a cancel in Google Play shows after Manage subscription without a restart, a fresh profile
// replaces this run's verify answer, an on-hold refusal replaces an earlier "active", and a quiet
// launch check that only confirmed the same subscription reloads nothing.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/auth_me.dart' show PlaySubscriptionInfo;
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/widgets/get_pro_sheet.dart' show subscriptionLine;

import 'billing_test_support.dart';

class _Auth extends AuthController {
  _Auth(this.initial);

  final AuthSnapshot initial;
  int reloads = 0;

  /// What the profile says when it is read again; null leaves it as it is.
  AuthSnapshot? onReload;

  @override
  AuthSnapshot build() => initial;

  void put(AuthSnapshot next) => state = next;

  @override
  Future<void> reload() async {
    reloads++;
    final next = onReload;
    if (next != null) state = next;
  }
}

AuthSnapshot _signedIn({PlaySubscriptionInfo? sub, bool pro = true}) =>
    AuthSnapshot(status: AuthStatus.signedIn, userId: 'user-1', isPro: pro, playSubscription: sub);

Map<String, dynamic> _granted(PlaySubscriptionInfo sub, {bool idempotent = true}) =>
    {'ok': true, 'finished': true, 'idempotent': idempotent, 'subscription': sub.toJson()};

void main() {
  tearDown(disposeContainers);

  final paidTo = DateTime.utc(2026, 11, 19, 10);
  final renewing = playSub(expiresAt: paidTo);
  final cancelled = playSub(state: 'canceled', autoRenewing: false, expiresAt: paidTo);
  final onHold = playSub(state: 'on_hold', active: false, autoRenewing: true, expiresAt: paidTo, hold: true);

  PlayBillingController ctl(ProviderContainer c) => c.read(playBillingProvider.notifier);

  /// A subscriber whose Google Play holds pro_monthly, and whose profile says [profile].
  Future<(ProviderContainer, BillingRig, _Auth)> launch({PlaySubscriptionInfo? profile, PlaySubscriptionInfo? verify}) async {
    final rig = BillingRig(store: FakePlayStore()..owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)]);
    rig.verifier.body = _granted(verify ?? renewing);
    final auth = _Auth(_signedIn(sub: profile));
    final c = ProviderContainer(overrides: [...rig.overrides, authSnapshotProvider.overrideWith(() => auth)]);
    addTearDownContainer(c);
    c.listen(playBillingProvider, (_, _) {});
    c.listen(playSubscriptionProvider, (_, _) {});
    await settle();
    return (c, rig, auth);
  }

  group('a cancel in Google Play', () {
    test('back from Manage subscription, the subscription is sent again and the line says renewal is off', () async {
      final (c, rig, _) = await launch(profile: renewing);
      expect(rig.verifier.calls, hasLength(1));
      expect(subscriptionLine(c.read(playSubscriptionProvider)!), BillingCopy.subRenews('19 November'));

      // An ordinary resume does not send a settled subscription again.
      await ctl(c).checkOnResume(minGap: Duration.zero);
      await settle();
      expect(rig.verifier.calls, hasLength(1));

      expect(await ctl(c).manageSubscription(), isTrue);
      expect(rig.manageOpened, 1);
      // The student turns renewal off in Google Play; the server reads that from Google.
      rig.verifier.body = _granted(cancelled);
      final rereadsBefore = rig.rereads;
      // Back within the usual 30 seconds between checks: the check still runs.
      await ctl(c).checkOnResume();
      await settle();

      expect(rig.verifier.calls, hasLength(2), reason: 'the subscription is sent to the server again');
      expect(c.read(playSubscriptionProvider)!.renewalOff, isTrue);
      expect(subscriptionLine(c.read(playSubscriptionProvider)!), BillingCopy.subRenewalOff('19 November'));
      expect(rig.rereads, rereadsBefore + 1, reason: 'the profile is read again too (a refund shows only there)');

      // Only the one resume after Manage subscription sends it again.
      await ctl(c).checkOnResume(minGap: Duration.zero);
      await settle();
      expect(rig.verifier.calls, hasLength(2));
    });

    test('Google Play not opening changes nothing on the next resume', () async {
      final rig = BillingRig(manageOpens: false, store: FakePlayStore()..owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)]);
      rig.verifier.body = _granted(renewing);
      final c = rig.container();
      c.listen(playBillingProvider, (_, _) {});
      await settle();
      expect(await ctl(c).manageSubscription(), isFalse);
      await ctl(c).checkOnResume(minGap: Duration.zero);
      await settle();
      expect(rig.verifier.calls, hasLength(1));
    });

    test('a resume reads a Play subscriber\'s profile again, at most once every 30 seconds; nobody else\'s', () async {
      final (c, rig, _) = await launch(profile: renewing);
      await ctl(c).checkOnResume();
      await settle();
      expect(rig.rereads, 1);
      await ctl(c).checkOnResume();
      await settle();
      expect(rig.rereads, 1, reason: 'within the gap nothing is asked again');

      final free = BillingRig();
      final c2 = free.container();
      c2.listen(playBillingProvider, (_, _) {});
      await settle();
      await c2.read(playBillingProvider.notifier).checkOnResume(minGap: Duration.zero);
      await settle();
      expect(free.rereads, 0, reason: 'no subscription: nothing to read again');
    });
  });

  group('the freshest answer wins', () {
    test('a profile that arrives with a different subscription replaces this run\'s verify answer', () async {
      final (c, _, auth) = await launch(profile: renewing);
      expect(c.read(playSubscriptionProvider), renewing);
      // Google told the server about the cancel; the profile is read again (a practice launch, a pack).
      auth.put(_signedIn(sub: cancelled));
      await settle();
      expect(c.read(playSubscriptionProvider), cancelled);
      expect(subscriptionLine(c.read(playSubscriptionProvider)!), BillingCopy.subRenewalOff('19 November'));
    });

    test('after a refund the profile has no subscription, and none is drawn', () async {
      final (c, _, auth) = await launch(profile: renewing);
      auth.put(_signedIn(pro: false));
      await settle();
      expect(c.read(playSubscriptionProvider), isNull);
    });

    test('a profile read again that says the same keeps the verify answer', () async {
      final (c, _, auth) = await launch(profile: renewing, verify: cancelled);
      expect(c.read(playSubscriptionProvider), cancelled, reason: 'verify is newer than the profile read at launch');
      auth.put(_signedIn(sub: renewing));
      await settle();
      expect(c.read(playSubscriptionProvider), cancelled);
    });

    test('an on-hold refusal replaces an earlier "active" with the server\'s own answer', () async {
      final (c, rig, _) = await launch(profile: renewing);
      expect(c.read(playSubscriptionProvider)!.active, isTrue);
      final refusal = ApiError.fromResponse(409, {
        'ok': false,
        'error': 'A sentence for people.',
        'code': 'subscription_on_hold',
        'subscription': onHold.toJson(),
        'pro': {'isPremium': false, 'premiumUntil': null},
      });
      expect(refusal.details['subscription'], isA<Map<String, Object?>>());
      rig.verifier.failWith = refusal;
      await ctl(c).restore();
      await settle();
      final sub = c.read(playSubscriptionProvider)!;
      expect(sub.active, isFalse);
      expect(sub.onHold, isTrue);
      expect(c.read(playBillingProvider).failure, BillingFailure.subscriptionOnHold);
    });

    test('the subscription block is read only from the subscription refusals', () {
      final e = ApiError.fromResponse(409, {'ok': false, 'error': 'x', 'code': 'purchase_voided', 'subscription': onHold.toJson()});
      expect(e.details.containsKey('subscription'), isFalse);
    });
  });

  group('what a quiet launch check reloads', () {
    test('the same subscription the profile already shows: nothing is read again', () async {
      final (_, rig, _) = await launch(profile: renewing);
      expect(rig.verifier.calls, hasLength(1));
      expect(rig.refreshes, 0);
    });

    test('a subscription that differs from the profile, or a first grant: the plan is read again', () async {
      final (_, rig, _) = await launch(profile: renewing, verify: cancelled);
      expect(rig.refreshes, 1);

      final rig2 = BillingRig(store: FakePlayStore()..owned = [purchase(PlayProducts.proId, status: PurchaseStatus.restored, pendingComplete: false)]);
      rig2.verifier.body = _granted(renewing, idempotent: false);
      final auth = _Auth(_signedIn(sub: renewing));
      final c2 = ProviderContainer(overrides: [...rig2.overrides, authSnapshotProvider.overrideWith(() => auth)]);
      addTearDownContainer(c2);
      c2.listen(playBillingProvider, (_, _) {});
      await settle();
      expect(rig2.refreshes, 1);
    });
  });

  group('reading the profile again', () {
    test('the rest of the plan is reloaded only when the profile changed', () async {
      var refreshes = 0;
      final auth = _Auth(_signedIn(sub: renewing));
      final c = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(() => auth),
        playBillingRefreshProvider.overrideWithValue(() async => refreshes++),
      ]);
      addTearDownContainer(c);
      c.listen(authSnapshotProvider, (_, _) {});
      await c.read(playProfileRereadProvider)();
      expect(auth.reloads, 1);
      expect(refreshes, 0);
      auth.onReload = _signedIn(pro: false);
      await c.read(playProfileRereadProvider)();
      expect(auth.reloads, 2);
      expect(refreshes, 1);
    });
  });
}
