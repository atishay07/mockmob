import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Widget _navs() {
  return SampleColumn(
    gap: 10,
    children: [
      for (var i = 0; i < kMmTabs.length; i++)
        Sample(
          '${kMmTabs[i].label} active${i == 0 ? ', dot on Review' : ''}',
          MmBottomNav(currentIndex: i, onTap: (_) {}, showReviewDot: i == 0),
        ),
    ],
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in Brightness.values) {
    testWidgets('bottom nav, ${brightness.name}', (tester) async {
      await pumpMockmob(tester, _navs(), brightness: brightness);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/bottom_nav_${brightness.name}.png'));
    });
  }
}
