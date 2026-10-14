import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationSlot;

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

Future<void> pump(WidgetTester tester, Widget screen, {RepairRunState? run, DateTime? now, MemoryRhythmSeen? seen, MemoryPrefsStore? rhythmStore}) => pumpMockmob(
  tester,
  screen,
  size: const Size(384, 2400),
  disableAnimations: true,
  wrapInScaffold: false,
  overrides: reviewOverrides(records: [repairedRecord], run: run, nowUtc: now, seen: seen, rhythmStore: rhythmStore),
);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the tab offers tonight, skipped questions without a repair key, and the record', (tester) async {
    await pump(tester, const ReviewScreen());
    expect(find.textContaining("'s repair, "), findsOneWidget);
    expect(find.textContaining('Start, about'), findsOneWidget);
    expect(find.text('Not attempted in Mock 2 (3)'), findsOneWidget);
    expect(find.text('Checked on fresh questions: not available yet.'), findsOneWidget);
    expect(find.textContaining('mastered'), findsNothing);
  });

  testWidgets('skipped questions sit in one collapsed group with their count until it is opened', (tester) async {
    await pump(tester, const ReviewScreen());
    // Closed: the count and the way in, no per-question action pair.
    expect(find.text('Not attempted in Mock 2 (3)'), findsOneWidget);
    expect(find.text('See the answer'), findsNothing);
    expect(find.text('Try it again'), findsNothing);
    final group = find.bySemanticsLabel(RegExp(r'^Not attempted in Mock 2 \(3\)\..*Show the questions$'));
    expect(group, findsOneWidget);

    await tester.tap(find.text('Not attempted in Mock 2 (3)'));
    await tester.pumpAndSettle();
    expect(find.text('See the answer'), findsNWidgets(3));
    expect(find.text('Try it again'), findsNWidgets(3));
    expect(find.bySemanticsLabel(RegExp(r'Hide the questions$')), findsOneWidget);

    await tester.tap(find.text('Not attempted in Mock 2 (3)'));
    await tester.pumpAndSettle();
    expect(find.text('See the answer'), findsNothing);
  });

  testWidgets('the repair ending leaves no dead gap under Share a card', (tester) async {
    // A phone-height viewport, so the list scrolls and its end can be measured.
    await pumpMockmob(
      tester,
      const RepairEndingScreen(attemptId: 'm7'),
      size: const Size(384, 640),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(
        records: [repairedRecord],
        run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
      ),
    );
    final list = find.byType(ListView);
    await tester.drag(list, const Offset(0, -2000));
    await tester.pumpAndSettle();
    final share = tester.getRect(find.widgetWithText(KeyButton, 'Share a card').first);
    final viewport = tester.getRect(list);
    expect(share.height, greaterThanOrEqualTo(48));
    // The list ends one list padding (16) plus a 4 dp spacer under the key; the pinned keys add
    // their own top padding. Anything over 32 dp is the dead gap the device walk-through saw.
    expect(viewport.bottom - share.bottom, lessThanOrEqualTo(32));
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
    expect(find.byType(MobiCharacter), findsOneWidget);
    expect(find.text('Repair 1 more mistake'), findsOneWidget);
  });

  group('the repairFinished moment', () {
    // Acknowledged repairs carry the server's requestId: the stable part of the moment's id.
    final acked = OutcomeExplained(RepairResponse.fromJson(explainedJson()), ackedAt: DateTime.utc(2026, 10, 12, 17, 38), requestId: 'req-a');
    final acked2 = OutcomeExplained(RepairResponse.fromJson(explainedJson()), ackedAt: DateTime.utc(2026, 10, 12, 17, 51), requestId: 'req-b');

    testWidgets('fires into a slot the ending mounts, in the receipt place, said once', (tester) async {
      final seen = MemoryRhythmSeen();
      await pump(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        run: runOf(phase: RepairPhase.ending, outcomes: [acked, acked2], index: 1),
        seen: seen,
      );
      await tester.pumpAndSettle();
      expect(seen.ids, {'repair:m7:req-a'});
      final slot = find.byType(CelebrationSlot);
      expect(slot, findsOneWidget);
      expect(find.descendant(of: slot, matching: find.text('Repair finished. Recorded at 11:21 PM.')), findsOneWidget);
      expect(find.text('Repair finished. Recorded at 11:21 PM.'), findsOneWidget, reason: 'the screen leaves its own receipt out');
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(find.descendant(of: slot, matching: find.byType(MobiCharacter)), findsNothing, reason: 'an L1 moment has no Mobi of its own');
    });

    testWidgets('a first repair is said by the moment, with one Mobi', (tester) async {
      final seen = MemoryRhythmSeen();
      await pump(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        run: runOf(phase: RepairPhase.ending, outcomes: [acked, acked2], index: 1, repairedBefore: false),
        seen: seen,
      );
      await tester.pumpAndSettle();
      expect(seen.ids, containsAll(['repair:m7:req-a', 'first_repair']));
      expect(find.descendant(of: find.byType(CelebrationSlot), matching: find.text('That was your first repair.')), findsOneWidget);
      expect(find.text('This is your first repair.'), findsNothing);
      expect(find.byType(MobiCharacter), findsOneWidget, reason: "the moment's Mobi hop is the one Mobi");
      expect(find.descendant(of: find.byType(CelebrationSlot), matching: find.byType(MobiCharacter)), findsOneWidget);
    });

    testWidgets('with rhythm turned off nothing is spent and the screen keeps its receipt', (tester) async {
      final seen = MemoryRhythmSeen();
      final store = MemoryPrefsStore()..values['rhythm_hidden_u1'] = true;
      await pump(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        run: runOf(phase: RepairPhase.ending, outcomes: [acked, acked2], index: 1),
        seen: seen,
        rhythmStore: store,
      );
      await tester.pumpAndSettle();
      expect(seen.ids, isEmpty);
      expect(find.byType(CelebrationSlot), findsNothing);
      expect(find.text('Repair finished. Recorded at 11:21 PM.'), findsOneWidget);
    });
  });

  testWidgets('nothing repaired: no number, no Mobi, no receipt', (tester) async {
    await pump(
      tester,
      const RepairEndingScreen(attemptId: 'm7'),
      run: runOf(phase: RepairPhase.ending, outcomes: [const OutcomeSetAside(heldByServer: true)]),
    );
    expect(find.text('Nothing was repaired this time'), findsOneWidget);
    expect(find.byType(MobiCharacter), findsNothing);
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
