// A question on the stage, over the Learn preview's real questions: each stem shape is set as its parts, the options sit at
// the foot of the page in the thumb zone, answer once, pending, right (with its confirm haptic and the streak), wrong (no
// haptic, "Not quite. It\u2019s C.", the line you needed opens in place, clamped to four lines, and the page scrolls only as far
// as the verdict needs and never under the head line), the first question's hint, the locked, explanation, left-out, closed and
// error variants, 48 dp targets and text scale 1.3 at 360 dp.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/mm_spinner.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart' show StageBelowChip;
import 'package:mockmob/features/learn2/stage/stage_pager.dart';
import 'package:mockmob/features/learn2/stage/stage_sci.dart';
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
  const _QHost({required this.stem, required this.options, this.skipped, this.locked, this.streak = 0, this.room = 0, this.above = 0, this.hint, this.sci = false});

  final String stem;

  /// Something above the question on its page (so the head line is not at the page's top), in dp.
  final double above;

  /// The first question's quiet hint above the options.
  final String? hint;
  final bool sci;
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
                hint: widget.hint,
                sci: widget.sci,
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
  Widget _withRoom(Widget q) => widget.room == 0 && widget.above == 0
      ? q
      : Column(children: [if (widget.above > 0) SizedBox(height: widget.above), q, if (widget.room > 0) SizedBox(height: widget.room)]);
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

  testWidgets('wrong: no haptic, the key row outlined, the line you needed opens in place, the head line stays', (tester) async {
    final haptics = StageHaptics();
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options), haptics: haptics);
    final page = tester.state<ScrollableState>(find.ancestor(of: find.text('List-I'), matching: find.byType(Scrollable)).first).position;
    _host(tester).set(StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('oldRatio')))));
    await tester.pump();
    expect(find.text('Not quite. The answer is A.'), findsOneWidget);
    expect(find.textContaining(RegExp(r'The answer is A,')), findsNothing, reason: 'the long form with the option is for a screen reader only');
    expect(tester.widget<StageOptionRow>(_row('B')).state, StageOptionState.wrong);
    expect(tester.widget<StageOptionRow>(_row('A')).state, StageOptionState.key);
    await tester.pumpAndSettle();
    expect(haptics.calls, isEmpty, reason: 'a wrong answer gives no haptic');
    expect(find.text('The line you needed'), findsOneWidget);
    expect(find.textContaining('Goodwill appearing in the books will be'), findsOneWidget);
    expect(find.text('Accountancy Part 1, Ch 2, p. 70'), findsOneWidget);
    // The head line is at the top of the page, so nothing may scroll under it: the page stays where it is.
    expect(page.pixels, 0, reason: 'the head line and the stem never go under the top (R4 ui-correctness#7)');
    expect(find.text('Question 1 of 3'), findsOneWidget);
  });

  testWidgets('after a wrong answer the page scrolls only as far as the verdict needs, 300 ms on, and never under the head line', (tester) async {
    // 300 dp of something above the question (a banner) lets the page scroll before the head line meets the top.
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options, above: 300, room: 900));
    final page = tester.state<ScrollableState>(find.ancestor(of: find.text('List-I'), matching: find.byType(Scrollable)).first).position;
    final viewportTop = tester.getTopLeft(find.byType(StagePager)).dy;
    _host(tester).set(StageAnswer.graded('C', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('oldRatio')))));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(page.pixels, 0, reason: 'it waits 300 ms');
    await tester.pumpAndSettle();
    expect(page.pixels, greaterThan(0), reason: 'then it moves toward the verdict');
    // The head line is still in view: its top is under the 24 dp fade at the page head.
    expect(tester.getTopLeft(find.text('Question 1 of 3')).dy, greaterThanOrEqualTo(viewportTop + 24 - 1));
    expect(find.text('The line you needed'), findsOneWidget);
  });

  testWidgets('the options sit at the foot of the page in the thumb zone; taller than the page it is plain flow', (tester) async {
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    await tester.pumpAndSettle();
    final pager = tester.getRect(find.byType(StagePager));
    final last = tester.getRect(_row('D'));
    // The page is the area less the 40 dp peek, with 24 dp under its last line and the 12 dp flex gap before the (closed) line.
    expect(pager.bottom - 40 - last.bottom, moreOrLessEquals(36, epsilon: 1), reason: 'the last option rests at the foot of its page');
    final stem = tester.getRect(find.textContaining('When a new partner is admitted').first);
    expect(stem.top - pager.top, lessThan(80), reason: 'the head and the stem stay at the top');
    expect(tester.getTopLeft(_row('A')).dy - stem.bottom, greaterThan(40), reason: 'a gap between the stem and the options');

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options, room: 100));
    await tester.pumpAndSettle();
    final page = tester.state<ScrollableState>(find.ancestor(of: find.text('List-I'), matching: find.byType(Scrollable)).first).position;
    expect(page.maxScrollExtent, greaterThan(0), reason: 'a long question scrolls');
  });

  testWidgets('the first question\'s hint reads above the options until it is answered, and is gone for a student who has seen it', (tester) async {
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, hint: 'Pick the answer you think is right.'));
    await tester.pumpAndSettle();
    final hint = tester.getRect(find.text('Pick the answer you think is right.'));
    expect(hint.bottom, lessThanOrEqualTo(tester.getTopLeft(_row('A')).dy), reason: 'read before the options, never under them');
    expect(find.textContaining('Tap the answer'), findsNothing);
    _host(tester).set(const StageAnswer.graded('A', StageResult(correct: true, key: 'A')));
    await tester.pumpAndSettle();
    expect(find.text('Pick the answer you think is right.'), findsNothing);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    await tester.pumpAndSettle();
    expect(find.text('Pick the answer you think is right.'), findsNothing);
  });

  testWidgets('under a wrong answer a chemistry chapter\'s line you needed draws its notation; another chapter\'s never does', (tester) async {
    // The web draws notation in a card\'s front and back and in NCERT\'s line, not in a stem or an option.
    final handle = tester.ensureSemantics();
    final card = KeyCard.tryParse({
      'id': 'c',
      'kind': 'definition',
      'subject': 'chemistry',
      'chapterKey': 'chemistry.solutions',
      'front': 'What is the charge on SO42- in H2SO4?',
      'back': 'The sulphate ion, SO42-, comes from H2SO4.',
      'quote': 'The sulphate ion, SO42-, comes from H2SO4.',
      'blanks': <String>[],
    })!;
    List<StageSciSpan> spans() {
      final out = <StageSciSpan>[];
      for (final r in tester.widgetList<RichText>(find.descendant(of: find.byType(StageLineBlock), matching: find.byType(RichText), skipOffstage: false))) {
        r.text.visitChildren((s) {
          if (s is StageSciSpan) out.add(s);
          return true;
        });
      }
      return out;
    }

    for (final sci in [true, false]) {
      await tester.pumpWidget(const SizedBox());
      await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, sci: sci));
      _host(tester).set(StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(card: card))));
      await tester.pumpAndSettle();
      expect(find.byType(StageLineBlock), findsOneWidget);
      if (sci) {
        expect(spans().map((s) => s.run), containsAll(['2', '4']), reason: 'SO42- and H2SO4');
        expect(spans().where((s) => s.raised).map((s) => s.run), contains('2−'), reason: 'the charge is raised, with a true minus sign');
        expect(find.bySemanticsLabel(RegExp('SO42')), findsWidgets, reason: 'a screen reader reads the same characters');
      } else {
        expect(spans(), isEmpty, reason: 'only a chemistry chapter is read as notation (an Accountancy "H2" is never a subscript)');
      }
    }
    handle.dispose();
  });

  testWidgets('the line you needed shows four lines behind a fade; "Read the whole line" opens all of it', (tester) async {
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    _host(tester).set(StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(card: stageCard('economic')))));
    await tester.pumpAndSettle();
    final more = find.text('Read the whole line', skipOffstage: false);
    expect(more, findsOneWidget, reason: 'a two-paragraph line is clamped');
    final clamp = find.byType(StageClampLine, skipOffstage: false);
    expect(tester.getSize(clamp).height, lessThan(StageClampLine.maxHeight + 60), reason: 'about four lines and the key');
    await tester.ensureVisible(more);
    await tester.tap(more);
    await tester.pumpAndSettle();
    expect(find.text('Read the whole line'), findsNothing, reason: 'once opened, whole');
    expect(find.textContaining('Public debt', skipOffstage: false), findsWidgets);
  });

  test('the clamp grows with the text size, as the web\'s em clamp does (the 1.3 walk cut the line after two lines)', () {
    expect(StageClampLine.heightFor(TextScaler.noScaling), StageClampLine.maxHeight);
    expect(StageClampLine.heightFor(const TextScaler.linear(1.3)), closeTo(126.8, 0.01));
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

  for (final scale in [1.0, 1.3]) {
    testWidgets('the "Options below" chip sits in a band under the text and never over the stem last line (360 x 800, text $scale; walk I5)', (tester) async {
      // The shortest plain stem that pushes option A under the fold: its last line is then the one nearest the chip.
      String stemOf(int words) => 'Premium received on a new partner joining the firm is shared. ${List.filled(words, 'goodwill').join(' ')} Which of the following is correct.';
      var words = 10;
      for (;; words += 4) {
        await tester.pumpWidget(const SizedBox());
        await pumpStage(tester, _QHost(stem: stemOf(words), options: _plain.options), textScale: scale);
        await tester.pumpAndSettle();
        if (find.text('Options below').evaluate().isNotEmpty) break;
        expect(words, lessThan(400), reason: 'a long enough stem must push the options under the fold');
      }
      final chip = tester.getRect(find.byType(StageBelowChip));
      final viewport = tester.getRect(find.byType(SingleChildScrollView));
      expect(chip.overlaps(viewport), isFalse, reason: 'the chip is outside the scrolling text, so it cannot cover any of it');
      // The stem's last line, wherever it is on the page.
      final paragraph = tester.renderObject<RenderParagraph>(find.byWidgetPredicate((w) => w is RichText && w.text.toPlainText().contains('Which of the following is correct.')).first);
      final boxes = paragraph.getBoxesForSelection(TextSelection(baseOffset: 0, extentOffset: paragraph.text.toPlainText().length));
      final last = boxes.last.toRect().shift(paragraph.localToGlobal(Offset.zero));
      // What of the line the page shows (the rest waits under the band, to be scrolled to) is clear of the chip.
      final shown = last.intersect(viewport);
      expect(shown.width <= 0 || shown.height <= 0 || !shown.overlaps(chip), isTrue, reason: 'the last line $last is clear of the chip $chip');
    });
  }

  testWidgets('a right answer on a long question brings the verdict into view when it landed under the fold (I8)', (tester) async {
    await pumpStage(tester, _QHost(stem: _lists.stem, options: _lists.options, above: 500), textScale: 1.3);
    await tester.pumpAndSettle();
    // Read to the end of the page, so the last option rests at its foot and the verdict will have no room under it.
    final scroll = find.byType(SingleChildScrollView);
    await tester.drag(scroll, const Offset(0, -2000));
    await tester.pumpAndSettle();
    _host(tester).set(const StageAnswer.graded('A', StageResult(correct: true, key: 'A')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();
    final verdict = tester.getRect(find.byType(StageVerdict));
    final viewport = tester.getRect(scroll);
    expect(verdict.top, greaterThanOrEqualTo(viewport.top));
    expect(verdict.bottom, lessThanOrEqualTo(viewport.bottom), reason: 'the verdict is on the page, not under its foot');
  });

  testWidgets('a locked line says why and offers See Pro; no card: Why and the explanation', (tester) async {
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    _host(tester).set(const StageAnswer.graded('B', StageResult(correct: false, key: 'A', line: StageLine(locked: true, text: 'Free shows 3 lines a day. This one is on Pro.'))));
    await tester.pumpAndSettle();
    expect(find.text('The line you needed'), findsOneWidget);
    expect(find.text('Free shows 3 lines a day. This one is on Pro.', skipOffstage: false), findsOneWidget);
    await tester.ensureVisible(find.text('See Pro'));
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
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, skipped: 'This question was just updated, so we skipped it.'));
    expect(find.byType(StageOptionRow), findsNothing);
    expect(find.text('This question was just updated, so we skipped it.'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options, locked: 'This feed has ended, so this answer wasn\'t counted.'));
    expect(find.byType(StageOptionRow), findsNWidgets(4));
    await tester.tap(_row('A'));
    await tester.pump();
    expect(_host(tester).chosen, isEmpty);
    expect(find.text('This feed has ended, so this answer wasn\'t counted.'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _QHost(stem: _plain.stem, options: _plain.options));
    await tester.tap(_row('A'));
    _host(tester).set(const StageAnswer.pending('A'));
    await tester.pump();
    _host(tester).set(null, err: 'That answer wasn\'t saved. Try again.');
    await tester.pump();
    expect(find.text('That answer wasn\'t saved. Try again.'), findsOneWidget);
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
