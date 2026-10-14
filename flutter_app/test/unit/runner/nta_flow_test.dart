import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/widgets/status_tint.dart' show statusTintColor;
import 'package:mockmob/features/runner/nta/nta_copy.dart';
import 'package:mockmob/features/runner/nta/nta_header.dart' show NtaBar;
import 'package:mockmob/features/runner/nta/nta_paper_theme.dart';
import 'package:mockmob/features/runner/nta/nta_question_paper.dart';
import 'package:mockmob/features/runner/nta/nta_runner_screen.dart';
import 'package:mockmob/features/runner/nta/nta_skin.dart';
import 'package:mockmob/features/runner/screens/submit_screen.dart' show SubmitPage;

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

FakeRunnerSession _nta({int index = 0, Map<String, int>? answers, Set<String>? marked}) =>
    FakeRunnerSession(mode: 'nta', currentIndex: index, answers: answers, marked: marked);

Future<void> _flush(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.pump(const Duration(milliseconds: 1));
  }
}

/// How many lines a text is laid out in: the distinct tops of its selection boxes.
int _lineCount(WidgetTester tester, Finder text) {
  final paragraph = tester.renderObject<RenderParagraph>(text);
  final boxes = paragraph.getBoxesForSelection(TextSelection(baseOffset: 0, extentOffset: paragraph.text.toPlainText().length));
  return {for (final b in boxes) b.top.round()}.length;
}

void _lifecycle(WidgetTester tester, List<AppLifecycleState> states) {
  for (final s in states) {
    tester.binding.handleAppLifecycleStateChanged(s);
  }
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('an NTA session opens the exam skin, not the Night Sheet runner', (tester) async {
    await pumpRunner(tester, session: _nta());
    await _flush(tester);
    expect(find.byType(NtaRunnerView), findsOneWidget);
    expect(find.text('NTA mode'), findsOneWidget, reason: 'the kicker above the subject');
    expect(find.text('Question 1 of 50'), findsOneWidget);
    expect(find.text('0 answered'), findsOneWidget);
    expect(find.text('47:12'), findsOneWidget);
    expect(find.text('Mark for Review & Next'), findsOneWidget);
    expect(find.text('Save & Next'), findsOneWidget);
    expect(find.text('Questions'), findsNothing);
  });

  testWidgets('picking, clearing, marking and moving use the exam keys', (tester) async {
    final s = _nta();
    final h = await pumpRunner(tester, session: s);
    await _flush(tester);

    await tester.tap(find.text('5:3:2'));
    await _flush(tester);
    expect(s.answers['q1'], 0);
    expect(h.haptics.calls, contains('selection'));

    await tester.tap(find.text('Clear response'));
    await _flush(tester);
    expect(s.answers.containsKey('q1'), isFalse);

    await tester.tap(find.text('Mark for Review & Next'));
    await _flush(tester);
    expect(s.marked, contains('q1'));
    expect(s.currentIndex, 1);

    await tester.tap(find.text('Save & Next'));
    await _flush(tester);
    expect(s.currentIndex, 2);

    await tester.tap(find.text('Previous'));
    await _flush(tester);
    expect(s.currentIndex, 1);
  });

  testWidgets('the last question submits from Submit Test', (tester) async {
    final s = _nta(index: 49);
    await pumpRunner(tester, session: s);
    await _flush(tester);
    await tester.tap(find.text('Submit Test'));
    await settle(tester);
    expect(find.text('Submit test?'), findsOneWidget);
    expect(find.text('Exam summary'), findsOneWidget);
    expect(find.textContaining('You have 50 unanswered questions'), findsOneWidget);
  });

  testWidgets('the palette drawer jumps and opens the question paper', (tester) async {
    final s = _nta(answers: {'q1': 1});
    await pumpRunner(tester, session: s);
    await _flush(tester);
    await tester.tap(find.bySemanticsLabel('Question palette'));
    await settle(tester);
    expect(find.text('Asha Verma'), findsOneWidget);
    expect(find.text('1/50 answered'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel(RegExp(r'^Question 7, not visited')));
    await settle(tester);
    expect(s.currentIndex, 6);

    await tester.tap(find.bySemanticsLabel('Question palette'));
    await settle(tester);
    await tester.tap(find.text('Question paper'));
    await settle(tester);
    expect(find.byType(NtaQuestionPaper), findsOneWidget);
    await tester.tap(find.bySemanticsLabel(RegExp(r'^Question 3, ')));
    await settle(tester);
    expect(s.currentIndex, 2);
  });

  testWidgets('leaving the app is a warning that locks answers until the student returns', (tester) async {
    final s = _nta();
    final h = await pumpRunner(tester, session: s);
    await _flush(tester);
    _lifecycle(tester, [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]);
    _lifecycle(tester, [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]);
    await _flush(tester);
    expect(find.text('Warning 1 of 3'), findsOneWidget);
    expect(find.text('Warnings 1/3'), findsOneWidget);
    expect(h.haptics.calls, isNotEmpty);
    expect(h.prefs.values['nta.strikes.sess-1'], 1);

    // Tap the option's row at its left edge: the warning card's button sits over the option's
    // centre, and a tap there would be the return itself.
    final option = tester.getRect(find.text('5:3:2'));
    await tester.tapAt(Offset(12, option.center.dy));
    await _flush(tester);
    expect(s.answers, isEmpty, reason: 'answering waits behind the warning');

    await tester.tap(find.text('Return to the exam'));
    await _flush(tester);
    expect(find.text('Warning 1 of 3'), findsNothing);
    await tester.tap(find.text('5:3:2'));
    await _flush(tester);
    expect(s.answers['q1'], 0);
    await tester.pump(const Duration(milliseconds: 300));
  });

  testWidgets('the warning dims the strip over the status bar with the paper, and the exam colour returns after', (tester) async {
    await pumpRunner(tester, session: _nta());
    await _flush(tester);
    expect(statusTintColor.value, NtaSkin.bar, reason: 'the exam bar runs under the status bar');

    _lifecycle(tester, [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]);
    _lifecycle(tester, [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]);
    await _flush(tester);
    expect(find.text('Warning 1 of 3'), findsOneWidget);
    // The same dim as the card's backdrop, so no bright blue band sits over the dimmed exam.
    final dimmed = Color.alphaBlend(NtaPaper.colors.ground.withValues(alpha: 0.94), NtaSkin.bar);
    expect(statusTintColor.value, dimmed);
    expect(statusTintColor.value, isNot(NtaSkin.bar));

    await tester.tap(find.text('Return to the exam'));
    await _flush(tester);
    expect(statusTintColor.value, NtaSkin.bar);
    await tester.pump(const Duration(milliseconds: 300));
  });

  testWidgets('the exam keys keep each label on one line at 1.3x text', (tester) async {
    await pumpRunner(tester, session: _nta(), textScale: 1.3);
    await _flush(tester);
    for (final label in [NtaCopy.markAndNext, NtaCopy.clearResponse, NtaCopy.previous, NtaCopy.saveAndNext]) {
      expect(_lineCount(tester, find.text(label)), 1, reason: '"$label" wrapped');
    }
  });

  testWidgets('the palette keeps its legend and foot keys on one line at 1.3x text', (tester) async {
    await pumpRunner(tester, session: _nta(), textScale: 1.3);
    await _flush(tester);
    await tester.tap(find.bySemanticsLabel('Question palette'));
    await settle(tester);
    for (final label in [NtaCopy.marked, NtaCopy.answeredMarked, NtaCopy.questionPaper, NtaCopy.submitTestShort]) {
      expect(_lineCount(tester, find.text(label)), 1, reason: '"$label" wrapped');
    }
  });

  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('the exam look and the MockMob look differ at a glance in ${brightness.name} mode', (tester) async {
      await pumpRunner(tester, session: _nta(), brightness: brightness);
      await _flush(tester);
      final container = ProviderScope.containerOf(tester.element(find.byType(NtaRunnerView)));

      Color painted() {
        final box = tester.widget<DecoratedBox>(find.descendant(of: find.byType(NtaBar), matching: find.byType(DecoratedBox)).first);
        return (box.decoration as BoxDecoration).color!;
      }

      expect(painted(), NtaSkin.bar, reason: 'the exam look is the exam blue');
      expect(statusTintColor.value, NtaSkin.bar);

      container.read(ntaStyleProvider.notifier).set(NtaStyle.mockmob);
      await _flush(tester);
      expect(painted(), isNot(NtaSkin.bar), reason: 'the MockMob look has the app bar, not the exam blue');
      expect(statusTintColor.value, painted(), reason: 'the status bar strip follows the bar');
      expect(find.byType(NtaRunnerView), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 300));
    });
  }

  testWidgets('the third warning submits the answers already given', (tester) async {
    final s = _nta(answers: {'q1': 2})..nextOutcome = null;
    final h = await pumpRunner(tester, session: s);
    await _flush(tester);
    for (var i = 0; i < 3; i++) {
      _lifecycle(tester, [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]);
      _lifecycle(tester, [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]);
      await _flush(tester);
      if (i < 2) {
        await tester.tap(find.text('Return to the exam'));
        await _flush(tester);
      }
    }
    expect(s.submits, 1);
    expect(h.prefs.values['nta.strikes.sess-1'], 3);
    await settle(tester);
    expect(s.submitState.value.stage, SubmitStage.sending);
    // The reason stays on screen: the ended card holds until the student continues.
    expect(find.text('Session ended'), findsOneWidget);
    expect(find.textContaining('You reached three warnings'), findsOneWidget);
    expect(find.text('Submitting your answers'), findsOneWidget);
    expect(find.text('Exam summary'), findsNothing, reason: 'the submit page waits for Continue');
    await tester.tap(find.text('Continue'));
    await settle(tester);
    expect(find.text('Exam summary'), findsOneWidget, reason: 'the submit page opens after Continue');
    expect(find.text('Session ended'), findsNothing);
  });

  testWidgets('the ended card says when the answers are in, and Continue still opens the submit page', (tester) async {
    final s = _nta(answers: {'q1': 2});
    final h = await pumpRunner(tester, session: s);
    await _flush(tester);
    for (var i = 0; i < 3; i++) {
      _lifecycle(tester, [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]);
      _lifecycle(tester, [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]);
      await _flush(tester);
      if (i < 2) {
        await tester.tap(find.text('Return to the exam'));
        await _flush(tester);
      }
    }
    await settle(tester);
    expect(h.prefs.values['nta.strikes.sess-1'], isNull, reason: 'the count is cleared once the paper is received');
    expect(find.text('Session ended'), findsOneWidget, reason: 'a fast submit does not skip the reason');
    expect(find.text('Your answers were received.'), findsOneWidget);
    expect(find.text('Submitting your answers'), findsNothing);
    expect(find.text('Exam summary'), findsNothing);
    await tester.tap(find.text('Continue'));
    await settle(tester, ms: SubmitPage.handOffDelay.inMilliseconds + 600);
    expect(h.location, startsWith('/result'), reason: 'Continue opens the submit page, which hands off to the result');
  });

  testWidgets('a notification shade pull is free', (tester) async {
    final s = _nta();
    await pumpRunner(tester, session: s);
    await _flush(tester);
    _lifecycle(tester, [AppLifecycleState.inactive]);
    await tester.pump(const Duration(milliseconds: 600));
    _lifecycle(tester, [AppLifecycleState.resumed]);
    await tester.pump(const Duration(seconds: 2));
    expect(find.textContaining('Warning'), findsNothing);
  });

  testWidgets('switching the exam look keeps the same runner, with no warning', (tester) async {
    final s = _nta();
    final h = await pumpRunner(tester, session: s);
    await _flush(tester);
    final before = tester.state(find.byType(NtaRunnerView));
    final container = ProviderScope.containerOf(tester.element(find.byType(NtaRunnerView)));
    for (final look in [NtaStyle.mockmob, NtaStyle.nta, NtaStyle.mockmob]) {
      container.read(ntaStyleProvider.notifier).set(look);
      await _flush(tester);
      expect(identical(tester.state(find.byType(NtaRunnerView)), before), isTrue, reason: 'a remount opens a new integrity guard');
    }
    expect(find.textContaining('Warning'), findsNothing);
    expect(h.prefs.values['nta.strikes.sess-1'], isNull);
    expect(h.systemUi.calls, ['enter'], reason: 'immersive mode and the wake lock stay on');
    expect(s.submits, 0);
  });

  testWidgets('back asks first, and leaving counts as a warning', (tester) async {
    final s = _nta();
    final h = await pumpRunner(tester, session: s);
    await _flush(tester);
    await tester.binding.handlePopRoute();
    await settle(tester);
    expect(find.textContaining('Leaving counts as warning 1 of 3'), findsOneWidget);
    await tester.tap(find.text('Leave the mock'));
    await settle(tester);
    expect(h.location, '/practice');
    expect(h.prefs.values['nta.strikes.sess-1'], 1);
    expect(h.prefs.values['nta.away.sess-1'], isTrue);
  });
}
