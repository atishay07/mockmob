// L1 (walk, 19 Oct): at text 1.6 the tab titles were cut to "Practi..." and "Your ...". A title wraps to two lines at its
// words, and a word wider than the room takes the largest size that holds it whole (never below the normal size).
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show TabRootHeader;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  setUpAll(loadAppFonts);

  for (final title in ['Practice', 'Your papers', 'Your Mob', 'Today']) {
    for (final scale in [1.0, 1.3, 1.6]) {
      testWidgets('"$title" at text $scale, 360 dp, with a trailing Ask Mobi key: whole, never cut', (tester) async {
        await pumpMockmob(
          tester,
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TabRootHeader(title: title, trailing: const SizedBox(width: 104, height: 44, child: ColoredBox(color: Colors.grey))),
          ),
          size: const Size(360, 640),
          textScale: scale,
          disableAnimations: true,
        );
        expect(tester.takeException(), isNull);
        final paragraph = tester.renderObject<RenderParagraph>(find.text(title));
        expect(paragraph.didExceedMaxLines, isFalse, reason: 'two lines are allowed');
        // No word is broken across lines: the title has no more lines than words.
        final words = title.split(' ');
        final lines = paragraph.getBoxesForSelection(TextSelection(baseOffset: 0, extentOffset: title.length)).length;
        expect(lines, lessThanOrEqualTo(words.length), reason: 'the title wraps at its words');
      });
    }
  }

  testWidgets('at the normal size a short title keeps its one line and its size', (tester) async {
    await pumpMockmob(
      tester,
      const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: TabRootHeader(title: 'Practice')),
      size: const Size(360, 640),
      disableAnimations: true,
    );
    final paragraph = tester.renderObject<RenderParagraph>(find.text('Practice'));
    expect(paragraph.getBoxesForSelection(const TextSelection(baseOffset: 0, extentOffset: 8)), hasLength(1));
    final text = tester.widget<Text>(find.text('Practice'));
    expect(text.textScaler!.scale(1), 1.0);
  });

  testWidgets('at 1.6 a word wider than the room is set at the largest size that holds it, not below the normal size', (tester) async {
    await pumpMockmob(
      tester,
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: TabRootHeader(title: 'Practice', trailing: const SizedBox(width: 104, height: 44)),
      ),
      size: const Size(360, 640),
      textScale: 1.6,
      disableAnimations: true,
    );
    final text = tester.widget<Text>(find.text('Practice'));
    final scale = text.textScaler!.scale(1);
    expect(scale, inInclusiveRange(1.0, 1.6));
    expect(scale, lessThan(1.6), reason: 'it had to give a little to stay whole beside the key');
  });
}
