// BalancedText: the web's `text-wrap: balance` on the Learn screens. A text of two lines or more is set at the narrowest width that
// keeps its number of lines; one line, or a text cut at its last line, keeps its full width; the number of lines never changes.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/learn2_balance.dart';

const TextStyle _style = TextStyle(fontSize: 20, height: 1.2);

int _lines(String text, double width, {int? maxLines}) {
  final tp = TextPainter(text: TextSpan(text: text, style: _style), textDirection: TextDirection.ltr, maxLines: maxLines)..layout(maxWidth: width);
  final lines = tp.computeLineMetrics().length;
  tp.dispose();
  return lines;
}

double _balanced(String text, double width, {int? maxLines}) =>
    BalancedText.balancedWidth(text, _style, width, scaler: TextScaler.noScaling, direction: TextDirection.ltr, maxLines: maxLines);

Widget _app(Widget child, {double width = 300, double textScale = 1}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
    child: Scaffold(body: Align(alignment: Alignment.topLeft, child: SizedBox(width: width, child: child))),
  ),
);

void main() {
  testWidgets('a text of two lines is set at the narrowest width that still holds two lines', (tester) async {
    const text = 'Pick up Admission of a Partner';
    final full = _lines(text, 300);
    expect(full, greaterThan(1), reason: 'the case needs a wrap');
    final width = _balanced(text, 300);
    expect(width, lessThan(300));
    expect(_lines(text, width), full, reason: 'the same number of lines');
    expect(_lines(text, width - 1.5), greaterThan(full), reason: 'any narrower and it would need another');
  });

  test('a text that fits one line keeps its full width', () {
    expect(_balanced('Explore', 300), 300);
    expect(_balanced('', 300), 300);
  });

  test('a text that is cut at its last line keeps its full width', () {
    const text = 'Accounting for Partnership: Basic Concepts and the rest of what this long name says again and again';
    expect(_lines(text, 300, maxLines: 2), 2);
    expect(_balanced(text, 300, maxLines: 2), 300);
  });

  test('no width, no change', () {
    expect(_balanced('a b c d e f g h i j k l', double.infinity), double.infinity);
    expect(_balanced('a b c d e f g h i j k l', 0), 0);
  });

  for (final scale in [1.0, 1.3]) {
    testWidgets('the widget is narrower than a plain Text and as tall, left aligned, at text scale $scale', (tester) async {
      const text = "That was today's free session, and your Key cards stay open.";
      await tester.pumpWidget(_app(const Text(text, style: _style), textScale: scale));
      final plain = tester.getRect(find.text(text));
      await tester.pumpWidget(_app(const BalancedText(text, style: _style), textScale: scale));
      final balanced = tester.getRect(find.text(text));
      expect(plain.height, greaterThan(_style.fontSize! * 1.2 * 1.5), reason: 'the case needs a wrap');
      expect(balanced.height, plain.height, reason: 'the number of lines does not change');
      expect(balanced.width, lessThan(plain.width));
      expect(balanced.left, 0);
      expect(find.text(text), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('a centred text is centred in its room', (tester) async {
    const text = 'Pick up Admission of a Partner';
    await tester.pumpWidget(_app(const Center(child: BalancedText(text, style: _style, textAlign: TextAlign.center))));
    final box = tester.getRect(find.text(text));
    expect(box.center.dx, closeTo(150, 1));
  });

  testWidgets('a text with no room to wrap (unbounded width) is left alone', (tester) async {
    const text = 'A short line';
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SingleChildScrollView(scrollDirection: Axis.horizontal, child: BalancedText(text, style: _style))),
      ),
    );
    expect(find.text(text), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
