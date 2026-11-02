// Flutter's accessibility guidelines on Learn home (APP-1101 section 7, APP-1102-A): 48 dp targets, a label on every target and
// text contrast as rendered, in both themes, on the returning Pro page, a new student's page, a Free page with its day used, with
// Find open, with a set open and with the subject sheet open. These read the real render tree.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';

import '../../../helpers/fonts.dart';
import '../../../helpers/golden_harness.dart';
import 'home_support.dart';

Future<void> _meetsAll(WidgetTester tester) async {
  final handle = tester.ensureSemantics();
  await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
  await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
  await expectLater(tester, meetsGuideline(textContrastGuideline));
  handle.dispose();
}

void main() {
  setUpAll(loadAppFonts);
  setUp(() => SubjectEmblem.objectArt = false);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    Future<void> pump(WidgetTester tester, HomeLearnApi api, {double bottom = 32}) async {
      await pumpMockmob(
        tester,
        HomePage(bottom: bottom),
        brightness: brightness,
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: homeOverrides(api, nudges: true),
      );
      await settleHome(tester);
      await settleImages(tester);
    }

    testWidgets('a returning Pro student meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi());
      await _meetsAll(tester);
    });

    testWidgets('the chapters and the part switch meet the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi());
      await Scrollable.ensureVisible(tester.element(find.byKey(const ValueKey('lh-switch-p2'))), alignment: 0.04);
      await tester.pump();
      await _meetsAll(tester);
    });

    testWidgets('Free with its day used meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi(pro: false, freeUsed: true));
      await _meetsAll(tester);
    });

    testWidgets('Find open meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi());
      await tester.tap(find.byKey(const ValueKey('lh-search')));
      await settleHome(tester);
      await _meetsAll(tester);
    });

    testWidgets('a new student meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi(newStudent: true));
      await _meetsAll(tester);
    });

    testWidgets('Find for a new student (words to try) meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi(newStudent: true));
      await tester.tap(find.byKey(const ValueKey('lh-search')));
      await settleHome(tester);
      await _meetsAll(tester);
    });

    testWidgets('a set open meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi());
      await tester.tap(find.byKey(const ValueKey('lh-search')));
      await settleHome(tester);
      await tester.tap(find.byKey(const ValueKey('lh-find-due')));
      await settleHome(tester);
      await _meetsAll(tester);
    });

    testWidgets('the subject sheet meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi());
      await tester.tap(find.byKey(const ValueKey('lh-picker')));
      await tester.pump(const Duration(milliseconds: 600));
      await _meetsAll(tester);
    });

    testWidgets('failed meets the guidelines, $tag', (tester) async {
      await pump(tester, HomeLearnApi(error: true));
      await _meetsAll(tester);
    });
  }
}
