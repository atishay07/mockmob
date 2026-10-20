// More Mob V4 den goldens (pass-1020 MOB-MINIMAL 3.1, 3.5, 3.6): the full den with Mob hours and the
// studying desk at text 1.0 and 1.3, Mob hours off for everyone, and the Invite and Your Mobs sheets, in
// Night and Day. The nine ladder steps are in den_v4_golden_test.dart.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart';
import 'den_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 400));
  await settleImages(tester);
  await tester.pump(const Duration(milliseconds: 1400));
}

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    for (final scale in [1.0, 1.3]) {
      testWidgets('v4 den full heavy text $scale ${_tag(b)}', (tester) async {
        await pumpDen(tester, v3Server(scenario: 'heavy'), brightness: b, height: 1900, textScale: scale);
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_full_heavy_${scale == 1.0 ? '100' : '130'}_${_tag(b)}.png'));
      });
    }
    testWidgets('v4 den hours off for everyone ${_tag(b)}', (tester) async {
      await pumpDen(tester, v3Server(scenario: 'open')..seedSharers = false, brightness: b, height: 1700);
      await _settle(tester);
      expect(find.text(MobV4DenCopy.hoursOff), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_hours_off_${_tag(b)}.png'));
    });
    testWidgets('v4 invite sheet ${_tag(b)}', (tester) async {
      await pumpDen(tester, v3Server(scenario: 'open'), brightness: b, height: 900);
      await _settle(tester);
      await tester.tap(find.bySemanticsLabel(RegExp('^Open seat')).first);
      await _settle(tester);
      expect(find.byKey(const ValueKey('invite-sheet-whatsapp')), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_invite_sheet_${_tag(b)}.png'));
    });
    testWidgets('v4 your mobs sheet ${_tag(b)}', (tester) async {
      await pumpDen(tester, v3Server(scenario: 'open'), brightness: b, height: 900);
      await _settle(tester);
      await tester.tap(find.byKey(const ValueKey('den-your-mobs')));
      await _settle(tester);
      expect(find.byKey(const ValueKey('your-mobs-join')), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4/den_v4_your_mobs_sheet_${_tag(b)}.png'));
    });
  }
}
