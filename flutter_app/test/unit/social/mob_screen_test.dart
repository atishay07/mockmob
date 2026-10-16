import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/screens/mob_join_screen.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_hub_row.dart';
import 'package:mockmob/features/social/widgets/mob_today_card.dart';

import '../../helpers/golden_harness.dart';
import 'mob_test_kit.dart';

const Size _tall = Size(390, 1800);

Future<void> _pump(WidgetTester tester, Widget child, RemoteState<MobRead> state, {RecordingNavigator? nav, FakeMobActions Function(dynamic ref)? actions, bool settle = true}) async {
  await pumpMockmob(
    tester,
    child,
    size: _tall,
    wrapInScaffold: child is! MobScreen && child is! MobJoinScreen,
    disableAnimations: true,
    overrides: mobOverrides(state, nav: nav, actions: actions == null ? null : (ref) => actions(ref)),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  group('Mob page', () {
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

    testWidgets('no Mob: the pitch, the three promises, subjects, name prefilled, one Start key', (tester) async {
      final nav = RecordingNavigator();
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), noMobState(), nav: nav, actions: (ref) => fake = FakeMobActions(ref));
      expect(find.text(MobCopy.pitch), findsOneWidget);
      for (final p in MobCopy.promises) {
        expect(find.text(p), findsOneWidget);
      }
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

    testWidgets('sat: the ring line, sitters, See your answers, the nudge, the trap, members in join order', (tester) async {
      final nav = RecordingNavigator();
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState(), nav: nav, actions: (ref) => fake = FakeMobActions(ref));
      expect(find.text('3 of 4'), findsOneWidget);
      expect(find.text(MobCopy.closes), findsOneWidget);
      expect(find.text(MobCopy.seeAnswers), findsOneWidget);
      expect(find.text(MobCopy.trapLine(mobState().value!.mob!.trap!)), findsOneWidget);
      // Join order, never by score.
      final names = ['Asha', 'Riya', 'Kabir', 'Dev'];
      final ys = [for (final n in names) tester.getTopLeft(find.textContaining(n).last).dy];
      expect([...ys]..sort(), ys);
      // Only the members who opted in show a score.
      expect(find.text('7 of 10'), findsOneWidget);
      expect(find.text('8 of 10'), findsOneWidget);
      // "Sat" for the three sitters only; no label on Dev's seat.
      expect(find.text(MobCopy.sat), findsNWidgets(3));

      await tester.tap(find.text(MobCopy.seeAnswers));
      await tester.tap(find.text(MobCopy.seeWhy('B')));
      await tester.ensureVisible(find.text(MobCopy.nudgeKey));
      await tester.tap(find.text(MobCopy.nudgeKey));
      await tester.pumpAndSettle();
      expect(nav.calls, ['answers:sess_123', 'trap:6']);
      expect(fake!.calls, contains('nudge'));
      expect(find.text(MobCopy.nudgeSent(1)), findsOneWidget);
    });

    testWidgets('not sat: Sit this week\'s paper with its plain cost line, no trap', (tester) async {
      final nav = RecordingNavigator();
      await _pump(tester, const MobScreen(), mobState((m) => (m['week'] as Map)['youSat'] = false), nav: nav);
      expect(find.text(MobCopy.sitKey(10, 12)), findsOneWidget);
      expect(find.text(MobCopy.costIncluded), findsOneWidget);
      expect(find.textContaining('trap'), findsNothing);
      await tester.tap(find.text(MobCopy.sitKey(10, 12)));
      await tester.pumpAndSettle();
      expect(nav.calls, ['sit']);
    });

    testWidgets('a received note shows once and is marked seen', (tester) async {
      FakeMobActions? fake;
      await _pump(
        tester,
        const MobScreen(),
        mobState((m) {
          (m['week'] as Map)['youSat'] = false;
          m['nudge'] = {'canSend': false, 'received': {'fromName': 'Riya'}};
        }),
        actions: (ref) => fake = FakeMobActions(ref),
      );
      expect(find.text(MobCopy.nudgeReceived('Riya')), findsOneWidget);
      expect(fake!.calls, contains('seen'));
    });

    testWidgets('a nudge already sent this week is disabled with its reason', (tester) async {
      await _pump(tester, const MobScreen(), mobState((m) => m['nudge'] = {'canSend': false}));
      expect(find.text(MobCopy.nudgeSentReason), findsWidgets);
    });

    testWidgets('alone: the invite is the primary action', (tester) async {
      await _pump(tester, const MobScreen(), ringState(0, 1));
      expect(find.text(MobCopy.inviteRow(4)), findsOneWidget);
      expect(find.text(MobCopy.aloneLead), findsOneWidget);
      expect(find.text('0 of 1'), findsOneWidget);
    });

    testWidgets('closed week says so and offers no sit key', (tester) async {
      await _pump(tester, const MobScreen(), mobState((m) {
        (m['week'] as Map)['youSat'] = false;
        (m['week'] as Map)['closed'] = true;
      }));
      expect(find.text(MobCopy.closed), findsOneWidget);
      expect(find.text(MobCopy.sitKey(10, 12)), findsNothing);
    });

    testWidgets('the full Mob has no invite row and says it is full', (tester) async {
      await _pump(tester, const MobScreen(), ringState(5, 5));
      expect(find.text(MobCopy.full), findsOneWidget);
      expect(find.textContaining('Invite a friend'), findsNothing);
      expect(find.text('5 of 5'), findsOneWidget);
    });

    testWidgets('settings: the score switch writes through', (tester) async {
      FakeMobActions? fake;
      await _pump(tester, const MobScreen(), mobState(), actions: (ref) => fake = FakeMobActions(ref));
      await tester.ensureVisible(find.text(MobCopy.muteNudges));
      await tester.tap(find.bySemanticsLabel(MobCopy.muteNudges).last);
      await tester.pumpAndSettle();
      expect(fake!.calls, contains('me:null:true'));
      expect(find.text(MobCopy.leave), findsOneWidget);
    });

    testWidgets('every tappable control is at least 48 dp', (tester) async {
      await _pump(tester, const MobScreen(), mobState());
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    });
  });

  group('entry points', () {
    testWidgets('Today card: nothing when not in a Mob', (tester) async {
      await _pump(tester, const MobTodayCard(), noMobState());
      expect(find.byType(MobTodayCard), findsOneWidget);
      expect(find.textContaining('sat this week'), findsNothing);
    });

    testWidgets('Today card: ring line and one action', (tester) async {
      await _pump(tester, const MobTodayCard(), mobState((m) => (m['week'] as Map)['youSat'] = false));
      expect(find.text(MobCopy.ringLine(3, 4)), findsOneWidget);
      expect(find.text(MobCopy.sitKey(10, 12)), findsOneWidget);
    });

    testWidgets('Today card: the Mobi moment once when the ring completes', (tester) async {
      await _pump(tester, const MobTodayCard(), ringState(4, 4));
      expect(find.text(MobCopy.mobiComplete(4)), findsOneWidget);
      expect(find.text(MobCopy.seeMob), findsOneWidget);
    });

    testWidgets('You hub row: hidden while the server switch is off', (tester) async {
      await _pump(tester, const MobHubRow(), const RemoteState<MobRead>(error: ApiError(kind: ApiErrorKind.notFound, code: 'MOB_DISABLED', status: 404)));
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
      expect(find.text(MobCopy.inviteUnusable), findsOneWidget);
      expect(find.text(MobCopy.joinKey), findsNothing);
    });

    testWidgets('a good code: subject and seats, never a name, then Join', (tester) async {
      const preview = MobInvitePreview(subject: 'economics', size: 2, seatsLeft: 3);
      await _pump(tester, const MobJoinScreen(code: 'https://www.mockmob.in/join/7K3M9QXA'), noMobState(),
          actions: (ref) => FakeMobActions(ref, previewResult: (preview, null)));
      expect(find.text(MobCopy.joinTitle), findsOneWidget);
      expect(find.text(MobCopy.joinBody(preview)), findsOneWidget);
      expect(find.text(MobCopy.joinNoContacts), findsOneWidget);
      expect(find.text(MobCopy.joinKey), findsOneWidget);
    });

    testWidgets('already in a Mob: says so instead of a Join key', (tester) async {
      const preview = MobInvitePreview(subject: 'economics', size: 2, seatsLeft: 3);
      await _pump(tester, const MobJoinScreen(code: '7K3M9QXA'), mobState(), actions: (ref) => FakeMobActions(ref, previewResult: (preview, null)));
      expect(find.text(MobCopy.alreadyInOne), findsOneWidget);
      expect(find.text(MobCopy.joinKey), findsNothing);
    });
  });
}
