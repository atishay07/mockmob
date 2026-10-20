// Goldens for A10 the results run (MOB-MINIMAL 3.4): every true screen of a closed game whose quest is done
// (podium, everyone's moment, Fix it together, then the earned achievements), Night and Day, text scale 1.0 and 1.3,
// and the Full mock together start sheet's rule box (A8) at 1.3. The step dots must show the true length.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/results_run.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';
import 'package:mockmob/features/social/v3/widgets/results_parts.dart';
import 'package:mockmob/features/social/v3/widgets/start_game_sheet.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';
String _ts(double s) => s == 1 ? '' : '_ts13';

String _kind(WidgetTester t) {
  if (find.byKey(const ValueKey('run-podium')).evaluate().isNotEmpty) return 'podium';
  if (find.byKey(const ValueKey('run-moments')).evaluate().isNotEmpty) return 'moments';
  if (find.byKey(const ValueKey('run-fix')).evaluate().isNotEmpty) return 'fix';
  final k = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('run-moment-'));
  if (k.evaluate().isNotEmpty) {
    final v = (k.evaluate().first.widget.key! as ValueKey<String>).value.substring('run-moment-'.length);
    return v.split(':').first;
  }
  return 'unknown';
}

Future<bool> _continue(WidgetTester t) async {
  for (final key in const ['podium-primary', 'moments-continue', 'fix-later', 'k2-key', 'k3-key', 'k4-continue', 'k1-key']) {
    final f = find.byKey(ValueKey(key));
    if (f.evaluate().isNotEmpty) {
      await t.ensureVisible(f.first);
      await t.tap(f.first, warnIfMissed: false);
      return true;
    }
  }
  final f = find.text('Continue');
  if (f.evaluate().isEmpty) return false;
  await t.tap(f.last, warnIfMissed: false);
  return true;
}

void main() {
  setUpGoldenFonts();
  setUpAll(() {
    loadFoldManifestForTest();
    FoilSheenProgram.enabled = false;
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    for (final scale in [1.0, 1.3]) {
      testWidgets('results run, every true screen (${_tag(b)}${_ts(scale)})', (t) async {
        final server = v3Server(scenario: 'questdone');
        await pumpMockmob(t, const ResultsRun(gameId: 'game-zoya-closed'), brightness: b, size: const Size(360, 780), textScale: scale, wrapInScaffold: false, overrides: v3Overrides(server));
        await t.pump(const Duration(milliseconds: 300));
        final seen = <String>[];
        for (var i = 0; i < 9; i++) {
          // Let each screen's timeline land (the podium's is about 3.5 s; the parcel's 2.4 s).
          for (var k = 0; k < 10; k++) {
            await t.pump(const Duration(milliseconds: 500));
          }
          await settleImages(t);
          final dots = find.byType(RunStepDots);
          if (dots.evaluate().isEmpty) break;
          final total = t.widget<RunStepDots>(dots.first).total;
          final kind = _kind(t);
          seen.add(kind);
          await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/results_run/step${i + 1}of${total}_${kind}_360_${_tag(b)}${_ts(scale)}.png'));
          if (i + 1 >= total || !await _continue(t)) break;
          await t.pump(const Duration(milliseconds: 400));
        }
        expect(seen.take(3), ['podium', 'moments', 'fix']);
        await t.pump(const Duration(seconds: 2));
      });
    }

    for (final scale in [1.0, 1.3]) {
      testWidgets('start sheet, Free member, the mock row and See Pro plans (${_tag(b)}${_ts(scale)})', (t) async {
        final server = v3Server(scenario: 'quiet', billing: 'free');
        await pumpMockmob(
          t,
          Builder(builder: (c) => Center(child: TextButton(onPressed: () => showStartGame(c), child: const Text('open')))),
          brightness: b,
          size: const Size(360, 780),
          textScale: scale,
          disableAnimations: true,
          overrides: [...v3Overrides(server), proNudgesOnProvider.overrideWithValue(true)],
        );
        await t.tap(find.text('open'));
        await t.pumpAndSettle();
        await settleImages(t);
        final pro = find.byKey(const ValueKey('start-mock-pro'));
        expect(pro, findsOneWidget);
        await t.ensureVisible(pro);
        await t.pumpAndSettle();
        expect(t.getSize(pro).height, greaterThanOrEqualTo(44));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/results_run/start_free_mock_row_360_${_tag(b)}${_ts(scale)}.png'));
      });
    }

    testWidgets('start sheet, full mock rule box at 1.3 (${_tag(b)})', (t) async {
      final server = v3Server(scenario: 'quiet', billing: 'pro');
      await pumpMockmob(
        t,
        Builder(builder: (c) => Center(child: TextButton(onPressed: () => showStartGame(c, prefill: const StartGamePrefill(format: GameFormat.mock, count: 50)), child: const Text('open')))),
        brightness: b,
        size: const Size(360, 780),
        textScale: 1.3,
        disableAnimations: true,
        overrides: v3Overrides(server),
      );
      await t.tap(find.text('open'));
      await t.pumpAndSettle();
      await settleImages(t);
      expect(find.byType(MockRuleBox), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/results_run/start_mock_rule_360_${_tag(b)}_ts13.png'));
    });
  }
}
