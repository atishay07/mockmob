// The den's states and rules (spec 5.3 D1 to D6, 5.6 M1, M12, the moment queue, K5, F2, F8).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/screens/results_run.dart';
import 'package:mockmob/features/social/v3/widgets/pennant.dart';
import 'package:mockmob/features/social/v3/widgets/results_parts.dart' show RunStepDots;
import 'package:mockmob/features/social/v3/widgets/den_stage.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';
import 'package:mockmob/features/social/v3/widgets/quest_segments.dart';
import 'package:mockmob/features/social/v3/widgets/sticker_row.dart';

import '../../../golden/social/v3/den_kit.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';

List<Object?> _moments(MobV3FakeServer server) => (server.denNow()['v3'] as Map)['moments'] as List<Object?>;

Future<void> _open(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 150));
  await tester.pump(const Duration(milliseconds: 150));
}

/// Achievements due on den open play as the results run over the den (V4 3.4); its X returns to the den.
Future<void> _closeRun(WidgetTester tester) async {
  for (var i = 0; i < 6 && find.byType(ResultsRun).evaluate().isNotEmpty; i++) {
    await tester.tap(find.byIcon(LucideIcons.x).last, warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 400));
    await _open(tester);
  }
}

void main() {
  for (final scenario in ['quiet', 'open', 'played', 'live', 'one', 'heavy', 'questdone']) {
    testWidgets('F2: no Played tag and no count of players in the $scenario den', (tester) async {
      await pumpDen(tester, v3Server(scenario: scenario));
      await _open(tester);
      await _closeRun(tester);
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
    expect(find.text('Accountancy · 4 of 5 seats'), findsOneWidget);
    expect(find.text('3'), findsOneWidget); // the pennant
    expect(find.bySemanticsLabel(RegExp('^Your chain, 13 days')), findsOneWidget);
  });

  testWidgets('D1 when the start is used: Ask your Mob, with the "Again?" key', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'quiet', billing: 'used'));
    await _open(tester);
    expect(find.text(MobV3Copy.askTitle), findsOneWidget);
    expect(find.text(MobV3Copy.askKey), findsOneWidget);
    expect(find.text(MobV3Copy.askLine), findsOneWidget);
    // V4: the Start a game row stays first and always; it is not the card's key here.
    expect(find.byKey(const ValueKey('den-start-key')), findsNothing);
    expect(find.byKey(const ValueKey('den-row-start')), findsOneWidget);
  });

  testWidgets('V4 step 4: who raced it under the ruler, the play key, and Start a game as the first row', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'open'));
    await _open(tester);
    expect(find.text('Riya opened a sprint'), findsOneWidget);
    expect(find.bySemanticsLabel('Kabir and Zoya have raced it'), findsOneWidget);
    expect(find.textContaining('Runs so far'), findsNothing);
    expect(find.text("Play Riya's sprint"), findsOneWidget);
    expect(find.text(MobV3Copy.moreWays), findsNothing);
    expect(find.byKey(const ValueKey('den-row-start')), findsOneWidget);
  });

  testWidgets('V4 heavy: the other open game is an Also open row, never a picker link', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'heavy'));
    await _open(tester);
    expect(find.text('1 more game is open'), findsNothing);
    expect(find.textContaining('Also open'), findsOneWidget);
  });

  testWidgets('D3: your time, the podium key and the sticker row', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'played'));
    await _open(tester);
    expect(find.text("Kabir's round"), findsOneWidget);
    expect(find.textContaining('You played at'), findsOneWidget);
    expect(find.text('See where you stand'), findsOneWidget);
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
    expect(find.text('Accountancy · 1 of 5 seats'), findsOneWidget);
    expect(find.text(MobV3Copy.oneTitle), findsOneWidget);
    expect(find.text(MobV3Copy.inviteWhatsApp), findsOneWidget);
    // V4 3.1 step 9: every open seat carries its own tag ("Open" when two or more are left).
    expect(find.text(MobV4DenCopy.openShort), findsNWidgets(4));
    expect(find.text(MobV3Copy.copyCode), findsOneWidget);
  });

  testWidgets('H2: a Mob of one after you played your own sprint: the invite card, then Your sprint as a row', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'oneplayed'));
    await _open(tester);
    // V4 3.1 step 9: the invite is the Now card; your own game is a row below it, named as yours (H2).
    expect(find.text(MobV3Copy.oneTitle), findsOneWidget);
    expect(find.text('Your sprint'), findsOneWidget);
    expect(find.byKey(const ValueKey('den-row-start')), findsOneWidget, reason: 'another game can still be started');
    // The invite is the Now card and the one volt key; your game is a row under it.
    expect(find.text(MobV3Copy.inviteWhatsApp), findsOneWidget);
    expect(tester.getRect(find.text('Your sprint')).top, greaterThan(tester.getRect(find.text(MobV3Copy.oneTitle)).top));
  });

  testWidgets('H2: a Mob of one with no game keeps the plain D5', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'one'));
    await _open(tester);
    expect(find.byKey(const ValueKey('den-one-game')), findsNothing);
    expect(find.text(MobV3Copy.seePodiumSoFar), findsNothing);
  });

  testWidgets('L4: in a Mob of one your Fold stands in the middle of the lamp pool', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'one'));
    await _open(tester);
    final fold = tester.getCenter(find.byType(FoldPuppet));
    expect(fold.dx, closeTo(180, 2));
  });

  testWidgets('L5: a brand-new Mob pennant says New Mob, never 0 weeks', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'one'));
    await _open(tester);
    // The pennant never says 0 weeks (the quest panel may truly say 0 of 60).
    expect(find.descendant(of: find.byType(Pennant), matching: find.text('0')), findsNothing);
    expect(find.text(MobV3Copy.pennantNew), findsOneWidget);
    expect(find.text('Mob'), findsOneWidget);
  });

  testWidgets('H5: at 360 x 800 the heavy den shows the play key above the bottom bar, the pass notice under the card', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'heavy'), height: 800);
    await _open(tester);
    final key = find.byKey(const ValueKey('den-play-key'));
    expect(key, findsOneWidget);
    // The tab bar and the gesture bar take the last 100 dp of an 800 dp phone, the status bar the
    // first 40 (the emulator's 720 x 1600 at 2x).
    expect(tester.getRect(key).bottom, lessThanOrEqualTo(800 - 100 - 40), reason: 'the one key is visible on first view');
    final notice = find.byKey(const ValueKey('den-pass-notice'));
    expect(notice, findsOneWidget);
    expect(tester.getRect(notice).top, greaterThan(tester.getRect(key).bottom), reason: 'the notice sits under the card');
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
    await _closeRun(tester);
    // V4 panel: the true total beside "of 60", and the bar full.
    expect(find.text('70'), findsOneWidget);
    expect(find.text('of 60'), findsOneWidget);
    final bar = tester.widget<QuestSegments>(find.byType(QuestSegments));
    expect(bar.answered, 70);
    expect(QuestSegments.fractionOf(bar.answered, bar.target), 1);
    expect(QuestSegments.fractionOf(51, 60), closeTo(0.85, 0.001));
  });

  testWidgets('achievements due on den open play as the results run, each marked seen only after its screen closed', (tester) async {
    final server = v3Server(scenario: 'questdone');
    await pumpDen(tester, server);
    await _open(tester);
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(ResultsRun), findsOneWidget);
    expect(find.byType(RunStepDots), findsWidgets);
    final quest = _moments(server).firstWhere((k) => '$k'.startsWith('quest_done:'));
    // Still showing: not seen yet.
    expect(_moments(server), contains(quest));
    await tester.tap(find.text('Continue').last, warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 400));
    await _open(tester);
    expect(_moments(server), isNot(contains(quest)));
    // The X returns to the den.
    await _closeRun(tester);
    expect(find.byType(ResultsRun), findsNothing);
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
    expect(EnterDen.pennantAngle(160) * 180 / 3.141592653589793, closeTo(4.8, 0.01));
    // Even half-swings of 225 ms: -2.4 at 385, +1.2 at 610, -0.4 at 835 (a visible, decaying sway).
    expect(EnterDen.pennantAngle(385) * 180 / 3.141592653589793, closeTo(-2.4, 0.01));
    expect(EnterDen.pennantAngle(610) * 180 / 3.141592653589793, closeTo(1.2, 0.01));
    expect(EnterDen.pennantAngle(835) * 180 / 3.141592653589793, closeTo(-0.4, 0.01));
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
