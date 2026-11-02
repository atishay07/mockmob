// The stage's sheets: "Stop for now?" says what was done ("8 of 17 done. It’s all saved.") and answers with the student's
// choice (Stop here, Back to it, or a dismissal), and "This feed" lists the items with their states (Now, right, not right,
// In Revise as the card stack, seen), each row going to its item, with Stop here at the foot. 52 dp rows, labelled for a
// screen reader.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_sheets.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_harness.dart';

class _Opener extends StatefulWidget {
  const _Opener();

  @override
  State<_Opener> createState() => _OpenerState();
}

class _OpenerState extends State<_Opener> {
  StageStopChoice? choice;
  bool answered = false;
  int? picked;
  int ends = 0;

  Future<void> stop() async {
    final c = await showStopSheet(context, done: 8, of: 17);
    setState(() {
      answered = true;
      choice = c;
    });
  }

  Future<void> list() => showStageSheet<void>(
    context: context,
    title: 'This feed',
    builder: (sheet) => StageFeedList(
      rows: const [
        StageFeedRow(n: 1, kind: 'Card', words: "What is the new partner's share of goodwill?", state: StageRowState.kept),
        StageFeedRow(n: 2, kind: 'Card', words: 'What is the sacrificing ratio?', state: StageRowState.seen),
        StageFeedRow(n: 3, kind: 'Question', words: 'When a new partner is admitted', state: StageRowState.right),
        StageFeedRow(n: 4, kind: 'Question', words: 'Case: the firm writes off goodwill', state: StageRowState.wrong),
        StageFeedRow(n: 5, kind: 'Card', words: 'Goodwill, if existing in the books', state: StageRowState.now),
        StageFeedRow(n: 6, kind: 'Question', words: 'Match each situation in List-I'),
      ],
      onPick: (i) {
        Navigator.of(sheet).pop();
        setState(() => picked = i);
      },
      onEnd: () {
        Navigator.of(sheet).pop();
        setState(() => ends++);
      },
    ),
  );

  @override
  Widget build(BuildContext context) => const SizedBox.expand();
}

_OpenerState _opener(WidgetTester tester) => tester.state<_OpenerState>(find.byType(_Opener));

void main() {
  setUpAll(loadAppFonts);

  testWidgets('Stop for now? says what was done and answers with the choice: Stop here, or Back to it', (tester) async {
    await pumpStage(tester, const _Opener());
    for (final (label, want) in [('Stop here', StageStopChoice.end), ('Back to it', StageStopChoice.keepGoing)]) {
      _opener(tester).answered = false;
      unawaited(_opener(tester).stop());
      await tester.pumpAndSettle();
      expect(find.text('Stop for now?'), findsOneWidget);
      expect(find.text('8 of 17 done. It\u2019s all saved.'), findsOneWidget);
      expect(find.byWidgetPredicate((w) => w is StageStepKey && w.tone == StageTone.volt), findsOneWidget, reason: 'one volt key');
      for (final gone in ['End here, see how it went', 'Leave for now, pick up later today', 'Keep going']) {
        expect(find.text(gone), findsNothing, reason: '"$gone" is not on the sheet');
      }
      await tester.tap(find.text(label).last);
      await tester.pumpAndSettle();
      expect(_opener(tester).answered, isTrue);
      expect(_opener(tester).choice, want);
      expect(find.text('Stop for now?'), findsNothing);
    }
    // The X in the head goes back to it, as the scrim does.
    _opener(tester).answered = false;
    unawaited(_opener(tester).stop());
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Back to it').first);
    await tester.pumpAndSettle();
    expect(_opener(tester).answered, isTrue);
    expect(_opener(tester).choice, isNull);
  });

  test('the stop line', () {
    expect(StopSheet.lineFor(done: 8, of: 17), '8 of 17 done. It\u2019s all saved.');
    expect(StopSheet.lineFor(done: 0, of: 0), 'It\u2019s all saved.');
  });

  testWidgets('This feed: the rows with their states, a row goes to its item, Stop here at the foot', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpStage(tester, const _Opener());
    unawaited(_opener(tester).list());
    await tester.pumpAndSettle();
    expect(find.text('This feed'), findsOneWidget);
    expect(find.text('Now'), findsOneWidget);
    expect(find.byType(StageCardStack), findsOneWidget, reason: 'a card in Revise shows the card stack');
    expect(find.bySemanticsLabel('1. Card. What is the new partner\'s share of goodwill?, In Revise'), findsOneWidget);
    expect(find.bySemanticsLabel('4. Question. Case: the firm writes off goodwill, not right'), findsOneWidget);
    expect(find.bySemanticsLabel('5. Card. Goodwill, if existing in the books, now'), findsOneWidget);
    final rows = find.byType(StageFeedRowView);
    expect(rows, findsNWidgets(6));
    expect(tester.getSize(rows.first).height, greaterThanOrEqualTo(52));
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    await tester.tap(find.textContaining('What is the sacrificing ratio?', findRichText: true));
    await tester.pumpAndSettle();
    expect(_opener(tester).picked, 1);
    expect(find.text('This feed'), findsNothing);

    unawaited(_opener(tester).list());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Stop here'));
    await tester.pumpAndSettle();
    expect(_opener(tester).ends, 1);
    handle.dispose();
  });

  testWidgets('the sheets fit at text scale 1.3 on a 360 dp phone', (tester) async {
    await pumpStage(tester, const _Opener(), textScale: 1.3);
    unawaited(_opener(tester).stop());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Back to it').last);
    await tester.pumpAndSettle();
    unawaited(_opener(tester).list());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}

