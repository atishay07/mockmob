// The one end screen of a session (LK31, R2 ruling 5, R3-SPEC L5): the Close row (the X and its word), the chapter's name, the
// headline with Mobi, the small fan of the cards sent to Revise (up to four, the top one with its kind and a whole-word front),
// one row of up to three numbers that count up, the chapter's bar that grows, then the key group pinned to the foot: Free's one
// line, the one main key (with a second line inside it), the one quiet link. Loading has the final shape, an error offers Try
// again and never invents a number. Text scale 1.3 at 360 dp fits.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/stage_end_model.dart';
import 'package:mockmob/features/learn2/stage/stage_free_used.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_harness.dart';

const _cards = [
  StagePileCard(label: 'Definition', front: 'What is the sacrificing ratio?'),
  StagePileCard(label: 'Formula', front: "An old partner's new share"),
  StagePileCard(label: 'Key line', front: 'Goodwill, if existing in the books of the firm, it is ____ at the time of admission of a partner.'),
];

class _Taps {
  int main = 0;
  int quiet = 0;
  int close = 0;
  int retry = 0;
}

Widget _end(
  _Taps taps, {
  List<StagePileCard>? pile = _cards,
  bool loading = false,
  StageEndError? error,
  String? free,
  String headline = '18 done in 12 min',
  List<EndNumber>? numbers,
  EndProgress? progress = (from: 0.2, to: 0.45, label: '20 of 45 cards seen'),
}) => EndScreen(
  close: StageCloseKey(onTap: () => taps.close++, semanticsLabel: 'Close the feed'),
  chapter: 'Admission of a Partner',
  headline: headline,
  mobi: 'nod',
  pile: pile,
  numbers: numbers ??
      [
        (value: '14', n: 14, label: 'in Revise, back Wed'),
        (value: '1 of 2', n: 1, label: 'questions right'),
        (value: '2', n: 2, label: 'open mistakes fixed'),
      ],
  progress: progress,
  free: free,
  main: StageEndKey(label: 'Next chapter · 10 min', sub: 'Retirement and Death of a Partner', onTap: () => taps.main++),
  quiet: StageTextKey(label: 'Fix 2 open mistakes · 2 min', onTap: () => taps.quiet++),
  loading: loading,
  error: error,
  onRetry: () => taps.retry++,
  retryKeys: [StageTextKey(label: 'Back to Explore', quiet: true, onTap: () {})],
);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the end reads top to bottom: Close, the chapter, the headline, the fan, the numbers, the bar, the keys', (tester) async {
    final taps = _Taps();
    await pumpStage(tester, _end(taps));
    await tester.pumpAndSettle();
    final close = tester.getRect(find.byType(StageCloseKey));
    expect(close.left, 6, reason: 'the X lines up with the 16 dp gutter');
    expect(find.text('Close'), findsOneWidget);
    final chapter = tester.getRect(find.text('Admission of a Partner'));
    final headline = tester.getRect(find.text('18 done in 12 min'));
    final fan = tester.getRect(find.byType(StageKeptFan));
    final nums = tester.getRect(find.text('questions right'));
    final bar = tester.getRect(find.text('20 of 45 cards seen'));
    final main = tester.getRect(find.byType(StageEndKey));
    final quiet = tester.getRect(find.text('Fix 2 open mistakes · 2 min'));
    expect(
      [close.bottom, chapter.top, headline.top, fan.top, nums.top, bar.top, main.top, quiet.top],
      orderedEquals([...[close.bottom, chapter.top, headline.top, fan.top, nums.top, bar.top, main.top, quiet.top]]..sort()),
      reason: 'top to bottom',
    );
    expect(chapter.left, 16);
    expect(find.byType(StageMobi), findsOneWidget);
    expect(tester.getRect(find.byType(StageMobi)).right, lessThanOrEqualTo(360 - 16 + 1), reason: 'Mobi sits at the headline\'s right');
    // The key group is pinned to the foot: 24 dp under the quiet link's box at the least.
    expect(main.height, greaterThanOrEqualTo(56));
    expect(main.left, 16);
    expect(main.right, 344);
    expect(800 - tester.getRect(find.ancestor(of: find.text('Fix 2 open mistakes · 2 min'), matching: find.byType(StageTextKey))).bottom, greaterThanOrEqualTo(24));
    await tester.tap(find.text('Next chapter · 10 min'));
    await tester.tap(find.text('Fix 2 open mistakes · 2 min'));
    await tester.tap(find.text('Close'));
    await tester.pump();
    expect([taps.main, taps.quiet, taps.close], [1, 1, 1]);
    expect(find.text('Retirement and Death of a Partner'), findsOneWidget, reason: 'the next chapter\'s name is inside the main key');
    for (final gone in ['kept', 'Cards', 'Old mistakes', 'Back to Explore', 'Another 10 minutes']) {
      expect(find.textContaining(gone), findsNothing, reason: '"$gone" is not on the end');
    }
  });

  testWidgets('the content group is centred between the close row and the keys', (tester) async {
    await pumpStage(tester, _end(_Taps(), pile: null, numbers: const [(value: '2', n: 2, label: 'questions tried')], progress: null));
    await tester.pumpAndSettle();
    final close = tester.getRect(find.byType(StageCloseKey));
    final main = tester.getRect(find.byType(StageEndKey));
    final group = tester.getRect(find.text('Admission of a Partner')).expandToInclude(tester.getRect(find.text('questions tried')));
    final above = group.top - close.bottom;
    final below = main.top - group.bottom;
    expect((above - below).abs(), lessThan(28 + 8), reason: 'equal space above and below, within the body\'s own 8 and 28 dp padding');
  });

  testWidgets('the numbers count up over 300 ms; the bar grows over 600 ms; both are final under reduced motion', (tester) async {
    await pumpStage(tester, _end(_Taps()));
    await tester.pump();
    expect(find.text('0'), findsWidgets, reason: 'the figures start at 0');
    await tester.pump(const Duration(milliseconds: 150));
    final mid = tester.widgetList<Text>(find.byWidgetPredicate((w) => w is Text && RegExp(r'^\d+$').hasMatch(w.data ?? ''))).map((t) => int.parse(t.data!)).toList();
    expect(mid.any((n) => n > 0 && n < 14), isTrue, reason: 'the 14 is on its way');
    await tester.pumpAndSettle();
    expect(find.text('14'), findsOneWidget);
    expect(find.text('1 of 2'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    // The bar: from 20% to 45% of its width.
    final barBox = find.descendant(of: find.byType(ClipRRect), matching: find.byType(FractionallySizedBox));
    expect(tester.widget<FractionallySizedBox>(barBox.last).widthFactor, closeTo(0.45, 0.001));

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _end(_Taps()), reduced: true);
    await tester.pump();
    expect(find.text('14'), findsOneWidget, reason: 'no count-up under reduced motion');
    expect(tester.widget<FractionallySizedBox>(find.descendant(of: find.byType(ClipRRect), matching: find.byType(FractionallySizedBox)).last).widthFactor, closeTo(0.45, 0.001));
  });

  testWidgets('Free after the day\'s session: one quiet line right above the keys', (tester) async {
    await pumpStage(tester, _end(_Taps(), free: "That was today's free session. Questions come back tomorrow."));
    await tester.pumpAndSettle();
    final line = tester.getRect(find.text("That was today's free session. Questions come back tomorrow."));
    final main = tester.getRect(find.byType(StageEndKey));
    expect(line.bottom, lessThanOrEqualTo(main.top));
    expect(main.top - line.bottom, lessThan(16), reason: 'directly above the keys');
  });

  testWidgets('the fan: up to four small cards, the top one with its kind and a whole-word front, the others hairlines', (tester) async {
    await pumpStage(tester, const Center(child: StageKeptFan(cards: _cards, small: true, height: 132)));
    await tester.pumpAndSettle();
    expect(find.text('Key line'), findsOneWidget, reason: 'the top card shows its kind');
    expect(find.text('Definition'), findsNothing, reason: 'the cards behind show hairlines only');
    final front = find.textContaining('Goodwill, if existing');
    final text = tester.widget<Text>(front).data!;
    expect(text, StageEndModel.miniFront(_cards.last.front, max: 54));
    expect(text.endsWith('…'), isTrue);
    expect(text.length, lessThanOrEqualTo(55));
    expect(tester.widget<Text>(front).maxLines, 3);
    expect(tester.getSize(find.byType(StageKeptFan)).width, 260);
  });

  testWidgets('the fan opens one frame after it is drawn: 220 ms, 40 ms steps, fanned by 7 degrees and 0.75 x 26 dp', (tester) async {
    await pumpStage(tester, const Center(child: StageKeptFan(cards: [StagePileCard(label: 'A', front: 'a'), StagePileCard(label: 'B', front: 'b'), StagePileCard(label: 'C', front: 'c')], small: true)));
    List<double> xs() => [
      for (final t in tester.widgetList<Transform>(find.descendant(of: find.byType(StageKeptFan), matching: find.byType(Transform))))
        if (t.transform.getTranslation().x != 0 || t.transform.entry(0, 1) == 0) t.transform.getTranslation().x,
    ];
    expect(xs().every((x) => x == 0), isTrue, reason: 'closed on the first frame');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    final open = xs().where((x) => x != 0).toList()..sort();
    expect(open, [moreOrLessEquals(-19.5), moreOrLessEquals(19.5)]);
  });

  testWidgets('the loading end has the final shape; an error offers Try again and never invents a number', (tester) async {
    final handle = tester.ensureSemantics();
    final taps = _Taps();
    await pumpStage(tester, _end(taps, loading: true));
    await tester.pump();
    expect(find.bySemanticsLabel('Adding it up'), findsWidgets);
    expect(find.text('14'), findsNothing);
    expect(find.byType(StageCloseKey), findsOneWidget, reason: 'Close is the only way out, so the loading end keeps it');
    expect(find.byType(StageEndKey), findsNothing);

    await pumpStage(tester, _end(taps, error: (title: 'Your feed is saved', line: 'The summary didn\'t load, but everything you did is saved.')));
    await tester.pumpAndSettle();
    expect(find.text('Your feed is saved'), findsOneWidget);
    expect(find.text('The summary didn\'t load, but everything you did is saved.'), findsOneWidget);
    expect(find.text('14'), findsNothing, reason: 'never invented numbers');
    expect(find.text('Back to Explore'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    expect(taps.retry, 1);
    handle.dispose();
  });

  testWidgets('a pile card from the server\'s short card: its kind label and its front as a card shows it', (tester) async {
    final card = StagePileCard.of(kind: 'formula', front: 'Formula: Current ratio');
    expect(card.label, 'Formula');
    expect(card.front, 'Current ratio');
  });

  testWidgets('Free after its day: the Close row first and the block right under it from the top (never centred), See Pro the one volt key, the Or rows', (tester) async {
    final rows = <String>[];
    var pro = 0;
    await pumpStage(
      tester,
      StageFreeUsedScreen(
        close: StageCloseKey(onTap: () {}, semanticsLabel: 'Close the feed'),
        rows: const [(id: 'continue', label: 'Continue · 8 min'), (id: 'revise', label: 'Revise 8 due cards · 2 min')],
        onSeePro: () => pro++,
        onRow: rows.add,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text("That was today's free session."), findsOneWidget);
    expect(find.text('Questions come back tomorrow. Your Key cards stay open.'), findsOneWidget);
    expect(find.text('Or'), findsOneWidget);
    expect(tester.getTopLeft(find.byType(StageCloseKey)).dy, lessThan(80), reason: 'the Close row is at the top of the screen');
    expect(tester.getTopLeft(find.text("That was today's free session.")).dy, lessThan(130), reason: 'the headline sits right under the Close row');
    final volt = tester.widgetList<StageStepKey>(find.byType(StageStepKey)).where((k) => k.tone == StageTone.volt);
    expect(volt.map((k) => k.label), ['See Pro']);
    await tester.tap(find.text('See Pro'));
    expect(pro, 1);
    await tester.tap(find.text('Revise 8 due cards · 2 min'));
    await tester.tap(find.text('Continue · 8 min'));
    expect(rows, ['revise', 'continue']);
    // No Pro on offer in this build: the key is left out and the rows stay.
    await pumpStage(
      tester,
      StageFreeUsedScreen(close: StageCloseKey(onTap: () {}), rows: const [(id: 'singles', label: 'Answer single questions')], onSeePro: null, onRow: rows.add),
    );
    await tester.pumpAndSettle();
    expect(find.text('See Pro'), findsNothing);
    expect(find.text('Answer single questions'), findsOneWidget);
  });

  testWidgets('the Mobi beside the headline is decoration, 64 dp', (tester) async {
    await pumpStage(tester, _end(_Taps()));
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byType(StageMobi)).height, 64);
  });

  testWidgets('text scale 1.3 at 360 dp fits, and every target is 48 dp and labelled', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpStage(tester, _end(_Taps(), free: "That was today's free session. Questions come back tomorrow."));
    await tester.pumpAndSettle();
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    expect(find.bySemanticsLabel('Close the feed'), findsOneWidget);
    handle.dispose();
    await pumpStage(tester, _end(_Taps(), free: "That was today's free session. Questions come back tomorrow."), textScale: 1.3);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    // Night and Day both draw (the select colour of the bar is the theme's own).
    expect(stageSelect(MmColors.dark), MmColors.dark.volt);
    expect(stageSelect(MmColors.light), MmColors.light.accentText);
  });
}
