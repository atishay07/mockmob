// The end of a session: the title and the done line, the kept fan that opens one frame after it is drawn (up to four
// real small cards, the top one with its kind and front), "3 kept" and the server's line, the hairline rows, the keys
// (the lead volt first, the text key centred), the loading shape, the error with Try again, and the end's layer with
// Close and the counter. Text scale 1.3 at 360 dp fits.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/stage_frame.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_harness.dart';

const _pile = StagePile(
  count: 3,
  cards: [
    StagePileCard(label: 'Definition', front: 'What is the sacrificing ratio?'),
    StagePileCard(label: 'Formula', front: "An old partner's new share"),
    StagePileCard(label: 'Key line', front: 'Goodwill, if existing in the books of the firm, it is ____ at the time of admission of a partner.'),
  ],
  line: 'They are first in Revise.',
);

class _Taps {
  int lead = 0;
  int next = 0;
  int back = 0;
  int close = 0;
  int retry = 0;
}

Widget _end(_Taps taps, {StagePile? pile = _pile, bool loading = false, StageEndError? error}) => StageEnd(
  onClose: () => taps.close++,
  closeLabel: 'Close the feed',
  position: 17,
  of: 17,
  child: EndForm(
    title: 'Admission of a Partner',
    done: 'All 17 done in 9 min.',
    pile: pile,
    lines: const [(label: 'Cards', text: '12 seen, 3 kept'), (label: 'Questions', text: '3 of 3 right'), (label: 'Old mistakes', text: '1 of 2 fixed')],
    keys: [
      StageStepKey(label: 'Another 10 minutes', onTap: () => taps.lead++),
      StageStepKey(label: 'Next chapter: Retirement and Death of a Partner', tone: StageTone.line, onTap: () => taps.next++),
      StageTextKey(label: 'Back to Explore', quiet: true, onTap: () => taps.back++),
    ],
    loading: loading,
    error: error,
    onRetry: () => taps.retry++,
  ),
);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the end reads as lines: the title, the done line, the fan, the rows and the keys', (tester) async {
    final taps = _Taps();
    await pumpStage(tester, _end(taps));
    await tester.pumpAndSettle();
    expect(find.text('Admission of a Partner'), findsOneWidget);
    expect(find.text('All 17 done in 9 min.'), findsOneWidget);
    expect(find.text('3 kept'), findsOneWidget);
    expect(find.text('They are first in Revise.'), findsOneWidget);
    expect(find.text('Key line'), findsOneWidget, reason: 'the top card shows its kind');
    expect(find.text('Definition'), findsNothing, reason: 'the cards behind show hairlines only');
    for (final t in ['Cards', '12 seen, 3 kept', 'Questions', '3 of 3 right', 'Old mistakes', '1 of 2 fixed']) {
      expect(find.text(t), findsOneWidget);
    }
    // One column at most 440 dp, the rows' labels 112 dp wide.
    expect(tester.getSize(find.byType(EndForm)).width, lessThanOrEqualTo(440));
    expect(tester.getRect(find.text('12 seen, 3 kept')).left - tester.getRect(find.text('Cards')).left, 112 + 12);
    await tester.tap(find.text('Another 10 minutes'));
    await tester.tap(find.text('Next chapter: Retirement and Death of a Partner'));
    await tester.tap(find.text('Back to Explore'));
    await tester.tap(find.text('Close'));
    await tester.pump();
    expect([taps.lead, taps.next, taps.back, taps.close], [1, 1, 1, 1]);
    expect(find.byType(StageCounter), findsOneWidget);
    final back = tester.getRect(find.text('Back to Explore'));
    expect(back.center.dx, moreOrLessEquals(180, epsilon: 1), reason: 'the text key is centred');
  });

  testWidgets('the fan opens one frame after the end is drawn: 320 ms, 40 ms steps, fanned by 7 degrees and 26 dp', (tester) async {
    await pumpStage(tester, const Center(child: SizedBox(width: 328, child: StageKeptFan(cards: [StagePileCard(label: 'A', front: 'a'), StagePileCard(label: 'B', front: 'b'), StagePileCard(label: 'C', front: 'c')]))));
    List<double> xs() => [
      for (final t in tester.widgetList<Transform>(find.descendant(of: find.byType(StageKeptFan), matching: find.byType(Transform))))
        if (t.transform.getTranslation().x != 0 || t.transform.entry(0, 1) == 0) t.transform.getTranslation().x,
    ];
    expect(xs().every((x) => x == 0), isTrue, reason: 'closed on the first frame');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 450));
    final open = xs().where((x) => x != 0).toList()..sort();
    expect(open, [-26, 26]);
  });

  testWidgets('nothing kept says so; the loading end has the final shape; an error offers Try again', (tester) async {
    final handle = tester.ensureSemantics();
    final taps = _Taps();
    await pumpStage(tester, _end(taps, pile: const StagePile(count: 0, none: 'Nothing kept this time. Keep a card and it comes back in Revise.')));
    await tester.pumpAndSettle();
    expect(find.text('Nothing kept this time. Keep a card and it comes back in Revise.'), findsOneWidget);
    expect(find.byType(StageKeptFan), findsNothing);

    await pumpStage(tester, _end(taps, loading: true));
    await tester.pump();
    expect(find.bySemanticsLabel('Adding it up'), findsWidgets);
    expect(find.text('3 kept'), findsNothing);

    await pumpStage(tester, _end(taps, error: (title: 'Your feed is saved', line: 'Its summary did not load.')));
    await tester.pumpAndSettle();
    expect(find.text('Your feed is saved'), findsOneWidget);
    expect(find.text('Its summary did not load.'), findsOneWidget);
    expect(find.text('3 kept'), findsNothing, reason: 'never invented numbers');
    await tester.tap(find.text('Try again'));
    expect(taps.retry, 1);
    handle.dispose();
  });

  testWidgets('a pile card from the server\'s short card: its kind label and its front as a card shows it', (tester) async {
    final card = StagePileCard.of(kind: 'formula', front: 'Formula: Current ratio');
    expect(card.label, 'Formula');
    expect(card.front, 'Current ratio');
  });

  testWidgets('text scale 1.3 at 360 dp fits, and every target is 48 dp and labelled', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpStage(tester, _end(_Taps()));
    await tester.pumpAndSettle();
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
    await pumpStage(tester, _end(_Taps()), textScale: 1.3);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
