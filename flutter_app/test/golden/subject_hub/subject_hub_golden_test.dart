// Goldens for the subject hub at 390 by 844 logical px, DPR 2, Night and Daylight, named
// `<name>_night.png` and `<name>_day.png`. The long page also gets a tall frame so everything
// below the first screen is looked at.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/subject_hub/subject_hub_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/subject_hub/hub_support.dart';

const Size _phone = Size(390, 844);
const Size _tall = Size(390, 3000);

void hubGolden(
  String name,
  String subject, {
  required List<Override> Function() overrides,
  Size size = _phone,
  Future<void> Function(WidgetTester tester)? interact,
}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      await pumpMockmob(
        tester,
        SubjectHubScreen(subject: subject),
        brightness: brightness,
        size: size,
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: overrides(),
      );
      await tester.pumpAndSettle();
      if (interact != null) await interact(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_$tag.png'));
    });
  }
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
  });

  hubGolden('accountancy_practised', 'accountancy', overrides: () => hubOverrides(attempts: loaded(accountancyAttempts())));
  hubGolden('accountancy_practised_tall', 'accountancy', size: _tall, overrides: () => hubOverrides(attempts: loaded(accountancyAttempts())));
  hubGolden('accountancy_fresh', 'accountancy', overrides: () => hubOverrides(attempts: loaded(const [])));
  hubGolden('accountancy_read_failed', 'accountancy', overrides: () => hubOverrides(attempts: const RemoteState(error: offlineError)));
  hubGolden('economics_fresh_tall', 'economics', size: _tall, overrides: () => hubOverrides(attempts: loaded(const [])));
  hubGolden('physics_no_hub', 'physics', overrides: () => hubOverrides(attempts: loaded(const [])));
  hubGolden(
    'accountancy_guide_open',
    'accountancy',
    size: const Size(390, 1500),
    overrides: () => hubOverrides(attempts: loaded(accountancyAttempts())),
    interact: (tester) async {
      final heading = find.text('How to practise CUET PYQs correctly');
      await tester.scrollUntilVisible(heading, 300, scrollable: find.byType(Scrollable).first);
      await tester.tap(heading);
      await tester.pumpAndSettle();
    },
  );
}
