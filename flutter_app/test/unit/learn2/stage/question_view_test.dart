// A question on the stage, over the Learn preview's real questions: each stem shape is set as its parts, the options
// answer once, pending, right (with its confirm haptic and the streak), wrong (no haptic, the line you needed opens in
// place and the chosen row comes to 12 dp under the top), the locked, explanation, left-out, closed and error variants,
// 48 dp targets and text scale 1.3 at 360 dp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/mm_spinner.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_pager.dart';
import 'package:mockmob/features/learn2/stage/stage_text.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_cards.dart';
import 'support/stage_harness.dart';

final _questions = realQuestions();

({String id, String stem, List<StageOption> options}) _q(bool Function(String stem) test) => _questions.firstWhere((q) => test(q.stem));

final _plain = _q((s) => s.startsWith('When a new partner is admitted'));
final _assertion = _q((s) => s.startsWith('Assertion: Premium received'));
final _lists = _q((s) => s.startsWith('In each independent case'));
final _statements = _q((s) => s.contains('Statement I: Sacrificing ratio'));
final _steps = _q((s) => StageText.stemParts(s) != null && StageText.matchLists(s) == null);

/// A question on a pager page, its answer held by the host as a screen holds it.
class _QHost extends StatefulWidget {
  const _QHost({required this.stem, required this.options, this.skipped, this.locked, this.streak = 0, this.room = 0});

  final String stem;
  final List<StageOption> options;
  final String? skipped;
  final String? locked;
  final int streak;

  /// Room under the question, so its page can scroll the chosen row all the way up.
  final double room;

  @override
  State<_QHost> createState() => _QHostState();
}

class _QHostState extends State<_QHost> {
  StageAnswer? answer;
  String? error;
  final List<String> chosen = [];
  int seePro = 0;

  void set(StageAnswer? a, {String? err}) => setState(() {
    answer = a;
    error = err;
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 62),
        Expanded(
          child: StagePager(
            count: 1,
            index: 0,
            onGo: (_) {},
            pageBuilder: (context, i) => StagePage.question(
              label: 'Question 1 of 1',
              child: _withRoom(QuestionView(
                head: 'Question 1 of 3',
                stem: widget.stem,
                options: widget.options,
                answer: answer,
                streak: widget.streak,
                skipped: widget.skipped,
                locked: widget.locked,
                error: error,
                onChoose: chosen.add,
                onSeePro: () => seePro++,
              )),
            ),
          ),
        ),
        const SizedBox(height: 104),
      ],
    );
  }
}

extension on _QHostState {
  Widget _withRoom(Widget q) => widget.room == 0 ? q : Column(children: [q, SizedBox(height: widget.room)]);
}

_QHostState _host(WidgetTester tester) => tester.state<_QHostState>(find.byType(_QHost));

Finder _row(String letter) => find.byWidgetPredicate((w) => w is StageOptionRow && w.letter == letter);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('each stem shape is set as its parts', (tester) async {
    await pumpStage(tester, _QHost(stem: _assertion.stem, options: _assertion.options));
    expect(find.text('Assertion'), findsOneWidget);
    expect(find.text('Reason'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options));
    expect(find.text('List-I'), findsOneWidget);
    expect(find.text('List-II'), findsOneWidget);
    expect(find.text('(A)'), findsOneWidget);
    expect(find.text('(IV)'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    final handle = tester.ensureSemantics();
    await pumpStage(tester, _QHost(stem: _statements.stem, options: _statements.options));
    expect(find.text('II'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'^Statement I\. Sacrificing ratio')), findsOneWidget);
    handle.dispose();

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _steps.stem, options: _steps.options));
    expect(find.textContaining(RegExp(r'^\((A|a|i|1)\)$')), findsWidgets);
  });

  testWidgets('the options: letters drawn, the bank\'s letters stripped only when every option has one, one answer', (tester) async {
    final haptics = StageHaptics();
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options), haptics: haptics);
    expect(find.text('Sacrifice ratio'), findsOneWidget, reason: '"A Sacrifice ratio" under key A reads "Sacrifice ratio"');
    for (final l in ['A', 'B', 'C', 'D']) {
      expect(_row(l), findsOneWidget);
    }
    await tester.tap(_row('B'));
    await tester.pump();
    await tester.tap(_row('C'));
    await tester.pump();
    expect(_host(tester).chosen, ['B'], reason: 'the rows answer once');
    expect(haptics.calls, ['selection'], reason: 'an option tap ticks');
  });

  testWidgets('pending, then right: the spinner, the volt row, "Right." and the confirm haptic after the grade', (tester) async {
    final haptics = StageHaptics();
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options), haptics: haptics);
    _host(tester).set(const StageAnswer.pending('A'));
    await tester.pump();
    expect(find.descendant(of: _row('A'), matching: find.byType(MmSpinner)), findsOneWidget);
    expect(tester.widget<StageOptionRow>(_row('B')).onTap, isNull, reason: 'locked while the answer is on its way');
    expect(haptics.calls, isEmpty);

    _host(tester).set(const StageAnswer.graded('A', StageResult(correct: true, key: 'A')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Right.'), findsOneWidget);
    expect(tester.widget<StageOptionRow>(_row('A')).state, StageOptionState.right);
    expect(tester.widget<StageOptionRow>(_row('B')).state, StageOptionState.rest);
    expect(haptics.calls, ['medium', 'light'], reason: 'confirm (its fallback on this test phone), after the grade');
    expect(find.text('The line you needed'), findsNothing);
  });

  testWidgets('a streak from 3 reads in the verdict line; an old mistake\'s fixed text wins', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, streak: 4));
    _host(tester).set(const StageAnswer.graded('A', StageResult(correct: true, key: 'A')));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Right. 4 in a row.'), findsOneWidget);
    handle.dispose();

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, streak: 4));
    _host(tester).set(const StageAnswer.graded('A', StageResult(correct: true, key: 'A', fixedText: 'Right this time. Back on Wed to check it held.')));
    await tester.pumpAndSettle();
    expect(find.text('Right this time. Back on Wed to check it held.'), findsOneWidget);
  });

  testWidgets('wrong: no haptic, the key row outlined, the line you needed opens in place, the pick comes to the top', (tester) async {
    final haptics = StageHaptics();
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options), haptics: haptics);
    final page = tester.state<ScrollableState>(find.ancestor(of: find.text('List-I'), matching: find.byType(Scrollable)).first).position;
    _host(tester).set(StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('oldRatio')))));
    await tester.pump();
    expect(find.text('Not quite. The answer is A.'), findsOneWidget);
    expect(tester.widget<StageOptionRow>(_row('B')).state, StageOptionState.wrong);
    expect(tester.widget<StageOptionRow>(_row('A')).state, StageOptionState.key);
    await tester.pumpAndSettle();
    expect(haptics.calls, isEmpty, reason: 'a wrong answer gives no haptic');
    expect(find.text('The line you needed'), findsOneWidget);
    expect(find.textContaining('Goodwill appearing in the books will be'), findsOneWidget);
    expect(find.text('Accountancy Part 1, Ch 2, p. 70'), findsOneWidget);
    // The page scrolls toward the pick; here the question ends before the pick can reach the top, so it stops at its end.
    expect(page.pixels, greaterThan(0));
    expect(page.pixels, moreOrLessEquals(page.maxScrollExtent, epsilon: 0.5));
  });

  testWidgets('after a wrong answer the chosen row comes to 12 dp under the top of its page', (tester) async {
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options, room: 900));
    _host(tester).set(StageAnswer.graded('C', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('oldRatio')))));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    final early = tester.getTopLeft(_row('C')).dy;
    await tester.pumpAndSettle();
    final viewportTop = tester.getTopLeft(find.byType(StagePager)).dy;
    expect(early, greaterThan(tester.getTopLeft(_row('C')).dy), reason: 'it waited 300 ms, then moved');
    expect(tester.getTopLeft(_row('C')).dy - viewportTop, moreOrLessEquals(12, epsilon: 1));
  });

  testWidgets('a long question says "Options below" while option A waits under the fold; a tap brings it up', (tester) async {
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    await tester.pumpAndSettle();
    expect(find.text('Options below'), findsNothing, reason: 'a short question shows its options');

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options, room: 900));
    await tester.pumpAndSettle();
    expect(find.text('Options below'), findsOneWidget);
    await tester.tap(find.text('Options below'));
    await tester.pumpAndSettle();
    final viewportTop = tester.getTopLeft(find.byType(StagePager)).dy;
    expect(tester.getTopLeft(_row('A')).dy - viewportTop, moreOrLessEquals(12, epsilon: 1));
    expect(find.text('Options below'), findsNothing, reason: 'gone once the options show');
  });

  testWidgets('a locked line says why and offers See Pro; no card: Why and the explanation', (tester) async {
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    _host(tester).set(const StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(locked: true, text: 'Free shows 3 lines a day. This one is on Pro.'))));
    await tester.pumpAndSettle();
    expect(find.text('The line you needed'), findsOneWidget);
    expect(find.text('Free shows 3 lines a day. This one is on Pro.'), findsOneWidget);
    await tester.tap(find.text('See Pro'));
    expect(_host(tester).seePro, 1);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    _host(tester).set(const StageAnswer.graded('B', StageResult(correct: false, key: 'A', explanation: 'The sacrifice is old share less new share.')));
    await tester.pumpAndSettle();
    expect(find.text('Why'), findsOneWidget);
    expect(find.text('The sacrifice is old share less new share.'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    _host(tester).set(const StageAnswer.graded('B', StageResult(correct: false, key: 'A')));
    await tester.pumpAndSettle();
    expect(find.text('The right answer is marked above.'), findsOneWidget);
  });

  testWidgets('left out, closed, and an answer that was not saved', (tester) async {
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, skipped: 'This question changed a moment ago, so it is left out.'));
    expect(find.byType(StageOptionRow), findsNothing);
    expect(find.text('This question changed a moment ago, so it is left out.'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, locked: 'This feed is finished, so this one is not counted.'));
    expect(find.byType(StageOptionRow), findsNWidgets(4));
    await tester.tap(_row('A'));
    await tester.pump();
    expect(_host(tester).chosen, isEmpty);
    expect(find.text('This feed is finished, so this one is not counted.'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    await tester.tap(_row('A'));
    _host(tester).set(const StageAnswer.pending('A'));
    await tester.pump();
    _host(tester).set(null, err: 'That answer was not saved. Try again.');
    await tester.pump();
    expect(find.text('That answer was not saved. Try again.'), findsOneWidget);
    await tester.tap(_row('C'));
    await tester.pump();
    expect(_host(tester).chosen, ['A', 'C'], reason: 'the rows answer again after a failed save');
  });

  testWidgets('48 dp targets, every target labelled, and text scale 1.3 at 360 dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    expect(find.bySemanticsLabel('Option A. Sacrifice ratio'), findsOneWidget);
    handle.dispose();

    for (final q in [_lists, _assertion, _statements, _steps]) {
      await tester.pumpWidget(const SizedBox());
      await pumpStage(tester, _QHost(stem: q.stem, options: q.options), textScale: 1.3);
      _host(tester).set(StageAnswer.graded(q.options[1].key, StageResult(correct: false, key: q.options[0].key, line: StageLine(card: stageCard('oldRatio')))));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: q.id);
    }
  });
}
