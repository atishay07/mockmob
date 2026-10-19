// Goldens for the SOCIAL slice of Mob v3 (spec 7.3): D0, D0a, J1 (valid, invalid), S1, SET and the invite
// card, at 360 dp Night and Day; D0 also at 412 dp and at 1.3x text. Compare with the arena references
// S21 (create), S22 (join), S20 (shelf) and S23 (a Mob of one).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/den_start_screen.dart';
import 'package:mockmob/features/social/v3/screens/join_v3_screen.dart';
import 'package:mockmob/features/social/v3/screens/mob_settings_v3_screen.dart';
import 'package:mockmob/features/social/v3/screens/shelf_screen.dart';
import 'package:mockmob/features/social/v3/widgets/fold_picker.dart';
import 'package:mockmob/features/social/v3/widgets/invite_card.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';
import '../../you/you_golden_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';
const _both = [Brightness.dark, Brightness.light];

void main() {
  setUpGoldenFonts();
  setUpAll(loadFoldManifestForTest);

  Future<void> shot(String name, Brightness b) => expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${_tag(b)}.png'));

  // D0: 360, 412 and 1.3x.
  for (final (w, scale, suffix) in [(360.0, 1.0, '360'), (412.0, 1.0, '412'), (360.0, 1.3, '360_x13')]) {
    for (final b in _both) {
      testWidgets('D0 no Mob $suffix ${_tag(b)}', (tester) async {
        await pumpMockmob(tester, const DenStartScreen(), brightness: b, size: Size(w, 780), textScale: scale, wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(SocialServer(scenario: 'fresh')));
        await tester.pump(const Duration(milliseconds: 500));
        await shot('d0_$suffix', b);
      });
    }
  }

  for (final b in _both) {
    testWidgets('D0 no subjects 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const DenStartScreen(), brightness: b, wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(SocialServer(scenario: 'fresh'), auth: noSubjectsAuth));
      await tester.pump(const Duration(milliseconds: 500));
      await shot('d0_nosubjects_360', b);
    });

    testWidgets('D0a start sheet 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const DenStartScreen(), brightness: b, size: const Size(360, 860), wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(SocialServer(scenario: 'fresh')));
      await tester.tap(find.byKey(const ValueKey('d0-start')));
      await settleImages(tester);
      await tester.pump(const Duration(milliseconds: 600));
      await shot('d0a_360', b);
    });

    testWidgets('J1 join, valid code 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const JoinV3Screen(code: 'K7P2M9'), brightness: b, size: const Size(360, 780), wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(SocialServer(scenario: 'fresh')));
      await tester.pump(const Duration(milliseconds: 300));
      await settleImages(tester);
      await shot('j1_valid_360', b);
    });

    testWidgets('J1 join, invalid code 360 ${_tag(b)}', (tester) async {
      final server = SocialServer(scenario: 'fresh', previews: {'K7P2M9': const JoinPreview(status: 'invalid')});
      await pumpMockmob(tester, const JoinV3Screen(code: 'K7P2M9'), brightness: b, size: const Size(360, 780), wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(server));
      await tester.pump(const Duration(milliseconds: 300));
      await shot('j1_invalid_360', b);
    });

    testWidgets('J1 join, empty 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const JoinV3Screen(), brightness: b, size: const Size(360, 780), wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(SocialServer(scenario: 'fresh')));
      await tester.pump(const Duration(milliseconds: 300));
      await shot('j1_empty_360', b);
    });

    testWidgets('S1 shelf 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const ShelfScreen(), brightness: b, size: const Size(360, 2300), wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(SocialServer()));
      await tester.pump(const Duration(milliseconds: 300));
      await settleImages(tester);
      await shot('s1_shelf_360', b);
    });

    testWidgets('SET settings, owner 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const MobSettingsV3Screen(), brightness: b, size: const Size(360, 1250), wrapInScaffold: false, disableAnimations: true, overrides: socialOverrides(SocialServer()));
      await tester.pump(const Duration(milliseconds: 300));
      await settleImages(tester);
      await shot('set_owner_360', b);
    });

    testWidgets('invite card 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(
        tester,
        const Padding(padding: EdgeInsets.all(16), child: InviteCardPreview(youName: 'Aarav', mobName: 'Chai Circle', subjectName: 'Accountancy', display: 'K7P 2M9')),
        brightness: b,
        size: const Size(360, 420),
        disableAnimations: true,
        overrides: socialOverrides(SocialServer()),
      );
      await settleImages(tester);
      await shot('invite_card_360', b);
    });

    testWidgets('fold picker cards 360 ${_tag(b)}', (tester) async {
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(20), child: FoldPickerCards(folds: FoldKey.starters, selected: FoldKey.dart, onChanged: (_) {})),
        brightness: b,
        size: const Size(360, 430),
        disableAnimations: true,
        overrides: socialOverrides(SocialServer()),
      );
      await settleImages(tester);
      await shot('fold_picker_360', b);
    });
  }
}
