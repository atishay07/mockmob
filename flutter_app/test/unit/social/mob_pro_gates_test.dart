// D80 in the Mob: every Mob part that is Pro's opens the Upgrade sheet when a Free student taps it,
// with PLAY_BILLING on. The locked side-by-side, the plan line, a refused start (one Mob on Free),
// the week's free paper used in another Mob, and a server answer that says Pro (PRO_REQUIRED,
// MOB_LIMIT, FREE_PAPER_USED). With the flag off every page is the one it was: no key, the toast.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/pro_nudge/data/pro_benefits.dart';
import 'package:mockmob/features/pro_nudge/data/pro_facts_provider.dart';
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_pro_entry.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import '../pro_nudge/pro_nudge_test_support.dart' show settleNudges;
import 'mob_test_kit.dart';

const Size _tall = Size(390, 3600);

Future<void> _pump(WidgetTester tester, Widget child, RemoteState<MobRead> state, {required bool on, FakeMobActions Function(Ref ref)? actions}) async {
  await pumpMockmob(
    tester,
    child,
    size: _tall,
    wrapInScaffold: child is! MobScreen,
    disableAnimations: true,
    overrides: [
      ...mobOverrides(state, actions: actions),
      ...BillingRig(on: on).overrides,
      proNudgePrefsProvider.overrideWithValue(MemoryPrefsStore()),
      proFactsProvider.overrideWithValue(ProFacts.empty),
    ],
  );
  await tester.pumpAndSettle();
}

Future<void> _tapKey(WidgetTester tester, String label) async {
  final key = find.text(label).first;
  await tester.ensureVisible(key);
  await tester.tap(key, warnIfMissed: false);
  await settleNudges(tester);
}

void _expectSheet(ProReason reason) {
  expect(find.text(ProNudgeCopy.head(reason).title), findsOneWidget);
  expect(find.text(ProNudgeCopy.head(reason).lede), findsOneWidget);
  expect(find.text(BillingCopy.getPro), findsWidgets);
  // The line that answers the Mob part leads the benefits.
  expect(find.text(ProNudgeCopy.leadBenefit(reason)!), findsOneWidget);
}

RemoteState<MobRead> _locked() => mobState((m) {
      m['compare'] = {'available': true, 'access': 'locked', 'youShare': true, 'needsShare': false, 'teaser': {'split': 3, 'of': 10, 'with': null, 'text': 'Your Mob split on 3 of 10 questions.'}};
      m['trap'] = null;
    });

RemoteState<MobRead> _freeUsed() => mobState((m) {
      ((m['week'] as Map)['paper'] as Map)['blocked'] = 'free_used';
      (m['week'] as Map)['youSat'] = false;
      (m['week'] as Map)['yourResultId'] = null;
      m['compare'] = null;
      m['trap'] = null;
    });

class _ToastHost extends StatelessWidget {
  const _ToastHost(this.failure);

  final MobFailure failure;

  @override
  Widget build(BuildContext context) => Center(
        child: TextButton(onPressed: () => sayMobFailure(context, failure, MobCopy.failure(failure)), child: const Text('act')),
      );
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('the locked side-by-side', () {
    testWidgets('flag on: Upgrade to Pro under the note opens the Upgrade sheet on the Mob', (tester) async {
      await _pump(tester, const MobScreen(), _locked(), on: true);
      expect(find.text(MobCopy.lockedNote), findsOneWidget);
      expect(find.text(MobCopy.openCompare), findsNothing);
      await _tapKey(tester, ProNudgeCopy.gateAction);
      _expectSheet(ProReason.mob);
    });

    testWidgets('flag off: the note alone, no key', (tester) async {
      await _pump(tester, const MobScreen(), _locked(), on: false);
      expect(find.text(MobCopy.lockedNote), findsOneWidget);
      expect(find.text(ProNudgeCopy.gateAction), findsNothing);
      expect(find.text(ProNudgeCopy.seePro), findsNothing);
    });
  });

  group('the plan line', () {
    testWidgets('flag on: a Free student has See Pro under what Pro adds; it opens the sheet on the Mob', (tester) async {
      await _pump(tester, const MobScreen(), mobState(), on: true);
      expect(find.text(MobCopy.proLine), findsOneWidget);
      await _tapKey(tester, ProNudgeCopy.seePro);
      _expectSheet(ProReason.mob);
    });

    testWidgets('a Pro student: no See Pro', (tester) async {
      await _pump(tester, const MobScreen(), proState(), on: true);
      expect(find.text(ProNudgeCopy.seePro), findsNothing);
    });
  });

  group('Free limits', () {
    testWidgets('a refused start (one Mob on Free): the server\'s words, then the key to the sheet on the limit', (tester) async {
      await _pump(tester, const MobScreen(), noMobState(), on: true, actions: (ref) => FakeMobActions(ref, failure: MobFailure.mobLimit));
      await tester.tap(find.text(MobCopy.startKey));
      await tester.pumpAndSettle();
      expect(find.textContaining('You already started a Mob.'), findsOneWidget);
      await _tapKey(tester, ProNudgeCopy.gateAction);
      _expectSheet(ProReason.mobLimit);
    });

    testWidgets('a refused start for a reason Pro does not answer: no key', (tester) async {
      await _pump(tester, const MobScreen(), noMobState(), on: true, actions: (ref) => FakeMobActions(ref, failure: MobFailure.mobCeiling));
      await tester.tap(find.text(MobCopy.startKey));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.failure(MobFailure.mobCeiling)), findsOneWidget);
      expect(find.text(ProNudgeCopy.gateAction), findsNothing);
    });

    testWidgets('the week\'s free paper went to another Mob: the line, then the key to the sheet on the limit', (tester) async {
      await _pump(tester, const MobScreen(), _freeUsed(), on: true);
      expect(find.text(MobCopy.freeUsed), findsOneWidget);
      await _tapKey(tester, ProNudgeCopy.gateAction);
      _expectSheet(ProReason.mobLimit);
    });

    testWidgets('flag off: the line alone', (tester) async {
      await _pump(tester, const MobScreen(), _freeUsed(), on: false);
      expect(find.text(MobCopy.freeUsed), findsOneWidget);
      expect(find.text(ProNudgeCopy.gateAction), findsNothing);
    });
  });

  group('a server answer that says Pro', () {
    for (final f in [MobFailure.proRequired, MobFailure.mobLimit, MobFailure.freePaperUsed]) {
      testWidgets('${f.name}, flag on: the Upgrade sheet opens instead of the toast', (tester) async {
        await _pump(tester, _ToastHost(f), mobState(), on: true);
        await tester.tap(find.text('act'));
        await settleNudges(tester);
        _expectSheet(mobProReason(f));
        expect(find.text(MobCopy.failure(f)), findsNothing);
      });

      testWidgets('${f.name}, flag off: the toast it always was', (tester) async {
        await _pump(tester, _ToastHost(f), mobState(), on: false);
        await tester.tap(find.text('act'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
        expect(find.text(MobCopy.failure(f)), findsOneWidget);
        expect(find.text(ProNudgeCopy.head(mobProReason(f)).title), findsNothing);
      });
    }

    testWidgets('a failure Pro does not answer stays a toast with the flag on', (tester) async {
      await _pump(tester, _ToastHost(MobFailure.alreadyNudged), mobState(), on: true);
      await tester.tap(find.text('act'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(MobCopy.failure(MobFailure.alreadyNudged)), findsOneWidget);
    });
  });
}
