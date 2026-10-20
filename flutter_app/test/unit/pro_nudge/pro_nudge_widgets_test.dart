// The Pro nudges on screen: the Upgrade sheet (its head per reason, the student's lines, Google Play's
// own price on the key and never the website's), the inline row (one action, dismissed for seven days),
// the gate key, the first-session helper (once), and nothing at all with PLAY_BILLING off or for Pro.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/student_actions.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/billing/widgets/pro_page.dart' show ProHeroArt, ProPage;
import 'package:mockmob/features/pro_nudge/pro_nudge.dart';
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart' show proNudgeInOnboardingProvider;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../billing/billing_test_support.dart';
import 'pro_nudge_test_support.dart';

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('the Upgrade sheet', () {
    testWidgets('a Pro gate opens it with its own headline and line, the plain benefits, and Google Play\'s price on the key', (tester) async {
      final semantics = tester.ensureSemantics();
      bool? opened;
      final rig = NudgeRig();
      await pumpNudges(tester, OpenSheetHost(reason: ProReason.ntaMode, onResult: (v) => opened = v), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);

      expect(opened, isTrue);
      final head = ProNudgeCopy.head(ProReason.ntaMode);
      expect(find.text(head.title), findsOneWidget);
      expect(find.text(head.lede), findsOneWidget);
      // It opens the full-screen Pro page (owner I6, 20 Oct): the showcase, and Google Play's price.
      expect(find.byType(ProPage), findsOneWidget);
      expect(find.text(BillingCopy.proPageUnlocksHeading), findsOneWidget);
      expect(find.text(BillingCopy.moment1Title), findsOneWidget);
      expect(find.textContaining('$playProPrice a month'), findsWidgets);
      expect(find.text('Get Pro'), findsWidgets);
      semantics.dispose();
    });

    testWidgets('a subscription on hold: its own heading, no sales headline, Manage subscription, and Not now leaves', (tester) async {
      final rig = NudgeRig(subscription: playSub(state: 'on_hold', active: false, hold: true));
      await pumpNudges(tester, const OpenSheetHost(reason: ProReason.firstSession), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(find.text(BillingCopy.subOnHoldTitle), findsOneWidget);
      expect(find.text(BillingCopy.subOnHold), findsOneWidget);
      expect(find.text(ProNudgeCopy.head(ProReason.firstSession).title), findsNothing, reason: 'no sales headline above a payment problem');
      expect(find.text('Get Pro'), findsNothing);
      expect(find.text(BillingCopy.manageSubscription), findsOneWidget);
      await tester.tap(find.text(BillingCopy.close));
      await settleNudges(tester);
      expect(find.text(BillingCopy.subOnHoldTitle), findsNothing);
    });

    testWidgets('the website\'s price never appears: only what Google Play returns', (tester) async {
      final rig = NudgeRig();
      await pumpNudges(tester, const OpenSheetHost(reason: ProReason.general), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(find.textContaining('99'), findsNothing);
      expect(find.textContaining(RegExp('website|mockmob.in|pricing', caseSensitive: false)), findsNothing);
      expect(find.text(ProNudgeCopy.sheetTitle), findsOneWidget);
    });

    testWidgets('the student\'s own lines lead under "Built around your prep", four lines in all', (tester) async {
      final rig = NudgeRig(facts: const ProFacts(mocksTaken: 2, weakestChapter: 'Accounting Ratios', practiceCredits: 12));
      await pumpNudges(tester, const OpenSheetHost(reason: ProReason.firstSession), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(find.text(ProNudgeCopy.head(ProReason.firstSession).title), findsOneWidget);
      expect(find.text(ProNudgeCopy.forYouHeading), findsOneWidget);
      expect(find.text(ProNudgeCopy.weakestChapter('Accounting Ratios')), findsOneWidget);
      expect(find.text(ProNudgeCopy.creditsLeft(12)), findsOneWidget);
      expect(find.text(ProNudgeCopy.mocksTaken(2)), findsOneWidget);
      // The one plain line left after the personal ones stood in for theirs.
      expect(find.text(ProNudgeCopy.plainBenefits[2]), findsOneWidget);
    });

    testWidgets('the key buys Pro through Google Play', (tester) async {
      final rig = NudgeRig();
      await pumpNudges(tester, const OpenSheetHost(reason: ProReason.general), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      await tester.tap(find.text('Get Pro').first);
      await settleNudges(tester);
      expect(rig.billing.store.buys.single.productId, PlayProducts.proId);
    });

    testWidgets('Google Play unavailable: no price and no key to press, said plainly with Try again', (tester) async {
      final rig = NudgeRig(store: FakePlayStore(available: false));
      await pumpNudges(tester, const OpenSheetHost(reason: ProReason.general), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(find.text(playProPrice), findsNothing);
      expect(find.text('Try again'), findsWidgets);
      expect(containerOf(tester).read(playBillingProvider).store, StoreAvailability.unavailable);
    });

    testWidgets('PLAY_BILLING off: nothing opens and the caller does what it did before', (tester) async {
      bool? opened;
      final rig = NudgeRig(on: false);
      await pumpNudges(tester, OpenSheetHost(reason: ProReason.ntaMode, onResult: (v) => opened = v), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(opened, isFalse);
      expect(find.text(ProNudgeCopy.head(ProReason.ntaMode).title), findsNothing);
    });

    testWidgets('a Pro student: nothing opens', (tester) async {
      bool? opened;
      final rig = NudgeRig(pro: true);
      await pumpNudges(tester, OpenSheetHost(reason: ProReason.general, onResult: (v) => opened = v), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(opened, isFalse);
    });
  });

  // D185 (owner): the first-session sheet stays a dismissible bottom sheet (D181), visual first: the Pro page's art,
  // one short headline, at most three one-line rows, Google Play's price once, Get Pro and Not now pinned.
  group('the first-session sheet', () {
    Future<void> open(WidgetTester tester, NudgeRig rig, {Size size = const Size(360, 800), double textScale = 1}) async {
      await pumpNudges(
        tester,
        Builder(
          builder: (context) => Center(
            child: TextButton(onPressed: () => showUpgradeBottomSheetIfOn(context, reason: ProReason.firstSession), child: const Text('open')),
          ),
        ),
        rig,
        size: size,
        textScale: textScale,
      );
      await tester.tap(find.text('open'));
      await settleNudges(tester, rounds: 14);
    }

    const facts = ProFacts(mocksTaken: 3, weakestChapter: 'Accounting Ratios', practiceCredits: 12, subjectCount: 4);

    testWidgets("the art, one headline, three short rows with the student's facts first, and no paragraph", (tester) async {
      await open(tester, NudgeRig(facts: facts));
      expect(find.byType(ProHeroArt), findsOneWidget);
      expect(find.text(ProNudgeCopy.sheetHeadline(ProReason.firstSession)), findsOneWidget);
      for (final row in ProBenefits.shortLines(facts, reason: ProReason.firstSession)) {
        expect(find.text(row.text), findsOneWidget);
      }
      expect(find.text(ProNudgeCopy.creditsLeftShort(12)), findsOneWidget);
      // No lede, no heading over the rows, no long lines, no fine print said twice.
      final head = ProNudgeCopy.head(ProReason.firstSession);
      expect(find.text(head.lede), findsNothing);
      expect(find.text(ProNudgeCopy.forYouHeading), findsNothing);
      expect(find.text(ProNudgeCopy.creditsLeft(12)), findsNothing);
      expect(find.text(BillingCopy.googlePlayNote), findsNothing);
      expect(find.text(BillingCopy.proTerms), findsNothing);
    });

    testWidgets('each row is one line at 360 dp', (tester) async {
      await open(tester, NudgeRig(facts: facts));
      // Body text is 24 dp a line, the headline about 28.
      for (final row in ProBenefits.shortLines(facts, reason: ProReason.firstSession)) {
        expect(tester.getSize(find.text(row.text)).height, lessThanOrEqualTo(24 + 0.5), reason: row.text);
      }
      expect(tester.getSize(find.text(ProNudgeCopy.sheetHeadline(ProReason.firstSession))).height, lessThanOrEqualTo(30 + 0.5), reason: 'the headline is one line');
    });

    testWidgets("Google Play's price once, with a month and one line of terms; Get Pro buys it", (tester) async {
      final rig = NudgeRig(facts: facts);
      await open(tester, rig);
      expect(find.textContaining('$playProPrice a month'), findsOneWidget);
      expect(find.text(ProNudgeCopy.cancelAnytime), findsOneWidget);
      await tester.tap(find.text(BillingCopy.getPro));
      await settleNudges(tester);
      expect(rig.billing.store.buys.single.productId, PlayProducts.proId);
    });

    testWidgets('Not now closes it', (tester) async {
      await open(tester, NudgeRig(facts: facts));
      await tester.tap(find.text(ProNudgeCopy.notNow));
      await settleNudges(tester);
      expect(find.byType(ProHeroArt), findsNothing);
    });

    testWidgets('Google Play unavailable: said plainly with Try again, no price, Get Pro waits', (tester) async {
      await open(tester, NudgeRig(facts: facts, store: FakePlayStore(available: false)));
      expect(find.text(BillingCopy.storeUnavailable), findsOneWidget);
      expect(find.text(BillingCopy.tryAgain), findsWidgets);
      expect(find.textContaining('a month'), findsNothing);
      expect(tester.widget<KeyButton>(find.widgetWithText(KeyButton, BillingCopy.getPro)).onPressed, isNull);
    });

    testWidgets("checking Google Play: a skeleton holds the price's place and says what is happening", (tester) async {
      await open(tester, NudgeRig(facts: facts, store: FakePlayStore()..gate = Completer<void>()));
      expect(find.text(BillingCopy.checkingStore), findsOneWidget);
      expect(tester.widget<KeyButton>(find.widgetWithText(KeyButton, BillingCopy.getPro)).onPressed, isNull);
    });

    testWidgets('a subscription on hold: its own heading and Manage subscription, no art and no sale', (tester) async {
      await open(tester, NudgeRig(facts: facts, subscription: playSub(state: 'on_hold', active: false, hold: true)));
      expect(find.text(BillingCopy.subOnHoldTitle), findsOneWidget);
      expect(find.byType(ProHeroArt), findsNothing);
      expect(find.text(BillingCopy.getPro), findsNothing);
      expect(find.text(BillingCopy.manageSubscription), findsOneWidget);
    });

    testWidgets('on a 360 by 640 phone at 1.3x text, Get Pro and Not now are whole and on screen', (tester) async {
      await open(tester, NudgeRig(facts: facts), size: const Size(360, 640), textScale: 1.3);
      for (final label in [BillingCopy.getPro, ProNudgeCopy.notNow]) {
        final key = tester.getRect(find.widgetWithText(KeyButton, label));
        expect(key.bottom, lessThanOrEqualTo(640), reason: label);
        expect(key.top, greaterThanOrEqualTo(0), reason: label);
      }
      expect(tester.getRect(find.textContaining('a month')).bottom, lessThanOrEqualTo(640));
    });
  });

  group('the inline row', () {
    testWidgets('one line and one action; the line opens the sheet with the surface\'s reason', (tester) async {
      final rig = NudgeRig();
      await pumpNudges(tester, const Padding(padding: EdgeInsets.all(16), child: ProNudgeRow(surface: ProNudgeSurface.result)), rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsOneWidget);
      expect(find.textContaining(ProNudgeCopy.goUnlimited), findsOneWidget);
      await tester.tap(find.textContaining(ProNudgeCopy.afterResult));
      await settleNudges(tester);
      expect(find.text(ProNudgeCopy.head(ProReason.unlimitedMocks).title), findsOneWidget);
    });

    testWidgets('Not now hides it and it stays quiet (saved on the phone)', (tester) async {
      final semantics = tester.ensureSemantics();
      final rig = NudgeRig();
      await pumpNudges(tester, const Padding(padding: EdgeInsets.all(16), child: ProNudgeRow(surface: ProNudgeSurface.practiceMocks)), rig);
      expect(find.textContaining(ProNudgeCopy.unlimitedMocks), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(ProNudgeCopy.nudgeDismiss));
      await settleNudges(tester);
      expect(find.textContaining(ProNudgeCopy.unlimitedMocks), findsNothing);
      expect(rig.prefs.values.keys.where((k) => k.endsWith('dismissed.practice-mocks')), hasLength(1));
      semantics.dispose();
    });

    testWidgets('PLAY_BILLING off or Pro: the row draws nothing and takes no space', (tester) async {
      for (final rig in [NudgeRig(on: false), NudgeRig(pro: true)]) {
        await pumpNudges(tester, const Column(mainAxisSize: MainAxisSize.min, children: [ProNudgeRow(surface: ProNudgeSurface.result, topGap: 8, bottomGap: 8)]), rig);
        expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
        expect(tester.getSize(find.byType(ProNudgeRow)).height, 0);
      }
    });
  });

  // D181 (owner, 20 Oct 2026): no Pro ask rides along with the student's very first result. The inline
  // "Go unlimited" row on a result waits for the second one; it is counted on the phone, so a restart does not
  // bring the first one back.
  group('the result row and the first result (D181)', () {
    const user = 'mm.pronudge.v2.user-1';
    final onboardedAt = DateTime(2026, 10, 18, 19).millisecondsSinceEpoch;
    const row = Padding(padding: EdgeInsets.all(16), child: ProNudgeRow(surface: ProNudgeSurface.result));

    NudgeRig onboardedStudent({int viewed = 0}) {
      final rig = NudgeRig();
      rig.prefs.values['$user.onboarded_at'] = onboardedAt;
      rig.prefs.values['$user.onboarded_launch'] = 'L1';
      if (viewed > 0) rig.prefs.values['$user.results_viewed'] = viewed;
      return rig;
    }

    testWidgets('a student onboarded on this phone: the first result has no row, and it counts as viewed', (tester) async {
      final rig = onboardedStudent();
      await pumpNudges(tester, row, rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
      expect(tester.getSize(find.byType(ProNudgeRow)).height, 0, reason: 'no row and no space');
      expect(rig.prefs.values['$user.results_viewed'], 1);
      expect(containerOf(tester).read(proNudgeProvider).resultViewed, isTrue, reason: 'returns to a tab root count from here');
      // The same result rebuilt (a rotation, a theme change) does not bring the row back.
      await pumpNudges(tester, row, rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
    });

    testWidgets('the second result carries the row, and it opens the Pro page', (tester) async {
      final rig = onboardedStudent(viewed: 1);
      await pumpNudges(tester, row, rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsOneWidget);
      expect(find.textContaining(ProNudgeCopy.goUnlimited), findsOneWidget);
      expect(rig.prefs.values['$user.results_viewed'], 2);
      await tester.tap(find.textContaining(ProNudgeCopy.afterResult));
      await settleNudges(tester);
      expect(find.byType(ProPage), findsOneWidget);
    });

    testWidgets('a student who signed straight in is not new: the row is there on their first result', (tester) async {
      final rig = NudgeRig();
      await pumpNudges(tester, row, rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsOneWidget);
    });

    testWidgets('other places are not results: they keep their row on the first day and count nothing', (tester) async {
      final rig = onboardedStudent();
      await pumpNudges(tester, const Padding(padding: EdgeInsets.all(16), child: ProNudgeRow(surface: ProNudgeSurface.practiceMocks)), rig);
      expect(find.textContaining(ProNudgeCopy.unlimitedMocks), findsOneWidget);
      expect(rig.prefs.values.containsKey('$user.results_viewed'), isFalse);
    });

    testWidgets('PLAY_BILLING off or Pro: nothing is drawn and nothing is counted', (tester) async {
      for (final rig in [NudgeRig(on: false), NudgeRig(pro: true)]) {
        rig.prefs.values['$user.onboarded_at'] = onboardedAt;
        await pumpNudges(tester, row, rig);
        expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
        expect(rig.prefs.values.containsKey('$user.results_viewed'), isFalse);
      }
    });
  });

  group('the gate key', () {
    testWidgets('says Upgrade to Pro and opens the sheet with the gate\'s reason', (tester) async {
      final rig = NudgeRig();
      await pumpNudges(tester, const Padding(padding: EdgeInsets.all(16), child: UpgradeEntry(reason: ProReason.smartPractice)), rig);
      await tester.tap(find.text(ProNudgeCopy.gateAction).first);
      await settleNudges(tester);
      expect(find.text(ProNudgeCopy.head(ProReason.smartPractice).title), findsOneWidget);
    });

    testWidgets('PLAY_BILLING off: nothing', (tester) async {
      await pumpNudges(tester, const UpgradeEntry(reason: ProReason.smartPractice), NudgeRig(on: false));
      expect(find.text(ProNudgeCopy.gateAction), findsNothing);
    });
  });

  group('the first-session helper', () {
    testWidgets('opens the first-session sheet once, after onboarding finished and a real action, and never again', (tester) async {
      final rig = NudgeRig();
      final opened = <bool>[];
      await pumpNudges(
        tester,
        Consumer(
          builder: (context, ref, _) => TextButton(onPressed: () => opened.add(showFirstSessionUpgradeIfDue(context, ref)), child: const Text('calm')),
        ),
        rig,
      );
      final c = containerOf(tester);
      // Before onboarding finished in this run: nothing.
      c.read(studentActionsProvider.notifier).submitted();
      await tester.tap(find.text('calm'));
      await settleNudges(tester);
      expect(opened, [false]);

      // Onboarding finishes (in it, sealed, out of it), then the first real action.
      c.read(onboardedThisRunProvider.notifier).sealed();
      expect(c.read(proNudgeInOnboardingProvider), isFalse);
      await settleNudges(tester);
      expect(c.read(upgradePopupDueProvider), isFalse, reason: 'the action before onboarding finished does not count');
      c.read(studentActionsProvider.notifier).submitted();
      await settleNudges(tester);
      expect(c.read(upgradePopupDueProvider), isFalse, reason: 'a first paper alone asks for nothing (D181): not armed yet');
      await tester.tap(find.text('calm'));
      await settleNudges(tester);
      expect(opened, [false, false]);

      // The student views the result, comes back to a tab root once (not enough), then a second time (armed).
      final ctl = c.read(proNudgeProvider.notifier);
      ctl.noteResultViewed();
      ctl.noteTabRoot();
      await settleNudges(tester);
      expect(c.read(upgradePopupDueProvider), isFalse);
      ctl.noteTabRoot();
      await settleNudges(tester);
      expect(c.read(upgradePopupDueProvider), isTrue);

      await tester.tap(find.text('calm'));
      await settleNudges(tester);
      expect(opened, [false, false, true]);
      expect(find.text(ProNudgeCopy.sheetHeadline(ProReason.firstSession)), findsOneWidget);
      expect(rig.prefs.values.keys.where((k) => k.endsWith('popup_shown')), hasLength(1));
      expect(c.read(upgradePopupDueProvider), isFalse);
    });
  });
}
