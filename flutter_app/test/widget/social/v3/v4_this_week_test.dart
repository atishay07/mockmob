// Mob V4 This week sheet (A4): Mob hours says only what is true. Somebody sharing with no minutes yet is not
// "nobody is sharing"; the crown never lands on a member who is not in the shared list; the sheet opens through
// the V4Sheets hook with its Mob settings link; the week has its own failed sentence; the pennant wears the crown.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_den.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/v4_sheet_hooks.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/sheets_test_kit.dart' show Host;

Future<void> _open(WidgetTester tester, void Function(BuildContext) open, MobV3FakeServer server, {List<Override> extra = const [], double scale = 1}) async {
  await pumpMockmob(tester, Host(open: open), size: const Size(360, 800), textScale: scale, disableAnimations: true, overrides: [...v3Overrides(server), ...extra]);
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await settleImages(tester);
}

void main() {
  setUpAll(loadFoldManifestForTest);

  group('MobHours', () {
    MobHours read(Map<String, Object?> j) => MobHours.fromJsonOrNull({
          'week_start': '2026-10-19',
          'target_minutes': 600,
          'total_minutes': 0,
          'me_sharing': true,
          'members': <Object>[],
          'top_member_id': null,
          'studying_now': <Object>[],
          ...j,
        })!;

    test('sharers with no minutes yet are not "nobody"', () {
      final h = read({});
      expect(h.offForEveryone, isFalse);
      expect(h.noMinutesYet, isTrue);
      expect(h.topMember, isNull);
    });

    test('a target of 0 means nobody shares', () {
      final h = read({'target_minutes': 0});
      expect(h.offForEveryone, isTrue);
      expect(h.noMinutesYet, isFalse);
    });

    test('a top_member_id that is not listed never names that member: the listed leader is used', () {
      final h = read({
        'total_minutes': 200,
        'members': [
          {'member_id': 'A', 'first_name': 'Riya', 'minutes': 120, 'goal_days': 5},
          {'member_id': 'B', 'first_name': 'Kabir', 'minutes': 80, 'goal_days': 3},
        ],
        'top_member_id': 'GONE',
      });
      expect(h.topMember?.memberId, 'A');
      expect(h.topMember?.minutes, 120);
    });

    test('a listed top_member_id is honoured', () {
      final h = read({
        'members': [
          {'member_id': 'A', 'first_name': 'Riya', 'minutes': 120, 'goal_days': 5},
          {'member_id': 'B', 'first_name': 'Kabir', 'minutes': 80, 'goal_days': 3},
        ],
        'top_member_id': 'B',
      });
      expect(h.topMember?.memberId, 'B');
    });
  });

  group('This week sheet', () {
    testWidgets('the first morning of the week: the target and an empty bar, with one honest line, never "nobody"', (tester) async {
      final server = v3Server(scenario: 'heavy')
        ..setShareStudyTime(true)
        ..startOfWeek();
      await _open(tester, V4Sheets.thisWeek, server);
      await tester.ensureVisible(find.byKey(const ValueKey('tw-hours')));
      expect(find.text(MobV4SheetsCopy.hoursOffEveryone), findsNothing);
      expect(find.text(MobV4SheetsCopy.hoursYouOn), findsNothing);
      expect(find.text(MobV4SheetsCopy.hoursNoMinutesYet('Chai Circle')), findsOneWidget);
      expect(find.text('of 10 h'), findsOneWidget);
      expect(find.byKey(const ValueKey('pennant-crown')), findsNothing);
    });

    testWidgets('nobody sharing keeps the "Nobody is sharing" copy', (tester) async {
      await _open(tester, V4Sheets.thisWeek, v3Server(scenario: 'quiet'));
      await tester.ensureVisible(find.byKey(const ValueKey('tw-hours')));
      expect(find.text(MobV4SheetsCopy.hoursOffEveryone), findsOneWidget);
      expect(find.text(MobV4SheetsCopy.hoursNoMinutesYet('Chai Circle')), findsNothing);
    });

    testWidgets('the pennant wears the crown when somebody studied the most', (tester) async {
      await _open(tester, V4Sheets.thisWeek, v3Server(scenario: 'heavy'));
      expect(find.byKey(const ValueKey('pennant-crown')), findsOneWidget);
    });

    testWidgets('opened through the hook, the hours block links to Mob settings and the link opens them', (tester) async {
      final server = v3Server(scenario: 'heavy')
        ..denNow()
        ..setShareStudyTime(false);
      await _open(tester, V4Sheets.thisWeek, server);
      final link = find.text(MobV4SheetsCopy.hoursSettingsLink);
      await tester.ensureVisible(link);
      await tester.pumpAndSettle();
      expect(link, findsOneWidget);
      await tester.tap(link);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.settingsTitle), findsOneWidget);
      expect(find.text(MobV4SheetsCopy.thisWeekTitle), findsNothing);
    });

    testWidgets('a read that did not come has its own sentence, not the settings one', (tester) async {
      await _open(tester, V4Sheets.thisWeek, v3Server(), extra: [denViewProvider.overrideWithValue(null)]);
      expect(find.text(MobV4SheetsCopy.thisWeekFailed), findsOneWidget);
      expect(find.text(MobV3Copy.settingsFailed), findsNothing);
      expect(find.text(MobV3Copy.tryAgain), findsOneWidget);
    });

    testWidgets('large text stacks the pennant above its words with no overflow', (tester) async {
      await _open(tester, V4Sheets.thisWeek, v3Server(scenario: 'heavy'), scale: 1.3);
      expect(tester.takeException(), isNull);
      final pennant = tester.getTopLeft(find.byKey(const ValueKey('pennant-crown'))).dy;
      final title = tester.getTopLeft(find.text(MobV3Copy.mobChainTitle(3))).dy;
      expect(pennant, lessThan(title));
    });
  });
}
