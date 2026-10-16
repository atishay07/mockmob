import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/platform/device_corner.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'night_support.dart';

/// The worst case under the bar (GLASS-1017 A3 and A5): a volt key, paper-white art and a line
/// of text, with a bar-sized pane of each tier over it. The golden engine has no shader filter,
/// so its Full row is "Full without the shader" (the tier the app ships, build decision 1).
Widget _tiers() {
  return Builder(
    builder: (context) {
      final colors = context.mmColors;
      final type = context.mmType;
      Widget row(GlassTier tier) => SizedBox(
        height: 196,
        child: Stack(
          children: [
            Positioned(left: 16, top: 16, right: 16, child: Text('Financial Markets is where the most marks are open', style: type.small, maxLines: 1)),
            Positioned(
              left: 16,
              top: 52,
              width: 200,
              height: 52,
              child: DecoratedBox(
                decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll),
                child: Center(child: Text('Start repair, 10 min', style: type.label.copyWith(color: colors.voltInk))),
              ),
            ),
            const Positioned(right: 16, top: 48, width: 132, height: 92, child: ColoredBox(color: Color(0xFFFFFFFF))),
            Positioned(
              left: 12,
              right: 12,
              top: 84,
              height: 64,
              child: MmGlass(
                kind: GlassKind.bar,
                tier: tier,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    for (final (icon, label) in const [
                      (LucideIcons.sun, 'Today'),
                      (LucideIcons.layers, 'Practice'),
                      (LucideIcons.rotateCcw, 'Review'),
                      (LucideIcons.school, 'Colleges'),
                      (LucideIcons.user, 'You'),
                    ])
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(icon, size: 22, color: colors.ink2),
                          const SizedBox(height: 4),
                          Text(label, style: type.caption.copyWith(color: colors.ink2)),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
      return Column(
        children: [for (final tier in [GlassTier.full, GlassTier.fullBasic, GlassTier.lite, GlassTier.off]) row(tier)],
      );
    },
  );
}

const _openerKey = ValueKey('glass-opener');

Widget _opener(void Function(BuildContext context) open) {
  return GoldenRoom(
    child: Builder(
      builder: (context) => Align(
        alignment: const Alignment(0, -0.2),
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

void _days(BuildContext context, {double? heightFactor}) {
  showMmSheet<void>(
    context: context,
    title: 'Your study days',
    heightFactor: heightFactor,
    footer: (context) => KeyButton(label: 'Save days', onPressed: () {}),
    builder: (context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('4 days a week, 98 study days to the exam.', style: context.mmType.body.copyWith(color: context.mmColors.ink2)),
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
      ],
    ),
  );
}

/// A list scrolling under a floating "Ask Mobi" pill (G5), at [offset].
class _FloatingHeader extends StatefulWidget {
  const _FloatingHeader({required this.offset});

  final double offset;

  @override
  State<_FloatingHeader> createState() => _FloatingHeaderState();
}

class _FloatingHeaderState extends State<_FloatingHeader> {
  late final ScrollController _scroll = ScrollController(initialScrollOffset: widget.offset);

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Stack(
      children: [
        ListView(
          controller: _scroll,
          padding: const EdgeInsets.fromLTRB(16, 72, 16, 16),
          children: [
            Text('Practice', style: type.screenTitle),
            const SizedBox(height: 12),
            Container(
              height: 52,
              decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll),
              alignment: Alignment.center,
              child: Text('Start 10 questions', style: type.label.copyWith(color: colors.voltInk)),
            ),
            for (final (label, value) in const [
              ('Accountancy', '41 of 50 held'),
              ('Business Studies', '36 of 50 held'),
              ('Economics', '29 of 50 held'),
              ('English', '44 of 50 held'),
              ('General Test', '22 of 50 held'),
              ('Mathematics', '18 of 40 held'),
            ]) ...[
              const SizedBox(height: 12),
              SizedBox(
                height: 48,
                child: Row(children: [
                  Expanded(child: Text(label, style: type.labelLarge)),
                  Text(value, style: type.body.copyWith(color: colors.ink2)),
                ]),
              ),
            ],
          ],
        ),
        Positioned(
          right: 16,
          top: 12,
          child: MmGlassControl(
            scroll: _scroll,
            semanticsLabel: 'Ask Mobi',
            onTap: () {},
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons.messageCircle, size: 18, color: colors.ink),
              const SizedBox(width: 8),
              Text('Ask Mobi', style: type.label.copyWith(color: colors.ink)),
            ]),
          ),
        ),
      ],
    );
  }
}

void main() {
  setUpAll(loadAppFonts);
  setUp(() => DeviceCorner.debugRadius = null);

  nightGolden('glass_tiers', _tiers);
  nightGolden('glass_header_scroll0', () => const _FloatingHeader(offset: 0), size: const Size(384, 420));
  nightGolden('glass_header_scroll120', () => const _FloatingHeader(offset: 120), size: const Size(384, 420));

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    testWidgets('sheet floats at its partial detent, $tag', (tester) async {
      await pumpMockmob(tester, _opener(_days), brightness: brightness, size: kNightSize);
      await tester.tap(find.byKey(_openerKey));
      await tester.pumpAndSettle();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/sheet_partial_$tag.png'));
    });

    testWidgets('sheet fills at its full detent, $tag', (tester) async {
      await pumpMockmob(tester, _opener((c) => _days(c, heightFactor: 1)), brightness: brightness, size: kNightSize);
      await tester.tap(find.byKey(_openerKey));
      await tester.pumpAndSettle();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/sheet_full_$tag.png'));
    });

    testWidgets('sheet mid-materialise, $tag', (tester) async {
      await pumpMockmob(tester, _opener(_days), brightness: brightness, size: kNightSize);
      await tester.tap(find.byKey(_openerKey));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 126));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/sheet_materialise_$tag.png'));
      await tester.pumpAndSettle();
    });
  }

  testWidgets('sheet at large text is a solid page', (tester) async {
    await pumpMockmob(tester, _opener(_days), brightness: Brightness.dark, size: kNightSize, textScale: 1.5);
    await tester.tap(find.byKey(_openerKey));
    await tester.pumpAndSettle();
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/sheet_largetext.png'));
  });
}
