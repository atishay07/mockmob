// The stage's frame, ticks and keys: the top bar (one row: Close with its word, the ticks, the counter that opens This feed;
// under it the chapter's name and its 2.4 s note; no kept count), the action bar (56 | 1fr | 56, wide for the checkpoint), the
// ticks (segments, the 48+ bar, the loading hairline, the fill of the current one), the side key (on, pop, busy, the card-stack
// glyph), the step key (volt or line, its lip, the 300 ms double-tap guard, the commit haptic, later, a second line), 48 dp
// targets and text scale 1.3 at 360 dp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/mm_spinner.dart';
import 'package:mockmob/features/learn2/stage/stage_frame.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_ticks.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_harness.dart';

class _Taps {
  int close = 0;
  int counter = 0;
  int keep = 0;
  int chapter = 0;
  int step = 0;
}

Widget _frame(_Taps taps, {String? note, bool wide = false, int of = 21, String title = 'Admission of a Partner'}) => StageFrame(
  label: 'Admission of a Partner feed',
  onClose: () => taps.close++,
  closeLabel: 'Close the feed',
  title: title,
  titleNote: note,
  ticks: StageTicks(total: of, done: 4, current: 4),
  position: 5,
  of: of,
  onCounter: () => taps.counter++,
  counterLabel: '5 of $of. Open the list of this feed',
  left: wide ? null : StageSideKey(mark: (color) => StageCardStack(color: color), label: 'Revise later', onTap: () => taps.keep++),
  right: wide ? null : StageSideKey(icon: LucideIcons.bookOpen, label: 'Chapter', onTap: () => taps.chapter++),
  wide: wide,
  main: wide
      ? [
          StageStepKey(label: 'Stop here', tone: StageTone.line, onTap: () {}),
          StageStepKey(label: 'Keep going', onTap: () => taps.step++),
        ]
      : [StageStepKey(label: 'Turn over', haptic: false, onTap: () => taps.step++)],
  child: const Center(child: Text('the item')),
);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the top bar and the action bar sit where the web puts them on a phone', (tester) async {
    final taps = _Taps();
    await pumpStage(tester, _frame(taps), padding: const EdgeInsets.only(top: 24, bottom: 16));
    // One 44 dp row 4 dp under the safe top: Close (the X and the word), the ticks, the counter, 12 dp apart; then the
    // chapter's name on its own 20 dp line.
    final close = tester.getRect(find.byType(StageCloseKey));
    expect(close.top, 24 + 4);
    expect(close.height, 44);
    expect(close.left, 6, reason: 'the X lines up with the 16 dp gutter');
    expect(find.text('Close'), findsOneWidget, reason: 'the X comes with its word');
    final ticks = tester.getRect(find.byType(StageTicks));
    expect(ticks.height, 2);
    expect(ticks.center.dy, close.center.dy, reason: 'the ticks are centred in the row');
    expect(ticks.left, close.right + 12);
    final counter = tester.getRect(find.byType(StageCounter));
    expect(ticks.right, counter.left - 12);
    expect(counter.right, 360 - 16 + 8, reason: 'its words end on the gutter');
    final title = tester.getRect(find.text('Admission of a Partner'));
    expect(title.center.dy, close.bottom + 10, reason: 'the 20 dp line under the row');
    expect(title.left, 16);
    // The action bar: 56 | 1fr | 56 with 12 dp gaps, 16 at the sides, the safe bottom + 8.
    final keep = tester.getRect(find.byType(StageSideKey).first);
    final step = tester.getRect(find.byType(StageStepKey));
    final chapter = tester.getRect(find.byType(StageSideKey).last);
    expect(keep.left, 16);
    expect(keep.width, 56);
    expect(step.left, 16 + 56 + 12);
    expect(step.right, 360 - 16 - 56 - 12);
    expect(step.height, 52);
    expect(chapter.right, 344);
    expect(tester.getRect(find.text('the item')).center.dy, greaterThan(close.bottom));
    expect(800 - 16 - 8 - step.bottom, greaterThanOrEqualTo(0));

    await tester.tap(find.byType(StageCloseKey));
    await tester.tap(find.byType(StageCounter));
    await tester.tap(find.byType(StageSideKey).first);
    await tester.tap(find.byType(StageSideKey).last);
    await tester.tap(find.byType(StageStepKey));
    await tester.pump();
    expect([taps.close, taps.counter, taps.keep, taps.chapter, taps.step], [1, 1, 1, 1, 1]);
  });

  testWidgets('the counter reads "5 of 21" with a chevron and opens This feed', (tester) async {
    final handle = tester.ensureSemantics();
    final taps = _Taps();
    await pumpStage(tester, _frame(taps));
    expect(find.bySemanticsLabel('5 of 21. Open the list of this feed'), findsOneWidget);
    expect(find.byIcon(LucideIcons.chevronDown), findsOneWidget);
    await tester.tap(find.byType(StageCounter));
    expect(taps.counter, 1);
    handle.dispose();
  });

  testWidgets('a title note stands in for the title for 2.4 s', (tester) async {
    final taps = _Taps();
    await pumpStage(tester, _frame(taps, note: 'Carrying on from 7 of 21'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Carrying on from 7 of 21'), findsOneWidget);
    expect(find.text('Admission of a Partner'), findsNothing);
    await tester.pump(const Duration(milliseconds: 2200));
    await tester.pumpAndSettle();
    expect(find.text('Admission of a Partner'), findsOneWidget);
    expect(find.text('Carrying on from 7 of 21'), findsNothing);
  });

  testWidgets('wide: the middle takes the whole bar for two keys, 10 dp apart', (tester) async {
    final taps = _Taps();
    await pumpStage(tester, _frame(taps, wide: true));
    final keys = find.byType(StageStepKey);
    final a = tester.getRect(keys.first);
    final b = tester.getRect(keys.last);
    expect(a.left, 16);
    expect(b.right, 344);
    expect(b.left - a.right, 10);
    expect(a.width, b.width);
    expect(find.byType(StageSideKey), findsNothing);
  });

  testWidgets('the end layer: the frame fades out under it and stops taking taps', (tester) async {
    final taps = _Taps();
    await pumpStage(
      tester,
      StageFrame(label: 'x', onClose: () => taps.close++, end: const ColoredBox(color: Color(0xFF000000), child: Center(child: Text('the end')))),
    );
    await tester.pumpAndSettle();
    expect(find.text('the end'), findsOneWidget);
    final fade = tester.widget<AnimatedOpacity>(find.ancestor(of: find.byType(StageTopBar), matching: find.byType(AnimatedOpacity)));
    expect(fade.opacity, 0);
  });

  group('ticks', () {
    Color fillOf(WidgetTester tester, int i) => tester.widgetList<ColoredBox>(find.descendant(of: find.byType(StageTicks), matching: find.byType(ColoredBox))).elementAt(i).color;

    testWidgets('one segment per item: done brand green (R4 owner: greener feeds), the current one filling volt, the rest ahead', (tester) async {
      await pumpStage(tester, const Padding(padding: EdgeInsets.all(16), child: StageTicks(total: 6, done: 2, current: 2)));
      final colors = MmColors.dark;
      final segs = find.descendant(of: find.byType(StageTicks), matching: find.byType(ClipRRect));
      expect(segs, findsNWidgets(6));
      final widths = [for (var i = 0; i < 6; i++) tester.getSize(segs.at(i)).width];
      expect(widths.toSet(), hasLength(1), reason: 'equal segments');
      expect(tester.getRect(segs.at(1)).left - tester.getRect(segs.at(0)).right, 3, reason: '3 dp gaps');
      expect(tester.getSize(segs.at(0)).height, 2);
      // Night dims the finished green so it stays apart from the full-volt fill of the current one.
      final done = colors.accentText.withValues(alpha: 0.6);
      expect(fillOf(tester, 0), done);
      expect(fillOf(tester, 1), done);
      expect(fillOf(tester, 0), isNot(colors.volt));
      expect(fillOf(tester, 2), StageTicks.ahead(colors));
      expect(fillOf(tester, 3), colors.volt, reason: 'the current fill');
    });

    testWidgets('the ahead colour is ink at 34% on Night and 42% on Day', (tester) async {
      expect(StageTicks.ahead(MmColors.dark).a, closeTo(0.34, 0.005));
      expect(StageTicks.ahead(MmColors.light).a, closeTo(0.42, 0.005));
    });

    testWidgets('the current fill grows over 300 ms when the item changes', (tester) async {
      await pumpStage(tester, const StageTicks(total: 4, done: 0, current: 0));
      await pumpStage(tester, const StageTicks(total: 4, done: 1, current: 1));
      await tester.pump(const Duration(milliseconds: 60));
      final t = tester.widgetList<Transform>(find.descendant(of: find.byType(StageTicks), matching: find.byType(Transform))).single;
      expect(t.transform.entry(0, 0), inExclusiveRange(0, 1));
      await tester.pump(const Duration(milliseconds: 300));
      final done = tester.widgetList<Transform>(find.descendant(of: find.byType(StageTicks), matching: find.byType(Transform))).single;
      expect(done.transform.entry(0, 0), 1);
    });

    testWidgets('over 48 items one bar; 0 items one hairline', (tester) async {
      await pumpStage(tester, const StageTicks(total: 60, done: 30, current: 29));
      await tester.pumpAndSettle();
      expect(find.descendant(of: find.byType(StageTicks), matching: find.byType(ClipRRect)), findsOneWidget);
      final t = tester.widget<Transform>(find.descendant(of: find.byType(StageTicks), matching: find.byType(Transform)));
      expect(t.transform.entry(0, 0), closeTo(0.5, 0.001));
      await pumpStage(tester, const StageTicks());
      expect(find.descendant(of: find.byType(StageTicks), matching: find.byType(Transform)), findsNothing);
      expect(tester.getSize(find.byType(StageTicks)).height, 2);
    });
  });

  group('keys', () {
    testWidgets('the side key: the card stack is ink, then a check in the select colour once it is on; the bookmark fills; pop swells it; busy waits', (tester) async {
      await pumpStage(tester, Center(child: StageSideKey(mark: (color) => StageCardStack(color: color), label: 'Revise later', onTap: () {})));
      expect(tester.widget<StageCardStack>(find.byType(StageCardStack)).color, MmColors.dark.ink);
      expect(find.text('Revise later'), findsOneWidget);
      await pumpStage(tester, Center(child: StageSideKey(icon: LucideIcons.check, label: 'In Revise', on: true, onTap: () {})));
      expect(find.byType(StageCardStack), findsNothing);
      expect(tester.widget<Icon>(find.byIcon(LucideIcons.check)).color, MmColors.dark.volt);
    });

    testWidgets('the side key: on fills the bookmark in volt and inks the label; pop swells it; busy waits', (tester) async {
      var taps = 0;
      Widget key({bool on = false, bool busy = false}) => Center(
        child: StageSideKey(icon: LucideIcons.bookmark, label: on ? 'Kept' : 'Keep', on: on, pop: on, busy: busy, onTap: () => taps++),
      );
      await pumpStage(tester, key());
      final off = tester.widget<StageBookmark>(find.byType(StageBookmark));
      expect(off.filled, isFalse);
      await pumpStage(tester, key(on: true));
      await tester.pump(const Duration(milliseconds: 90));
      final pop = tester.widgetList<Transform>(find.descendant(of: find.byType(StageSideKey), matching: find.byType(Transform))).map((t) => t.transform.entry(0, 0));
      expect(pop.any((s) => s > 1.05), isTrue, reason: 'it swells toward 1.15 as it turns on');
      await tester.pumpAndSettle();
      final on = tester.widget<StageBookmark>(find.byType(StageBookmark));
      expect(on.filled, isTrue);
      expect(on.color, MmColors.dark.volt);
      expect(tester.widget<Text>(find.text('Kept')).style?.color, MmColors.dark.ink);
      await pumpStage(tester, key(busy: true));
      expect(find.byType(MmSpinner), findsOneWidget);
      await tester.tap(find.byType(StageSideKey));
      expect(taps, 0, reason: 'a busy key waits');
    });

    testWidgets('the step key: volt on its lip, the line key without; one commit per 300 ms; the commit haptic', (tester) async {
      final haptics = StageHaptics();
      var taps = 0;
      await pumpStage(
        tester,
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              StageStepKey(label: 'Next', onTap: () => taps++),
              const SizedBox(height: 20),
              StageStepKey(label: 'Skip', tone: StageTone.line, onTap: () {}),
            ],
          ),
        ),
        haptics: haptics,
      );
      final volt = tester.widgetList<DecoratedBox>(find.descendant(of: find.byType(StageStepKey).first, matching: find.byType(DecoratedBox))).first;
      final decoration = volt.decoration as ShapeDecoration;
      expect(decoration.color, MmColors.dark.volt);
      expect(decoration.shadows!.single.offset, const Offset(0, 3), reason: 'the 3 dp lip');
      final line = tester.widgetList<DecoratedBox>(find.descendant(of: find.byType(StageStepKey).last, matching: find.byType(DecoratedBox))).first;
      expect((line.decoration as ShapeDecoration).color, MmColors.dark.raised);
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(taps, 1, reason: 'a double tap commits once');
      expect(haptics.calls, ['light']);
      await tester.tap(find.text('Next'));
      await tester.pump();
      expect(taps, 2);
    });

    testWidgets('a step key can carry a second line (the end\'s next chapter)', (tester) async {
      await pumpStage(tester, Center(child: StageStepKey(label: 'Next chapter · 10 min', sub: 'Goodwill: Nature and Valuation', minHeight: 56, onTap: () {})));
      expect(find.text('Next chapter · 10 min'), findsOneWidget);
      expect(find.text('Goodwill: Nature and Valuation'), findsOneWidget);
      expect(tester.getSize(find.byType(StageStepKey)).height, greaterThanOrEqualTo(56));
    });

    testWidgets('a later step key fades in after 260 ms', (tester) async {
      await pumpStage(tester, Center(child: StageStepKey(label: 'Next', later: true, onTap: () {})));
      double shown() => tester.widget<Opacity>(find.descendant(of: find.byType(StageStepKey), matching: find.byType(Opacity)).first).opacity;
      await tester.pump(const Duration(milliseconds: 200));
      expect(shown(), 0, reason: 'still waiting at 200 ms');
      await tester.pump(const Duration(milliseconds: 140));
      expect(shown(), inExclusiveRange(0, 1), reason: 'fading in');
      await tester.pump(const Duration(milliseconds: 200));
      expect(shown(), 1);
    });
  });

  testWidgets('48 dp targets, every target labelled; text scale 1.3 at 360 dp fits', (tester) async {
    final handle = tester.ensureSemantics();
    final taps = _Taps();
    await pumpStage(tester, _frame(taps));
    await tester.pumpAndSettle();
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    expect(find.bySemanticsLabel('Close the feed'), findsOneWidget);
    handle.dispose();
    await pumpStage(tester, _frame(taps, of: 120, title: 'Accounting for Share Capital and Debentures'), textScale: 1.3);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(
      tester.getSize(find.text('Accounting for Share Capital and Debentures')).height,
      closeTo(26, 0.5),
      reason: "the chapter's line grows with the text (20 dp at 1, 26 at 1.3), so its words are not clipped",
    );
    await pumpStage(tester, _frame(taps, wide: true), textScale: 1.3);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
