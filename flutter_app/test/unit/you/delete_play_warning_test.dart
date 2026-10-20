// Delete account and Google Play (owner CTO call, 20 Oct 2026): deleting the account never cancels a Google Play
// subscription, so a student whose Pro can still charge them is told, before they type DELETE and again once the
// request is recorded, with a key that opens Google Play's subscription page. A subscription that was already
// cancelled (it only runs to its end) or one that is over owes no warning. A question left waiting in Ask Mobi is
// forgotten once the request is with us, and only then.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/auth/sign_out_cleanup.dart';
import 'package:mockmob/core/models/auth_me.dart' show PlaySubscriptionInfo;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import '../pro_nudge/pro_nudge_test_support.dart' show settleNudges;
import 'you_test_support.dart';

PlaySubscriptionInfo _sub({
  String state = 'active',
  bool active = true,
  bool? autoRenewing = true,
  bool inGracePeriod = false,
  bool onHold = false,
}) =>
    PlaySubscriptionInfo(
      productId: 'mockmob_pro_monthly',
      state: state,
      active: active,
      autoRenewing: autoRenewing,
      expiresAt: DateTime(2026, 11, 20),
      inGracePeriod: inGracePeriod,
      onHold: onHold,
    );

ApiResponse _recordedAt(DateTime at) => ApiResponse(200, {'status': 'pending', 'requestedAt': at.toUtc().toIso8601String(), 'message': 'ok'});

void main() {
  // The real type: the Ahem test font is twice as wide, and the banner's key would overflow in it.
  setUpAll(loadAppFonts);

  group('deleteLeavesPlayCharging', () {
    test('a subscription that can still charge is owed a warning', () {
      expect(deleteLeavesPlayCharging(_sub()), isTrue, reason: 'active, renewal on');
      expect(deleteLeavesPlayCharging(_sub(autoRenewing: null)), isTrue, reason: 'renewal not known to be off');
      expect(deleteLeavesPlayCharging(_sub(state: 'in_grace_period', inGracePeriod: true)), isTrue, reason: 'Google Play is retrying a payment');
      expect(deleteLeavesPlayCharging(_sub(state: 'on_hold', active: false, onHold: true, autoRenewing: true)), isTrue, reason: 'held');
      expect(deleteLeavesPlayCharging(_sub(state: 'paused', active: false, autoRenewing: false)), isTrue, reason: 'paused, it can come back');
    });

    test('no warning when nothing more will be charged, or there is nothing', () {
      expect(deleteLeavesPlayCharging(_sub(state: 'canceled', autoRenewing: false)), isFalse, reason: 'cancelled in Google Play, runs to its end');
      expect(deleteLeavesPlayCharging(_sub(state: 'expired', active: false, autoRenewing: false)), isFalse);
      expect(deleteLeavesPlayCharging(_sub(state: 'expired', active: false)), isFalse, reason: 'over, not held');
      expect(deleteLeavesPlayCharging(null), isFalse);
    });
  });

  group('the delete screen', () {
    late MemoryPrefsStore ask;
    late MockApi api;

    Future<BillingRig> pump(WidgetTester tester, {PlaySubscriptionInfo? subscription, bool manageOpens = true, double textScale = 1}) async {
      // A fresh tree each time: the set of overrides differs between cases.
      await tester.pumpWidget(const SizedBox.shrink());
      final rig = BillingRig(userId: 'u1', subscription: subscription, manageOpens: manageOpens);
      ask = MemoryPrefsStore();
      await ask.setString(pendingAskPrefsKey, '{"text":"What is a tax?","requestId":"r1","userId":"u1"}');
      api = MockApi();
      await pumpMockmob(
        tester,
        const DeleteScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(360, 1700),
        textScale: textScale,
        overrides: [
          ...youOverrides(api: api, drafts: draftsWithUnsent(0)),
          ...rig.overrides,
          pendingAskPrefsProvider.overrideWithValue(ask),
        ],
      );
      await tester.pump();
      await tester.pump();
      return rig;
    }

    Future<void> request(WidgetTester tester) async {
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pump();
      await tester.tap(find.text(YouCopy.deleteRequest));
      await tester.pump();
      await tester.pump();
    }

    testWidgets('an active subscription with renewal on: the warning stands above the DELETE field, with the key', (tester) async {
      await pump(tester, subscription: _sub());
      expect(find.text(YouCopy.deletePlayNote), findsOneWidget);
      expect(find.text(BillingCopy.manageSubscription), findsOneWidget);
      // Read before the student types DELETE, not after it.
      expect(tester.getTopLeft(find.text(YouCopy.deletePlayNote)).dy, lessThan(tester.getTopLeft(find.byType(TextField)).dy));
      // The key is a real touch target: 44 dp or more.
      expect(tester.getSize(find.ancestor(of: find.text(BillingCopy.manageSubscription), matching: find.byType(ConstrainedBox)).first).height, greaterThanOrEqualTo(44));
    });

    testWidgets('a subscription on hold or paused in Google Play gets the same warning', (tester) async {
      await pump(tester, subscription: _sub(state: 'on_hold', active: false, onHold: true));
      expect(find.text(YouCopy.deletePlayNote), findsOneWidget);
    });

    testWidgets('renewal already off, over, or none: no warning and no key', (tester) async {
      for (final sub in [_sub(state: 'canceled', autoRenewing: false), _sub(state: 'expired', active: false, autoRenewing: false), null]) {
        await pump(tester, subscription: sub);
        expect(find.text(YouCopy.deletePlayNote), findsNothing);
        expect(find.text(BillingCopy.manageSubscription), findsNothing);
        expect(find.text(YouCopy.deleteRequest), findsOneWidget, reason: 'the page itself is unchanged');
      }
    });

    testWidgets('the key opens Google Play', (tester) async {
      final rig = await pump(tester, subscription: _sub());
      await tester.tap(find.text(BillingCopy.manageSubscription));
      // The billing controller starts its own check with Google Play; let it finish.
      await settleNudges(tester);
      expect(rig.manageOpened, 1);
      expect(find.text(BillingCopy.manageOpenFailed), findsNothing);
    });

    testWidgets('when Google Play cannot be opened, one line says where to find it', (tester) async {
      final rig = await pump(tester, subscription: _sub(), manageOpens: false);
      await tester.tap(find.text(BillingCopy.manageSubscription));
      // The billing controller starts its own check with Google Play; let it finish.
      await settleNudges(tester);
      expect(rig.manageOpened, 1);
      expect(find.text(BillingCopy.manageOpenFailed), findsOneWidget);
    });

    testWidgets('once the request is recorded the warning is still there, above the sign-out key, and the Ask Mobi note is gone', (tester) async {
      await pump(tester, subscription: _sub());
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((_) async => _recordedAt(DateTime(2026, 10, 20, 22, 39)));
      expect(await ask.getString(pendingAskPrefsKey), isNotNull, reason: 'nothing is forgotten before the request is with us');
      await request(tester);
      expect(find.text(YouCopy.deleteReceivedTitle), findsOneWidget);
      expect(find.text(YouCopy.deletePlayNote), findsOneWidget);
      expect(tester.getTopLeft(find.text(YouCopy.deletePlayNote)).dy, lessThan(tester.getTopLeft(find.text(YouCopy.signOut)).dy));
      expect(await ask.getString(pendingAskPrefsKey), isNull);
    });

    testWidgets('a request that did not go through keeps the question and the page as it was', (tester) async {
      await pump(tester, subscription: _sub());
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenThrow(offlineError());
      await request(tester);
      expect(find.text(YouCopy.deleteOffline), findsOneWidget);
      expect(find.text(YouCopy.deletePlayNote), findsOneWidget);
      expect(await ask.getString(pendingAskPrefsKey), isNotNull, reason: 'the account is still here');
    });

    testWidgets('at large text the warning, the key and the field all stay on the page without overflow', (tester) async {
      await pump(tester, subscription: _sub(), textScale: 1.3);
      expect(tester.takeException(), isNull);
      expect(find.text(YouCopy.deletePlayNote), findsOneWidget);
      expect(find.text(BillingCopy.manageSubscription), findsOneWidget);
    });
  });
}
