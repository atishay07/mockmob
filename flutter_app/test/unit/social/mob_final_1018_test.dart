// The owner's final walk, 18 Oct 2026 (FINAL-WALK-ISSUES.json), the Mob items:
//   H11  no Pro words with PLAY_BILLING off; with it on, every Pro line keeps its Upgrade key (D80)
//   H12  the start page's seat ring, the rules in two plain lines
//   M    a prefilled Mob name always passes the screen's own rule ("app-e2e-student" did not)
//   M    Today's invitation leads with what a Mob is, not "You have saved 12 sessions."

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/pro_nudge/data/pro_benefits.dart';
import 'package:mockmob/features/pro_nudge/data/pro_facts_provider.dart';
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_navigator.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_ring.dart';
import 'package:mockmob/features/social/widgets/mob_today_card.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import '../you/you_test_support.dart';
import 'mob_test_kit.dart';

const Size _tall = Size(390, 3600);

/// The Mob overrides with this account's display name and the Play flag.
List<Override> _overrides(RemoteState<MobRead> state, {String? name, bool on = false, FakeMobActions Function(Ref ref)? actions}) => [
      ...youOverrides(
        now: mobNow,
        auth: AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha.verma@example.com', name: name, subjects: const ['accountancy', 'economics']),
      ),
      mobRepositoryProvider.overrideWithBuild((ref, n) => state),
      mobPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      mobNavigatorProvider.overrideWithValue(RecordingNavigator()),
      mobActionsProvider.overrideWith((ref) => actions?.call(ref) ?? FakeMobActions(ref)),
      ...BillingRig(on: on).overrides,
      proNudgePrefsProvider.overrideWithValue(MemoryPrefsStore()),
      proFactsProvider.overrideWithValue(ProFacts.empty),
    ];

Future<void> _pump(WidgetTester tester, Widget child, List<Override> overrides, {Size size = _tall, double textScale = 1}) async {
  await pumpMockmob(tester, child, size: size, wrapInScaffold: child is! MobScreen, disableAnimations: true, overrides: overrides, textScale: textScale);
  await tester.pumpAndSettle();
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('the prefilled name always passes the rule', () {
    test('handles, emails, digits and long names', () {
      final cases = {
        'app-e2e-student': 'App',
        'asha.verma99@gmail.com': 'Asha',
        'riya_s@example.com': 'Riya',
        '12345': '',
        '9876543210': '',
        '': '',
        '   ': '',
        'Asha Verma': 'Asha',
        'asha': 'Asha',
        'Mary-Jane Watson': 'Mary-Jane',
        'A. Kumar': 'Kumar',
        'Bartholomewjohnsonsmith Lee': 'Bartholomewjohnson',
        'x7@y.com': '',
      };
      for (final e in cases.entries) {
        final got = mobNameFrom(e.key);
        expect(got, e.value, reason: e.key);
        if (got.isNotEmpty) expect(isValidMobName(got), isTrue, reason: '${e.key} -> $got');
      }
      expect(mobNameFrom(null), '');
    });

    testWidgets('a real name prefills a valid first name, and Start a Mob goes through untouched', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), _overrides(noMobState(), name: 'Asha Verma', actions: (ref) => fake = FakeMobActions(ref)));
      expect(find.widgetWithText(TextField, 'Asha'), findsOneWidget);
      await tester.ensureVisible(find.text(MobCopy.startKey));
      await tester.tap(find.text(MobCopy.startKey));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.nameRule), findsNothing);
      expect(fake!.calls.single, startsWith('create:accountancy:Asha:'));
    });

    testWidgets('a handle or the email prefix prefills nothing: the field asks for a first name (19 Oct walk: "Fresh" from the email)', (tester) async {
      for (final handle in ['app-e2e-student', 'asha.verma']) {
        await _pump(tester, const MobScreen(), _overrides(noMobState(), name: handle));
        final field = tester.widget<TextField>(find.byType(TextField));
        expect(field.controller!.text, '', reason: handle);
        expect(field.decoration!.hintText, MobCopy.nameHint);
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('digits only: the field starts empty with its hint, never a name that fails', (tester) async {
      await _pump(tester, const MobScreen(), _overrides(noMobState(), name: '9876543210'));
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.controller!.text, '');
      expect(field.decoration!.hintText, MobCopy.nameHint);
      expect(find.text(MobCopy.seatCaption('')), findsOneWidget);
    });
  });

  group('the start page (H12)', () {
    testWidgets('the seat ring takes the picked colour and the typed name', (tester) async {
      await _pump(tester, const MobScreen(), _overrides(noMobState(), name: 'Asha Verma'));
      expect(tester.widget<MobSeatRing>(find.byType(MobSeatRing)).initial, 'A');
      final before = tester.widget<MobSeatRing>(find.byType(MobSeatRing)).colour;
      final other = (before + 1) % MobColours.count;
      await tester.ensureVisible(find.bySemanticsLabel(MobCopy.colourName(other)));
      await tester.tap(find.bySemanticsLabel(MobCopy.colourName(other)));
      await tester.pumpAndSettle();
      expect(tester.widget<MobSeatRing>(find.byType(MobSeatRing)).colour, other);
      await tester.enterText(find.byType(TextField), 'Riya');
      await tester.pumpAndSettle();
      expect(tester.widget<MobSeatRing>(find.byType(MobSeatRing)).initial, 'R');
      expect(find.text(MobCopy.seatCaption('Riya')), findsOneWidget);
      expect(find.bySemanticsLabel(MobCopy.seatRingLabel), findsOneWidget);
    });

    testWidgets('one dominant key, and the page holds at 360 dp with large text', (tester) async {
      await _pump(tester, const MobScreen(), _overrides(noMobState(), name: 'Asha'), size: const Size(360, 3600), textScale: 1.6);
      expect(tester.takeException(), isNull);
      expect(find.text(MobCopy.startKey), findsOneWidget);
      // The rules are said once, above; the key carries no second "free" line on the page.
      expect(find.text(MobCopy.startCost), findsNothing);
      expect(MobCopy.promises.join(' '), isNot(contains('Pro')));
    });
  });

  group('no Pro words with PLAY_BILLING off (H11)', () {
    testWidgets('a Free student in a Mob reads no word of Pro anywhere on the page', (tester) async {
      await _pump(tester, const MobScreen(), _overrides(mobState(), name: 'Asha'));
      expect(find.textContaining(RegExp(r'\bPro\b'), findRichText: true), findsNothing);
      expect(find.text(ProNudgeCopy.seePro), findsNothing);
    });

    test('every Free limit has a plain sentence with no Pro in it', () {
      // MOB_LIMIT_PRO is said only to a Pro student, at the cap Pro has.
      for (final f in MobFailure.values.where((f) => f != MobFailure.mobLimitPro)) {
        expect(MobCopy.failure(f), isNot(matches(RegExp(r'\bPro\b'))), reason: f.name);
      }
      for (final s in [MobCopy.freeUsedPlain, MobCopy.lockedNotePlain, MobCopy.sampleLeadPlain, MobCopy.extrasOpenToAllPlain, MobCopy.inviteMomentBody]) {
        expect(s, isNot(contains('Pro')));
      }
      expect(MobCopy.freeUsedPlain, contains('You get one Mob paper a week.'));
    });

    testWidgets('flag on: the plan line keeps its See Pro key (D80)', (tester) async {
      await _pump(tester, const MobScreen(), _overrides(mobState(), name: 'Asha', on: true));
      expect(find.text(MobCopy.proLine), findsOneWidget);
      expect(find.text(ProNudgeCopy.seePro), findsWidgets);
    });

    testWidgets('flag on: the free first side-by-side names Pro and carries the Upgrade key', (tester) async {
      await _pump(
        tester,
        const MobScreen(),
        _overrides(
          mobState((m) {
            m['compare'] = {'available': true, 'access': 'locked', 'youShare': true, 'needsShare': false, 'teaser': {'split': 3, 'of': 10, 'with': null, 'text': 'Your Mob split on 3 of 10 questions.'}};
            m['trap'] = null;
          }),
          name: 'Asha',
          on: true,
        ),
      );
      expect(find.text(MobCopy.lockedNote), findsOneWidget);
      expect(find.text(ProNudgeCopy.gateAction), findsWidgets);
    });
  });

  group('Today\'s invitation (M)', () {
    testWidgets('leads with what a Mob is; the moment\'s count is not its first line', (tester) async {
      await _pump(tester, const MobInviteCard(reason: 'You have saved 12 sessions.'), _overrides(noMobState(), name: 'Asha'));
      expect(find.text(MobCopy.inviteMomentTitle), findsOneWidget);
      expect(find.text(MobCopy.inviteMomentBody), findsOneWidget);
      expect(find.textContaining('You have saved'), findsNothing);
      expect(MobCopy.inviteMomentBody, startsWith('Sit the same 10 questions as your friends'));
      expect(MobCopy.inviteMomentBody, isNot(contains('!')));
    });
  });
}
