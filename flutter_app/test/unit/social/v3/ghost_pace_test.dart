// Spec 5.3 R4, the ghost pace chip: the formula exactly, on the fixture's three recorded runs of
// Riya's sprint, including the flip from "4 s behind Kabir" to "4 s ahead of Kabir".

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/ghost_pace.dart';

import 'mob_v3_test_kit.dart';

const _riya = Ghost(memberId: 'RIYA00000002', name: 'Riya', arrivalsMs: [41000, 79000, 130000, 151000, 190000]);
const _kabir = Ghost(memberId: 'KABIR0000003', name: 'Kabir', arrivalsMs: [38000, 84000, 126000, 160000, 205000]);
const _zoya = Ghost(memberId: 'ZOYA00000004', name: 'Zoya', arrivalsMs: [52000, 101000, 150000, 199000, 236000]);
const _ghosts = [_riya, _kabir, _zoya];

void main() {
  test('the nearest ghost at your question, by the server times', () {
    final p = GhostPaceCalc.of(youMs: 42000, k: 0, ghosts: _ghosts)!;
    expect(p.name, 'Riya');
    expect(p.delta, -1);
    expect(p.text, '1 s behind Riya');
  });

  test('the fixture flips from "4 s behind Kabir" to "4 s ahead of Kabir"', () {
    final behind = GhostPaceCalc.of(youMs: 88000, k: 1, ghosts: _ghosts)!;
    expect(behind.text, '4 s behind Kabir');
    final ahead = GhostPaceCalc.of(youMs: 122000, k: 2, ghosts: _ghosts)!;
    expect(ahead.text, '4 s ahead of Kabir');
    expect(ahead.delta, 4);
  });

  test('under a second reads level', () {
    expect(GhostPaceCalc.of(youMs: 84400, k: 1, ghosts: _ghosts)!.text, 'Level with Kabir');
    expect(GhostPaceCalc.of(youMs: 83600, k: 1, ghosts: _ghosts)!.text, 'Level with Kabir');
  });

  test('rounding is JavaScript Math.round, so the server and the app agree on halves', () {
    expect(GhostPaceCalc.jsRound(3.5), 4);
    expect(GhostPaceCalc.jsRound(-3.5), -3);
    expect(GhostPaceCalc.jsRound(-0.5), 0);
    expect(GhostPaceCalc.jsRound(2.49), 2);
    // 4.5 s quicker than Kabir at question 2: +4.5 rounds to 5 ahead; 4.5 s slower rounds to 4 behind.
    expect(GhostPaceCalc.of(youMs: 121500, k: 2, ghosts: _ghosts)!.delta, 5);
    expect(GhostPaceCalc.of(youMs: 130500, k: 2, ghosts: const [_kabir])!.delta, -4);
  });

  test('a tie between two ghosts goes to the first in the server order', () {
    // 82000 is 3 s after Riya (79000)... and 2 s before Kabir (84000): Kabir is nearer.
    expect(GhostPaceCalc.of(youMs: 82000, k: 1, ghosts: _ghosts)!.name, 'Kabir');
    // 81500 is 2.5 s from both: the first ghost in the list, Riya.
    expect(GhostPaceCalc.of(youMs: 81500, k: 1, ghosts: _ghosts)!.name, 'Riya');
  });

  test('no chip before the first answer, with no ghosts, or past a ghost run', () {
    expect(GhostPaceCalc.afterAnswers(const [], _ghosts), isNull);
    expect(GhostPaceCalc.of(youMs: 40000, k: 0, ghosts: const []), isNull);
    expect(GhostPaceCalc.of(youMs: 40000, k: 7, ghosts: _ghosts), isNull);
    expect(GhostPaceCalc.of(youMs: 40000, k: -1, ghosts: _ghosts), isNull);
  });

  test('after stored answers, the latest question decides (a resumed run)', () {
    final p = GhostPaceCalc.afterAnswers(const [
      RunAnswer(q: 1, pick: 1, correct: true, elapsedMs: 88000),
      RunAnswer(q: 0, pick: 1, correct: true, elapsedMs: 42000),
    ], _ghosts);
    expect(p!.text, '4 s behind Kabir');
  });

  test('the fixture server sends these arrivals for Riya\'s sprint', () async {
    final server = v3Server();
    final game = await server.game('game-riya-sprint');
    final kabir = game.ghosts.firstWhere((g) => g.name == 'Kabir');
    expect(kabir.arrivalsMs, _kabir.arrivalsMs);
  });
}
