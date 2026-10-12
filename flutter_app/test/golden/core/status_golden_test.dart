import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/copy/copy.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Widget _status() {
  return SampleColumn(
    gap: 14,
    children: [
      const Sample(
        'Save pill, on this phone',
        Align(alignment: Alignment.centerLeft, child: SavePill(state: SaveState.onThisPhone)),
      ),
      const Sample(
        'Save pill, sending',
        Align(alignment: Alignment.centerLeft, child: SavePill(state: SaveState.sending)),
      ),
      const Sample(
        'Save pill, saved',
        Align(alignment: Alignment.centerLeft, child: SavePill(state: SaveState.saved)),
      ),
      Sample(
        'Receipt line, recorded',
        ReceiptLine(text: Receipts.mockSaved('Mock 7', DateTime(2026, 10, 12, 23, 42))),
      ),
      const Sample('Receipt line, pending', ReceiptLine.pending()),
      const Sample('Inline banner, offline strip', InlineBanner.offlineStrip()),
      Sample(
        'Inline banner, error with action',
        InlineBanner(
          message: 'We could not send 3 answers. They are still on this phone.',
          tone: BannerTone.error,
          actionLabel: 'Try again',
          onAction: () {},
        ),
      ),
      const Sample(
        'Skeleton',
        SkeletonGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Skeleton.line(width: 180, height: 20),
              SizedBox(height: 10),
              Skeleton.line(),
              SizedBox(height: 8),
              Skeleton.line(width: 240),
              SizedBox(height: 14),
              Skeleton(height: 96, radius: 20),
            ],
          ),
        ),
      ),
    ],
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in Brightness.values) {
    testWidgets('save pill, receipt, banner and skeleton, ${brightness.name}', (tester) async {
      await pumpMockmob(tester, _status(), brightness: brightness, disableAnimations: true);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/status_${brightness.name}.png'));
    });
  }
}
