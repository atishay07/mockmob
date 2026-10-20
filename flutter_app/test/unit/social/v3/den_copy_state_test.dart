// Which den card shows (spec 5.3 D1 to D5), from the fixture server's scenarios.

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/den_copy_state.dart';

import 'mob_v3_test_kit.dart';

MobRead _read(String scenario, {String billing = 'off'}) => MobRead.fromJson(v3Server(scenario: scenario, billing: billing).denNow());

DenCard _card(String scenario, {String billing = 'off'}) {
  final r = _read(scenario, billing: billing);
  return denCardFor(r.v3!, paperSat: r.mob?.week.youSat ?? false);
}

void main() {
  test('quiet: D1, nothing open, the paper was sat', () {
    final c = _card('quiet');
    expect(c.kind, DenCardKind.quiet);
    expect(c.game, isNull);
    expect(c.paperSat, isTrue);
  });

  test('quiet with the start used: the "Ask your Mob for a game" variant', () {
    expect(_card('quiet', billing: 'used').kind, DenCardKind.cantStart);
    expect(_card('quiet', billing: 'free').kind, DenCardKind.quiet);
    expect(_card('quiet', billing: 'pro').kind, DenCardKind.quiet);
  });

  test("open: D2 puts Riya's sprint forward", () {
    final c = _card('open');
    expect(c.kind, DenCardKind.open);
    expect(c.game!.id, 'game-riya-sprint');
    expect(c.moreOpen, 0);
  });

  test("played: D3 on Kabir's round, which you finished", () {
    final c = _card('played');
    expect(c.kind, DenCardKind.played);
    expect(c.game!.id, 'game-kabir-round');
    expect(c.game!.yourRun, YourRun.finished);
  });

  test('live: D4 on the open live room', () {
    final c = _card('live');
    expect(c.kind, DenCardKind.live);
    expect(c.game!.mode, GameMode.live);
  });

  test('one: D5, a Mob of one', () {
    expect(_card('one').kind, DenCardKind.one);
  });

  test('heavy: the unplayed game comes first, and the other open game is counted for the link', () {
    final c = _card('heavy');
    expect(c.kind, DenCardKind.open);
    expect(c.game!.id, 'game-riya-sprint');
    expect(c.moreOpen, 1);
  });

  test('a room that already started: D4 "Play it now"', () {
    final v3 = MobV3.fromJson({
      'name': {'key': 0, 'text': 'Chai Circle'},
      'live': {'enabled': true, 'hoursOk': true},
      'members': [
        {'memberId': 'A', 'name': 'Aarav', 'you': true},
        {'memberId': 'R', 'name': 'Riya'},
      ],
      'games': [
        {
          'id': 'g1',
          'mode': 'live',
          'host': {'memberId': 'R', 'name': 'Riya'},
          'closesAt': '2026-10-23T15:22:00Z',
          'room': {'state': 'running', 'startsAt': '2026-10-22T15:23:00Z'},
          'yourRun': 'none',
        },
      ],
    });
    expect(denCardFor(v3).kind, DenCardKind.liveRunning);
  });

  test('after every game closes the den is quiet again', () {
    final s = v3Server(scenario: 'heavy')..closeAllGames();
    final r = MobRead.fromJson(s.denNow());
    expect(denCardFor(r.v3!, paperSat: true).kind, DenCardKind.quiet);
    // V4 ladder step 5: the week's paper, unsat, comes before step 7.
    expect(denCardFor(r.v3!).kind, DenCardKind.paper);
  });
}
