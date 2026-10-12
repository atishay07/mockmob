import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'night_support.dart';

Widget _opener(void Function(BuildContext context) open) {
  return GoldenRoom(
    child: Builder(
      builder: (context) => Align(
        alignment: const Alignment(0, -0.2),
        child: TextButton(onPressed: () => open(context), child: const Text('Open')),
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
      await tester.tap(find.text('Open'));
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
        overrides: [resumeOfferProvider.overrideWith((ref) async => null)],
      );
      await tester.tap(find.text('Open'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 60));
      }
      expect(find.text('Quick 10'), findsWidgets);
      expect(find.text('Full mock'), findsOneWidget);
      expect(find.text('Repair the next mistake'), findsOneWidget);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/quick_start_$tag.png'));
    });

    testWidgets('quick start mid-morph, $tag', (tester) async {
      await pumpMockmob(
        tester,
        _opener(_quickStart),
        brightness: brightness,
        size: kNightSize,
        overrides: [resumeOfferProvider.overrideWith((ref) async => null)],
      );
      await tester.tap(find.text('Open'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 110));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/quick_start_morph_$tag.png'));
      await tester.pump(const Duration(seconds: 1));
    });
  }
}
