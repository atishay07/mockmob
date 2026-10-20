// Goldens of the Mob V4 sheets A6 and A7 (V4-sheets): the Shelf sheet (closed, a Fold's detail open under its
// row, a locked Fold open, and the whole sheet) and the Mob settings sheet (the owner with Mob hours on, a
// member's menu open, change my name open, Free and Pro open for a Free member and for Pro, and the whole
// sheet). 360 dp, Night and Day, text scale 1.0 and 1.3. Compare each by eye with MOB-MINIMAL 3.5.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/screens/shelf_screen.dart' show FoldTile;
import 'package:mockmob/features/social/v3/widgets/mob_settings_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/shelf_sheet.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

class _Host extends StatelessWidget {
  const _Host({required this.open});

  final void Function(BuildContext) open;

  @override
  Widget build(BuildContext context) => Center(child: TextButton(onPressed: () => open(context), child: const Text('open')));
}

Future<void> _shot(
  WidgetTester tester,
  String name,
  void Function(BuildContext) open, {
  required Brightness b,
  MobV3FakeServer? server,
  String scenario = 'heavy',
  String billing = 'off',
  bool nudges = false,
  double scale = 1,
  double height = 800,
  Future<void> Function(WidgetTester)? act,
  List<Override> extra = const [],
}) async {
  final s = server ?? SocialServer(scenario: scenario, billing: billing);
  await pumpMockmob(
    tester,
    _Host(open: open),
    brightness: b,
    size: Size(360, height),
    textScale: scale,
    disableAnimations: true,
    overrides: socialOverrides(s, actions: (ref) => SocialMobActions(ref), extra: [proNudgesOnProvider.overrideWithValue(nudges), ...extra]),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await settleImages(tester);
  if (act != null) {
    await act(tester);
    await tester.pumpAndSettle();
    await settleImages(tester);
  }
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4_sheets/${name}_${scale == 1 ? '100' : '130'}_${_tag(b)}.png'));
}

Future<void> _tapText(WidgetTester t, String text) async {
  final f = find.text(text);
  await t.ensureVisible(f.first);
  await t.pumpAndSettle();
  await t.tap(f.first);
  await t.pumpAndSettle();
}

void main() {
  setUpGoldenFonts();
  setUp(loadFoldManifestForTest);

  for (final b in [Brightness.dark, Brightness.light]) {
    for (final scale in [1.0, 1.3]) {
      testWidgets('A6 Shelf sheet ${_tag(b)} $scale', (t) => _shot(t, 'a6_shelf', openShelfSheet, b: b, scale: scale));
      testWidgets('A6 Shelf sheet, a Fold open ${_tag(b)} $scale', (t) async {
        await _shot(t, 'a6_shelf_detail', openShelfSheet, b: b, scale: scale, act: (t) async {
          await t.tap(find.byType(FoldTile).at(1));
        });
      });
      testWidgets('A6 Shelf sheet, a locked Fold open ${_tag(b)} $scale', (t) async {
        await _shot(t, 'a6_shelf_locked', openShelfSheet, b: b, scale: scale, act: (t) async {
          final f = find.byType(FoldTile).at(5);
          await t.ensureVisible(f);
          await t.pumpAndSettle();
          await t.tap(f);
        });
      });
      testWidgets('A6 Shelf sheet, the whole sheet ${_tag(b)} $scale', (t) => _shot(t, 'a6_shelf_full', openShelfSheet, b: b, scale: scale, height: scale == 1 ? 3000 : 4200));
      testWidgets('A7 Mob settings, the owner, Mob hours on ${_tag(b)} $scale', (t) => _shot(t, 'a7_settings_owner', openMobSettingsSheet, b: b, scale: scale));
      testWidgets('A7 Mob settings, the whole sheet for a Free member with Free and Pro open ${_tag(b)} $scale', (t) async {
        await _shot(t, 'a7_settings_full', openMobSettingsSheet, b: b, scale: scale, height: scale == 1 ? 2500 : 3400, scenario: 'formats', billing: 'free', nudges: true, act: (t) async {
          await _tapText(t, MobV3Copy.freeProTitle);
        });
      });
      testWidgets('A7 Mob settings, a member menu open ${_tag(b)} $scale', (t) async {
        await _shot(t, 'a7_settings_menu', openMobSettingsSheet, b: b, scale: scale, act: (t) async {
          final f = find.byTooltip(MobV3Copy.memberMenu('Riya'));
          await t.ensureVisible(f);
          await t.pumpAndSettle();
          await t.tap(f);
        });
      });
      testWidgets('A7 Mob settings, change my name open ${_tag(b)} $scale', (t) async {
        await _shot(t, 'a7_settings_edit', openMobSettingsSheet, b: b, scale: scale, height: 900, act: (t) async {
          await _tapText(t, MobCopy.changeName);
        });
      });
      testWidgets('A7 Mob settings, Free and Pro open for a Free member ${_tag(b)} $scale', (t) async {
        await _shot(t, 'a7_settings_plans_free', openMobSettingsSheet, b: b, scale: scale, scenario: 'formats', billing: 'free', nudges: true, act: (t) async {
          await _tapText(t, MobV3Copy.freeProTitle);
        });
      });
      testWidgets('A7 Mob settings, Free and Pro open for Pro ${_tag(b)} $scale', (t) async {
        await _shot(t, 'a7_settings_plans_pro', openMobSettingsSheet, b: b, scale: scale, scenario: 'formats', billing: 'pro', act: (t) async {
          await _tapText(t, MobV3Copy.freeProTitle);
        });
      });
    }
  }
}
