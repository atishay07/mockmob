// K4 (owner, 20 Oct 2026): the Pro page's "Free and Pro, side by side" table at 360 dp, with text at 1.0 and 1.3, Night
// and Day. D175: there is no free first full mock, so the Free cell of Full mocks reads "50 credits each", and every
// row grows with its words rather than being cut off.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/billing/widgets/pro_showcase.dart';

import '../../helpers/golden_harness.dart';
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

void main() {
  setUpGoldenFonts();

  for (final scale in [1.0, 1.3]) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      final file = 'pro_compare_360_text${(scale * 100).round()}_$tag';
      testWidgets(file, (tester) async {
        await pumpMockmob(
          tester,
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ProCompareTable(rows: [...BillingCopy.compareRows, ...BillingCopy.compareMobRows]),
          ),
          brightness: brightness,
          size: const Size(360, 940),
          textScale: scale,
        );
        await tester.pumpAndSettle();
        // Nothing overflows at 360 dp, at either text size.
        expect(tester.takeException(), isNull);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
      });
    }
  }
}
