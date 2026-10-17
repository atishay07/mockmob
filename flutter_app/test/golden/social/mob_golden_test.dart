// Goldens for the Mob (SOCIAL-SPEC sections 8 and 15): the ring at 0, 1, 3 and 5 of 5, no Mob, alone,
// not sat, the free paper used elsewhere, the teaser with the side-by-side locked, the trap, a closed
// week, loading, the error, the join page, the Today card, a Pro student with two Mobs and extras, the
// side-by-side and the past weeks. At 360 and 412 dp wide, Night and Day, DPR 2, plus the trap state
// at 1.3x text. Data: the server's own fixtures (test/fixtures/mob).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/screens/mob_compare_screen.dart';
import 'package:mockmob/features/social/screens/mob_history_screen.dart';
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
  double height = 1700,
  double textScale = 1,
  FakeMobActions Function(dynamic ref)? actions,
  bool scaffold = false,
  bool settle = true,
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
        if (settle) {
          await tester.pumpAndSettle();
        } else {
          await tester.pump(const Duration(milliseconds: 100));
        }
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${width.round()}_$tag.png'));
      });
    }
  }
}

MobCompare _compare([void Function(Map<String, dynamic>)? edit]) {
  final j = mobJson('compare_v2.json');
  edit?.call(j['compare'] as Map<String, dynamic>);
  return MobCompare.fromJson(j);
}

const _todayPad = Padding(padding: EdgeInsets.only(top: 24), child: Align(alignment: Alignment.topCenter, child: MobTodayCard()));

void main() {
  setUpGoldenFonts();

  _golden('mob_ring0', () => const MobScreen(), () => ringState(0, 5, youSat: false));
  _golden('mob_ring1', () => const MobScreen(), () => ringState(1, 5));
  _golden('mob_ring3', () => const MobScreen(), () => ringState(3, 5));
  _golden('mob_ring5', () => const MobScreen(), () => ringState(5, 5));
  _golden('mob_none', () => const MobScreen(), noMobState);
  _golden('mob_alone', () => const MobScreen(), () => mobState(null, 'get_alone_v1.json'));
  _golden('mob_not_sat', () => const MobScreen(), () => mobState(null, 'get_not_sat_v1.json'));
  _golden(
    'mob_free_used',
    () => const MobScreen(),
    () => mobState((m) {
      ((m['week'] as Map)['paper'] as Map)['blocked'] = 'free_used';
      (m['week'] as Map)['youSat'] = false;
      (m['week'] as Map)['yourResultId'] = null;
      m['compare'] = null;
      m['trap'] = null;
    }),
  );
  _golden('mob_trap', () => const MobScreen(), mobState);
  _golden('mob_trap_text13', () => const MobScreen(), mobState, widths: const [360], height: 2300, textScale: 1.3);
  _golden(
    'mob_locked',
    () => const MobScreen(),
    () => mobState((m) {
      m['compare'] = {
        'available': true,
        'access': 'locked',
        'youShare': true,
        'needsShare': false,
        'teaser': {'split': 3, 'of': 10, 'with': null, 'text': 'Your Mob split on 3 of 10 questions.'},
      };
      m['trap'] = null;
    }),
  );
  _golden(
    'mob_closed',
    () => const MobScreen(),
    () => mobState((m) {
      (m['week'] as Map)['youSat'] = false;
      (m['week'] as Map)['closed'] = true;
      m['compare'] = null;
      m['trap'] = null;
    }),
  );
  _golden('mob_pro', () => const MobScreen(), proState, height: 2700);
  _golden('mob_loading', () => const MobScreen(), () => const RemoteState<MobRead>(loading: true), height: 800, settle: false);
  _golden('mob_error', () => const MobScreen(), () => const RemoteState<MobRead>(error: ApiError(kind: ApiErrorKind.network, code: 'network')), height: 800);
  _golden(
    'mob_join',
    () => const MobJoinScreen(code: '7K3M9QXA'),
    noMobState,
    height: 900,
    actions: (ref) => FakeMobActions(
      ref,
      previewResult: (const MobInvitePreview(code: '7K3M9QXA', subject: 'business_studies', subjectLabel: 'Business Studies', size: 3, seatsLeft: 2, inviter: 'Riya'), null),
    ),
  );
  _golden(
    'mob_join_invalid',
    () => const MobJoinScreen(code: 'nope'),
    noMobState,
    height: 700,
  );
  _golden(
    'mob_compare',
    () => MobCompareScreen(data: _compare()),
    mobState,
    height: 3400,
  );
  _golden(
    'mob_compare_sample',
    () => MobCompareScreen(data: _compare((c) {
      c['access'] = 'sample';
      c['youShare'] = false;
      c['hidden'] = 1;
    })),
    mobState,
    height: 1100,
    widths: const [360],
  );
  _golden(
    'mob_history',
    () => const MobHistoryScreen(),
    proState,
    height: 800,
    actions: (ref) => FakeMobActions(ref, historyResult: MobHistory.fromJson(mobFixture('history_v2.json'))),
  );
  _golden(
    'mob_today_card',
    () => _todayPad,
    () => mobState(null, 'get_not_sat_v1.json'),
    height: 460,
    scaffold: true,
  );
  _golden(
    'mob_today_sat',
    () => _todayPad,
    mobState,
    height: 400,
    scaffold: true,
  );
  _golden(
    'mob_today_complete',
    () => _todayPad,
    () => ringState(4, 4),
    height: 400,
    scaffold: true,
  );
}
