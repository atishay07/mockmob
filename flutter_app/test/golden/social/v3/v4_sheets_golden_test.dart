// Goldens of the Mob V4 sheets (MOB-MINIMAL 3.5, 3.6): This week (with Mob hours, with the student's own
// sharing off, I am sharing, only I share, the week's first morning, nobody sharing, hours not shipped, the
// Mob settings link, failed), Your chain (normal, loading, failed, Exam pause days open), and the Shelf and Mob
// settings sheets, 360 dp Night and Day at 1.0 and 1.3 text. Tall frames so the whole sheet is visible for the
// by-eye pass, and one real 360 x 800 phone frame of the week sheet.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_den.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
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

/// A chain read that never comes back (the skeleton shows).
class _LoadingChain extends ChainRepository {
  @override
  Future<ChainState> build() => Completer<ChainState>().future;
}

/// A chain read that fails (the sentence and Try again show).
class _FailedChain extends ChainRepository {
  @override
  Future<ChainState> build() => Future<ChainState>.error(StateError('offline'));
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
  List<Override> extra = const [],
  bool settle = true,
  Future<void> Function(WidgetTester)? act,
}) async {
  final server = v3Server(scenario: scenario, billing: billing);
  if (prep != null) prep(server);
  await pumpMockmob(tester, _Host(open: open), brightness: b, size: Size(360, height), textScale: scale, disableAnimations: true, overrides: [...v3Overrides(server), ...extra]);
  await tester.tap(find.text('open'));
  if (settle) {
    await tester.pumpAndSettle();
    await settleImages(tester);
  } else {
    await tester.pump(const Duration(milliseconds: 600));
  }
  if (act != null) {
    await act(tester);
    await tester.pumpAndSettle();
    await settleImages(tester);
  }
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4_$name${scale == 1 ? '' : '_x13'}_${_tag(b)}.png'));
}

Future<void> _openPause(WidgetTester t) async {
  final f = find.text(MobV3Copy.examPause);
  await t.ensureVisible(f.first);
  await t.pumpAndSettle();
  await t.tap(f.first);
}

void _monday(MobV3FakeServer s) {
  s.setShareStudyTime(true);
  s.startOfWeek();
}

void main() {
  setUpGoldenFonts();
  setUp(loadFoldManifestForTest);

  for (final b in [Brightness.dark, Brightness.light]) {
    final t = _tag(b);
    testWidgets('This week with hours $t', (tt) => _sheet(tt, 'week_hours', showThisWeekSheet, b: b, prep: (s) {
          s.denNow();
          s.setShareStudyTime(false);
        }));
    testWidgets('This week, I am sharing $t', (tt) => _sheet(tt, 'week_sharing', showThisWeekSheet, b: b, prep: (s) => s.setShareStudyTime(true)));
    testWidgets('This week, only I share $t', (tt) => _sheet(tt, 'week_only_you', showThisWeekSheet, b: b, height: 2100, prep: (s) {
          s.denNow();
          s.onlyYouShare();
        }));
    testWidgets('This week, the first morning of the week $t', (tt) => _sheet(tt, 'week_monday', showThisWeekSheet, b: b, height: 2100, prep: _monday));
    testWidgets('This week, the first morning, I do not share $t', (tt) => _sheet(tt, 'week_monday_off', showThisWeekSheet, b: b, height: 2100, prep: (s) {
          s.denNow();
          s.setShareStudyTime(false);
          s.startOfWeek();
        }));
    testWidgets('This week, nobody sharing $t', (tt) => _sheet(tt, 'week_nobody', showThisWeekSheet, b: b, scenario: 'quiet', height: 1900));
    testWidgets('This week, hours not shipped $t', (tt) => _sheet(tt, 'week_nohours', showThisWeekSheet, b: b, height: 1700, prep: (s) => s.hoursShipped = false));
    testWidgets('This week, the Mob settings link $t', (tt) => _sheet(tt, 'week_settings_link', (c) => showThisWeekSheet(c, onSettings: (_) {}), b: b, prep: (s) {
          s.denNow();
          s.setShareStudyTime(false);
        }));
    testWidgets('This week, failed $t', (tt) => _sheet(tt, 'week_failed', showThisWeekSheet, b: b, height: 800, extra: [denViewProvider.overrideWithValue(null)]));
    testWidgets('This week on a 360 x 800 phone $t', (tt) => _sheet(tt, 'week_phone', showThisWeekSheet, b: b, height: 800, prep: (s) => s.setShareStudyTime(true)));
    testWidgets('This week 1.3x $t', (tt) => _sheet(tt, 'week_hours', showThisWeekSheet, b: b, scale: 1.3, height: 3300, prep: (s) => s.setShareStudyTime(true)));
    testWidgets('This week, the first morning 1.3x $t', (tt) => _sheet(tt, 'week_monday', showThisWeekSheet, b: b, scale: 1.3, height: 3000, prep: _monday));
    testWidgets('This week, failed 1.3x $t', (tt) => _sheet(tt, 'week_failed', showThisWeekSheet, b: b, scale: 1.3, height: 800, extra: [denViewProvider.overrideWithValue(null)]));
    testWidgets('Your chain $t', (tt) => _sheet(tt, 'chain', showYourChainSheet, b: b, height: 2300));
    testWidgets('Your chain 1.3x $t', (tt) => _sheet(tt, 'chain', showYourChainSheet, b: b, scale: 1.3, height: 3200));
    testWidgets('Your chain, loading $t', (tt) => _sheet(tt, 'chain_loading', showYourChainSheet, b: b, height: 800, settle: false, extra: [chainProvider.overrideWith(_LoadingChain.new)]));
    testWidgets('Your chain, loading 1.3x $t', (tt) => _sheet(tt, 'chain_loading', showYourChainSheet, b: b, scale: 1.3, height: 800, settle: false, extra: [chainProvider.overrideWith(_LoadingChain.new)]));
    testWidgets('Your chain, failed $t', (tt) => _sheet(tt, 'chain_failed', showYourChainSheet, b: b, height: 800, extra: [chainProvider.overrideWith(_FailedChain.new)]));
    testWidgets('Your chain, failed 1.3x $t', (tt) => _sheet(tt, 'chain_failed', showYourChainSheet, b: b, scale: 1.3, height: 800, extra: [chainProvider.overrideWith(_FailedChain.new)]));
    testWidgets('Your chain, Exam pause days open $t', (tt) => _sheet(tt, 'chain_pause_open', showYourChainSheet, b: b, height: 800, act: _openPause));
    testWidgets('Your chain, Exam pause days open 1.3x $t', (tt) => _sheet(tt, 'chain_pause_open', showYourChainSheet, b: b, scale: 1.3, height: 800, act: _openPause));
    testWidgets('Shelf $t', (tt) => _sheet(tt, 'shelf', openShelfSheet, b: b, height: 2800));
    testWidgets('Mob settings $t', (tt) => _sheet(tt, 'settings', openMobSettingsSheet, b: b, height: 2300));
    testWidgets('Mob settings, Free $t', (tt) => _sheet(tt, 'settings_free', openMobSettingsSheet, b: b, billing: 'free', height: 2900));
    testWidgets('Mob settings 1.3x $t', (tt) => _sheet(tt, 'settings', openMobSettingsSheet, b: b, scale: 1.3, height: 3200));
  }
}
