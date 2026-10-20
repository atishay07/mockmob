// Goldens for You > Privacy under D183 (owner, 20 Oct 2026): "Prefer not to say" gets the usage-data switch like 18
// or older (here on), and an age never answered reads off with the line that says to answer the age question.
// 360 dp wide, Night and Day, at 1x and 1.3x text.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/features/you/privacy/privacy_screen.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/you/you_test_support.dart';
import 'you_golden_kit.dart' show setUpGoldenFonts;

void _privacyGolden(String name, ConsentState Function() consent) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    for (final scale in const [1.0, 1.3]) {
      final file = '${name}_${tag}_360${scale == 1 ? '' : '_text130'}';
      testWidgets(file, (tester) async {
        await pumpMockmob(
          tester,
          const PrivacyScreen(),
          brightness: brightness,
          size: Size(360, scale == 1 ? 900 : 1300),
          textScale: scale,
          wrapInScaffold: false,
          disableAnimations: true,
          overrides: youOverrides(consent: FakeConsent(consent())),
        );
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
      });
    }
  }
}

void main() {
  setUpGoldenFonts();

  // "Prefer not to say": the unknown band with a decision on the server, usage data allowed.
  _privacyGolden('privacy_not_say_on', () => consentState(AgeBand.unknown, on: true));

  // The age was never answered: no decision on the server, so nothing is on and the switch waits for the answer.
  _privacyGolden(
    'privacy_unanswered',
    () => const ConsentState(status: ConsentStatus.loaded, consent: Consent()),
  );
}
