// Goldens for R8 Everyone's moment (open and closed with a trap) and R9 Fix it together (the
// answer sheet, and the fresh question answered), 360 dp Night and Day.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/screens/fix_together_screen.dart';
import 'package:mockmob/features/social/v3/screens/moments_screen.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../widget/social/v3/results_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

void main() {
  setUpGoldenFonts();
  late MobV3FakeServer server;

  setUpAll(() async {
    loadFoldManifestForTest();
    FoilSheenProgram.enabled = false;
    server = await openServer();
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    for (final (name, widget) in [
      ('r8_open', const MomentsScreen(gameId: riyaGame)),
      ('r8_closed', const MomentsScreen(gameId: zoyaGame)),
      ('r9_sheet', const FixTogetherScreen(gameId: zoyaGame, q: 4)),
    ]) {
      testWidgets('$name 360 ${_tag(b)}', (tester) async {
        await pumpMockmob(tester, widget, brightness: b, size: const Size(360, 780), wrapInScaffold: false, overrides: v3Overrides(server));
        await tester.pump(const Duration(milliseconds: 800));
        await settleImages(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_360_${_tag(b)}.png'));
      });
    }

    testWidgets('r9_fresh_answered 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const FixTogetherScreen(gameId: zoyaGame, q: 4), brightness: b, size: const Size(360, 780), wrapInScaffold: false, overrides: v3Overrides(server));
      await tester.pump(const Duration(milliseconds: 800));
      await tester.tap(find.text('Try a fresh question'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      await tester.tap(find.byKey(const ValueKey('fix-option-1')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/r9_fresh_answered_360_${_tag(b)}.png'));
      await tester.pump(const Duration(seconds: 1));
    });
  }
}
