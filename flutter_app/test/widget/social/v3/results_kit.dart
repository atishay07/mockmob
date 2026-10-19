// Fixtures for the results slice (R7 podium, R8 moments, R9 fix): podiums played through the fixture
// server, plus hand-made ones for the states the fixtures do not reach (only you, private marks).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_bank.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';

const String riyaGame = 'game-riya-sprint';
const String zoyaGame = 'game-zoya-closed';
const String youId = 'AARAV0000001';
const String riyaId = 'RIYA00000002';
const String kabirId = 'KABIR0000003';
const String zoyaId = 'ZOYA00000004';

/// Plays Riya's sprint as you: right, right, wrong, right, right (19 marks). Riya 20, You 19,
/// Kabir 19, Zoya 13: a shared second and Zoya on the floor.
Future<void> playRiyaSprint(MobV3FakeServer s) async {
  await s.run(riyaGame);
  const rights = [true, true, false, true, true];
  for (var q = 0; q < 5; q++) {
    final correct = mobV3Bank[q].correct;
    await s.answer(riyaGame, q: q, pick: rights[q] ? correct : (correct + 1) % 4);
  }
}

/// A heavy server with Riya's sprint played (the open podium with a tie).
Future<MobV3FakeServer> openServer() async {
  final s = v3Server();
  await playRiyaSprint(s);
  return s;
}

/// Only you finished.
Podium onlyYouPodium() => Podium(
      soFar: true,
      closesAt: DateTime.utc(2026, 10, 23, 8, 35),
      right: 4,
      of: 5,
      places: const [PodiumPlace(memberId: youId, name: 'Aarav', fold: FoldKey.dart, colour: 5, marks: 19, place: 1, you: true)],
    );

/// Kabir keeps his marks private: he stands with "Private" and no place.
Podium privatePodium() => Podium(
      soFar: true,
      closesAt: DateTime.utc(2026, 10, 23, 8, 35),
      right: 12,
      of: 15,
      places: const [
        PodiumPlace(memberId: riyaId, name: 'Riya', fold: FoldKey.patang, colour: 3, marks: 20, place: 1),
        PodiumPlace(memberId: youId, name: 'Aarav', fold: FoldKey.dart, colour: 5, marks: 19, place: 2, you: true),
        PodiumPlace(memberId: kabirId, name: 'Kabir', fold: FoldKey.naav, colour: 0, private: true),
      ],
    );

/// Reads the number in a place's marks text ("19 marks"), or null for "Private".
int? marksShown(WidgetTester tester, String memberId) {
  final w = tester.widget<Text>(find.byKey(ValueKey('podium-marks-$memberId')));
  final s = w.textSpan?.toPlainText() ?? w.data ?? '';
  return int.tryParse(s.split(' ').first);
}

PodiumStageState stageState(WidgetTester tester) => tester.state<PodiumStageState>(find.byType(PodiumStage));

/// Shows [warm] (to load the art) until [go] flips, then [live]. Frame tests start [live] at 0 ms.
class SwapHost extends StatelessWidget {
  const SwapHost({super.key, required this.go, required this.warm, required this.live});

  final ValueNotifier<bool> go;
  final Widget warm;
  final Widget live;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<bool>(valueListenable: go, builder: (_, on, _) => on ? live : warm);
}
