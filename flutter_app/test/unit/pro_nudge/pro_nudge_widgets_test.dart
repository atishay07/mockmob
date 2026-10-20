// The Pro nudges on screen: the Upgrade sheet (its head per reason, the student's lines, Google Play's
// own price on the key and never the website's), the inline row (one action, dismissed for seven days),
// the gate key, the first-session helper (once), and nothing at all with PLAY_BILLING off or for Pro.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/student_actions.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/billing/data/billing_controller.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/billing/widgets/pro_page.dart' show ProPage;
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
  // "Go unlimited" row on a result waits for the next one. Which result is the first is decided by its attempt and
  // saved on the phone, and a result is seen only when its page is the one on top (review v15).
  group('the result row and the first result (D181)', () {
    const user = 'mm.pronudge.v2.user-1';
    final onboardedAt = DateTime(2026, 10, 18, 19).millisecondsSinceEpoch;
    Widget rowFor(String attemptId) => Padding(padding: const EdgeInsets.all(16), child: ProNudgeRow(surface: ProNudgeSurface.result, attemptId: attemptId));
    final row = rowFor('a1');

    NudgeRig onboardedStudent({int viewed = 0, String? first}) {
      final rig = NudgeRig();
      rig.prefs.values['$user.onboarded_at'] = onboardedAt;
      rig.prefs.values['$user.onboarded_launch'] = 'L1';
      if (viewed > 0) rig.prefs.values['$user.results_viewed'] = viewed;
      if (first != null) rig.prefs.values['$user.first_result'] = first;
      return rig;
    }

    testWidgets('a student onboarded on this phone: the first result has no row, and it is saved by its attempt', (tester) async {
      final rig = onboardedStudent();
      await pumpNudges(tester, row, rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
      expect(tester.getSize(find.byType(ProNudgeRow)).height, 0, reason: 'no row and no space');
      expect(rig.prefs.values['$user.results_viewed'], 1);
      expect(rig.prefs.values['$user.first_result'], 'a1');
      expect(containerOf(tester).read(proNudgeProvider).resultViewed, isTrue, reason: 'returns to Today count from here');
    });

    testWidgets('the first result taken away and built again (same run) stays without the row, and is counted once', (tester) async {
      final rig = onboardedStudent();
      final shown = ValueNotifier(true);
      addTearDown(shown.dispose);
      await pumpNudges(tester, ValueListenableBuilder<bool>(valueListenable: shown, builder: (_, on, _) => on ? row : const SizedBox()), rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
      for (var i = 0; i < 2; i++) {
        shown.value = false;
        await settleNudges(tester, rounds: 3);
        shown.value = true;
        await settleNudges(tester, rounds: 3);
        expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
      }
      expect(rig.prefs.values['$user.results_viewed'], 1);
      expect(rig.prefs.values['$user.first_result'], 'a1');
    });

    testWidgets('the first result opened again in a later run stays without the row', (tester) async {
      final rig = onboardedStudent(viewed: 1, first: 'a1');
      await pumpNudges(tester, row, rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
    });

    for (final sameKey in [false, true]) {
      final kept = sameKey ? ' (the same page kept)' : '';
      testWidgets('a first mock: the result built under the sealed sheet is not seen, and the reveal brings no row$kept', (tester) async {
        final rig = onboardedStudent();
        // 0: Today, which has read the nudges already, as in the app long before a result opens (so the only thing
        // that keeps the result under the seal from counting is that its page is not the one on top). 1: the full
        // result under the sealed sheet. 2: the reveal.
        final stage = ValueNotifier(0);
        addTearDown(stage.dispose);
        await pumpNudges(
          tester,
          ValueListenableBuilder<int>(
            valueListenable: stage,
            builder: (_, at, _) => Navigator(
              pages: [
                MaterialPage<void>(
                  key: const ValueKey('today'),
                  child: Scaffold(
                    body: Consumer(builder: (_, ref, _) {
                      ref.watch(proNudgeProvider);
                      return const Center(child: Text('today'));
                    }),
                  ),
                ),
                // The full result is the page under the sealed sheet (`/result/:id` under `/result/:id/sealed`); the reveal
                // hands over with `go`, which builds it again (a new key) or keeps it.
                if (at >= 1) MaterialPage<void>(key: ValueKey(sameKey || at == 2 ? 'full' : 'full-under-seal'), child: Scaffold(body: row)),
                if (at == 1) const MaterialPage<void>(key: ValueKey('sealed'), child: Scaffold(body: Center(child: Text('sealed')))),
              ],
              onDidRemovePage: (_) {},
            ),
          ),
          rig,
        );
        expect(find.text('today'), findsOneWidget);
        expect(containerOf(tester).read(proNudgeProvider).loaded, isTrue, reason: 'read on Today, before any result opens');

        stage.value = 1;
        await settleNudges(tester);
        expect(find.text('sealed'), findsOneWidget);
        expect(rig.prefs.values.containsKey('$user.results_viewed'), isFalse, reason: 'built under the seal: not seen yet');
        expect(rig.prefs.values.containsKey('$user.first_result'), isFalse);
        expect(containerOf(tester).read(proNudgeProvider).resultViewed, isFalse);

        stage.value = 2;
        await settleNudges(tester);
        expect(find.text('sealed'), findsNothing);
        expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing, reason: 'the first visible result carries no Pro ask');
        expect(rig.prefs.values['$user.results_viewed'], 1);
        expect(rig.prefs.values['$user.first_result'], 'a1');
      });
    }

    testWidgets('the second attempt carries the row, and it opens the Pro page', (tester) async {
      final rig = onboardedStudent(viewed: 1, first: 'a1');
      await pumpNudges(tester, rowFor('a2'), rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsOneWidget);
      expect(find.textContaining(ProNudgeCopy.goUnlimited), findsOneWidget);
      expect(rig.prefs.values['$user.results_viewed'], 2);
      expect(rig.prefs.values['$user.first_result'], 'a1', reason: 'never replaced');
      await tester.tap(find.textContaining(ProNudgeCopy.afterResult));
      await settleNudges(tester);
      expect(find.byType(ProPage), findsOneWidget);
    });

    testWidgets('the first result, then the second, in one run: no row, then the row', (tester) async {
      final rig = onboardedStudent();
      final id = ValueNotifier('a1');
      addTearDown(id.dispose);
      await pumpNudges(tester, ValueListenableBuilder<String>(valueListenable: id, builder: (_, a, _) => rowFor(a)), rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing);
      id.value = 'a2';
      await settleNudges(tester);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsOneWidget);
      id.value = 'a1';
      await settleNudges(tester);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsNothing, reason: 'back on the first result');
      expect(rig.prefs.values['$user.results_viewed'], 2);
    });

    testWidgets('a student who signed straight in is not new: the row is there on their first result', (tester) async {
      final rig = NudgeRig();
      await pumpNudges(tester, row, rig);
      expect(find.textContaining(ProNudgeCopy.afterResult), findsOneWidget);
      expect(rig.prefs.values.containsKey('$user.first_result'), isFalse);
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

      // The student views the result, comes back to Today once (not enough), then a second time (armed).
      final ctl = c.read(proNudgeProvider.notifier);
      ctl.notePlace(ShellPlace.page);
      ctl.noteResultViewed('a1');
      ctl.notePlace(ShellPlace.today);
      await settleNudges(tester);
      expect(c.read(upgradePopupDueProvider), isFalse);
      ctl.notePlace(ShellPlace.page);
      ctl.notePlace(ShellPlace.today);
      await settleNudges(tester);
      expect(c.read(upgradePopupDueProvider), isTrue);

      await tester.tap(find.text('calm'));
      await settleNudges(tester);
      expect(opened, [false, false, true]);
      expect(find.text(ProNudgeCopy.head(ProReason.firstSession).title), findsOneWidget);
      expect(rig.prefs.values.keys.where((k) => k.endsWith('popup_shown')), hasLength(1));
      expect(c.read(upgradePopupDueProvider), isFalse);
    });
  });
}
