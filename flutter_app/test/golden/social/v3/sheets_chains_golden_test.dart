// Goldens of the Mob v3 sheets and chains (spec 7.3): P1 (billing off, Free with a start, Free used, with a
// mic), P2, P3, P4, P5, C1 (normal, make-up open, hidden) and C2 (normal, 70 of 60). 360 dp Night and Day;
// C1 also at 412 and at 1.3x text. Compare each by eye with Arena S5 to S7 and S3, S4 and Live 03 to 05.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/screens/chains_screen.dart';
import 'package:mockmob/features/social/v3/widgets/free_pro_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/mic_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/pause_sheet.dart';
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
  String scenario = 'heavy',
  String billing = 'off',
  bool nudges = false,
  double width = 360,
  double height = 800,
  double scale = 1,
}) async {
  final server = v3Server(scenario: scenario, billing: billing);
  await pumpMockmob(
    tester,
    _Host(open: open),
    brightness: b,
    size: Size(width, height),
    textScale: scale,
    disableAnimations: true,
    overrides: [...v3Overrides(server), proNudgesOnProvider.overrideWithValue(nudges)],
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await settleImages(tester);
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${width.round()}${scale == 1 ? '' : '_x13'}_${_tag(b)}.png'));
}

Future<void> _screen(
  WidgetTester tester,
  String name, {
  required Brightness b,
  required Widget screen,
  String scenario = 'heavy',
  String billing = 'off',
  double width = 360,
  double height = 1500,
  double scale = 1,
  List<Override> extra = const [],
  Future<void> Function(MobV3FakeServer)? prep,
}) async {
  final server = v3Server(scenario: scenario, billing: billing);
  if (prep != null) await prep(server);
  await pumpMockmob(tester, screen, brightness: b, size: Size(width, height), textScale: scale, disableAnimations: true, wrapInScaffold: false, overrides: [...v3Overrides(server), ...extra]);
  await tester.pumpAndSettle();
  await settleImages(tester);
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${width.round()}${scale == 1 ? '' : '_x13'}_${_tag(b)}.png'));
}

void main() {
  setUpGoldenFonts();
  setUp(loadFoldManifestForTest);

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('P1 billing off ${_tag(b)}', (t) => _sheet(t, 'p1_off', showPlayPicker, b: b, scenario: 'open'));
    testWidgets('P1 free with a start ${_tag(b)}', (t) => _sheet(t, 'p1_free', showPlayPicker, b: b, scenario: 'open', billing: 'free', nudges: true));
    testWidgets('P1 free used ${_tag(b)}', (t) => _sheet(t, 'p1_used', showPlayPicker, b: b, scenario: 'open', billing: 'used', nudges: true));
    testWidgets('P1 mic ${_tag(b)}', (t) => _sheet(t, 'p1_mic', showPlayPicker, b: b, scenario: 'open', billing: 'mic', nudges: true));
    testWidgets('P2 start ${_tag(b)}', (t) => _sheet(t, 'p2_start', (c) => showStartGame(c), b: b, billing: 'pro', nudges: true));
    testWidgets('P3 mic ${_tag(b)}', (t) => _sheet(t, 'p3_mic', showMicSheet, b: b, billing: 'pro', nudges: true));
    testWidgets('P4 plans ${_tag(b)}', (t) => _sheet(t, 'p4_plans', showFreeProSheet, b: b, billing: 'free', nudges: true));
    testWidgets('P5 pause ${_tag(b)}', (t) => _sheet(t, 'p5_pause', showPauseSheet, b: b));

    testWidgets('C1 normal ${_tag(b)}', (t) => _screen(t, 'c1_normal', b: b, screen: const ChainsScreen()));
    testWidgets('C1 make-up ${_tag(b)}', (t) => _screen(t, 'c1_makeup', b: b, scenario: 'makeup', screen: const ChainsScreen()));
    testWidgets('C1 hidden ${_tag(b)}', (t) => _screen(t, 'c1_hidden', b: b, height: 800, screen: const ChainsScreen(), prep: (s) => s.chainHidden(true)));
    testWidgets('C1 normal 412 ${_tag(b)}', (t) => _screen(t, 'c1_normal', b: b, width: 412, screen: const ChainsScreen()));
    testWidgets('C1 normal 1.3x ${_tag(b)}', (t) => _screen(t, 'c1_normal', b: b, scale: 1.3, height: 2000, screen: const ChainsScreen()));
    testWidgets('C2 normal ${_tag(b)}', (t) => _screen(t, 'c2_normal', b: b, screen: const ChainsScreen(mobTab: true)));
    testWidgets('C2 70 of 60 ${_tag(b)}', (t) => _screen(t, 'c2_questdone', b: b, scenario: 'questdone', screen: const ChainsScreen(mobTab: true)));
  }
}
