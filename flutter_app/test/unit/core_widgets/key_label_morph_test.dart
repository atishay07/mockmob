// A key's label change: the old words lift and fade while the new ones rise in (180 ms), the key
// never jumps in height, and under reduced motion the text is swapped at once.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/key_button.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// One key whose words (and reason) are driven from outside, so a change is a rebuild, not a new key.
Widget _driven(ValueNotifier<String> label, ValueNotifier<String?> reason, {bool disabled = false}) => AnimatedBuilder(
      animation: Listenable.merge([label, reason]),
      builder: (context, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: KeyButton(label: label.value, onPressed: disabled ? null : () {}, disabledReason: reason.value),
      ),
    );

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a changed label rises in over the old one, and the key keeps its height', (tester) async {
    final label = ValueNotifier('Next');
    final reason = ValueNotifier<String?>(null);
    addTearDown(label.dispose);
    addTearDown(reason.dispose);
    await pumpMockmob(tester, _driven(label, reason), size: const Size(360, 400));
    final before = tester.getSize(find.byType(KeyButton)).height;
    label.value = 'Submit';
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    expect(find.text('Next'), findsOneWidget, reason: 'the old label is still lifting away');
    expect(find.text('Submit'), findsOneWidget);
    expect(tester.getSize(find.byType(KeyButton)).height, before);
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('Next'), findsNothing);
    expect(find.text('Submit'), findsOneWidget);
  });

  testWidgets('reduced motion swaps the text at once', (tester) async {
    final label = ValueNotifier('Next');
    final reason = ValueNotifier<String?>(null);
    addTearDown(label.dispose);
    addTearDown(reason.dispose);
    await pumpMockmob(tester, _driven(label, reason), size: const Size(360, 400), disableAnimations: true);
    label.value = 'Submit';
    await tester.pump();
    expect(find.text('Next'), findsNothing);
    expect(find.text('Submit'), findsOneWidget);
  });

  testWidgets('a reason under a disabled key grows open and closes', (tester) async {
    final label = ValueNotifier('Start');
    final reason = ValueNotifier<String?>(null);
    addTearDown(label.dispose);
    addTearDown(reason.dispose);
    await pumpMockmob(tester, _driven(label, reason, disabled: true), size: const Size(360, 400));
    expect(find.text('Choose a chapter first.'), findsNothing);
    reason.value = 'Choose a chapter first.';
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));
    expect(find.text('Choose a chapter first.'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 300));
    reason.value = null;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));
    expect(find.text('Choose a chapter first.'), findsOneWidget, reason: 'still closing');
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Choose a chapter first.'), findsNothing);
  });
}
