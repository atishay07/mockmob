import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/screens/mob_compare_screen.dart';
import 'package:mockmob/features/social/screens/mob_history_screen.dart';
import 'package:mockmob/features/social/screens/mob_join_screen.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_hub_row.dart';
import 'package:mockmob/features/social/widgets/mob_ring.dart';
import 'package:mockmob/features/social/widgets/mob_today_card.dart';

import '../../helpers/golden_harness.dart';
import 'mob_test_kit.dart';

const Size _tall = Size(390, 3600);

Future<void> _pump(
  WidgetTester tester,
  Widget child,
  RemoteState<MobRead> state, {
  RecordingNavigator? nav,
  FakeMobActions Function(dynamic ref)? actions,
  bool settle = true,
  Size size = _tall,
}) async {
  final full = child is MobScreen || child is MobJoinScreen || child is MobCompareScreen || child is MobHistoryScreen;
  await pumpMockmob(
    tester,
    child,
    size: size,
    wrapInScaffold: !full,
    disableAnimations: true,
    overrides: mobOverrides(state, nav: nav, actions: actions == null ? null : (ref) => actions(ref)),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

MobCompare _compare([void Function(Map<String, dynamic>)? edit]) {
  final j = mobJson('compare_v2.json');
  edit?.call(j['compare'] as Map<String, dynamic>);
  return MobCompare.fromJson(j);
}

void main() {
  group('Mob page: states', () {
    testWidgets('loading shows a skeleton, no text of a state', (tester) async {
      await _pump(tester, const MobScreen(), const RemoteState<MobRead>(loading: true), settle: false);
      expect(find.text(MobCopy.startKey), findsNothing);
      expect(find.text(MobCopy.loadFailed), findsNothing);
    });

    testWidgets('a failed read names the cause and offers Try again', (tester) async {
      await _pump(tester, const MobScreen(), const RemoteState<MobRead>(error: ApiError(kind: ApiErrorKind.network, code: 'network')));
      expect(find.text(MobCopy.loadFailedOffline), findsOneWidget);
      expect(find.text(MobCopy.tryAgain), findsOneWidget);
    });

    testWidgets('the server switch off: one plain line, no start form', (tester) async {
      await _pump(tester, const MobScreen(), RemoteState<MobRead>(error: ApiError.fromResponse(404, errorBody('MOB_DISABLED'))));
      expect(find.text(MobCopy.unavailable), findsOneWidget);
      expect(find.text(MobCopy.startKey), findsNothing);
    });

    testWidgets('no Mob: the pitch, the seat ring, the rules in two plain lines, subjects, name prefilled, one Start key', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), noMobState(), actions: (ref) => fake = FakeMobActions(ref));
      expect(find.text(MobCopy.pitch), findsOneWidget);
      // H12: the seat ring is the page's picture; the rules are one paragraph, no check-mark list.
      expect(find.byType(MobSeatRing), findsOneWidget);
      expect(find.text(MobCopy.seatCaption('Asha')), findsOneWidget);
      expect(MobCopy.promises, hasLength(2));
      expect(find.text(MobCopy.promises.join(' ')), findsOneWidget);
      expect(find.byIcon(LucideIcons.check), findsNothing);
      expect(find.text('Accountancy'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Asha'), findsOneWidget);
      await tester.tap(find.text(MobCopy.startKey));
      await tester.pumpAndSettle();
      expect(fake!.calls.single, startsWith('create:accountancy:Asha:'));
    });

    testWidgets('a name that breaks the rule is refused before any request', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), noMobState(), actions: (ref) => fake = FakeMobActions(ref));
      await tester.enterText(find.byType(TextField), '1');
      await tester.tap(find.text(MobCopy.startKey));
      await tester.pumpAndSettle();
      expect(fake?.calls ?? const <String>[], isEmpty);
      expect(find.text(MobCopy.nameRule), findsWidgets);
    });

    testWidgets('a refused start says why, in the server\'s words', (tester) async {
      await _pump(tester, const MobScreen(), noMobState(), actions: (ref) => FakeMobActions(ref, failure: MobFailure.mobLimit));
      await tester.tap(find.text(MobCopy.startKey));
      await tester.pumpAndSettle();
      expect(find.textContaining('You already started a Mob.'), findsOneWidget);
    });
  });

  group('Mob page: Free', () {
    testWidgets('sat: the ring, See your answers, the teaser, the trap, members in join order, the Pro note', (tester) async {
      final nav = RecordingNavigator();
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState(), nav: nav, actions: (ref) => fake = FakeMobActions(ref));
      expect(find.text('3 of 4'), findsOneWidget);
      expect(find.text(MobCopy.closes), findsOneWidget);
      expect(find.text(MobCopy.paperLine('Accountancy', 10)), findsOneWidget);
      // The free teaser, and the free first side-by-side that waits for a second member to share.
      expect(find.text('Your Mob split on 3 of 10 questions.'), findsOneWidget);
      expect(find.text(MobCopy.offerNeedsOther), findsOneWidget);
      expect(find.text(MobCopy.openCompare), findsNothing);
      expect(find.text(MobCopy.shareLabel), findsWidgets);
      expect(find.text(MobCopy.trapLine(mobState().value!.mob!.trap!)), findsOneWidget);
      expect(find.text(MobCopy.repairIt), findsOneWidget);
      // No switcher, no extras, no history for a free student.
      expect(find.text(MobCopy.extrasTitle), findsNothing);
      expect(find.text(MobCopy.historyTitle), findsNothing);
      expect(find.text(MobCopy.startAnother), findsNothing);
      // Join order, never by score.
      final ys = [for (final n in ['Riya', 'Asha', 'Kabir', 'Meera']) tester.getTopLeft(find.textContaining(n).last).dy];
      expect([...ys]..sort(), ys);
      // Only the member who opted in shows a score, and no row says "Sat" (P6).
      expect(find.text('7 of 10'), findsOneWidget);
      expect(find.text('Sat'), findsNothing);
      // PLAY_BILLING off (H11): no line about Pro at all for a Free student.
      expect(find.text(MobCopy.proLine), findsNothing);
      expect(find.textContaining('Pro', findRichText: true), findsNothing);
      expect(find.textContaining('pricing', findRichText: true), findsNothing);

      await tester.tap(find.text(MobCopy.seeAnswers));
      await tester.tap(find.text(MobCopy.repairIt));
      await tester.ensureVisible(find.text(MobCopy.nudgeKey));
      await tester.tap(find.text(MobCopy.nudgeKey));
      await tester.pumpAndSettle();
      expect(nav.calls, ['answers:practice_u2', 'trap:6:practice_u2']);
      expect(fake!.calls, contains('nudge'));
      expect(find.text(MobCopy.nudgeSentNote), findsOneWidget);
    });

    testWidgets('not sat: Sit this week\'s paper with its free-of-credits line, no trap, no compare', (tester) async {
      final nav = RecordingNavigator();
      await _pump(tester, const MobScreen(), mobState(null, 'get_not_sat_v1.json'), nav: nav);
      expect(find.text(MobCopy.sitKey(10, 10)), findsOneWidget);
      expect(find.text(MobCopy.sitNote(10, 10)), findsOneWidget);
      expect(find.text('Free. No credits.'), findsOneWidget);
      expect(find.text(MobCopy.trapTitle), findsNothing);
      expect(find.text(MobCopy.compareTitle), findsNothing);
      await tester.tap(find.text(MobCopy.sitKey(10, 10)));
      await tester.pumpAndSettle();
      expect(nav.calls, ['sit']);
    });

    testWidgets('a received note shows with Got it, and Got it marks it seen', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState(null, 'get_not_sat_v1.json'), actions: (ref) => fake = FakeMobActions(ref));
      expect(find.text(MobCopy.nudgeReceived('Riya')), findsOneWidget);
      expect(fake!.calls, isNot(contains('seen')), reason: 'not marked until the student has read it');
      await tester.tap(find.text(MobCopy.gotIt));
      await tester.pumpAndSettle();
      expect(fake!.calls, contains('seen'));
    });

    testWidgets('a nudge already sent this week is disabled with its reason', (tester) async {
      await _pump(tester, const MobScreen(), mobState((m) => m['nudge'] = {'canSend': false, 'reason': 'sent', 'received': null}));
      expect(find.text(MobCopy.nudgeSentReason), findsWidgets);
    });

    testWidgets('everyone sat: no dead nudge key, only the line that says so', (tester) async {
      await _pump(tester, const MobScreen(), ringState(4, 4));
      expect(find.text(MobCopy.nudgeKey), findsNothing);
      expect(find.text(MobCopy.nudgeEveryoneSat), findsOneWidget);
    });

    testWidgets('this week\'s free paper went to another Mob: the plain line, no sit key', (tester) async {
      await _pump(tester, const MobScreen(), mobState((m) {
        ((m['week'] as Map)['paper'] as Map)['blocked'] = 'free_used';
        (m['week'] as Map)['youSat'] = false;
        (m['week'] as Map)['yourResultId'] = null;
        m['compare'] = null;
        m['trap'] = null;
      }));
      expect(find.text(MobCopy.freeUsedPlain), findsOneWidget);
      expect(find.text(MobCopy.sitKey(10, 10)), findsNothing);
    });

    testWidgets('alone: the invite is the primary action, no switches yet', (tester) async {
      await _pump(tester, const MobScreen(), mobState(null, 'get_alone_v1.json'));
      expect(find.text(MobCopy.inviteRow(4)), findsOneWidget);
      expect(find.text(MobCopy.aloneLead), findsOneWidget);
      expect(find.text('0 of 1'), findsOneWidget);
      expect(find.text(MobCopy.sitKey(10, 10)), findsOneWidget);
      expect(find.text(MobCopy.shareLabel), findsNothing);
      expect(find.text(MobCopy.muteNudges), findsNothing);
    });

    testWidgets('closed week says so and offers no sit key', (tester) async {
      await _pump(tester, const MobScreen(), mobState((m) {
        (m['week'] as Map)['youSat'] = false;
        (m['week'] as Map)['closed'] = true;
        m['compare'] = null;
        m['trap'] = null;
      }));
      expect(find.text(MobCopy.closed), findsOneWidget);
      expect(find.text(MobCopy.sitKey(10, 10)), findsNothing);
    });

    testWidgets('the full Mob has no invite row and says it is full', (tester) async {
      await _pump(tester, const MobScreen(), ringState(5, 5));
      expect(find.text(MobCopy.full), findsOneWidget);
      expect(find.textContaining('Invite a friend'), findsNothing);
      expect(find.text('5 of 5'), findsWidgets);
    });

    testWidgets('a locked side-by-side says the plain fact and offers no key (flag off)', (tester) async {
      await _pump(tester, const MobScreen(), mobState((m) {
        m['compare'] = {'available': true, 'access': 'locked', 'youShare': true, 'needsShare': false, 'teaser': {'split': 3, 'of': 10, 'with': null, 'text': 'Your Mob split on 3 of 10 questions.'}};
        m['trap'] = null;
      }));
      expect(find.text('Your Mob split on 3 of 10 questions.'), findsOneWidget);
      expect(find.text(MobCopy.lockedNotePlain), findsOneWidget);
      expect(find.text(MobCopy.openCompare), findsNothing);
    });

    testWidgets('a student who does not share is asked once, in words, with the switch off', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState((m) {
        (m['you'] as Map)['showScore'] = false;
        (m['compare'] as Map)['youShare'] = false;
      }), actions: (ref) => fake = FakeMobActions(ref));
      expect(find.text(MobCopy.offerNeedsYou), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(MobCopy.shareLabel).first);
      await tester.pumpAndSettle();
      expect(fake!.calls, contains('me:true:null'));
    });
  });

  group('Mob page: Pro', () {
    testWidgets('two Mobs, the switcher, extras, past weeks, the full side-by-side, no Pro note', (tester) async {
      final nav = RecordingNavigator();
      await _pump(tester, const MobScreen(), proState(), nav: nav);
      expect(find.text('Accountancy'), findsWidgets);
      expect(find.text('Economics'), findsOneWidget);
      expect(find.text(MobCopy.startAnother), findsOneWidget);
      expect(find.text(MobCopy.openCompare), findsOneWidget);
      expect(find.text(MobCopy.extrasTitle), findsOneWidget);
      expect(find.text('Partnership Accounts, 10 questions'), findsOneWidget);
      expect(find.text('Whole subject, 5 questions'), findsOneWidget);
      expect(find.text(MobCopy.makeExtra), findsOneWidget);
      expect(find.text(MobCopy.historyTitle), findsOneWidget);
      expect(find.text('2 weeks'), findsOneWidget);
      expect(find.text(MobCopy.proLine), findsNothing);
      await tester.ensureVisible(find.text(MobCopy.sitIt));
      await tester.tap(find.text(MobCopy.sitIt));
      await tester.pumpAndSettle();
      expect(nav.calls, ['sit:c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35']);
    });

    testWidgets('the side-by-side opens from its key and shows the questions', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), proState(), actions: (ref) => fake = FakeMobActions(ref, compareResult: _compare()));
      await tester.ensureVisible(find.text(MobCopy.openCompare));
      await tester.tap(find.text(MobCopy.openCompare));
      await tester.pumpAndSettle();
      expect(fake!.calls, ['compare:2026-10-12:-']);
      expect(find.text(MobCopy.questionNumber(1)), findsOneWidget);
      expect(find.text(MobCopy.sideBySideTitle(_compare())), findsOneWidget);
    });

    testWidgets('a refused side-by-side stays on the page with its reason', (tester) async {
      await _pump(tester, const MobScreen(), proState(), actions: (ref) => FakeMobActions(ref, compareFailure: MobFailure.proRequired));
      await tester.ensureVisible(find.text(MobCopy.openCompare));
      await tester.tap(find.text(MobCopy.openCompare));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.failure(MobFailure.proRequired)), findsOneWidget);
      expect(find.text(MobCopy.questionNumber(1)), findsNothing);
    });

    testWidgets('making an extra paper sends the length, and a refusal is read out', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), proState(), actions: (ref) => fake = FakeMobActions(ref));
      await tester.ensureVisible(find.text(MobCopy.makeExtra));
      await tester.tap(find.text(MobCopy.makeExtra));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.extraNote), findsOneWidget);
      await tester.tap(find.text(MobCopy.questionsN(15)));
      await tester.pumpAndSettle();
      await tester.tap(find.text(MobCopy.makePaper));
      await tester.pumpAndSettle();
      expect(fake!.calls, ['extra:-:15']);
    });

    testWidgets('an extra paper you sat opens its answers and its side-by-side', (tester) async {
      final nav = RecordingNavigator();
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), proState(), nav: nav, actions: (ref) => fake = FakeMobActions(ref, compareResult: _compare()));
      await tester.ensureVisible(find.text(MobCopy.sideBySide).first);
      await tester.tap(find.text(MobCopy.sideBySide).first);
      await tester.pumpAndSettle();
      expect(fake!.calls, ['compare:-:d5f2b8a1-6c37-4a90-8e14-7b3c9d0a5f62']);
    });

    testWidgets('Start another Mob opens the form without the subjects that have a Mob', (tester) async {
      await _pump(tester, const MobScreen(), proState());
      await tester.ensureVisible(find.text(MobCopy.startAnother));
      await tester.pumpAndSettle();
      await tester.tap(find.text(MobCopy.startAnother));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.startKey), findsOneWidget);
      expect(find.text(MobCopy.pitch), findsNothing, reason: 'the sheet drops the pitch');
    });
  });

  group('Mob page: settings and menus', () {
    testWidgets('the mute switch writes through', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState(), actions: (ref) => fake = FakeMobActions(ref));
      await tester.ensureVisible(find.text(MobCopy.muteNudges));
      await tester.tap(find.bySemanticsLabel(MobCopy.muteNudges).last);
      await tester.pumpAndSettle();
      expect(fake!.calls, contains('me:null:true'));
      expect(find.text(MobCopy.leave), findsOneWidget);
    });

    testWidgets('Leave Mob asks first, then leaves', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState(), actions: (ref) => fake = FakeMobActions(ref));
      await tester.ensureVisible(find.text(MobCopy.leave));
      await tester.tap(find.text(MobCopy.leave));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.leaveTitle(false, 'Accountancy')), findsOneWidget);
      expect(fake!.calls, isEmpty);
      await tester.tap(find.text(MobCopy.leaveConfirm).last);
      await tester.pumpAndSettle();
      expect(fake!.calls, ['leave:-']);
    });

    testWidgets('with several Mobs the leave question names the one it is about', (tester) async {
      await _pump(tester, const MobScreen(), proState());
      await tester.ensureVisible(find.text(MobCopy.leave));
      await tester.tap(find.text(MobCopy.leave));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.leaveTitle(true, 'Accountancy')), findsOneWidget);
    });

    testWidgets('a member menu leaves and blocks only after a confirm', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState(), actions: (ref) => fake = FakeMobActions(ref));
      await tester.tap(find.byTooltip(MobCopy.memberMenu('Riya')));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.report), findsOneWidget);
      expect(find.text(MobCopy.removeMember), findsNothing, reason: 'only the member who started the Mob can remove');
      await tester.tap(find.text(MobCopy.leaveAndBlock));
      await tester.pumpAndSettle();
      expect(find.text(MobCopy.blockTitle('Riya')), findsOneWidget);
      await tester.tap(find.text(MobCopy.leaveAndBlock).last);
      await tester.pumpAndSettle();
      expect(fake!.calls, ['leave:K7Q2M9XR4T1A']);
    });

    testWidgets('every tappable control is at least 48 dp (Free)', (tester) async {
      await _pump(tester, const MobScreen(), mobState());
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    });

    testWidgets('every tappable control is at least 48 dp (Pro)', (tester) async {
      await _pump(tester, const MobScreen(), proState());
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    });
  });

  group('side-by-side', () {
    testWidgets('per question: you, the sharers, the verdict in words, the split, the trap', (tester) async {
      final nav = RecordingNavigator();
      await _pump(tester, MobCompareScreen(data: _compare()), mobState(), nav: nav, size: const Size(390, 4800));
      expect(find.text(MobCopy.sideBySideTitle(_compare())), findsOneWidget);
      expect(find.text('3 of 4 sat.'), findsOneWidget);
      expect(find.text('Your Mob split on 3 of 10 questions.'), findsOneWidget);
      expect(find.text(MobCopy.questionNumber(6)), findsOneWidget);
      expect(find.text(MobCopy.split), findsNWidgets(3));
      expect(find.text(MobCopy.right), findsWidgets);
      expect(find.text(MobCopy.wrong), findsWidgets);
      expect(find.text('Changed once. 1m 11s'), findsOneWidget);
      expect(find.text(MobCopy.howPicked(const [MobPickCount(option: 'B', count: 3)])), findsNWidgets(2), reason: 'questions 6 and 10');
      await tester.ensureVisible(find.text(MobCopy.repairIt));
      await tester.tap(find.text(MobCopy.repairIt));
      await tester.pumpAndSettle();
      expect(nav.calls, ['trap:6:practice_u2']);
      // No arrows, no ranking: nothing here sorts by score.
      expect(find.textContaining('rank'), findsNothing);
    });

    testWidgets('members who keep their answers private are counted, never named', (tester) async {
      await _pump(tester, MobCompareScreen(data: _compare((c) => c['hidden'] = 1)), mobState());
      expect(find.text('3 of 4 sat. 1 member keeps their answers private.'), findsOneWidget);
    });

    testWidgets('the free first side-by-side says so; a student who does not share can turn it on', (tester) async {
      FakeMobActions? fake;
      await _pump(
        tester,
        MobCompareScreen(data: _compare((c) {
          c['access'] = 'sample';
          c['youShare'] = false;
        })),
        mobState(),
        actions: (ref) => fake = FakeMobActions(ref, compareResult: _compare()),
      );
      expect(find.text(MobCopy.sampleLeadPlain), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(MobCopy.shareLabel).first);
      await tester.pumpAndSettle();
      expect(fake!.calls, ['me:true:null', 'compare:-:-']);
    });

    testWidgets('a paper whose questions are gone says so and keeps the result reachable', (tester) async {
      await _pump(tester, MobCompareScreen(data: _compare((c) => c['questions'] = <Object>[])), mobState());
      expect(find.text(MobCopy.noQuestions), findsOneWidget);
    });

    testWidgets('an extra paper is titled by its chapter and length', (tester) async {
      final c = _compare((c) {
        c['kind'] = 'extra';
        c['chapter'] = 'Partnership Accounts';
        c['extraId'] = 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35';
      });
      await _pump(tester, MobCompareScreen(data: c, extra: c.extraId), mobState());
      expect(find.text('Partnership Accounts, 10 questions'), findsOneWidget);
    });

    testWidgets('every tappable control is at least 48 dp', (tester) async {
      await _pump(tester, MobCompareScreen(data: _compare()), mobState(), size: const Size(390, 4800));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
    });
  });

  group('past weeks', () {
    testWidgets('weeks newest first, your result and a side-by-side where two sat', (tester) async {
      final nav = RecordingNavigator();
      FakeMobActions? fake;
      await _pump(
        tester,
        const MobHistoryScreen(),
        proState(),
        nav: nav,
        actions: (ref) => fake = FakeMobActions(ref, historyResult: MobHistory.fromJson(mobFixture('history_v2.json')), compareResult: _compare()),
      );
      expect(find.text('Week of 5 Oct'), findsOneWidget);
      expect(find.text('Week of 28 Sep'), findsOneWidget);
      expect(find.text('4 members sat. You scored 8 of 10. 1 extra paper.'), findsOneWidget);
      expect(find.text('2 members sat. You did not sit it.'), findsOneWidget);
      // The week you did not sit has no keys: there is nothing of yours to open.
      expect(find.text(MobCopy.seeAnswers), findsOneWidget);
      await tester.tap(find.text(MobCopy.seeAnswers));
      await tester.tap(find.text(MobCopy.sideBySide));
      await tester.pumpAndSettle();
      expect(nav.calls, ['answers:practice_u2_w1']);
      expect(fake!.calls, ['history', 'compare:2026-10-05:-']);
    });

    testWidgets('a failed read names the cause and offers Try again', (tester) async {
      await _pump(tester, const MobHistoryScreen(), proState());
      expect(find.text(MobCopy.failure(MobFailure.generic)), findsOneWidget);
      expect(find.text(MobCopy.tryAgain), findsOneWidget);
    });

    testWidgets('no closed week yet: it says when weeks appear', (tester) async {
      await _pump(tester, const MobHistoryScreen(), proState(), actions: (ref) => FakeMobActions(ref, historyResult: const MobHistory()));
      expect(find.text(MobCopy.historyEmpty), findsOneWidget);
    });
  });

  group('entry points', () {
    testWidgets('Today card: nothing when not in a Mob', (tester) async {
      await _pump(tester, const MobTodayCard(), noMobState());
      expect(find.byType(MobTodayCard), findsOneWidget);
      expect(find.textContaining('sat this week'), findsNothing);
    });

    testWidgets('Today card: the ring line, and a sit key that sits the paper', (tester) async {
      final nav = RecordingNavigator();
      await _pump(tester, const MobTodayCard(), mobState(null, 'get_not_sat_v1.json'), nav: nav);
      expect(find.text(MobCopy.ringLine(3, 4)), findsOneWidget);
      expect(find.text(MobCopy.nudgeReceived('Riya')), findsOneWidget);
      await tester.tap(find.text(MobCopy.sitKey(10, 10)));
      await tester.pumpAndSettle();
      expect(nav.calls, ['sit']);
    });

    testWidgets('Today card: after you sat, the key opens the Mob', (tester) async {
      await _pump(tester, const MobTodayCard(), mobState());
      expect(find.text(MobCopy.seeMob), findsOneWidget);
      expect(find.text(MobCopy.sitKey(10, 10)), findsNothing);
    });

    testWidgets('Today card: with the week\'s free paper used elsewhere there is no sit key', (tester) async {
      await _pump(tester, const MobTodayCard(), mobState((m) {
        (((m['week'] as Map)['paper']) as Map)['blocked'] = 'free_used';
        (m['week'] as Map)['youSat'] = false;
      }));
      expect(find.text(MobCopy.sitKey(10, 10)), findsNothing);
      expect(find.text(MobCopy.seeMob), findsOneWidget);
    });

    testWidgets('Today card: the Mobi moment once when the ring completes', (tester) async {
      await _pump(tester, const MobTodayCard(), ringState(4, 4));
      expect(find.text(MobCopy.mobiComplete(4)), findsOneWidget);
      expect(find.text(MobCopy.seeMob), findsOneWidget);
    });

    testWidgets('Today card: a Mob of one has no moment and no sit key to nobody', (tester) async {
      await _pump(tester, const MobTodayCard(), ringState(1, 1));
      expect(find.textContaining('Your Mob sat it'), findsNothing);
    });

    testWidgets('Today card: with two Mobs the title names the subject', (tester) async {
      await _pump(tester, const MobTodayCard(), proState());
      expect(find.text('Your Accountancy Mob'), findsOneWidget);
    });

    testWidgets('You hub row: hidden while the server switch is off', (tester) async {
      await _pump(tester, const MobHubRow(), RemoteState<MobRead>(error: ApiError.fromResponse(404, errorBody('MOB_DISABLED'))));
      expect(find.text(MobCopy.hubStart), findsNothing);
      expect(find.text(MobCopy.hubRow), findsNothing);
    });

    testWidgets('You hub row: Start a Mob when not in one', (tester) async {
      await _pump(tester, const MobHubRow(), noMobState());
      expect(find.text(MobCopy.hubStart), findsOneWidget);
    });

    testWidgets('You hub row: Your Mob with its ring line', (tester) async {
      await _pump(tester, const MobHubRow(), mobState());
      expect(find.text(MobCopy.hubRow), findsOneWidget);
      expect(find.text('Accountancy, ${MobCopy.ringLine(3, 4)}'), findsOneWidget);
    });
  });

  group('join', () {
    testWidgets('a bad code reads the one plain sentence', (tester) async {
      await _pump(tester, const MobJoinScreen(code: 'nope'), noMobState());
      expect(find.text(MobCopy.inviteUnusableTitle), findsOneWidget);
      expect(find.text(MobCopy.inviteUnusableNote), findsOneWidget);
      expect(find.text(MobCopy.joinKey), findsNothing);
    });

    testWidgets('an expired code reads exactly like a bad one', (tester) async {
      await _pump(tester, const MobJoinScreen(code: '7K3M9QXA'), noMobState(), actions: (ref) => FakeMobActions(ref, previewResult: (null, MobFailure.inviteExpired)));
      expect(find.text(MobCopy.inviteUnusableTitle), findsOneWidget);
    });

    testWidgets('a good code names who invited you, the subject and seats, then one Join key', (tester) async {
      FakeMobActions? fake;
      const preview = MobInvitePreview(code: '7K3M9QXA', subject: 'accountancy', subjectLabel: 'Accountancy', size: 3, seatsLeft: 2, inviter: 'Riya');
      await _pump(tester, const MobJoinScreen(code: 'https://www.mockmob.in/join/7K3M9QXA'), noMobState(),
          actions: (ref) => fake = FakeMobActions(ref, previewResult: (preview, null)));
      expect(find.text('Riya invited you to this week\'s 10-question Accountancy paper.'), findsOneWidget);
      expect(find.text(MobCopy.joinBody(preview)), findsOneWidget);
      expect(find.text(MobCopy.joinNoContacts), findsOneWidget);
      // The name is filled in and editable, and nothing else stands between the link and the key.
      expect(find.text('Asha'), findsWidgets);
      expect(find.byType(TextField), findsNothing, reason: 'the name field opens on Change name or colour');
      await tester.tap(find.text(MobCopy.joinKey));
      await tester.pumpAndSettle();
      expect(fake!.calls.single, startsWith('join:7K3M9QXA:Asha:'));
    });

    testWidgets('a signed-out style preview with no inviter still reads as an invitation', (tester) async {
      const preview = MobInvitePreview(code: '7K3M9QXA', subject: 'economics', size: 2, seatsLeft: 3);
      await _pump(tester, const MobJoinScreen(code: '7K3M9QXA'), noMobState(), actions: (ref) => FakeMobActions(ref, previewResult: (preview, null)));
      expect(find.text(MobCopy.joinTitle), findsOneWidget);
      expect(find.text(MobCopy.joinKey), findsOneWidget);
    });

    testWidgets('the plan\'s limit comes back as its sentence with a way to the Mob you are in', (tester) async {
      const preview = MobInvitePreview(code: '7K3M9QXA', subject: 'economics', size: 2, seatsLeft: 3);
      await _pump(tester, const MobJoinScreen(code: '7K3M9QXA'), mobState(),
          actions: (ref) => FakeMobActions(ref, previewResult: (preview, null), failure: MobFailure.mobCeiling));
      await tester.tap(find.text(MobCopy.joinKey));
      await tester.pumpAndSettle();
      expect(find.textContaining('You are in 12 Mobs'), findsOneWidget);
      expect(find.text(MobCopy.openYourMobs), findsOneWidget);
    });

    testWidgets('a refused name opens the name field with the reason', (tester) async {
      const preview = MobInvitePreview(code: '7K3M9QXA', subject: 'economics', size: 2, seatsLeft: 3);
      await _pump(tester, const MobJoinScreen(code: '7K3M9QXA'), noMobState(),
          actions: (ref) => FakeMobActions(ref, previewResult: (preview, null), failure: MobFailure.nameRefused));
      await tester.tap(find.text(MobCopy.joinKey));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text(MobCopy.failure(MobFailure.nameRefused)), findsOneWidget);
    });
  });
}

Map<String, dynamic> errorBody(String code) => (mobFixture('errors_v1.json')[code] as Map<String, dynamic>)['body'] as Map<String, dynamic>;
