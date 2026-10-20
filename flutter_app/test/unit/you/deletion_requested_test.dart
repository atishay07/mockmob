// Deletion is only a request (owner, 20 Oct 2026: credits looked odd on an account he had "deleted"). The delete screen says
// the account works until it is processed; once the server says a request exists (`deletionRequestedAt` on /api/me), You >
// Account opens with a banner and the Wallet's balance card carries one quiet line.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/auth_me.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart' show walletRepositoryProvider;
import 'package:mockmob/features/wallet/wallet_copy.dart';
import 'package:mockmob/features/wallet/wallet_screen.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
import 'package:mockmob/features/you/copy.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import '../wallet/wallet_test_support.dart';
import 'you_test_support.dart';

final _requested = DateTime(2026, 10, 18, 21, 30);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 60));
  }
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('AuthMe reads deletionRequestedAt tolerantly', () {
    test('beside the user, as the server is adding it', () {
      final me = AuthMe.fromJson({
        'user': {'id': 'u1'},
        'needsOnboarding': false,
        'deletionRequestedAt': '2026-10-18T16:00:00.000Z',
      });
      expect(me.deletionRequestedAt!.isAtSameMomentAs(DateTime.utc(2026, 10, 18, 16)), isTrue);
    });

    test('inside the user', () {
      final me = AuthMe.fromJson({
        'user': {'id': 'u1', 'deletionRequestedAt': '2026-10-18T16:00:00Z'},
      });
      expect(me.deletionRequestedAt!.isAtSameMomentAs(DateTime.utc(2026, 10, 18, 16)), isTrue);
    });

    test('absent today, null, or not a date: no request', () {
      expect(AuthMe.fromJson({'user': {'id': 'u1'}}).deletionRequestedAt, isNull);
      expect(AuthMe.fromJson({'user': {'id': 'u1'}, 'deletionRequestedAt': null}).deletionRequestedAt, isNull);
      expect(AuthMe.fromJson({'user': {'id': 'u1'}, 'deletionRequestedAt': 'soon'}).deletionRequestedAt, isNull);
      expect(AuthMe.fromJson({'user': {'id': 'u1'}, 'deletionRequestedAt': true}).deletionRequestedAt, isNull);
      expect(AuthMe.fromJson(const {}).deletionRequestedAt, isNull);
    });

    test('the snapshot tells a request from none', () {
      expect(userWith(deletionRequestedAt: _requested) == userWith(), isFalse);
      expect(userWith(deletionRequestedAt: _requested), userWith(deletionRequestedAt: _requested));
    });
  });

  group('the delete screen', () {
    testWidgets('says the account works until it is processed, under "Tapping only sends us your request"', (tester) async {
      await pumpMockmob(
        tester,
        const DeleteScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(360, 1400),
        overrides: youOverrides(fakeAuth: FakeAuth(userWith()), drafts: draftsWithUnsent(0)),
      );
      await tester.pump();
      expect(YouCopy.deleteWorksUntil, 'Until we process it, your account works as before: your credits and papers stay, and you can keep signing in.');
      expect(find.text(YouCopy.deleteNotInstant), findsOneWidget);
      expect(find.text(YouCopy.deleteWorksUntil), findsOneWidget);
      expect(tester.getTopLeft(find.text(YouCopy.deleteWorksUntil)).dy, greaterThan(tester.getTopLeft(find.text(YouCopy.deleteNotInstant)).dy));
    });
  });

  group('You > Account', () {
    Future<void> pump(WidgetTester tester, {DateTime? requested, double textScale = 1}) async {
      await pumpMockmob(
        tester,
        const AccountScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(360, 1700),
        textScale: textScale,
        overrides: youOverrides(fakeAuth: FakeAuth(userWith(deletionRequestedAt: requested)), drafts: draftsWithUnsent(0)),
      );
      await tester.pump();
    }

    testWidgets('no request: no banner', (tester) async {
      await pump(tester);
      expect(find.byType(InlineBanner), findsNothing);
      expect(find.textContaining('Deletion requested'), findsNothing);
    });

    testWidgets('a request: the banner opens the page, with the day and the way to cancel', (tester) async {
      await pump(tester, requested: _requested);
      expect(find.text('Deletion requested on 18 October. Your account works until we process it. To cancel, email support@mockmob.in.'), findsOneWidget);
      expect(find.text(YouCopy.deletionBanner(_requested)), findsOneWidget);
      // At the top, above the plan card.
      expect(tester.getTopLeft(find.byType(InlineBanner)).dy, lessThan(tester.getTopLeft(find.text('Free')).dy));
      expect(tester.takeException(), isNull);
    });

    testWidgets('a request at 1.3x text does not overflow', (tester) async {
      await pump(tester, requested: _requested, textScale: 1.3);
      expect(find.byType(InlineBanner), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('the Wallet', () {
    Future<void> pump(WidgetTester tester, {DateTime? requested, bool night = true, double textScale = 1}) async {
      await pumpMockmob(
        tester,
        const WalletScreen(),
        size: const Size(360, 1100),
        wrapInScaffold: false,
        disableAnimations: true,
        textScale: textScale,
        brightness: night ? Brightness.dark : Brightness.light,
        overrides: [
          ...youOverrides(
            fakeAuth: FakeAuth(userWith(deletionRequestedAt: requested)),
            walletOverride: walletRepositoryProvider.overrideWith(() => FakeWalletRepo(walletState(walletBody()))),
          ),
          ...BillingRig().overrides,
        ],
      );
      await _settle(tester);
    }

    testWidgets('no request: the balance card has no deletion line', (tester) async {
      await pump(tester);
      expect(find.text(WalletCopy.deletionRequested), findsNothing);
    });

    for (final night in [true, false]) {
      testWidgets('a request (${night ? 'Night' : 'Day'}): one quiet line says the credits stay', (tester) async {
        await pump(tester, requested: _requested, night: night);
        expect(find.text('Deletion requested. Your credits stay until then.'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('a request at 1.3x text does not overflow', (tester) async {
      await pump(tester, requested: _requested, textScale: 1.3);
      expect(find.text(WalletCopy.deletionRequested), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
