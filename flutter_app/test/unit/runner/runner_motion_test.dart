import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/runner/widgets/question_enter.dart';
import 'package:mockmob/features/runner/widgets/runner_count.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

Widget _host(Widget child, {bool reduced = false}) => MaterialApp(
  theme: buildTheme(Brightness.dark),
  home: MediaQuery(
    data: const MediaQueryData().copyWith(disableAnimations: reduced),
    child: Scaffold(body: Center(child: child)),
  ),
);

Widget _count(int current) => RunnerCount(
  current: current,
  total: 20,
  style: const TextStyle(fontSize: 30),
  unitColor: Colors.grey,
  semanticsLabel: 'Question $current of 20',
);

double _opacityOf(WidgetTester tester, String text) =>
    tester.widget<Opacity>(find.ancestor(of: find.text(text), matching: find.byType(Opacity)).first).opacity;

void main() {
  setUpAll(loadAppFonts);

  group('the count in the top bar', () {
    testWidgets('slides the old number out while the new one rises in, then only the new one is left', (tester) async {
      await tester.pumpWidget(_host(_count(3)));
      await tester.pump();
      expect(find.byType(MonumentalNumber), findsOneWidget);
      await tester.pumpWidget(_host(_count(4)));
      await tester.pump(const Duration(milliseconds: 60));
      expect(find.byType(MonumentalNumber), findsNWidgets(2), reason: 'both numbers are on screen mid-slide');
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(MonumentalNumber), findsOneWidget);
      // One question, one label for a screen reader: the leaving number never speaks.
      final handle = tester.ensureSemantics();
      expect(find.bySemanticsLabel('Question 4 of 20'), findsOneWidget);
      expect(find.bySemanticsLabel('Question 3 of 20'), findsNothing);
      handle.dispose();
    });

    testWidgets('under reduced motion the number is simply replaced', (tester) async {
      await tester.pumpWidget(_host(_count(3), reduced: true));
      await tester.pump();
      await tester.pumpWidget(_host(_count(4), reduced: true));
      await tester.pump();
      expect(find.byType(MonumentalNumber), findsOneWidget);
    });
  });

  group('a question arriving', () {
    Widget enter() => QuestionEnter(
      direction: 1,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: const [
          EnterItem(order: 0, child: Text('question')),
          EnterItem(order: 3, child: Text('option')),
        ],
      ),
    );

    testWidgets('the options follow the question, a step behind each other, and all arrive', (tester) async {
      await tester.pumpWidget(_host(enter()));
      await tester.pump(const Duration(milliseconds: 90));
      expect(_opacityOf(tester, 'question'), greaterThan(_opacityOf(tester, 'option')));
      expect(_opacityOf(tester, 'option'), lessThan(1));
      await tester.pump(const Duration(seconds: 1));
      expect(_opacityOf(tester, 'question'), 1);
      expect(_opacityOf(tester, 'option'), 1);
    });

    testWidgets('under reduced motion everything is there at once', (tester) async {
      await tester.pumpWidget(_host(enter(), reduced: true));
      await tester.pump();
      expect(_opacityOf(tester, 'question'), 1);
      expect(_opacityOf(tester, 'option'), 1);
    });
  });

  group('in the runner', () {
    testWidgets('choosing an answer sends a dot to the track and the cell inks when it lands, leaving nothing running', (tester) async {
      final handle = tester.ensureSemantics();
      final s = FakeRunnerSession(questions: accountancyQuestions(20), mode: 'quick', mockNumber: null, currentIndex: 5);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text(s.questions[5].options[1].text));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      expect(s.answers['q6'], 1);
      await tester.pump(const Duration(seconds: 2));
      expect(find.bySemanticsLabel('Question 6 of 20, answered'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('under reduced motion the answer is on the track at once', (tester) async {
      final handle = tester.ensureSemantics();
      final s = FakeRunnerSession(questions: accountancyQuestions(20), mode: 'quick', mockNumber: null, currentIndex: 5);
      await pumpRunner(tester, session: s, disableAnimations: true);
      await settle(tester);
      await tester.tap(find.text(s.questions[5].options[1].text));
      await tester.pump();
      expect(find.bySemanticsLabel('Question 6 of 20, answered'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('the palette has a key to the first question without an answer', (tester) async {
      final s = FakeRunnerSession(currentIndex: 2, answers: {'q1': 0, 'q3': 2});
      await pumpRunner(tester, session: s);
      await tester.tap(find.text('Questions'));
      await settle(tester);
      expect(find.text('2 of 50 answered'), findsNothing, reason: 'the number and its unit are drawn apart');
      await tester.tap(find.text('Go to question 2, first not answered'));
      await settle(tester);
      expect(s.calls, contains('goTo 1'));
    });

    testWidgets('a full paper has no jump key on the palette', (tester) async {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(3),
        currentIndex: 0,
        answers: {'q1': 0, 'q2': 1, 'q3': 2},
      );
      await pumpRunner(tester, session: s);
      await tester.tap(find.text('Questions'));
      await settle(tester);
      expect(find.textContaining('first not answered'), findsNothing);
    });

    testWidgets('the submit page takes the student back to the first question still empty', (tester) async {
      final s = FakeRunnerSession(currentIndex: 49, answers: {'q1': 0, 'q3': 2}, marked: {'q3'});
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit');
      await settle(tester);
      expect(find.text('Go to question 3').last, findsOneWidget, reason: 'the first marked question');
      await tester.tap(find.text('Go to question 2').last);
      await settle(tester);
      expect(s.calls, contains('goTo 1'));
    });
  });
}
