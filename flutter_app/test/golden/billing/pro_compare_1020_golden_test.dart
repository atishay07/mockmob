// K4 (owner, 20 Oct 2026): the Pro page's "Free and Pro, side by side" table at 360 dp, with text at 1.0 and 1.3, Night
// and Day. The Free cell of Full mocks was cut off ("First free, then 50 credits" in a fixed 48 dp row); the row now
// reads "Full mocks", "Your first in each subject is free", "Then 50 credits", and every row grows with its words.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/billing/widgets/pro_showcase.dart';

import '../../helpers/golden_harness.dart';
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

void main() {
  setUpGoldenFonts();

  final cases = <(String, bool?, double)>[
    ('first_free', true, 1.0),
    ('first_free', true, 1.3),
    ('no_first_free', false, 1.3),
    ('unknown', null, 1.3),
  ];
  for (final (name, firstFree, scale) in cases) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      final file = 'pro_compare_${name}_360_text${(scale * 100).round()}_$tag';
      testWidgets(file, (tester) async {
        await pumpMockmob(
          tester,
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ProCompareTable(
              rows: [...BillingCopy.compareRowsFor(firstFree: firstFree), ...BillingCopy.compareMobRows],
              notes: BillingCopy.compareNotesFor(firstFree: firstFree),
            ),
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
