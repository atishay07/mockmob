// Flutter's accessibility guidelines on the screens a student uses most (perf and a11y review,
// round 1): 48 dp targets, a label on every target, and text contrast as rendered, in both
// themes. These read the real render tree, so decorative art and glass are measured as drawn.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../golden/review/review_golden_support.dart';
import '../../golden/today/today_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../runner/support/fake_session.dart';
import '../runner/support/harness.dart';
import '../today/support/today_fixtures.dart';

Future<void> _meetsAll(WidgetTester tester, {bool contrast = true}) async {
  final handle = tester.ensureSemantics();
  await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
  await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
  if (contrast) await expectLater(tester, meetsGuideline(textContrastGuideline));
  handle.dispose();
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    testWidgets('Today with the dock meets the guidelines, $tag', (tester) async {
      await pumpMockmob(
        tester,
        PhoneFrame(child: TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero)),
        brightness: brightness,
        size: kTodaySize,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      await _meetsAll(tester);
    });

    testWidgets('Review meets the guidelines, $tag', (tester) async {
      await pumpMockmob(
        tester,
        const ReviewScreen(),
        brightness: brightness,
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(),
      );
      await settleImages(tester);
      await _meetsAll(tester);
    });

    testWidgets('the quick-start sheet meets the guidelines, $tag', (tester) async {
      await pumpMockmob(
        tester,
        const MmSheetGlass(child: MmSheetScaffold(child: QuickStartSheet())),
        brightness: brightness,
        size: const Size(384, 853),
        disableAnimations: true,
        overrides: [resumeOfferProvider.overrideWith((ref) async => null)],
      );
      await _meetsAll(tester);
    });

    testWidgets('the runner meets the guidelines, $tag', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(answers: {'q1': 1}), brightness: brightness);
      await settle(tester);
      await _meetsAll(tester);
    });
  }
}
