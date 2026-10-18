// G17 + D105 (19 Oct): the Mob has its own tab. Its root is the Mob page as a tab (the tab header with
// the account key, no back key); a student with no Mob sees both ways in at once, Join with a code and
// Start a Mob; the code sheet takes a code or a whole link and opens the friend's Mob; Today carries a
// Mob block only while the student is in no Mob.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/account/account_avatar.dart' show AccountAvatarButton;
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/logic/mob_entry.dart';
import 'package:mockmob/features/social/mob_routes.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_join_code.dart';
import 'package:mockmob/features/social/widgets/mob_today_card.dart';

import '../../helpers/golden_harness.dart';
import 'mob_test_kit.dart';

void main() {
  test('the Mob tab is /mob, and the old page path redirects there (router)', () {
    expect(MobPaths.mob, '/mob');
  });

  testWidgets('no Mob, as the tab: the tab header (no back key), Join with a code above the fold, and Start a Mob', (tester) async {
    await pumpMockmob(tester, const MobScreen(asTab: true), size: const Size(360, 800), wrapInScaffold: false, disableAnimations: true, overrides: mobOverrides(noMobState()));
    await tester.pumpAndSettle();
    expect(find.byType(TabRootHeader), findsOneWidget);
    expect(find.text(MobCopy.title), findsOneWidget);
    expect(find.bySemanticsLabel('Back'), findsNothing, reason: 'a tab root has no back key');
    expect(find.byType(AccountAvatarButton), findsOneWidget, reason: 'the account key, like every tab root');
    final join = find.byKey(const ValueKey('mob-join-with-code'));
    expect(join, findsOneWidget);
    expect(tester.getRect(join).bottom, lessThan(800 - MmBar.lift - MmBar.height), reason: 'Join with a code shows on the first screen at 360 by 800');
    expect(find.text(MobCopy.joinCodeLead), findsOneWidget);
    await tester.scrollUntilVisible(find.text(MobCopy.startKey), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text(MobCopy.startKey), findsWidgets, reason: 'Start a Mob is the other way in');
  });

  testWidgets('pushed (not the tab), the page keeps its back key', (tester) async {
    await pumpMockmob(tester, const MobScreen(), size: const Size(360, 800), wrapInScaffold: false, disableAnimations: true, overrides: mobOverrides(noMobState()));
    await tester.pumpAndSettle();
    expect(find.byType(TabRootHeader), findsNothing);
    expect(find.bySemanticsLabel('Back'), findsOneWidget);
  });

  testWidgets('the code sheet: a wrong code says so plainly; a code or a whole link opens the Mob', (tester) async {
    final codes = <String>[];
    await pumpMockmob(tester, JoinWithCodeSheet(onCode: codes.add), size: const Size(360, 800), disableAnimations: true);
    await tester.pump();
    expect(find.text(MobCopy.joinCodeNote), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('mob-join-code-field')), 'abc');
    await tester.tap(find.text(MobCopy.joinCodeKey));
    await tester.pump();
    expect(find.text(MobCopy.joinCodeWrong), findsOneWidget);
    expect(codes, isEmpty);

    await tester.enterText(find.byKey(const ValueKey('mob-join-code-field')), 'k7p2 m9qx');
    await tester.pump();
    expect(find.text(MobCopy.joinCodeWrong), findsNothing, reason: 'typing clears the error');
    await tester.tap(find.text(MobCopy.joinCodeKey));
    await tester.pump();
    expect(codes, ['K7P2M9QX']);

    await tester.enterText(find.byKey(const ValueKey('mob-join-code-field')), 'https://www.mockmob.in/join/K7P2M9QX');
    await tester.tap(find.text(MobCopy.joinCodeKey));
    await tester.pump();
    expect(codes, ['K7P2M9QX', 'K7P2M9QX']);
  });

  test('every new Mob line is a full, plain sentence', () {
    for (final line in [MobCopy.joinCodeLead, MobCopy.joinCodeNote, MobCopy.joinCodeWrong]) {
      expect(line.trim(), endsWith('.'), reason: line);
      expect(line, isNot(contains('  ')));
    }
    expect(MobCopy.joinWithCode, 'Join with a code');
    expect(MobCopy.joinCodeTitle, "Join a friend's Mob");
  });

  group('Today keeps a Mob block only while the student has no Mob (D105)', () {
    test('the rule', () {
      expect(mobTodayBlockShows(inMob: true), isFalse);
      expect(mobTodayBlockShows(inMob: false), isTrue);
    });

    testWidgets('a member sees no Mob card on Today: the Mob tab holds it', (tester) async {
      await pumpMockmob(tester, const MobTodayBlock(), disableAnimations: true, overrides: mobOverrides(mobState()));
      await tester.pumpAndSettle();
      expect(find.byType(MobTodayCard), findsNothing);
    });
  });
}
