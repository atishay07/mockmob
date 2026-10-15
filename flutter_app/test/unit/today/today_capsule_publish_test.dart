// Tonight's move stands in for the hero's key as the bar's capsule only once that key is out of
// view (device walk-through 22:07, finding 23: the capsule and the key showed together). The key
// rises into place over the page's entrance, so the line is judged at the end of it.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../golden/today/today_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

ValueNotifier<BarMove?>? _slot;

Future<void> _pump(WidgetTester tester, {required Size size}) async {
  _slot = null;
  await pumpMockmob(
    tester,
    PhoneFrame(
      child: Builder(
        builder: (context) {
          _slot = MmBarInsets.maybeOf(context)?.tonightMove;
          return TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero);
        },
      ),
    ),
    size: size,
    overrides: todayOverrides,
  );
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a layout change with no rebuild or scroll is still judged (the page settles after the capsule was raised)', (tester) async {
    final height = ValueNotifier<double>(560);
    // One body instance: resizing its box relayouts it without rebuilding it.
    final controller = ScrollController();
    addTearDown(controller.dispose);
    final body = TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero, controller: controller);
    _slot = null;
    await pumpMockmob(
      tester,
      PhoneFrame(
        child: Builder(
          builder: (context) {
            _slot = MmBarInsets.maybeOf(context)?.tonightMove;
            return ValueListenableBuilder<double>(
              valueListenable: height,
              child: body,
              builder: (context, h, child) => Align(alignment: Alignment.topCenter, child: SizedBox(height: h, child: child)),
            );
          },
        ),
      ),
      size: const Size(384, 853),
      overrides: todayOverrides,
    );
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pump(const Duration(milliseconds: 100));
    expect(_slot!.value, isNull, reason: 'words of the card sit where the capsule would');
    controller.jumpTo(controller.position.maxScrollExtent);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(_slot!.value, isNotNull, reason: 'the whole card is scrolled out of the short box');
    height.value = 853;
    await tester.pump();
    controller.jumpTo(0);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(milliseconds: 50));
    expect(_slot!.value, isNull, reason: 'the card came back into view; the capsule stands down');
  });

  testWidgets('a hero key in view at rest raises no capsule, though it rose into place during the entrance', (tester) async {
    await _pump(tester, size: const Size(384, 853));
    // Mid-entrance the key is lower than it will rest; nothing is decided yet.
    await tester.pump(const Duration(milliseconds: 100));
    expect(_slot, isNotNull);
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump(const Duration(milliseconds: 100));
    expect(_slot!.value, isNull, reason: 'the key is above the bar, so the capsule stays away');
  });

  testWidgets('a hero key below the fold keeps the capsule away while words of the card sit above the bar', (tester) async {
    await _pump(tester, size: const Size(384, 560));
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pump(const Duration(milliseconds: 100));
    expect(_slot!.value, isNull);
  });

  testWidgets('at 360 dp with 1.3x text the capsule never sits on a word of the hero card', (tester) async {
    _slot = null;
    await pumpMockmob(
      tester,
      PhoneFrame(
        child: Builder(
          builder: (context) {
            _slot = MmBarInsets.maybeOf(context)?.tonightMove;
            return TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero);
          },
        ),
      ),
      size: const Size(360, 640),
      textScale: 1.3,
      overrides: todayOverrides,
    );
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pump(const Duration(milliseconds: 100));
    final stack = tester.getSize(find.byType(TodayBody));
    final line = stack.height - (20 + 12 + 64.0);
    if (_slot!.value != null) {
      // The capsule's strip holds no paragraph of the page above the bar's line.
      for (final p in tester.renderObjectList<RenderParagraph>(find.descendant(of: find.byType(TodayBody), matching: find.byType(RichText)))) {
        final y = p.localToGlobal(Offset.zero).dy;
        final covered = y < line && y + p.size.height > line - 52;
        expect(covered, isFalse, reason: 'the capsule would cover "${p.text.toPlainText()}"');
      }
    }
  });
}
