import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

Future<void> pump(WidgetTester tester, Widget screen, {RepairRunState? run, DateTime? now}) => pumpMockmob(
  tester,
  screen,
  size: const Size(384, 2400),
  disableAnimations: true,
  wrapInScaffold: false,
  overrides: reviewOverrides(records: [repairedRecord], run: run, nowUtc: now),
);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the tab offers tonight, skipped questions without a repair key, and the record', (tester) async {
    await pump(tester, const ReviewScreen());
    expect(find.textContaining("'s repair, "), findsOneWidget);
    expect(find.textContaining('Repair 3 mistakes'), findsOneWidget);
    expect(find.text('Not attempted in Mock 2 (3)'), findsOneWidget);
    expect(find.text('See the answer'), findsNWidgets(3));
    expect(find.text('Try it again'), findsNWidgets(3));
    expect(find.text('Checked on fresh questions: not available yet.'), findsOneWidget);
    expect(find.textContaining('mastered'), findsNothing);
  });

  testWidgets('the next key waits while the explanation is being made', (tester) async {
    await pump(
      tester,
      const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
      run: runOf(outcomes: [const OutcomeLoading()]),
    );
    final key = tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Next mistake'));
    expect(key.onPressed, isNull);
    expect(find.text('Correct answer'), findsNothing, reason: 'the key shows only with the server answer');
  });

  testWidgets('an explained mistake shows the correct answer and the worked explanation', (tester) async {
    await pump(
      tester,
      const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
      run: runOf(outcomes: [explained]),
    );
    expect(find.text('Correct answer'), findsOneWidget);
    expect(find.text('Your answer'), findsOneWidget);
    expect(find.text('What happened here'), findsOneWidget);
    expect(find.text('Practise 5 on Partnership'), findsOneWidget);
  });

  testWidgets('the ending receipt is the last acknowledgement, in the student zone', (tester) async {
    await pump(
      tester,
      const RepairEndingScreen(attemptId: 'm7'),
      run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
    );
    expect(find.text('Repair finished. Recorded at 11:21 PM.'), findsOneWidget);
    expect(find.byType(Mobi), findsOneWidget);
    expect(find.text('Repair 1 more mistake'), findsOneWidget);
  });

  testWidgets('nothing repaired: no number, no Mobi, no receipt', (tester) async {
    await pump(
      tester,
      const RepairEndingScreen(attemptId: 'm7'),
      run: runOf(phase: RepairPhase.ending, outcomes: [const OutcomeSetAside(heldByServer: true)]),
    );
    expect(find.text('Nothing was repaired this time'), findsOneWidget);
    expect(find.byType(Mobi), findsNothing);
    expect(find.byType(ReceiptLine), findsNothing);
    expect(find.byType(MonumentalNumber), findsNothing);
  });

  for (final (name, screen, run) in [
    ('tab', const ReviewScreen() as Widget, null),
    ('entry', const RepairScreen(attemptId: 'm7', questionId: 'm7-q0') as Widget, runOf(phase: RepairPhase.entry)),
    ('explained', const RepairScreen(attemptId: 'm7', questionId: 'm7-q0') as Widget, runOf(outcomes: [explained])),
    (
      'ending',
      const RepairEndingScreen(attemptId: 'm7') as Widget,
      runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
    ),
  ]) {
    testWidgets('$name lays out at 200% text on a 360 by 640 phone', (tester) async {
      await pumpMockmob(
        tester,
        screen,
        size: const Size(360, 640),
        textScale: 2,
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(records: [repairedRecord], run: run),
      );
      expect(tester.takeException(), isNull);
    });
  }
}
