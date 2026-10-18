// Goldens for the 19 Oct A1 pieces (G17 + D105, G15 + D101): the Mob tab for a student in no Mob
// (the tab header, Join with a code and Start a Mob), the code sheet, and the calm sheet a Free
// student meets on a locked mode while PLAY_BILLING is off ("NTA mode is part of Pro. Pro opens in
// the app soon."). At 360 and 412 dp, Night and Day, plus 1.3x text at 360.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/practice/widgets/locked_mode_sheet.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_join_code.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/social/mob_test_kit.dart';
import '../you/you_golden_kit.dart';

typedef _Shot = ({double width, double scale});

const List<_Shot> _shots = [(width: 360, scale: 1), (width: 412, scale: 1), (width: 360, scale: 1.3)];

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';
String _file(String name, _Shot s, Brightness b) => 'goldens/${name}_${s.width.round()}${s.scale == 1 ? '' : '_x13'}_${_tag(b)}.png';

/// Opens the locked-mode sheet the way a tap on the tile does.
class _LockedHost extends StatelessWidget {
  const _LockedHost({required this.mode});

  final LockedMode mode;

  @override
  Widget build(BuildContext context) => Center(
    child: TextButton(onPressed: () => openLockedMode(context, mode: mode, onInstead: () {}), child: const Text('open')),
  );
}

void main() {
  setUpGoldenFonts();

  for (final shot in _shots) {
    for (final b in [Brightness.dark, Brightness.light]) {
      testWidgets('mob tab, no Mob ${shot.width.round()} ${shot.scale} ${_tag(b)}', (tester) async {
        await pumpMockmob(
          tester,
          const MobScreen(asTab: true),
          brightness: b,
          size: Size(shot.width, 1500),
          textScale: shot.scale,
          wrapInScaffold: false,
          disableAnimations: true,
          overrides: mobOverrides(noMobState()),
        );
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile(_file('a1_mob_tab_none', shot, b)));
      });

      testWidgets('locked NTA sheet, billing off ${shot.width.round()} ${shot.scale} ${_tag(b)}', (tester) async {
        await pumpMockmob(
          tester,
          const _LockedHost(mode: LockedMode.nta),
          brightness: b,
          size: Size(shot.width, 800),
          textScale: shot.scale,
          disableAnimations: true,
          overrides: [...mobOverrides(noMobState()), proNudgesOnProvider.overrideWithValue(false)],
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile(_file('a1_locked_nta', shot, b)));
      });
    }
  }

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('join with a code sheet 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => Center(child: TextButton(onPressed: () => showJoinWithCodeSheet(context), child: const Text('open'))),
        ),
        brightness: b,
        size: const Size(360, 800),
        disableAnimations: true,
        overrides: mobOverrides(noMobState()),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/a1_join_code_360_${_tag(b)}.png'));
    });
  }
}
