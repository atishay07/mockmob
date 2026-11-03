// The stage's centred states, the checkpoint, the loading stage and the flight: their words and keys, the checkpoint's one
// line and its small fan only when something was kept (never a zero, never a third line), the skeleton at the card's least
// height with the real Close, and a ghost that flies to its target in 320 ms and is gone after (nothing under reduced motion).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/stage_flight.dart';
import 'package:mockmob/features/learn2/stage/stage_frame.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_sizes.dart';
import 'package:mockmob/features/learn2/stage/stage_states.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_harness.dart';

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a centred state: the title, the line, the keys (one volt)', (tester) async {
    var tries = 0;
    await pumpStage(
      tester,
      Center(
        child: StageCentre(
          title: 'The feed didn\'t start',
          line: 'Check your connection and try again.',
          keys: [
            StageStepKey(label: 'Try again', onTap: () => tries++),
            StageTextKey(label: 'Back to Explore', quiet: true, onTap: () {}),
          ],
        ),
      ),
    );
    expect(find.text('The feed didn\'t start'), findsOneWidget);
    expect(find.text('Check your connection and try again.'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    expect(tries, 1);
  });

  testWidgets('the checkpoint: one number, one line, and the small fan only with something kept', (tester) async {
    await pumpStage(
      tester,
      Center(
        child: StageCheckpoint(
          big: '1 of 1 right',
          status: '8 of 17 done, about 6 min left.',
          keptCards: const [StagePileCard(label: 'Formula', front: 'The sacrifice by a partner.', id: 'a')],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('1 of 1 right'), findsOneWidget);
    expect(find.text('8 of 17 done, about 6 min left.'), findsOneWidget);
    expect(find.byType(StageKeptFan), findsOneWidget);
    expect(find.text('The sacrifice by a partner.'), findsOneWidget);
    expect(find.textContaining('Keep going, or stop here'), findsNothing, reason: 'the third line is gone');
    await pumpStage(tester, const Center(child: StageCheckpoint(big: '6 cards seen', status: '8 of 21 done.')));
    expect(find.byType(StageKeptFan), findsNothing);
    expect(find.textContaining('kept'), findsNothing, reason: 'no "0 kept"');
  });

  testWidgets('the loading stage: the real Close, a title bar, the hairline ticks, a card at its least height', (tester) async {
    final handle = tester.ensureSemantics();
    var closed = 0;
    await pumpStage(tester, StageSkeleton(onClose: () => closed++));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.bySemanticsLabel('Starting the feed'), findsWidgets);
    expect(find.text('Admission of a Partner'), findsNothing);
    await tester.tap(find.byType(StageCloseKey));
    expect(closed, 1);
    final card = find.byWidgetPredicate((w) => w is Container && w.constraints?.minHeight == StageSizes.cardMin(800));
    expect(card, findsOneWidget);
    expect(tester.getSize(card).height, greaterThanOrEqualTo(StageSizes.cardMin(800)));
    handle.dispose();
    await pumpStage(tester, StageSkeleton(onClose: () {}, title: 'Admission of a Partner', slow: const Text('Taking longer than usual.')));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Admission of a Partner'), findsOneWidget);
    expect(find.text('Taking longer than usual.'), findsOneWidget);
  });

  testWidgets('the flight: a ghost flies to its target in 320 ms and is gone; nothing under reduced motion', (tester) async {
    final from = GlobalKey();
    final to = GlobalKey();
    Widget stage() => Column(
      children: [
        StageTopBar(onClose: () {}, title: 'Admission of a Partner'),
        Align(alignment: Alignment.centerRight, child: SizedBox(key: to, width: 40, height: 28)),
        Expanded(child: Center(child: SizedBox(key: from, width: 300, height: 380))),
      ],
    );
    Finder ghost() => find.byWidgetPredicate((w) => w is Positioned && w.width == StageFlight.ghost.width && w.height == StageFlight.ghost.height);
    await pumpStage(tester, stage());
    await tester.pumpAndSettle();
    var done = false;
    StageFlight.fly(tester.element(find.byKey(from)), from: from, to: to).then((_) => done = true);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
    expect(ghost(), findsOneWidget);
    // Where the ghost is drawn (its box inside the moving transforms).
    Offset drawn() => tester.getCenter(find.descendant(of: ghost(), matching: find.byType(DecoratedBox)));
    final start = drawn();
    expect(start.dy, moreOrLessEquals(tester.getCenter(find.byKey(from)).dy, epsilon: 1), reason: "it leaves from the card's centre");
    await tester.pump(const Duration(milliseconds: 160));
    expect(drawn().dy, lessThan(start.dy - 100), reason: 'it travels toward its target');
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(ghost(), findsNothing);
    expect(done, isTrue);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, stage(), reduced: true);
    await tester.pumpAndSettle();
    StageFlight.fly(tester.element(find.byKey(from)), from: from, to: to);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
    expect(ghost(), findsNothing);
  });

  testWidgets('the states fit at text scale 1.3 on a 360 dp phone', (tester) async {
    await pumpStage(
      tester,
      Center(child: StageCentre(title: "Today's free session is used", line: 'Your free Learn session for today is done. Explore questions stay free.', keys: [StageStepKey(label: 'Pick up where you stopped, 8 of 21', onTap: () {})])),
      textScale: 1.3,
    );
    expect(tester.takeException(), isNull);
    await pumpStage(
      tester,
      Center(
        child: StageCheckpoint(
          big: '2 of 3 right',
          status: '8 of 21 done, about 6 min left.',
          keptCards: const [StagePileCard(label: 'Definition', front: 'Name the six essential features of a partnership', id: 'a')],
        ),
      ),
      textScale: 1.3,
    );
    expect(tester.takeException(), isNull);
    await pumpStage(tester, StageSkeleton(onClose: () {}), textScale: 1.3);
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
  });
}
