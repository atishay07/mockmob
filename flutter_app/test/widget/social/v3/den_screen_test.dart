// The den's states and rules (spec 5.3 D1 to D6, 5.6 M1, M12, the moment queue, K5, F2, F8).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/widgets/den_cards.dart';
import 'package:mockmob/features/social/v3/widgets/den_stage.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';
import 'package:mockmob/features/social/v3/widgets/quest_bar.dart';
import 'package:mockmob/features/social/v3/widgets/sticker_row.dart';

import '../../../golden/social/v3/den_kit.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';

List<Object?> _moments(MobV3FakeServer server) => (server.denNow()['v3'] as Map)['moments'] as List<Object?>;

Future<void> _open(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 150));
  await tester.pump(const Duration(milliseconds: 150));
}

void main() {
  for (final scenario in ['quiet', 'open', 'played', 'live', 'one', 'heavy', 'questdone']) {
    testWidgets('F2: no Played tag and no count of players in the $scenario den', (tester) async {
      await pumpDen(tester, v3Server(scenario: scenario));
      await _open(tester);
      expect(find.text('Played'), findsNothing);
      expect(find.textContaining(RegExp(r'\bPlayed\b')), findsNothing);
      expect(find.textContaining(RegExp(r'\b\d of [2-5]\b(?! (questions|traps|seats))')), findsNothing);
      expect(find.textContaining('still to play'), findsNothing);
      // Every member's Fold stands undimmed: nothing marks who did or did not play.
      final puppets = tester.widgetList<FoldPuppet>(find.byType(FoldPuppet)).toList();
      expect(puppets, isNotEmpty);
      expect(puppets.every((p) => p.brightness == 1 && !p.ghost && !p.locked), isTrue);
    });
  }

  testWidgets('Folds stand in join order with their first names', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'quiet'));
    await _open(tester);
    final xs = [
      for (final n in ['You', 'Riya', 'Kabir', 'Zoya']) tester.getCenter(find.text(n)).dx,
    ];
    expect(xs, orderedEquals([...xs]..sort()));
  });

  testWidgets('D1 quiet: start a game; the header names the Mob', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'quiet'));
    await _open(tester);
    expect(find.text(MobV3Copy.quietTitle), findsOneWidget);
    expect(find.text(MobV3Copy.startAGame), findsOneWidget);
    expect(find.text('Chai Circle'), findsOneWidget);
    expect(find.text('Accountancy, 4 of you'), findsOneWidget);
    expect(find.text('3'), findsOneWidget); // the pennant
    expect(find.bySemanticsLabel(RegExp('^Your chain, 13 days')), findsOneWidget);
  });

  testWidgets('D1 when the start is used: Ask your Mob, with the "Again?" key', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'quiet', billing: 'used'));
    await _open(tester);
    expect(find.text(MobV3Copy.askTitle), findsOneWidget);
    expect(find.text(MobV3Copy.askKey), findsOneWidget);
    expect(find.text(MobV3Copy.askLine), findsOneWidget);
    expect(find.text(MobV3Copy.startAGame), findsNothing);
  });

  testWidgets('D2: the runs row names finished runs with their times, and the play key', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'open'));
    await _open(tester);
    expect(find.text('Riya opened a sprint'), findsOneWidget);
    expect(find.text(keepTimes('Runs so far: Riya, 2:13 PM. Kabir, 4:53 PM. Zoya, 6:28 PM.')), findsOneWidget);
    expect(find.text("Play Riya's sprint"), findsOneWidget);
    expect(find.text(MobV3Copy.moreWays), findsOneWidget);
  });

  testWidgets('heavy: the other open game is a link to the picker', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'heavy'));
    await _open(tester);
    expect(find.text('1 more game is open'), findsOneWidget);
  });

  testWidgets('D3: your time, the podium key and the sticker row', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'played'));
    await _open(tester);
    expect(find.text("Kabir's round"), findsOneWidget);
    expect(find.textContaining('You played at'), findsOneWidget);
    expect(find.text(MobV3Copy.seePodiumSoFar), findsOneWidget);
    for (final k in ['Nice one', 'So close', 'Teach me', 'Again?']) {
      expect(find.text(k), findsOneWidget);
    }
  });

  testWidgets('D4: a live room says who opened it and offers the room, with no presence tags', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'live'));
    await _open(tester);
    expect(find.text('Riya opened a live room'), findsOneWidget);
    expect(find.text("Join Riya's room"), findsOneWidget);
    expect(find.text('Here'), findsNothing);
  });

  testWidgets('D5: a Mob of one invites, with four open seats', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'one'));
    await _open(tester);
    expect(find.text('Accountancy, just you'), findsOneWidget);
    expect(find.text(MobV3Copy.oneTitle), findsOneWidget);
    expect(find.text(MobV3Copy.inviteWhatsApp), findsOneWidget);
    expect(find.text('4 open seats'), findsOneWidget);
    expect(find.text(MobV3Copy.copyCode), findsOneWidget);
  });

  testWidgets('D6 failed: the sentence and Try again, the room with no Folds', (tester) async {
    await pumpDen(
      tester,
      v3Server(scenario: 'heavy'),
      state: const RemoteState<MobRead>(
        error: ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500),
      ),
    );
    await _open(tester);
    expect(find.text(MobV3Copy.failed), findsOneWidget);
    expect(find.text(MobV3Copy.tryAgain), findsOneWidget);
    expect(find.byType(FoldPuppet), findsNothing);
  });

  testWidgets('F8: past the goal the quest shows the true total and the bar is full', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'questdone'));
    await _open(tester);
    expect(find.text('70 answered. The quest needed 60.'), findsOneWidget);
    final bar = tester.widget<QuestBar>(find.byType(QuestBar));
    expect(bar.answered, 70);
    expect(QuestBar.fillOf(bar.answered, bar.target), 1);
    expect(QuestBar.fillOf(51, 60), closeTo(0.85, 0.001));
  });

  testWidgets('moments play in order, one at a time, each marked seen only after it closed', (tester) async {
    final server = v3Server(scenario: 'questdone');
    final moments = RecordingMoments();
    final gates = <String, Completer<void>>{};
    moments.hold = (k) => (gates[k] = Completer<void>()).future;
    await pumpDen(tester, server, moments: moments);
    await _open(tester);
    expect(moments.played, hasLength(1));
    final first = moments.played.first;
    expect(first, startsWith('quest_done:'));
    // Still showing: not seen yet.
    expect(_moments(server), contains(first));
    gates[first]!.complete();
    await _open(tester);
    expect(_moments(server), isNot(contains(first)));
    expect(moments.played, hasLength(2));
    expect(moments.played[1], startsWith('stitch:'));
    expect(_moments(server), contains(moments.played[1]));
    gates[moments.played[1]]!.complete();
    await _open(tester);
    expect(moments.played, hasLength(3));
    expect(moments.played[2], 'reveal:hop');
    gates['reveal:hop']!.complete();
    await _open(tester);
    expect(moments.played, hasLength(3));
    expect(_moments(server), isEmpty);
  });

  testWidgets('K5: the pass notice shows once, is marked seen, and leaves on its own', (tester) async {
    final server = v3Server(scenario: 'quiet');
    await pumpDen(tester, server);
    await _open(tester);
    expect(find.textContaining('was covered by a rest pass. Your chain is still 13.'), findsOneWidget);
    final chain = await server.chain();
    expect(chain.notices, isEmpty);
    await tester.pump(const Duration(seconds: 7));
    expect(find.textContaining('was covered by a rest pass'), findsNothing);
  });

  testWidgets('M12: a sticker flies from your Fold; a second tap inside 3 s does nothing alarming', (tester) async {
    final server = v3Server(scenario: 'played');
    await pumpDen(tester, server);
    await _open(tester);
    List<Object?> reactions() => (server.denNow()['v3'] as Map)['reactions'] as List<Object?>;
    final before = reactions().length;
    await tester.ensureVisible(find.text('Nice one'));
    await tester.tap(find.text('Nice one'));
    await tester.pump(const Duration(milliseconds: 50));
    expect(reactions().length, before + 1);
    expect(find.byType(StickerFlight), findsOneWidget);
    // The flight starts over the Folds, not over the card.
    expect(find.descendant(of: find.byType(DenStage), matching: find.byType(StickerFlight)), findsOneWidget);
    await tester.tap(find.text('So close'));
    await tester.pump(const Duration(milliseconds: 50));
    expect(reactions().length, before + 1);
    expect(find.byType(StickerFlight), findsOneWidget);
    expect(find.textContaining("didn't go through"), findsNothing);
    await tester.pump(StickerFlight.total);
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(StickerFlight), findsNothing);
  });

  testWidgets('reduced motion: the den fades in over 120 ms and the Folds stay still', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'quiet'), reduced: true);
    await tester.pump(const Duration(milliseconds: 130));
    final puppets = tester.widgetList<FoldPuppet>(find.byType(FoldPuppet));
    expect(puppets, isNotEmpty);
    expect(puppets.every((p) => !p.breathe && !p.blink), isTrue);
    final fades = tester.widgetList<FadeTransition>(find.ancestor(of: find.byType(DenStage), matching: find.byType(FadeTransition)));
    expect(fades.every((f) => f.opacity.value == 1), isTrue);
  });

  test('M1 timeline: the spec numbers', () {
    expect(EnterDen.dim(0), closeTo(0.62, 0.001));
    expect(EnterDen.lamp(0), closeTo(0.6, 0.001));
    expect(EnterDen.lamp(420), closeTo(1, 0.001));
    expect(EnterDen.dim(420), closeTo(0, 0.001));
    expect(EnterDen.roomDy(120), closeTo(14, 0.001));
    expect(EnterDen.roomDy(480), closeTo(0, 0.001));
    expect(EnterDen.pennantAngle(160) * 180 / 3.141592653589793, closeTo(2.4, 0.01));
    expect(EnterDen.pennantAngle(1060).abs(), lessThan(0.0001));
    // Folds from 200, 90 ms apart; rise 14 dp and scale 0.92 to 1.
    expect(EnterDen.fold(199, 0).$1, 0);
    expect(EnterDen.fold(240, 0).$1, greaterThan(0));
    expect(EnterDen.fold(289, 1).$1, 0);
    expect(EnterDen.fold(320, 1).$1, greaterThan(0));
    expect(EnterDen.fold(200, 0).$3, closeTo(0.92, 0.001));
    expect(EnterDen.fold(1100, 4).$2, closeTo(0, 0.05));
    // The shadow settles 60 ms after its Fold.
    expect(EnterDen.shadow(259, 0).$1, 0);
    expect(EnterDen.shadow(300, 0).$1, greaterThan(0));
    // The card at 420 and the quest strip at 465.
    expect(EnterDen.block(419, EnterDen.cardAt).$1, 0);
    expect(EnterDen.block(464, EnterDen.questAt).$1, 0);
    expect(EnterDen.block(780, EnterDen.cardAt).$2, closeTo(0, 0.01));
  });

  testWidgets('M1: idle breathe and blink start at 700 ms', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'quiet'), reduced: false);
    // pumpDen lets images decode for about 640 ms of the timeline; by 1100 ms the room is awake.
    await tester.pump(const Duration(milliseconds: 600));
    final puppets = tester.widgetList<FoldPuppet>(find.byType(FoldPuppet));
    expect(puppets.every((p) => p.breathe && p.blink), isTrue);
  });
}
