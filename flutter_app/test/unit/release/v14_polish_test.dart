// Version 14 polish (owner, 20 Oct 2026, after version 13 from the Play Store), held by tests:
// K1 Day mode: Practice's objects are the same porcelain objects in Day as in Night, never the page's ink as a black body.
// K3 You: a Free student sees "Free plan" and "Upgrade to Pro" near the top of You, which opens the Pro page; a Pro
//    student sees their plan instead.
// K4 Pro page: the Full mocks row reads "Your first in each subject is free", "Then 50 credits" while the server says
//    so, and nothing about a free first mock otherwise.
// K6 Wallet: credits have a place near the top of You and on Practice; the Wallet says in one line why the first full
//    mock in each subject is free.
// D165: the welcome and invite offer is written but drawn only once the server says it is live (off today).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/billing/widgets/pro_page.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart' show ReferralStatus, referralStatusProvider;
import 'package:mockmob/features/pro_nudge/copy.dart' show ProNudgeCopy;
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/features/practice/widgets/practice_credit_line.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';
import 'package:mockmob/features/wallet/wallet_copy.dart';
import 'package:mockmob/features/wallet/wallet_screen.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/help/faq.dart' show FaqCopy;
import 'package:mockmob/features/you/hub/plan_strip.dart';

import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import '../wallet/wallet_test_support.dart';
import '../you/you_test_support.dart';
import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 60));
  }
}

void main() {
  // The app's own fonts, so widths and line heights are the phone's (the test font is wider and would report
  // overflows a phone never shows).
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('the words', () {
    test('new lines are plain: no exclamation marks, no middle dots, no hype', () {
      final lines = [
        YouCopy.stripCredits,
        YouCopy.stripFreePlan,
        YouCopy.stripOpensPro,
        BillingCopy.compareFullMockFree,
        WalletCopy.keptPartNoteReferrals,
        WalletCopy.welcomeCredits,
        PracticeCopy.creditLine(46),
      ];
      for (final s in lines) {
        for (final banned in ['!', '·', 'unlock', 'Unlock', 'amazing', 'awesome']) {
          expect(s, isNot(contains(banned)), reason: '$banned in $s');
        }
      }
    });

    test('D175: no line promises a free first full mock', () {
      final lines = [
        BillingCopy.compareFullMockFree,
        BillingCopy.moment1LineWithPrice,
        WalletCopy.creditsFor,
        PracticeCopy.creditLine(46),
        PracticeCopy.firstMockTaken,
        PracticeCopy.firstMockUnchecked,
        ...FaqCopy.credits.answer,
      ];
      for (final s in lines) {
        expect(s.toLowerCase(), isNot(contains('first one')), reason: s);
        expect(s.toLowerCase(), isNot(contains('first full mock')), reason: s);
        expect(s.toLowerCase(), isNot(contains('each subject')), reason: s);
        expect(s.toLowerCase(), isNot(contains('on us')), reason: s);
      }
    });

    test('D165 + D182: 50 to start, 100 each once the friend finishes one practice', () {
      expect(WalletCopy.welcomeCredits, contains('50 credits'));
      expect(ReferralCopy.how(100), contains('finish one practice'));
      expect(ReferralCopy.how(100), contains('100 credits land for both of you'));
    });
  });

  group('K4: the Full mocks row', () {
    test('D175: Free pays 50 credits for each full mock and Pro has them unlimited; no first one is free', () {
      final row = BillingCopy.compareRows.firstWhere((r) => r.$1 == 'Full mocks');
      expect(row.$2, '50 credits each');
      expect(row.$3, BillingCopy.compareUnlimited);
    });
  });

  group('K4: the whole Pro page holds at 360 dp', () {
    for (final scale in [1.0, 1.3]) {
      for (final brightness in [Brightness.dark, Brightness.light]) {
        testWidgets('text at $scale, $brightness: no overflow, and the Full mocks row says 50 credits each', (tester) async {
          final rig = BillingRig(store: FakePlayStore(prices: {'pro_monthly': 'Rs 149.00'}));
          await pumpMockmob(
            tester,
            const ProPage(),
            brightness: brightness,
            size: const Size(360, 4200),
            textScale: scale,
            wrapInScaffold: false,
            disableAnimations: true,
            overrides: [
              ...youOverrides(
                credits: oneBalanceState(),
                walletOverride: walletRepositoryProvider.overrideWith(() => FakeWalletRepo(walletState(walletBody()))),
              ),
              ...rig.overrides,
            ],
          );
          final container = ProviderScope.containerOf(tester.element(find.byType(ProPage)));
          container.read(walletRepositoryProvider);
          await _settle(tester);
          expect(tester.takeException(), isNull);
          expect(find.text(BillingCopy.compareFullMockFree), findsOneWidget);
          expect(find.textContaining('first one'), findsNothing);
          expect(find.textContaining('each subject'), findsNothing);
        });
      }
    }
  });

  group('K1: Day objects', () {
    test('Practice\'s objects are porcelain in Day, the same material as Night, never the Day ink', () {
      expect(ChoiceGlyphPainter.dayPorcelain, MmColors.dark.ink);
      expect(ChoiceGlyphPainter.dayPorcelain, isNot(MmColors.light.ink));
    });
  });

  group('K3 and K6: the plan strip on You', () {
    Future<void> pump(WidgetTester tester, {bool pro = false, bool playOn = true}) async {
      final List<Override> overrides = [
        ...youOverrides(
          credits: oneBalanceState(pro: pro),
          walletOverride: walletRepositoryProvider.overrideWith(() => FakeWalletRepo(walletState(walletBody(pro: pro)))),
        ),
        ...BillingRig(on: playOn).overrides,
      ];
      await pumpMockmob(
        tester,
        const Padding(padding: EdgeInsets.all(16), child: YouPlanStrip()),
        size: const Size(360, 400),
        overrides: overrides,
      );
      await _settle(tester);
    }

    testWidgets('a Free student sees the balance, "Free plan" and "Upgrade to Pro", which opens the Pro page', (tester) async {
      await pump(tester);
      expect(find.text(YouCopy.stripFreePlan), findsOneWidget);
      expect(find.text(ProNudgeCopy.gateAction), findsOneWidget);
      expect(find.textContaining('108'), findsOneWidget);
      expect(find.bySemanticsLabel('Free plan. Upgrade to Pro. Opens the Pro page.'), findsOneWidget);
      await tester.tap(find.text(ProNudgeCopy.gateAction));
      await _settle(tester);
      expect(find.byType(ProPage), findsOneWidget);
      // The Pro page's light sweep runs on a timer: let it finish before the tree goes.
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 5));
    });

    testWidgets('the credits half opens the Wallet', (tester) async {
      await pump(tester);
      await tester.tap(find.text(YouCopy.stripCredits));
      await _settle(tester);
      expect(find.text(WalletCopy.title), findsWidgets);
    });

    testWidgets('a Pro student sees their plan, never an upgrade', (tester) async {
      await pump(tester, pro: true);
      expect(find.text(YouCopy.stripPro), findsOneWidget);
      expect(find.text(ProNudgeCopy.gateAction), findsNothing);
    });

    testWidgets('with Google Play off there is no upgrade key that leads nowhere', (tester) async {
      await pump(tester, playOn: false);
      expect(find.text(ProNudgeCopy.gateAction), findsNothing);
      expect(find.text(YouCopy.stripFreePlan), findsOneWidget);
    });

    testWidgets('a balance that has not loaded is never 0', (tester) async {
      final List<Override> overrides = [...youOverrides(credits: oneBalanceState(total: null)), ...BillingRig().overrides];
      await pumpMockmob(tester, const YouPlanStrip(), size: const Size(360, 300), overrides: overrides);
      await _settle(tester);
      expect(find.text('0'), findsNothing);
      expect(find.textContaining(YouCopy.stripNotLoaded), findsOneWidget);
    });
  });

  group('K6: the Wallet', () {
    Future<void> pump(WidgetTester tester, {bool pro = false, List<Override> extra = const []}) async {
      await pumpMockmob(
        tester,
        const WalletScreen(),
        size: const Size(360, 2400),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [...walletOverrides(pro: pro, rig: BillingRig()), ...extra],
      );
      await _settle(tester);
    }

    testWidgets('D175: a Free student sees a full mock at 50 credits and no free-first line', (tester) async {
      await pump(tester);
      expect(find.text(WalletCopy.buyMock), findsOneWidget);
      expect(find.textContaining('first full mock'), findsNothing);
      expect(find.textContaining('First one'), findsNothing);
      expect(find.textContaining('each subject'), findsNothing);
    });

    testWidgets('D165 is off until the server says so: no invite, the kept note as today', (tester) async {
      await pump(tester);
      expect(find.text(ReferralCopy.title(100)), findsNothing);
      expect(find.text(ReferralCopy.haveCode), findsNothing);
      expect(find.text(WalletCopy.keptPartNote), findsOneWidget);
      expect(find.text(WalletCopy.keptPartNoteReferrals), findsNothing);
    });

    testWidgets('D165 once the server says invites are live: the one invite section, the code row and the kept note that names invite credits', (tester) async {
      await pump(tester, extra: [
        referralStatusProvider.overrideWith((ref) async => const ReferralStatus(live: true, code: 'K7P2M9X', link: 'https://www.mockmob.in/r/K7P2M9X')),
      ]);
      await tester.pump();
      expect(find.text(ReferralCopy.title(100)), findsOneWidget, reason: 'one invite section, not two');
      expect(find.text(ReferralCopy.how(100)), findsOneWidget);
      expect(find.text(ReferralCopy.haveCode), findsOneWidget);
      expect(find.text(WalletCopy.keptPartNoteReferrals), findsOneWidget);
    });
  });

  group('K6: Practice\'s credit line', () {
    Future<void> pump(WidgetTester tester, List<Override> overrides) async {
      await pumpMockmob(tester, const Padding(padding: EdgeInsets.all(16), child: PracticeCreditLine()), size: const Size(360, 300), overrides: overrides);
      await _settle(tester);
    }

    testWidgets('a Free student sees the balance and a way to the Wallet, with no free-first line', (tester) async {
      await pump(tester, [
        ...youOverrides(
          credits: oneBalanceState(),
          walletOverride: walletRepositoryProvider.overrideWith(() => FakeWalletRepo(walletState(walletBody()))),
        ),
      ]);
      // The Wallet read lands after the first frame.
      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeCreditLine)));
      container.read(walletRepositoryProvider);
      await _settle(tester);
      expect(find.text(PracticeCopy.creditLine(108)), findsOneWidget);
      expect(find.textContaining('first full mock'), findsNothing);
      expect(find.textContaining('each subject'), findsNothing);
    });

    testWidgets('a Pro student sees nothing (practice is unlimited)', (tester) async {
      await pump(tester, youOverrides(credits: oneBalanceState(pro: true)));
      expect(find.textContaining('You have'), findsNothing);
    });

    testWidgets('an older server with two pools sees nothing rather than a sum it did not send', (tester) async {
      await pump(tester, youOverrides(credits: creditsState()));
      expect(find.textContaining('You have'), findsNothing);
    });
  });
}
