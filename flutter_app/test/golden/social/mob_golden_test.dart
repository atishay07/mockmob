// Goldens for the Mob (SOCIAL-SPEC section 8): the ring at 0, 1, 3 and 5 of 5, no Mob, alone,
// the trap, a closed week, the error, the join page and the Today card. At 360 and 412 dp wide,
// Night and Day, DPR 2, plus the trap state at 1.3x text. Data: the stand-in fixture
// test/fixtures/social/mob_get_v1.json.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/screens/mob_join_screen.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_today_card.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/social/mob_test_kit.dart';
import '../you/you_golden_kit.dart';

void _golden(
  String name,
  Widget Function() screen,
  RemoteState<MobRead> Function() state, {
  List<double> widths = const [360, 412],
  double height = 1500,
  double textScale = 1,
  FakeMobActions Function(dynamic ref)? actions,
  bool scaffold = false,
}) {
  for (final width in widths) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('$name ${width.round()} $tag', (tester) async {
        await pumpMockmob(
          tester,
          screen(),
          brightness: brightness,
          size: Size(width, height),
          textScale: textScale,
          wrapInScaffold: scaffold,
          disableAnimations: true,
          overrides: mobOverrides(state(), actions: actions == null ? null : (ref) => actions(ref)),
        );
        await tester.pump();
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${width.round()}_$tag.png'));
      });
    }
  }
}

void main() {
  setUpGoldenFonts();

  _golden('mob_ring0', () => const MobScreen(), () => ringState(0, 5, youSat: false));
  _golden('mob_ring1', () => const MobScreen(), () => ringState(1, 5));
  _golden('mob_ring3', () => const MobScreen(), () => ringState(3, 5));
  _golden('mob_ring5', () => const MobScreen(), () => ringState(5, 5));
  _golden('mob_none', () => const MobScreen(), noMobState);
  _golden('mob_alone', () => const MobScreen(), () => ringState(0, 1, youSat: false));
  _golden('mob_trap', () => const MobScreen(), mobState);
  _golden('mob_trap_text13', () => const MobScreen(), mobState, widths: const [360], height: 1900, textScale: 1.3);
  _golden(
    'mob_closed',
    () => const MobScreen(),
    () => mobState((m) {
      (m['week'] as Map)['youSat'] = false;
      (m['week'] as Map)['closed'] = true;
    }),
  );
  _golden('mob_error', () => const MobScreen(), () => const RemoteState<MobRead>(error: ApiError(kind: ApiErrorKind.network, code: 'network')), height: 800);
  _golden(
    'mob_join',
    () => const MobJoinScreen(code: '7K3M9QXA'),
    noMobState,
    height: 900,
    actions: (ref) => FakeMobActions(ref, previewResult: (const MobInvitePreview(subject: 'business_studies', size: 3, seatsLeft: 2), null)),
  );
  _golden(
    'mob_today_card',
    () => const Padding(padding: EdgeInsets.only(top: 24), child: Align(alignment: Alignment.topCenter, child: MobTodayCard())),
    () => mobState((m) {
      (m['week'] as Map)['youSat'] = false;
      m['nudge'] = {'canSend': false, 'received': {'fromName': 'Riya'}};
    }),
    height: 400,
    scaffold: true,
  );
  _golden(
    'mob_today_complete',
    () => const Padding(padding: EdgeInsets.only(top: 24), child: Align(alignment: Alignment.topCenter, child: MobTodayCard())),
    () => ringState(4, 4),
    height: 400,
    scaffold: true,
  );
}
