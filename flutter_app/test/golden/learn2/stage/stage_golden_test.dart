// The study stage on a 360 x 800 phone, Night and Day, against the web's final phone screenshots
// (wt-1031-learn-v2 tmp/learn-1101/final/10 to 18, 80 to 82): the card front at its three sizes, a long back that
// scrolls inside, a plain question and the three set stems (List-I and List-II, statements, Assertion and Reason),
// a right answer with the streak, a wrong answer with the line open, the checkpoint, the end with the kept fan, the
// stop sheet, This feed, and the loading stage. Real NCERT cards and real preview questions.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/card_face.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_pager.dart';
import 'package:mockmob/features/learn2/stage/stage_sheets.dart';
import 'package:mockmob/features/learn2/stage/stage_states.dart';
import 'package:mockmob/features/learn2/stage/stage_text.dart';

import '../../../unit/learn2/stage/support/stage_cards.dart';
import '../../../unit/learn2/stage/support/stage_harness.dart';
import 'stage_golden_support.dart';

final _questions = realQuestions();

({String id, String stem, List<StageOption> options}) _q(bool Function(String stem) test) => _questions.firstWhere((q) => test(q.stem));

final _plain = _q((s) => s.startsWith('When a new partner is admitted'));
final _case = _q((s) => s.startsWith("Case: Firm's balance sheet shows goodwill"));
final _assertion = _q((s) => s.startsWith('Assertion: Premium received'));
final _lists = _q((s) => s.startsWith('In each independent case'));
final _statements = _q((s) => s.contains('Statement I: Sacrificing ratio'));

Widget _card(String name, {int position = 1, bool turned = false, StageStamp? stamp, int kept = 0}) => StageScene(
  position: position,
  kept: kept,
  left: keepKey(kept: kept > 0),
  keyFor: [StageStepKey(label: turned ? 'Next' : 'Turn over', haptic: false, onTap: () {})],
  page: StagePage.card(label: 'Card $position of 16', child: CardFace.of(stageCard(name), turned: turned, stamp: stamp, onTurn: () {})),
);

Widget _question(({String id, String stem, List<StageOption> options}) q, {int position = 5, String head = 'Question 1 of 3'}) => StageScene(
  position: position,
  kept: 1,
  left: saveKey(),
  keyFor: [StageSkipKey(onTap: () {})],
  page: StagePage.question(
    label: 'Question $position of 16',
    child: QuestionView(head: head, stem: q.stem, options: q.options, onChoose: (_) {}),
  ),
);

Widget _answered(({String id, String stem, List<StageOption> options}) q, {required String next, int position = 8, int streak = 0, int kept = 1, String head = 'Question 2 of 3'}) =>
    StageScene(
      position: position,
      of: 17,
      kept: kept,
      left: saveKey(),
      keyFor: [StageStepKey(label: next, later: true, onTap: () {})],
      page: StagePage.question(
        label: 'Question $position of 17',
        child: AnsweredQuestion(stem: q.stem, options: q.options, head: head, streak: streak),
      ),
    );

Future<void> _answer(WidgetTester tester, StageAnswer answer) async {
  tester.state<AnsweredQuestionState>(find.byType(AnsweredQuestion)).answerWith(answer);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

Widget _checkpoint() => StageScene(
  position: 8,
  of: 17,
  kept: 1,
  wide: true,
  keyFor: [
    StageStepKey(label: 'End here', tone: StageTone.line, onTap: () {}),
    StageStepKey(label: 'Keep going', onTap: () {}),
  ],
  page: const StagePage.centre(
    label: 'Checkpoint after 8 of 17',
    child: StageCheckpoint(
      big: '1 of 1 right',
      status: '8 of 17 done. About 6 min left.',
      line: 'Keep going, or end here. What you kept is already in Revise.',
      kept: true,
    ),
  ),
);

class _SheetOver extends StatefulWidget {
  const _SheetOver({required this.child, required this.open});

  final Widget child;
  final void Function(BuildContext context) open;

  @override
  State<_SheetOver> createState() => _SheetOverState();
}

class _SheetOverState extends State<_SheetOver> {
  @override
  Widget build(BuildContext context) => widget.child;
}

Future<void> _openSheet(WidgetTester tester) async {
  final state = tester.state<_SheetOverState>(find.byType(_SheetOver));
  state.widget.open(state.context);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  group('card', () {
    stageGolden('stage_card_front_s', () => _card('sacrificing'));
    stageGolden('stage_card_front_m', () => _card('premium'));
    stageGolden('stage_card_front_l', () => _card('paidPrivately'));
    stageGolden('stage_card_back_long', () => _card('economic', turned: true, stamp: const StageStamp('In Revise'), kept: 1));
  });

  group('question', () {
    stageGolden('stage_question_plain', () => _question(_plain, head: 'Question 3 of 3'));
    stageGolden('stage_question_lists', () => _question(_lists));
    stageGolden('stage_question_statements', () => _question(_statements));
    stageGolden('stage_question_assertion', () => _question(_assertion));
    stageGolden(
      'stage_question_right_streak',
      () => _answered(_plain, next: 'See how it went', position: 17, streak: 3, kept: 3, head: 'Question 3 of 3'),
      after: (tester) => _answer(tester, const StageAnswer.graded('A', StageResult(correct: true, key: 'A'))),
    );
    stageGolden(
      'stage_question_wrong_line',
      () => _answered(_case, next: 'Next'),
      after: (tester) => _answer(tester, StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('oldRatio'))))),
    );
  });

  group('pause and end', () {
    stageGolden('stage_checkpoint', _checkpoint);
    stageGolden(
      'stage_end',
      () => StageEnd(
        onClose: () {},
        closeLabel: 'Close the feed',
        position: 17,
        of: 17,
        child: EndForm(
          title: 'Admission of a Partner',
          done: StageText.doneLine(reached: 17, of: 17, minutes: 9),
          pile: StagePile(
            count: 3,
            cards: [
              StagePileCard.of(kind: 'definition', front: stageCard('sacrificing').front),
              StagePileCard.of(kind: 'definition', front: stageCard('premium').front),
              StagePileCard.of(kind: 'key_line', front: stageCard('writtenOff').front),
            ],
            line: 'They are first in Revise.',
          ),
          lines: const [(label: 'Cards', text: '12 seen, 3 kept'), (label: 'Questions', text: '3 of 3 right'), (label: 'Old mistakes', text: '1 of 2 fixed')],
          keys: [
            StageStepKey(label: 'Another 10 minutes', onTap: () {}),
            StageStepKey(label: 'Next chapter: Retirement and Death of a Partner', tone: StageTone.line, onTap: () {}),
            StageTextKey(label: 'Back to Explore', quiet: true, onTap: () {}),
          ],
        ),
      ),
    );
    stageGolden(
      'stage_stop_sheet',
      () => _SheetOver(
        child: _checkpoint(),
        open: (context) => unawaited(
          showStopSheet(context, done: 8, of: 17, detail: '1 of 1 question right. 0 of 1 old mistake fixed. 1 kept in Revise.'),
        ),
      ),
      after: _openSheet,
    );
    stageGolden(
      'stage_feed_sheet',
      () => _SheetOver(
        child: _card('premium', position: 5, kept: 1),
        open: (context) => unawaited(
          showStageSheet<void>(
            context: context,
            title: 'This feed',
            builder: (sheet) => StageFeedList(
              rows: [
                StageFeedRow(n: 1, kind: 'Card', words: stageCard('sacrificing').front, state: StageRowState.kept),
                StageFeedRow(n: 2, kind: 'Card', words: stageCard('paidPrivately').front, state: StageRowState.seen),
                StageFeedRow(n: 3, kind: 'Question', words: _plain.stem, state: StageRowState.right),
                StageFeedRow(n: 4, kind: 'Question', words: _case.stem, state: StageRowState.wrong),
                StageFeedRow(n: 5, kind: 'Card', words: stageCard('premium').front, state: StageRowState.now),
                StageFeedRow(n: 6, kind: 'Question', words: _lists.stem),
                StageFeedRow(n: 7, kind: 'Card', words: stageCard('writtenOff').front),
                StageFeedRow(n: 8, kind: 'Question', words: _statements.stem),
              ],
              onPick: (_) {},
              onEnd: () {},
            ),
          ),
        ),
      ),
      after: _openSheet,
    );
    stageGolden('stage_skeleton', () => StageSkeleton(onClose: () {}, title: 'Admission of a Partner'));
  });
}
