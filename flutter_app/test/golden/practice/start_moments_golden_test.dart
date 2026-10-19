// Goldens for the owner's APK v8 notes on Practice and Start (15 Oct): the Practice tab's exam band
// (one NTA entry, its palette glyph inside its own tile) at the narrowest phone with large text
// and at the widest, and a Full mock's ticket as the stub tears and the stopwatch under it runs
// its turn.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/widgets/choice_deck.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/features/practice/widgets/composer_ticket.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

ChoiceOption _o(String id, ChoiceGlyphKind glyph, String title, String note, {String? tag}) =>
    ChoiceOption(id: id, glyph: glyph, title: title, note: note, tag: tag, onTap: () {});

/// The Practice tab's exam band and the Start sheet's NTA row, on the page ground.
class _ExamFrame extends StatelessWidget {
  const _ExamFrame();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // On a Material, as the tab and the sheet are, so text has its style.
    return Material(
      color: colors.ground,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ChoiceDeck(
                animateIn: false,
                bleed: MmSpace.gutter,
                rows: [
                  ChoiceRow.band(
                    title: 'Exam conditions',
                    rows: [
                      ChoiceRow.pair(
                        _o('full', ChoiceGlyphKind.mock, 'Full mock', '50 questions in 60 minutes, timed like the exam.'),
                        _o('nta', ChoiceGlyphKind.nta, 'NTA mode', 'Comes with Pro. A Full mock is open to you now.', tag: 'Pro'),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A Full mock's ticket whose Start sequence the test drives through [tear].
class _TicketFrame extends StatelessWidget {
  const _TicketFrame({required this.tear, this.nta = false});

  final ValueNotifier<TicketTear> tear;

  /// NTA mode's ticket instead: the exam sheet under the stub.
  final bool nta;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.mmColors.ground,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: ValueListenableBuilder<TicketTear>(
            valueListenable: tear,
            builder: (context, value, _) => ComposerTicket(
              subjectId: 'accountancy',
              eyebrow: nta ? 'NTA mode' : 'Mock 7',
              subject: 'Accountancy',
              count: 50,
              semanticsLabel: 'Mock 7, Accountancy',
              tear: value,
              clock: !nta,
              examSheet: nta,
            ),
          ),
        ),
      ),
    );
  }
}

void main() {
  setUpAll(loadAppFonts);
  final haptics = [hapticsProvider.overrideWithValue(const Haptics(enabled: false))];

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';
    group('practice start moments, ${b.name}', () {
      testWidgets('the exam band at 360 dp with large text', (tester) async {
        await pumpMockmob(
          tester,
          const _ExamFrame(),
          brightness: b,
          size: const Size(360, 520),
          textScale: 1.3,
          wrapInScaffold: false,
          overrides: haptics,
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/exam_band_360_large_$tag.png'));
      });

      testWidgets('the exam band at 430 dp', (tester) async {
        await pumpMockmob(tester, const _ExamFrame(), brightness: b, size: const Size(430, 380), wrapInScaffold: false, overrides: haptics);
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/exam_band_430_$tag.png'));
      });

      testWidgets('a Full mock starts: the stub tears and the stopwatch runs its turn', (tester) async {
        final tear = ValueNotifier(TicketTear.rest);
        addTearDown(tear.dispose);
        await pumpMockmob(
          tester,
          _TicketFrame(tear: tear),
          brightness: b,
          size: const Size(384, 260),
          wrapInScaffold: false,
          overrides: haptics,
        );
        tear.value = TicketTear.lifted;
        await tester.pump(const Duration(milliseconds: 200));
        tear.value = TicketTear.torn;
        await tester.pump();
        // The five-frame sheet of the turn (AP2-01; 19 Oct H4): the stub gone and the dial in,
        // still, at 240 ms, the hand on its way at 500, past the bottom near 800, resting on 12
        // at 1140 when the paper opens.
        var at = 0;
        for (final ms in const [0, 240, 500, 800, 1140]) {
          await tester.pump(Duration(milliseconds: ms - at));
          at = ms;
          await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/mock_start_lap_${ms}ms_$tag.png'));
        }
      });
      testWidgets('NTA mode starts: the exam sheet slides in and the mark settles', (tester) async {
        final tear = ValueNotifier(TicketTear.rest);
        addTearDown(tear.dispose);
        await pumpMockmob(
          tester,
          _TicketFrame(tear: tear, nta: true),
          brightness: b,
          size: const Size(384, 260),
          wrapInScaffold: false,
          overrides: haptics,
        );
        tear.value = TicketTear.lifted;
        await tester.pump(const Duration(milliseconds: 200));
        tear.value = TicketTear.torn;
        await tester.pump();
        // The sheet nearly in, the mark on its way down.
        await tester.pump(const Duration(milliseconds: 240));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/nta_start_mid_$tag.png'));
        await tester.pump(const Duration(milliseconds: 400));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/nta_start_landed_$tag.png'));
      });
    });
  }
}
