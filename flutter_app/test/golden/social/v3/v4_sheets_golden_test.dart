// Goldens of the Mob V4 sheets (MOB-MINIMAL 3.5, 3.6): This week (with Mob hours, with the student's own
// sharing off, nobody sharing, hours not shipped), Your chain, and the Shelf and Mob settings sheets, 360 dp
// Night and Day at 1.0 and 1.3 text. Tall frames so the whole sheet is visible for the by-eye pass.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/widgets/mob_settings_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/shelf_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/this_week_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/your_chain_sheet.dart';

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
  double height = 2300,
  double scale = 1,
  void Function(MobV3FakeServer)? prep,
}) async {
  final server = v3Server(scenario: scenario, billing: billing);
  if (prep != null) prep(server);
  await pumpMockmob(tester, _Host(open: open), brightness: b, size: Size(360, height), textScale: scale, disableAnimations: true, overrides: v3Overrides(server));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await settleImages(tester);
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4_$name${scale == 1 ? '' : '_x13'}_${_tag(b)}.png'));
}

void main() {
  setUpGoldenFonts();
  setUp(loadFoldManifestForTest);

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('This week with hours ${_tag(b)}', (t) => _sheet(t, 'week_hours', showThisWeekSheet, b: b, prep: (s) {
          s.denNow();
          s.setShareStudyTime(false);
        }));
    testWidgets('This week, I am sharing ${_tag(b)}', (t) => _sheet(t, 'week_sharing', showThisWeekSheet, b: b));
    testWidgets('This week, nobody sharing ${_tag(b)}', (t) => _sheet(t, 'week_nobody', showThisWeekSheet, b: b, scenario: 'quiet', height: 1900));
    testWidgets('This week, hours not shipped ${_tag(b)}', (t) => _sheet(t, 'week_nohours', showThisWeekSheet, b: b, height: 1700, prep: (s) => s.hoursShipped = false));
    testWidgets('This week 1.3x ${_tag(b)}', (t) => _sheet(t, 'week_hours', showThisWeekSheet, b: b, scale: 1.3, height: 3200));
    testWidgets('Your chain ${_tag(b)}', (t) => _sheet(t, 'chain', showYourChainSheet, b: b, height: 2300));
    testWidgets('Your chain 1.3x ${_tag(b)}', (t) => _sheet(t, 'chain', showYourChainSheet, b: b, scale: 1.3, height: 3200));
    testWidgets('Shelf ${_tag(b)}', (t) => _sheet(t, 'shelf', openShelfSheet, b: b, height: 2800));
    testWidgets('Mob settings ${_tag(b)}', (t) => _sheet(t, 'settings', openMobSettingsSheet, b: b, height: 2300));
    testWidgets('Mob settings, Free ${_tag(b)}', (t) => _sheet(t, 'settings_free', openMobSettingsSheet, b: b, billing: 'free', height: 2900));
    testWidgets('Mob settings 1.3x ${_tag(b)}', (t) => _sheet(t, 'settings', openMobSettingsSheet, b: b, scale: 1.3, height: 3200));
  }
}
