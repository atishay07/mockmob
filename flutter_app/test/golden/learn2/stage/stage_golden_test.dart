// The study stage on a 360 x 800 phone, Night and Day, against the web's phone screenshots (wt-1031-learn-v2
// tmp/learn-1101/r4-merged f01 to f09, r01 to r08 at 390): the flashcard at its three sizes with the next card's edge peeking, the
// first visit's Mobi chip, a long back that scrolls inside, a plain question and the three set stems with the options at the foot
// in the thumb zone, a right answer with the streak, a wrong answer with the line open, the checkpoint with its fan, the one end
// screen (a finished feed, a stopped one, Free after its day), Free's day used, the stop sheet, This feed and the loading stage.
// Real NCERT cards and real preview questions.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/card_face.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_cue.dart';
import 'package:mockmob/features/learn2/stage/stage_end_model.dart';
import 'package:mockmob/features/learn2/stage/stage_free_used.dart';
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
final _short = _q((s) => s.startsWith('On admission of a partner, a gain arising on revaluation'));
final _assertion = _q((s) => s.startsWith('Assertion: Premium received'));
final _lists = _q((s) => s.startsWith('In each independent case'));
final _statements = _q((s) => s.contains('Statement I: Sacrificing ratio'));

Widget _card(String name, {int position = 1, bool turned = false, StageStamp? stamp, bool added = false, Widget? chip}) => StageScene(
  position: position,
  left: reviseKey(added: added),
  keyFor: [StageStepKey(label: turned ? 'Next' : 'Turn over', haptic: false, onTap: () {})],
  next: peekOf('Key line'),
  chip: chip,
  page: StagePage.card(label: 'Card $position of 16', child: CardFace.of(stageCard(name), turned: turned, stamp: stamp, onTurn: () {})),
);

Widget _question(({String id, String stem, List<StageOption> options}) q, {int position = 5}) => StageScene(
  position: position,
  left: saveKey(),
  keyFor: [StageSkipKey(onTap: () {})],
  next: peekOf('Formula'),
  page: StagePage.question(
    label: 'Question $position of 16',
    child: QuestionView(head: 'Question', stem: q.stem, options: q.options, onChoose: (_) {}),
  ),
);

Widget _answered(({String id, String stem, List<StageOption> options}) q, {required String next, int position = 8, int streak = 0}) => StageScene(
  position: position,
  of: 17,
  left: saveKey(),
  keyFor: [StageStepKey(label: next, later: true, onTap: () {})],
  next: peekOf('Key line'),
  page: StagePage.question(
    label: 'Question $position of 17',
    child: AnsweredQuestion(stem: q.stem, options: q.options, streak: streak),
  ),
);

Future<void> _answer(WidgetTester tester, StageAnswer answer) async {
  tester.state<AnsweredQuestionState>(find.byType(AnsweredQuestion)).answerWith(answer);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

List<StagePileCard> _fan() => [
  StagePileCard.of(kind: 'definition', front: stageCard('sacrificing').front),
  StagePileCard.of(kind: 'definition', front: stageCard('premium').front),
  StagePileCard.of(kind: 'key_line', front: stageCard('writtenOff').front),
];

Widget _checkpoint() => StageScene(
  position: 8,
  of: 17,
  wide: true,
  keyFor: [
    StageStepKey(label: 'Stop here', tone: StageTone.line, onTap: () {}),
    StageStepKey(label: 'Keep going', onTap: () {}),
  ],
  next: peekOf('Definition'),
  page: StagePage.centre(
    label: 'Checkpoint after 8 of 17',
    cap: 'So far',
    child: StageCheckpoint(big: '3 for Revise', status: '8 of 17 done, about 6 min left.', keptCards: _fan()),
  ),
);

StageCloseKey _close() => StageCloseKey(onTap: () {}, semanticsLabel: 'Close the feed');

EndScreen _end({
  String headline = '17 done in 9 min',
  Widget? main,
  Widget? quiet,
  String? free,
  bool withNumbers = true,
}) => EndScreen(
  close: _close(),
  chapter: 'Admission of a Partner',
  headline: headline,
  mobi: 'nod',
  pile: withNumbers ? _fan() : null,
  numbers: withNumbers ? StageEndModel.endNumbers(revise: 3, reviseText: 'in Revise, back Wed', answered: 3, right: 3, mistakes: 2, fixed: 1) : const [],
  progress: StageEndModel.endProgress({'of': 58, 'seen': 14, 'before': 12}),
  free: free,
  main: main ?? StageEndKey(label: 'Keep going · 10 min', onTap: () {}),
  quiet: quiet ?? StageTextKey(label: 'Fix 2 open mistakes · 2 min', onTap: () {}),
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
    stageGolden('stage_card_first_visit', () => _card('premium', chip: const StageCue()));
    stageGolden('stage_card_back_long', () => _card('economic', turned: true, stamp: const StageStamp('In Revise'), added: true));
  });

  group('question', () {
    stageGolden('stage_question_plain', () => _question(_plain));
    stageGolden('stage_question_lists', () => _question(_lists));
    stageGolden('stage_question_statements', () => _question(_statements));
    stageGolden('stage_question_assertion', () => _question(_assertion));
    stageGolden(
      'stage_question_right_streak',
      () => _answered(_plain, next: 'See how it went', position: 17, streak: 3),
      after: (tester) => _answer(tester, const StageAnswer.graded('A', StageResult(correct: true, key: 'A'))),
    );
    // As the student first sees it: the verdict at the fold, the line under it (the page keeps the head line where it is).
    stageGolden(
      'stage_question_wrong_line',
      () => _answered(_short, next: 'Next'),
      after: (tester) => _answer(tester, StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('oldRatio'))))),
    );
    // And after the student scrolls down to read it: the line in place under the options, clamped to four lines.
    stageGolden(
      'stage_question_wrong_line_read',
      () => _answered(_short, next: 'Next'),
      after: (tester) async {
        await _answer(tester, StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('oldRatio')))));
        final page = tester.state<ScrollableState>(find.descendant(of: find.byType(StagePager), matching: find.byType(Scrollable)).first).position;
        page.jumpTo(page.maxScrollExtent);
        await tester.pump();
      },
    );
  });

  group('pause and end', () {
    stageGolden('stage_checkpoint', _checkpoint);
    stageGolden('stage_end', _end);
    stageGolden(
      'stage_end_stopped',
      () => _end(headline: '5 of 20 done', main: StageEndKey(label: 'Continue · 6 min', onTap: () {})),
    );
    stageGolden(
      'stage_end_next_chapter',
      () => _end(main: StageEndKey(label: 'Next chapter · 10 min', sub: 'Retirement and Death of a Partner', onTap: () {}), quiet: StageTextKey(label: 'Keep going · 10 min', onTap: () {})),
    );
    stageGolden(
      'stage_end_free',
      () => _end(
        headline: '3 done',
        withNumbers: false,
        free: 'That was today\'s free session. Questions come back tomorrow.',
        main: StageEndKey(label: 'Quick recap · 1 min', onTap: () {}),
        quiet: StageTextKey(label: 'See Pro', onTap: () {}),
      ),
    );
    stageGolden(
      'stage_free_used',
      () => StageFreeUsedScreen(
        close: _close(),
        rows: const [(id: 'continue', label: 'Continue · 8 min'), (id: 'revise', label: 'Revise 8 due cards · 2 min')],
        onSeePro: () {},
        onRow: (_) {},
      ),
    );
    stageGolden(
      'stage_stop_sheet',
      () => _SheetOver(
        child: _checkpoint(),
        open: (context) => unawaited(showStopSheet(context, done: 8, of: 17)),
      ),
      after: _openSheet,
    );
    stageGolden(
      'stage_feed_sheet',
      () => _SheetOver(
        child: _card('premium', position: 5, added: true),
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
