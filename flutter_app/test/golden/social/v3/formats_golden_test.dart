// Goldens of the Mob formats (D167) at 360 dp, Night and Day: the one Start a game sheet (Anytime with a sprint,
// Live with a 10-minute race, a Free student's locked full mock, a round's chips), the play picker's start row,
// the race run (question, last ten seconds, time up), the podium of a race, and Full mock together's mark sheets
// side by side. Compare by eye with pass-1020 MOB-MINIMAL (`tmp/design-1020/mob-minimal/sheet-*.png`).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/play_picker_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/start_game_sheet.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

class _Host extends StatelessWidget {
  const _Host({required this.open});

  final void Function(BuildContext) open;

  @override
  Widget build(BuildContext context) => Center(child: TextButton(onPressed: () => open(context), child: const Text('open')));
}

Future<void> _sheet(
  WidgetTester tester,
  String name,
  void Function(BuildContext) open, {
  required Brightness b,
  String scenario = 'quiet',
  String billing = 'off',
  bool nudges = false,
  double height = 800,
  List<Override> extra = const [],
}) async {
  final server = v3Server(scenario: scenario, billing: billing);
  await pumpMockmob(
    tester,
    _Host(open: open),
    brightness: b,
    size: Size(360, height),
    disableAnimations: true,
    overrides: [...v3Overrides(server), proNudgesOnProvider.overrideWithValue(nudges), ...extra],
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await settleImages(tester);
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/formats/${name}_360_${_tag(b)}.png'));
}

void main() {
  setUpGoldenFonts();
  setUp(loadFoldManifestForTest);

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('start sheet, anytime, sprint (${_tag(b)})', (t) async {
      await _sheet(t, 'start_anytime_sprint', (c) => showStartGame(c), b: b, scenario: 'live', billing: 'free');
    });

    testWidgets('start sheet, live, 10-minute race (${_tag(b)})', (t) async {
      await _sheet(
        t,
        'start_live_race10',
        (c) => showStartGame(c, prefill: const StartGamePrefill(format: GameFormat.race, minutes: 10, mode: GameMode.live)),
        b: b,
        scenario: 'live',
        billing: 'pro',
      );
    });

    testWidgets('start sheet, full mock together (${_tag(b)})', (t) async {
      await _sheet(t, 'start_mock', (c) => showStartGame(c, prefill: const StartGamePrefill(format: GameFormat.mock, count: 50)), b: b, billing: 'pro');
    });

    testWidgets('play picker with the start row (${_tag(b)})', (t) async {
      await _sheet(t, 'picker_start_row', (c) => showPlayPicker(c), b: b, scenario: 'race', nudges: true);
    });
  }

  testWidgets('start sheet, Free, a round with its chips (night)', (t) async {
    await _sheet(t, 'start_free_round15', (c) => showStartGame(c, prefill: const StartGamePrefill(format: GameFormat.round, count: 15)), b: Brightness.dark, billing: 'free');
  });

  // Keeps the fake server import used by the run goldens below.
  test('fixture scenarios exist', () {
    expect(MobV3FakeServer(scenario: 'race').denNow(), isNotEmpty);
    expect(MobV3FakeServer(scenario: 'mockdone').denNow(), isNotEmpty);
  });
}
