// M9 of the v15 emulator walk: the You tab's "190 practice credits" stayed at 190 after a Full mock started and the server
// held 140; the Account sheet showed 140, and only a pull to refresh fixed You. The figures prefer the credits overview, which
// was read only on a few events, none of them a spend or a return to the tab. Now it is read again when the profile's balance
// moves (what a start's profile read reports) and each time You comes back to the front.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart' show AiCredits;
import 'package:mockmob/core/repositories/credits_repository.dart' show creditsRepositoryProvider;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/credits/data/credits_data.dart' show MeCreditsRepository, meCreditsProvider;
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

/// A signed-in account whose profile balance the test moves, as a profile read after a start does.
class _Account extends AuthController {
  _Account(this.first);

  final AuthSnapshot first;

  @override
  AuthSnapshot build() => first;

  void balance(int? next) => state = AuthSnapshot(
        status: AuthStatus.signedIn,
        userId: first.userId,
        email: first.email,
        name: first.name,
        subjects: first.subjects,
        creditBalance: next,
      );
}

/// The overview with no network, counting forced reads.
class _Overview extends MeCreditsRepository {
  int reads = 0;

  @override
  bool get autoLoad => false;


  @override
  Future<void> refresh({bool force = false}) async {
    if (force) reads++;
  }
}

void main() {
  group('a spend reaches the figures (profile balance moves)', () {
    late _Account account;
    late _Overview overview;
    late ProviderContainer c;

    setUp(() {
      account = _Account(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co', creditBalance: 190));
      overview = _Overview();
      c = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(() => account),
        meCreditsProvider.overrideWith(() => overview),
        creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
      ]);
      addTearDown(c.dispose);
      c.read(meCreditsProvider);
      c.read(authSnapshotProvider);
    });

    test('190 to 140 (a Full mock started) reads the overview again', () async {
      account.balance(140);
      await Future<void>.delayed(Duration.zero);
      expect(overview.reads, 1);
    });

    test('the same balance, or a balance not read yet, reads nothing', () async {
      account.balance(190);
      await Future<void>.delayed(Duration.zero);
      account.balance(null);
      await Future<void>.delayed(Duration.zero);
      expect(overview.reads, 0);
    });

    test('the first balance of a signed-in profile is not a spend', () async {
      final fresh = _Account(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co'));
      final overview2 = _Overview();
      final c2 = ProviderContainer(overrides: [authSnapshotProvider.overrideWith(() => fresh), meCreditsProvider.overrideWith(() => overview2), creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>())]);
      addTearDown(c2.dispose);
      c2.read(meCreditsProvider);
      c2.read(authSnapshotProvider);
      fresh.balance(400);
      await Future<void>.delayed(Duration.zero);
      expect(overview2.reads, 0);
      fresh.balance(390);
      await Future<void>.delayed(Duration.zero);
      expect(overview2.reads, 1, reason: 'a later change is a spend');
    });
  });

  group('the You tab reads the balances each time it comes to the front', () {
    Future<(ValueNotifier<bool>, FakeMeCredits)> pumpHub(WidgetTester tester, {int practice = 190}) async {
      tester.view.physicalSize = const Size(768, 10000);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final front = ValueNotifier<bool>(true);
      addTearDown(front.dispose);
      final router = GoRouter(
        initialLocation: '/you',
        routes: [
          GoRoute(
            path: '/you',
            builder: (_, _) => ValueListenableBuilder<bool>(
              valueListenable: front,
              builder: (_, on, _) => TickerMode(enabled: on, child: const YouHubScreen()),
            ),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: youOverrides(credits: creditsState(practice: practice)),
          child: DefaultAssetBundle(bundle: FileAssetBundle(), child: MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router)),
        ),
      );
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(tester.element(find.byType(YouHubScreen)));
      return (front, container.read(meCreditsProvider.notifier) as FakeMeCredits);
    }

    testWidgets('coming back from another tab reads the credits; staying on You, or opening it, does not add reads', (tester) async {
      final (front, credits) = await pumpHub(tester);
      final opened = credits.refreshes;
      front.value = false; // another tab in front
      await tester.pump();
      expect(credits.refreshes, opened, reason: 'leaving reads nothing');
      front.value = true; // back on You
      await tester.pump();
      expect(credits.refreshes, opened + 1);
      await tester.pump();
      expect(credits.refreshes, opened + 1, reason: 'one read for one return');
      front.value = false;
      await tester.pump();
      front.value = true;
      await tester.pump();
      expect(credits.refreshes, opened + 2, reason: 'each return reads again');
    });
  });
}
