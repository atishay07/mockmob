import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/widgets/question_panel.dart' show MarkedOption;
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

  testWidgets('the tab leads with the weak chapter and keeps the record, the papers and the rows under it in one scroll', (tester) async {
    await pump(tester, const ReviewScreen());
    // The lead: what the papers cost, the costliest chapter, the one volt key.
    expect(find.textContaining(RegExp(r'^Your 3 papers lost \d+ marks')), findsOneWidget);
    expect(find.text(ReviewCopy.loseMost), findsOneWidget);
    expect(find.text(ReviewCopy.practiseOnChapter(10)), findsOneWidget);
    expect(find.textContaining(RegExp(r'^Repair \d+ mistakes?, \d+ min$')), findsNothing, reason: "tonight's key is not on the tab any more");
    // Under it, in one scroll and with no switch: Saved repairs, the papers and the past results.
    expect(find.text('History'), findsNothing);
    expect(find.text('To repair'), findsNothing);
    expect(find.text(ReviewCopy.savedRepairsHeading), findsOneWidget);
    expect(find.text('Past results'), findsOneWidget);
    expect(find.textContaining('mastered'), findsNothing);
    // The record's one saved repair says when it was repaired, in a weekday and a 12-hour time, and opens free.
    expect(find.textContaining('Repaired Sun 4 Oct, 11:08\u00A0PM'), findsOneWidget);
    expect(find.text('See your record'), findsOneWidget);
  });

  testWidgets('every chapter says what it lost with its denominator, and the open one has one volt key', (tester) async {
    await pump(tester, const ReviewScreen());
    expect(find.textContaining('marks on offer'), findsWidgets);
    expect(find.textContaining(RegExp(r'Lost \d+ of the \d+ marks')), findsWidgets);
    expect(find.byWidgetPredicate((w) => w is KeyButton && w.variant == KeyVariant.primary), findsOneWidget);
  });

  testWidgets('a skipped question is a free "Try it again" in the foot of its chapter, never a repair', (tester) async {
    await pump(tester, const ReviewScreen());
    // Mock 7 skipped three questions; the lead chapter's foot names the ones it holds as 44 dp chips.
    expect(find.textContaining('left blank. Try'), findsWidgets);
    final chips = find.bySemanticsLabel(RegExp(r'^Try it again, question \d+, Mock \d\. Free\.$'));
    expect(chips, findsWidgets);
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
    final list = find.byType(SingleChildScrollView).first;
    await tester.drag(list, const Offset(0, -2000));
    await tester.pumpAndSettle();
    final share = tester.getRect(find.widgetWithText(KeyButton, 'Share a card').first);
    final viewport = tester.getRect(list);
    // A quiet key is drawn 40 dp tall and takes a finger anywhere in a 48 dp box (MmHitSlop).
    expect(share.height, greaterThanOrEqualTo(40));
    expect(tester.getSemantics(find.widgetWithText(KeyButton, 'Share a card').first).rect.height, greaterThanOrEqualTo(48));
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
    // The key holds its place and works (spinner, taps ignored) instead of sitting grey.
    final key = tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Next mistake'));
    expect(key.loading, isTrue);
    expect(find.text('Correct answer'), findsNothing, reason: 'the key shows only with the server answer');
  });

  testWidgets('an explained mistake folds the question to one line and shows the worked explanation', (tester) async {
    await pump(
      tester,
      const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
      run: runOf(outcomes: [explained]),
    );
    // The paid part leads: the question is one line until it is asked for.
    // The folded line draws the pick and the key as bubbles; TalkBack hears the one sentence.
    expect(find.bySemanticsLabel('Q1. Your pick A. Key B.'), findsOneWidget);
    expect(find.byType(MarkedOption), findsNothing, reason: 'the options stay folded');
    expect(find.text('Where it breaks'), findsOneWidget);
    expect(find.text('This answer cost 6 marks in this session: 5 not earned and 1 penalty.'), findsOneWidget);
    expect(find.text('Practise 5 on Partnership'), findsOneWidget);
    // The small print under the repair: what it cost and what is left, from the server's answer.
    expect(find.text('1 credit used. 8 left.'), findsOneWidget);
    await tester.tap(find.text('Show the question'));
    await tester.pumpAndSettle();
    expect(find.byType(MarkedOption), findsNWidgets(4));
    expect(find.text('Correct answer'), findsOneWidget);
    expect(find.text('Your answer'), findsOneWidget);
    expect(find.bySemanticsLabel('Q1. Your pick A. Key B.'), findsNothing);
  });

  testWidgets('a v2 repair leads with the trap, then the rule to keep', (tester) async {
    final v2 = OutcomeExplained(
      RepairResponse.fromJson({
        'status': 'explained',
        'repair': {
          'trap_type': 'partly_true',
          'trap': 'A names the right total sacrifice.',
          'why_wrong': 'It takes the whole sacrifice from each partner.',
          'another_way': 'Split the sacrifice first, then subtract.',
          'contrast': 'If C took 1/5 from A alone, A would be right. Here both give, so B.',
          'rule': 'Split the sacrifice before you subtract.',
        },
        'chosenIndex': 0,
        'keyIndex': 1,
      }),
      ackedAt: DateTime.utc(2026, 10, 12, 17, 30),
      requestId: 'req-v2',
    );
    await pump(tester, const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'), run: runOf(outcomes: [v2]));
    expect(find.text('A partly true option'), findsOneWidget);
    expect(find.text('Why A looked right'), findsOneWidget);
    expect(find.text('Where it breaks'), findsOneWidget);
    expect(find.text('Another way to see it'), findsOneWidget);
    expect(find.text('Keep this'), findsOneWidget);
    expect(find.text('Split the sacrifice before you subtract.'), findsOneWidget);
    expect(find.text('What happened here'), findsNothing);
    final trapY = tester.getTopLeft(find.text('A partly true option')).dy;
    final ruleY = tester.getTopLeft(find.text('Keep this')).dy;
    expect(trapY, lessThan(ruleY));
  });

  testWidgets('the ending receipt is the last acknowledgement, in the student zone', (tester) async {
    await pump(
      tester,
      const RepairEndingScreen(attemptId: 'm7'),
      run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
    );
    expect(find.text('Repair finished. Recorded at 11:21\u00A0PM.'), findsOneWidget);
    expect(find.byType(MobiCharacter), findsOneWidget);
    expect(find.text('Repair 1 more mistake'), findsOneWidget);
    // The number carries the count; the line carries what the number does not.
    expect(find.textContaining(RegExp(r'\d+ left in Partnership|Nothing left in Partnership')), findsOneWidget);
    expect(find.textContaining('repaired tonight'), findsNothing);
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
      expect(find.text('Repair finished. Recorded at 11:21 PM.'), findsNothing);
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
      expect(find.text('Repair finished. Recorded at 11:21\u00A0PM.'), findsOneWidget);
    });
  });

  testWidgets('nothing repaired: a hero with Mobi and one large word, no number, no receipt, and the same mistakes again', (tester) async {
    await pump(
      tester,
      const RepairEndingScreen(attemptId: 'm7'),
      run: runOf(phase: RepairPhase.ending, outcomes: [const OutcomeSetAside(heldByServer: true)]),
    );
    expect(find.text('Nothing repaired this time'), findsOneWidget);
    final mobi = tester.widget<MobiCharacter>(find.byType(MobiCharacter));
    expect(mobi.interactive, isTrue, reason: 'the ending Mobi answers a tap');
    expect(mobi.tapCycle, MobiTapCycle.standard);
    expect(find.byType(ReceiptLine), findsNothing);
    expect(find.byType(MonumentalNumber), findsNothing);
    expect(find.widgetWithText(KeyButton, 'Try the same mistakes again'), findsOneWidget, reason: 'the key says what it does');
    expect(find.text('3 mistakes, Partnership'), findsOneWidget, reason: 'the run held three mistakes and all are still open');
    expect(find.widgetWithText(KeyButton, 'Repair 1 more mistake'), findsNothing);
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
