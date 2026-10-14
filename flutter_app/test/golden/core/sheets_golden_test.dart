import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'frame_sequence.dart';
import 'night_support.dart';

const _openerKey = ValueKey('golden-opener');

Widget _opener(void Function(BuildContext context) open) {
  return GoldenRoom(
    child: Builder(
      builder: (context) => Align(
        alignment: const Alignment(0, -0.2),
        // An invisible opener: the golden pictures the sheet, never a stray button label.
        child: GestureDetector(
          key: _openerKey,
          behavior: HitTestBehavior.opaque,
          onTap: () => open(context),
          child: const SizedBox(width: 120, height: 48),
        ),
      ),
    ),
  );
}

void _sheet(BuildContext context) {
  showMmSheet<void>(
    context: context,
    title: 'This week',
    builder: (context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Three study days so far. Rest days keep the light.', style: context.mmType.body.copyWith(color: context.mmColors.ink2)),
        const SizedBox(height: 16),
        WeekBubbles(days: const [
          WeekBubbleDay(mark: WeekDayMark.done),
          WeekBubbleDay(mark: WeekDayMark.done),
          WeekBubbleDay(mark: WeekDayMark.rest),
          WeekBubbleDay(mark: WeekDayMark.done, isToday: true),
          WeekBubbleDay(),
          WeekBubbleDay(),
          WeekBubbleDay(mark: WeekDayMark.rest),
        ]),
        const SizedBox(height: 20),
        KeyButton(label: 'Change my goal', onPressed: () {}),
      ],
    ),
  );
}

void _quickStart(BuildContext context) {
  Navigator.of(context).push(
    MorphSheetRoute<void>(
      origin: const Rect.fromLTWH(300, 760, 60, 60),
      scrim: context.mmColors.scrim,
      reduced: false,
      builder: (context) => const QuickStartSheet(),
    ),
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    testWidgets('glass sheet, $tag', (tester) async {
      await pumpMockmob(tester, _opener(_sheet), brightness: brightness, size: kNightSize);
      await tester.tap(find.byKey(_openerKey));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 60));
      }
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/sheet_$tag.png'));
    });

    testWidgets('quick start, $tag', (tester) async {
      await pumpMockmob(
        tester,
        _opener(_quickStart),
        brightness: brightness,
        size: kNightSize,
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
          nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 10)),
          quickStartRepairProvider.overrideWithValue(const QuickRepair(location: '/review', chapter: 'Partnership fundamentals')),
          // The full house: Quick 10 as the hero, Full mock and NTA mode as the two tiles, Repair
          // and Ask in the grouped list (five choices, never more).
          quickStartNtaProvider.overrideWithValue(const QuickNta(location: '/exam/nta', subject: 'accountancy', proOnly: false)),
        ],
      );
      await tester.tap(find.byKey(_openerKey));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 60));
      }
      expect(find.text('Quick 10'), findsWidgets);
      expect(find.text('Full mock'), findsOneWidget);
      expect(find.text('NTA mode'), findsOneWidget);
      expect(find.text('Repair the next mistake'), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/quick_start_$tag.png'));
    });

    testWidgets('quick start mid-morph, $tag', (tester) async {
      await pumpMockmob(
        tester,
        _opener(_quickStart),
        brightness: brightness,
        size: kNightSize,
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
          nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 10)),
          quickStartRepairProvider.overrideWithValue(const QuickRepair(location: '/review', chapter: 'Partnership fundamentals')),
          // The full house: Quick 10 as the hero, Full mock and NTA mode as the two tiles, Repair
          // and Ask in the grouped list (five choices, never more).
          quickStartNtaProvider.overrideWithValue(const QuickNta(location: '/exam/nta', subject: 'accountancy', proOnly: false)),
        ],
      );
      await tester.tap(find.byKey(_openerKey));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 110));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/quick_start_morph_$tag.png'));
      await tester.pump(const Duration(seconds: 1));
    });

    // The whole opening, frame by frame (0, 50, 100, 150, 210, 290, 420 and 700 ms; two rows of
    // four): the glass is glass from the first frame, the disc is gone by a quarter of the way,
    // the rows arrive in order after the shape has opened, and Mobi points at the first row
    // once it has landed.
    testWidgets('quick start opening (frames), $tag', (tester) async {
      await pumpMockmob(
        tester,
        _opener(_quickStart),
        brightness: brightness,
        size: kNightSize,
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
          nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 10)),
          quickStartRepairProvider.overrideWithValue(const QuickRepair(location: '/review', chapter: 'Partnership fundamentals')),
          quickStartNtaProvider.overrideWithValue(const QuickNta(location: '/exam/nta', subject: 'accountancy', proOnly: false)),
        ],
      );
      await tester.tap(find.byKey(_openerKey));
      await tester.pump();
      final sheet = await frameSheet(
        tester,
        root: find.byType(MaterialApp),
        atMs: const [0, 50, 100, 150, 210, 290, 420, 700],
        scale: 0.5,
        columns: 4,
      );
      await expectLater(sheet, matchesGoldenFile('goldens/quick_start_frames_$tag.png'));
      await tester.pump(const Duration(seconds: 1));
    });

    // Mobi once the sheet has landed: weighing the choice (thinking, hand at chin), then
    // pointing at the first row (frames at 400, 520, 640, 800, 1000 and 1400 ms after the tap, 2x).
    testWidgets('quick start mobi points (frames), $tag', (tester) async {
      await pumpMockmob(
        tester,
        _opener(_quickStart),
        brightness: brightness,
        size: kNightSize,
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
          nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 10)),
          quickStartRepairProvider.overrideWithValue(const QuickRepair(location: '/review', chapter: 'Partnership fundamentals')),
          quickStartNtaProvider.overrideWithValue(const QuickNta(location: '/exam/nta', subject: 'accountancy', proOnly: false)),
        ],
      );
      await tester.tap(find.byKey(_openerKey));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      final mobi = tester.getRect(find.byType(Mobi));
      final sheet = await frameSheet(
        tester,
        root: find.byType(MaterialApp),
        atMs: const [0, 120, 240, 400, 600, 1000],
        crop: Rect.fromLTRB(mobi.left - 70, mobi.top - 10, mobi.right + 20, mobi.bottom + 40),
        pixelRatio: 2,
        layerScale: 2,
        columns: 6,
      );
      await expectLater(sheet, matchesGoldenFile('goldens/quick_start_mobi_$tag.png'));
      await tester.pump(const Duration(seconds: 2));
    });
  }
}
