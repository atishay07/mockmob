// Where the Upgrade sheet and the credit top-ups are reachable from, flag on and flag off: the You
// plan card, Practice's Pro gate and credits-low state (both open the Upgrade sheet, D80), and Ask
// Mobi's out-of-credits band. With PLAY_BILLING off none of them shows anything.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/credits/data/credits_data.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show ProNudgeCopy, ProReason;
import 'package:mockmob/features/you/account/plan_card.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../../golden/insights/insights_golden_support.dart' show insightsOverrides;
import '../practice/support/harness.dart';
import '../you/you_test_support.dart';
import 'billing_test_support.dart';

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 60));
  }
}

final AiCredits _emptyWallet = AiCredits.fromJson({
  'state': 'empty',
  'isPaid': false,
  'wallet': {'state': 'empty', 'known': true, 'total': 0, 'includedRemaining': 0, 'includedMonthlyCredits': 50, 'bonusCredits': 0, 'resetAt': '2026-10-31T18:30:00.000Z'},
});

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('You plan card', () {
    Future<void> pumpPlan(WidgetTester tester, BillingRig rig, AuthSnapshot auth) => pumpMockmob(
          tester,
          SingleChildScrollView(child: PlanCard(auth: auth)),
          wrapInScaffold: true,
          disableAnimations: true,
          overrides: [...youOverrides(auth: auth, credits: creditsState(pro: auth.isPro)), ...rig.overrides],
        );

    testWidgets('flag on: a Free student sees Get Pro; a Pro student does not', (tester) async {
      await pumpPlan(tester, BillingRig(), const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', creditBalance: 40));
      await _settle(tester);
      expect(find.text('Get Pro'), findsWidgets);
      await pumpPlan(tester, BillingRig(), const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', isPro: true));
      await _settle(tester);
      expect(find.text('Get Pro'), findsNothing);
    });

    testWidgets('flag off: no Get Pro', (tester) async {
      await pumpPlan(tester, BillingRig(on: false), const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', creditBalance: 40));
      await _settle(tester);
      expect(find.text('Get Pro'), findsNothing);
    });
  });

  group('Practice', () {
    List<GoRoute> routes() => [
          GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
          GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
          stubRoute('/run/:sessionId'),
          stubRoute('/learn'),
          stubRoute('/review'),
          stubRoute('/practice'),
        ];

    Future<void> pumpGate(WidgetTester tester, BillingRig rig) async {
      await pumpRouted(
        tester,
        location: '/practice/setup/nta?subject=accountancy',
        routes: routes(),
        overrides: [
          ...practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => m == 'nta' ? proGate() : creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50))),
          // The Get Pro sheet reads the plan from the credits overview, which would open the phone's database.
          meCreditsProvider.overrideWith(() => FakeMeCredits(creditsState())),
          creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
          ...rig.overrides,
        ],
      );
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump(const Duration(milliseconds: 50));
    }

    testWidgets('flag on: the Pro gate has an Upgrade to Pro key that opens the Upgrade sheet on NTA mode', (tester) async {
      final rig = BillingRig();
      await pumpGate(tester, rig);
      expect(find.text('NTA mode comes with Pro'), findsOneWidget);
      final key = find.text(ProNudgeCopy.gateAction).first;
      await tester.ensureVisible(key);
      await tester.tap(key);
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));
      // The Upgrade sheet, with the gate's own headline and Google Play's key to buy.
      expect(find.bySemanticsLabel(ProNudgeCopy.sheetLabel), findsOneWidget);
      expect(find.text(ProNudgeCopy.head(ProReason.ntaMode).title), findsOneWidget);
      expect(find.text(BillingCopy.getPro), findsWidgets);
      // The free way out is still there.
      expect(find.text('Take a Full mock instead'), findsWidgets);
    });

    testWidgets('flag off: the gate names Pro calmly (D101), with no Upgrade key and no way to buy', (tester) async {
      final rig = BillingRig(on: false);
      await pumpGate(tester, rig);
      expect(find.text('NTA mode comes with Pro'), findsNothing);
      expect(find.text('NTA mode is part of Pro'), findsOneWidget);
      expect(find.textContaining('Pro opens in the app soon.'), findsOneWidget);
      expect(find.text(ProNudgeCopy.gateAction), findsNothing);
      expect(find.text('Get Pro'), findsNothing);
    });

    for (final on in [true, false]) {
      testWidgets('credits low, flag ${on ? 'on' : 'off'}: ${on ? 'Pro is offered as what removes the limit' : 'nothing is offered'}', (tester) async {
        final rig = BillingRig(on: on);
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=accountancy',
          routes: routes(),
          overrides: [
            ...practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => lowCredits())),
            // The Upgrade sheet reads the plan from the credits overview, which would open the phone's database.
            meCreditsProvider.overrideWith(() => FakeMeCredits(creditsState())),
            creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
            ...rig.overrides,
          ],
        );
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pump(const Duration(milliseconds: 50));
        expect(find.textContaining('You have 8 credits, and this takes 10.'), findsOneWidget);
        expect(find.text(ProNudgeCopy.creditsRunLow), on ? findsOneWidget : findsNothing);
        expect(find.text(ProNudgeCopy.gateAction), on ? findsWidgets : findsNothing);
        expect(find.text(BillingCopy.getCredits), on ? findsWidgets : findsNothing);
        if (on) {
          // The key opens the Upgrade sheet on what removes the limit.
          final key = find.text(ProNudgeCopy.gateAction).first;
          await tester.ensureVisible(key);
          await tester.tap(key);
          await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 700));
          expect(find.text(ProNudgeCopy.head(ProReason.practiceCredits).title), findsOneWidget);
          expect(find.text(BillingCopy.getPro), findsWidgets);
        }
      });
    }
  });

  group('Ask Mobi out of credits', () {
    Future<void> pumpAsk(WidgetTester tester, BillingRig rig) => pumpMockmob(
          tester,
          const AskScreen(),
          size: const Size(384, 900),
          disableAnimations: true,
          overrides: [...insightsOverrides(credits: _emptyWallet), ...rig.overrides],
          wrapInScaffold: false,
        );

    testWidgets('flag on: Add credits opens the Wallet', (tester) async {
      final rig = BillingRig();
      await pumpAsk(tester, rig);
      expect(find.text(InsightsCopy.outTitle), findsOneWidget);
      expect(find.text(BillingCopy.getCredits), findsWidgets);
    });

    testWidgets('flag off: the band is the one it was', (tester) async {
      final rig = BillingRig(on: false);
      await pumpAsk(tester, rig);
      expect(find.text(InsightsCopy.outTitle), findsOneWidget);
      expect(find.text(BillingCopy.getCredits), findsNothing);
    });
  });
}
