// Goldens for the quick-start chooser built in the practice track (UI blitz, 14 Oct): the deck
// that replaces the five identical rows of "Pick today's work". The real sheet lives in
// lib/core/router/quick_start.dart; this frame draws the same title band over the deck so the
// merge can compare like with like.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/widgets/quick_start_deck.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

const Size _size = Size(384, 853);

ChoiceOption _o(String id, String title, String note, {String? tag}) =>
    ChoiceOption(id: id, glyph: QuickStartDeck.glyphFor(id), title: title, note: note, tag: tag, onTap: () {});

final _fresh = [
  _o('quick', 'Quick 10', '10 questions, about 10 minutes.'),
  _o('mock', 'Full mock', '50 questions, 60 minutes, timed like the exam.'),
  _o('nta', 'NTA mode', 'The exam-day screen in Business Studies: palette, Mark for Review.'),
  _o('repair', 'Repair the next mistake', 'A worked explanation for your next mistake, in Admission of a partner.'),
  _o('ask', 'Ask your record', 'Questions about your marks and chapters, answered from what you have done.'),
];

final _resume = [
  _o('resume', 'Resume Economics mock', 'Ends at 9:47 PM. 23 of 50 answered.'),
  _o('quick', 'Quick 10', '10 questions, about 10 minutes.'),
  _o('mock', 'Full mock', '50 questions, 60 minutes, timed like the exam.'),
  _o('nta', 'NTA mode, with Pro', 'The exam-day screen in Economics: palette, Mark for Review.'),
  _o('repair', 'Repair the next mistake', 'A worked explanation for your next mistake, in Goodwill.'),
];

/// The sheet as the dock's Start morphs into it: the page dimmed behind, the title band, the deck.
class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.title, required this.options});

  final String title;
  final List<ChoiceOption> options;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ColoredBox(
      color: colors.ground,
      child: Stack(
        children: [
          Positioned.fill(child: LightField.lamp(context, strength: 0.8)),
          Positioned.fill(child: ColoredBox(color: colors.scrim)),
          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: DecoratedBox(
              decoration: ShapeDecoration(
                color: colors.raised,
                shape: RoundedSuperellipseBorder(borderRadius: const BorderRadius.all(Radius.circular(32)), side: BorderSide(color: colors.line)),
                shadows: colors.glassShadow,
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: SizedBox(
                        width: 36,
                        height: 4,
                        child: DecoratedBox(decoration: BoxDecoration(color: colors.ink4, borderRadius: MmRadius.pillAll)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(child: Text(title, style: type.screenTitle.copyWith(fontSize: 24))),
                        const Mobi(pose: MobiPose.think, size: 52),
                      ],
                    ),
                    const SizedBox(height: 12),
                    QuickStartDeck(options: options),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  await settleImages(tester);
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';
    group('quick-start deck, ${b.name}', () {
      testWidgets('a fresh evening: Quick 10 leads, Ask closes quietly', (tester) async {
        await pumpMockmob(
          tester,
          _SheetFrame(title: "What's it going to be tonight?", options: _fresh),
          brightness: b,
          size: _size,
          wrapInScaffold: false,
          overrides: [hapticsProvider.overrideWithValue(const Haptics(enabled: false))],
        );
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/quick_start_deck_$tag.png'));
      });

      testWidgets('a mock still open: Resume leads, the rest pair up', (tester) async {
        await pumpMockmob(
          tester,
          _SheetFrame(title: "Pick today's work", options: _resume),
          brightness: b,
          size: _size,
          wrapInScaffold: false,
          overrides: [hapticsProvider.overrideWithValue(const Haptics(enabled: false))],
        );
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/quick_start_deck_resume_$tag.png'));
      });

      testWidgets('mid-press: the pressed tile sinks and its glyph plays', (tester) async {
        await pumpMockmob(
          tester,
          _SheetFrame(title: "Pick today's work", options: _fresh),
          brightness: b,
          size: _size,
          wrapInScaffold: false,
          overrides: [hapticsProvider.overrideWithValue(const Haptics(enabled: false))],
        );
        await _settle(tester);
        final gesture = await tester.startGesture(tester.getCenter(find.text('Full mock')));
        for (var i = 0; i < 6; i++) {
          await tester.pump(const Duration(milliseconds: 50));
        }
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/quick_start_deck_pressed_$tag.png'));
        await gesture.cancel();
        await tester.pump(const Duration(seconds: 1));
      });
    });
  }
}
