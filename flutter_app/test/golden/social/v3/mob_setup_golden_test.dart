// Goldens for the Mob setup, one question a screen (owner D166; MOB-EXPLAINER.md section 2, the
// prototype's Setup 1 to 4): each question at 360 x 780 Night and Day, the first before and after a
// Fold is picked, the last at 1.3x text, and a returning student's last question ("You play as").
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/mob_setup_screen.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';
import '../../you/you_golden_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';
const _both = [Brightness.dark, Brightness.light];

Future<void> _pump(WidgetTester tester, Brightness b, {double scale = 1, FoldKey? seat}) async {
  final server = SocialServer(scenario: 'fresh');
  if (seat != null) await server.profile(seat);
  await pumpMockmob(tester, const MobSetupScreen(), brightness: b, size: const Size(360, 780), textScale: scale, wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(server));
  await tester.pump(const Duration(milliseconds: 300));
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.tap(f);
  await tester.pump(const Duration(milliseconds: 300));
}

Finder get _key => find.byKey(const ValueKey('setup-key'));

/// Walks a fresh student to question [step] (1 to 4) with Dart, Chai Circle and Accountancy.
Future<void> _to(WidgetTester tester, int step) async {
  if (step >= 1) await _tap(tester, find.text('Dart'));
  if (step >= 2) {
    await _tap(tester, _key);
    await _tap(tester, find.byKey(const ValueKey('mob-name-0')));
  }
  if (step >= 3) await _tap(tester, _key);
  if (step >= 4) await _tap(tester, _key);
}

void main() {
  setUpGoldenFonts();
  setUpAll(loadFoldManifestForTest);

  Future<void> shot(WidgetTester tester, String name, Brightness b) async {
    await settleImages(tester);
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${_tag(b)}.png'));
  }

  for (final b in _both) {
    testWidgets('setup 1, your Fold, nothing picked 360 ${_tag(b)}', (tester) async {
      await _pump(tester, b);
      await shot(tester, 'setup_1_fold_empty_360', b);
    });

    testWidgets('setup 1, your Fold, Dart picked 360 ${_tag(b)}', (tester) async {
      await _pump(tester, b);
      await _to(tester, 1);
      await shot(tester, 'setup_1_fold_360', b);
    });

    testWidgets('setup 2, the name 360 ${_tag(b)}', (tester) async {
      await _pump(tester, b);
      await _to(tester, 2);
      await shot(tester, 'setup_2_name_360', b);
    });

    testWidgets('setup 3, the subject 360 ${_tag(b)}', (tester) async {
      await _pump(tester, b);
      await _to(tester, 3);
      await shot(tester, 'setup_3_subject_360', b);
    });

    testWidgets('setup 4, you 360 ${_tag(b)}', (tester) async {
      await _pump(tester, b);
      await _to(tester, 4);
      await shot(tester, 'setup_4_you_360', b);
    });

    testWidgets('setup 4, you 360 1.3x ${_tag(b)}', (tester) async {
      await _pump(tester, b, scale: 1.3);
      await _to(tester, 4);
      await shot(tester, 'setup_4_you_360_x13', b);
    });

    testWidgets('setup 4, a returning student 360 ${_tag(b)}', (tester) async {
      await _pump(tester, b, seat: FoldKey.kandil);
      await _tap(tester, find.byKey(const ValueKey('mob-name-3')));
      await _tap(tester, _key);
      await _tap(tester, _key);
      await shot(tester, 'setup_4_you_returning_360', b);
    });
  }
}
