import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/count_up.dart';
import 'package:mockmob/core/widgets/monumental_number.dart';

import '../core/motion/motion_harness.dart';

/// The colour the count-up's text is drawn in right now.
Color? _textColor(WidgetTester tester) =>
    tester.widget<Text>(find.descendant(of: find.byType(MmCountUp), matching: find.byType(Text))).style?.color;

String _text(WidgetTester tester) =>
    tester.widget<Text>(find.descendant(of: find.byType(MmCountUp), matching: find.byType(Text))).data!;

/// The tinted copy a remembered MonumentalNumber lays over its digits while a change shows.
Finder _tintCopy() => find.descendant(of: find.byType(MonumentalNumber), matching: find.byType(FadeTransition));

void main() {
  setUp(MmNumberMemory.clear);

  group('MmNumberMemory', () {
    test('direction reads numbers and figure strings', () {
      expect(MmNumberMemory.direction(36, 40), 1);
      expect(MmNumberMemory.direction('183', '171'), -1);
      expect(MmNumberMemory.direction('4.5', '4.5'), 0);
      expect(MmNumberMemory.direction(null, 3), 0);
      expect(MmNumberMemory.direction('1,204', '1,310'), 1);
    });

    test('keeps the newest keys up to its capacity', () {
      for (var i = 0; i <= MmNumberMemory.capacity; i++) {
        MmNumberMemory.remember('k$i', i);
      }
      expect(MmNumberMemory.recall('k0'), isNull);
      expect(MmNumberMemory.recall('k${MmNumberMemory.capacity}'), MmNumberMemory.capacity);
    });
  });

  group('MmCountUp with a memory key', () {
    Widget count(num value, {bool reduced = false, String? memoryKey = 'today.right'}) => motionApp(
          Center(child: MmCountUp(value: value, memoryKey: memoryKey)),
          reduced: reduced,
        );

    testWidgets('a remount with the same value does not count again', (tester) async {
      await tester.pumpWidget(count(36));
      expect(_text(tester), '0');
      await tester.pumpAndSettle();
      expect(_text(tester), '36');

      await tester.pumpWidget(motionApp(const SizedBox()));
      await tester.pumpWidget(count(36));
      expect(_text(tester), '36');
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a remount with a higher value counts from the remembered one and inks volt', (tester) async {
      await tester.pumpWidget(count(36));
      await tester.pumpAndSettle();
      final rest = _textColor(tester);
      await tester.pumpWidget(motionApp(const SizedBox()));

      await tester.pumpWidget(count(40));
      expect(_text(tester), '36');
      await tester.pump(const Duration(milliseconds: 200));
      final accent = tester.element(find.byType(MmCountUp)).mmColors.accentText;
      expect(_textColor(tester), accent);
      await tester.pumpAndSettle();
      expect(_text(tester), '40');
      expect(_textColor(tester), rest);
    });

    testWidgets('a fall dims, then settles', (tester) async {
      await tester.pumpWidget(count(36));
      await tester.pumpAndSettle();
      final rest = _textColor(tester);
      await tester.pumpWidget(count(30));
      await tester.pump(const Duration(milliseconds: 200));
      final dim = tester.element(find.byType(MmCountUp)).mmColors.ink3;
      expect(_textColor(tester), dim);
      await tester.pumpAndSettle();
      expect(_text(tester), '30');
      expect(_textColor(tester), rest);
    });

    testWidgets('reduced motion shows the new value at once, untinted', (tester) async {
      await tester.pumpWidget(count(36));
      await tester.pumpAndSettle();
      final rest = _textColor(tester);
      await tester.pumpWidget(motionApp(const SizedBox()));
      await tester.pumpWidget(count(40, reduced: true));
      expect(_text(tester), '40');
      expect(_textColor(tester), rest);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('without a key it counts from the start, as before', (tester) async {
      await tester.pumpWidget(count(36, memoryKey: null));
      await tester.pumpAndSettle();
      await tester.pumpWidget(motionApp(const SizedBox()));
      await tester.pumpWidget(count(36, memoryKey: null));
      expect(_text(tester), '0');
      await tester.pumpAndSettle();
    });
  });

  group('MonumentalNumber with a memory key', () {
    Widget number(String value, {VoidCallback? onLanded}) => motionApp(
          Center(child: MonumentalNumber(value: value, unit: 'of 250', memoryKey: 'score', onLanded: onLanded)),
        );

    testWidgets('rolls once, then a remount with the same value is simply there', (tester) async {
      var landed = 0;
      await tester.pumpWidget(number('183', onLanded: () => landed++));
      await tester.pumpAndSettle();
      expect(landed, 1);

      await tester.pumpWidget(motionApp(const SizedBox()));
      await tester.pumpWidget(number('183', onLanded: () => landed++));
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pumpAndSettle();
      expect(landed, 1);
      expect(_tintCopy(), findsNothing);
    });

    testWidgets('a remount with a new value rolls from the remembered one, tinted, then settles', (tester) async {
      var landed = 0;
      await tester.pumpWidget(number('171'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(motionApp(const SizedBox()));

      await tester.pumpWidget(number('183', onLanded: () => landed++));
      await tester.pump(const Duration(milliseconds: 200));
      expect(_tintCopy(), findsOneWidget);
      expect(tester.widget<FadeTransition>(_tintCopy()).opacity.value, 1);
      await tester.pumpAndSettle();
      expect(landed, 1);
      expect(_tintCopy(), findsNothing);
    });
  });
}
