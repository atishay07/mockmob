// Goldens for the den (spec 7.3): D1, D2, D3, D5, D6 failed and heavy at 360 Night and Day; D2 at 412
// and at 1.3x text; Enter the den (M1) frames at 0, 200, 420 and 700 ms.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/screens/den_screen.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart';
import 'den_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 400));
  await settleImages(tester);
}

void main() {
  setUpGoldenFonts();

  const states = {'d1_quiet': 'quiet', 'd2_open': 'open', 'd3_played': 'played', 'd5_one': 'one', 'd5_oneplayed': 'oneplayed', 'heavy': 'heavy'};
  for (final b in [Brightness.dark, Brightness.light]) {
    for (final e in states.entries) {
      testWidgets('den ${e.key} 360 ${_tag(b)}', (tester) async {
        await pumpDen(tester, v3Server(scenario: e.value), brightness: b);
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/den_${e.key}_360_${_tag(b)}.png'));
      });
    }
  }

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('den d6 failed 360 ${_tag(b)}', (tester) async {
      await pumpDen(
        tester,
        v3Server(scenario: 'heavy'),
        brightness: b,
        state: const RemoteState<MobRead>(
          error: ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500),
        ),
      );
      await _settle(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/den_d6_failed_360_${_tag(b)}.png'));
    });
  }

  // D2, the main state, at 412 and at 1.3x text (names wrap, never cut).
  for (final shot in [(width: 412.0, scale: 1.0, name: '412'), (width: 360.0, scale: 1.3, name: '360_x13')]) {
    for (final b in [Brightness.dark, Brightness.light]) {
      testWidgets('den d2 open ${shot.name} ${_tag(b)}', (tester) async {
        await pumpDen(
          tester,
          v3Server(scenario: 'open'),
          brightness: b,
          width: shot.width,
          textScale: shot.scale,
        );
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/den_d2_open_${shot.name}_${_tag(b)}.png'));
      });
    }
  }

  // Enter the den (M1) frames: 0, 200, 420 and 700 ms. The shell's header never fades.
  testWidgets('enter the den frames, night', (tester) async {
    await pumpDen(tester, v3Server(scenario: 'open'), reduced: false);
    await _settle(tester);
    DenScreen.debugReplay.value++;
    await tester.pump();
    for (final ms in [0, 200, 420, 700]) {
      if (ms > 0) await tester.pump(Duration(milliseconds: ms == 200 ? 200 : (ms == 420 ? 220 : 280)));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/den_enter_${ms}ms_360_night.png'));
    }
    await tester.pump(const Duration(seconds: 1));
  });
}
