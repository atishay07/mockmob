// L3 (walk, 19 Oct): at 360 dp the "Balanced" difficulty segment was cut to "Balanc...". The same choice now reads as
// chips wherever four equal segments cannot hold the longest word whole, and stays a segmented control where they can.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmSegmented;
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/widgets/composer_parts.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;

Future<void> _pump(WidgetTester tester, {required double phone, double scale = 1, bool isPro = false}) async {
  tester.view.physicalSize = Size(phone, 800) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          theme: buildTheme(Brightness.dark),
          builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)), child: child!),
          home: Scaffold(
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: DifficultyPicker(value: PracticeDifficulty.balanced, isPro: isPro, onChanged: (_) {}),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  setUpAll(loadAppFonts);

  for (final phone in [320.0, 360.0, 384.0]) {
    for (final scale in [1.0, 1.15]) {
      for (final isPro in [false, true]) {
        testWidgets('${phone.toInt()} dp, text $scale, ${isPro ? 'Pro' : 'Free'}: every level word is whole', (tester) async {
          await _pump(tester, phone: phone, scale: scale, isPro: isPro);
          for (final word in ['Balanced', 'Easy', 'Medium', 'Hard']) {
            final paragraph = tester.renderObject<RenderParagraph>(find.text(word));
            expect(paragraph.didExceedMaxLines, isFalse, reason: '$word is cut');
            expect(paragraph.size.width, greaterThan(0));
          }
          expect(tester.takeException(), isNull);
        });
      }
    }
  }

  testWidgets('a wide phone keeps the one-row segmented control; a narrow one lays the same four choices out as chips', (tester) async {
    await _pump(tester, phone: 412);
    expect(find.byType(MmSegmented<PracticeDifficulty>), findsOneWidget);
    await _pump(tester, phone: 360);
    expect(find.byType(MmSegmented<PracticeDifficulty>), findsNothing);
    expect(find.text('Balanced'), findsOneWidget);
  });
}
