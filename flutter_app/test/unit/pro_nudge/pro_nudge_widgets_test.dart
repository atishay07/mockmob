// The Pro nudges on screen: the Upgrade sheet (its head per reason, the student's lines, Google Play's
// own price on the key and never the website's), the inline row (one action, dismissed for seven days),
// the gate key, the first-session helper (once), and nothing at all with PLAY_BILLING off or for Pro.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/student_actions.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
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
      expect(find.text(ProNudgeCopy.includesHeading), findsOneWidget);
      for (final line in ProNudgeCopy.plainBenefits) {
        expect(find.text(line), findsOneWidget);
      }
      expect(find.text(playProPrice), findsOneWidget);
      expect(find.text('Get Pro'), findsWidgets);
      expect(find.bySemanticsLabel(RegExp('^${ProNudgeCopy.sheetLabel}')), findsWidgets);
      semantics.dispose();
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
      expect(c.read(upgradePopupDueProvider), isTrue);

      await tester.tap(find.text('calm'));
      await settleNudges(tester);
      expect(opened, [false, true]);
      expect(find.text(ProNudgeCopy.head(ProReason.firstSession).title), findsOneWidget);
      expect(rig.prefs.values.keys.where((k) => k.endsWith('popup_shown')), hasLength(1));
      expect(c.read(upgradePopupDueProvider), isFalse);
    });
  });
}
