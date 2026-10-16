import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/notes/feature_note_view.dart';
import 'package:mockmob/core/notes/feature_notes.dart';
import 'package:mockmob/core/notes/sample_row.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/paper_when.dart';
import 'package:mockmob/features/review/data/repair_check_logic.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/widgets/mistake_map.dart' show MistakeRow;
import 'package:mockmob/features/review/widgets/repair_entry_view.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

/// Owner items F17 and F18 in the app: a repaired mistake says so and when, every mistake names its
/// paper with the date and the 12-hour time, the receipt after Check it held counts only what was
/// answered, and each feature note shows at its moment and then stays gone.
void main() {
  setUpAll(loadAppFonts);

  final clock = ReviewClock('Asia/Kolkata', () => eveningUtc);

  group('which paper and when (F17)', () {
    test('the date and the 12-hour time, in the student\'s own day', () {
      // 12 Oct, 9:41 PM IST is UTC 16:11.
      final text = paperWhen(clock, 'Mock 3', DateTime.utc(2026, 10, 12, 16, 11));
      expect(text, startsWith('Mock 3, 12 Oct, 9:41'));
      expect(text, contains('PM'));
      expect(text, isNot(contains('21:41')));
    });

    test('an after-midnight attempt crosses into the next IST day', () {
      final text = whenText(clock, DateTime.utc(2026, 10, 12, 19, 5));
      expect(text, contains('13 Oct'));
      expect(text, contains('12:35'));
      expect(text, contains('AM'));
    });
  });

  group('saved repairs on the paper the server sends (F17)', () {
    Map<String, dynamic> body(Object? saved) => {
      ...mockJson(id: 'm7', completedAt: DateTime.utc(2026, 10, 12, 16, 11), wrong: {1}),
      'savedRepairs': ?saved,
    };

    test('read by question id, with the time the server made each one', () {
      final detail = AttemptDetail.fromJson(body({'m7-q1': {'repairedAt': '2026-10-11T14:35:00Z'}}));
      expect(detail.savedRepairs.keys, ['m7-q1']);
      expect(detail.savedRepairs['m7-q1'], DateTime.utc(2026, 10, 11, 14, 35));
    });

    test('absent on an older server: empty, never guessed', () {
      expect(AttemptDetail.fromJson(body(null)).savedRepairs, isEmpty);
    });

    test('a row with no readable time is left out', () {
      final detail = AttemptDetail.fromJson(body({'m7-q1': {'repairedAt': 'someday'}, 'm7-q2': 'x', 'm7-q3': {}}));
      expect(detail.savedRepairs, isEmpty);
    });
  });

  group('a mistake row names its paper and its repair (F17)', () {
    MistakeItem itemOf(String attempt, String qid, {List<RepairLocalRecord> records = const []}) {
      final index = buildReviewIndex(allAttempts, records);
      return [for (final g in index.groups) ...g.items].firstWhere((i) => i.attemptId == attempt && i.questionId == qid);
    }

    testWidgets('an open mistake: the paper, the date and the time it was attempted, and no repair line', (tester) async {
      await pumpMockmob(tester, MistakeRow(item: itemOf('m7', 'm7-q0'), clock: clock, onTap: () {}), size: const Size(390, 400));
      expect(find.textContaining('Mock 2, 12 Oct, 10:42'), findsOneWidget);
      expect(find.textContaining('Saved repair'), findsNothing);
    });

    testWidgets('a repaired mistake says its saved repair is there, when it was made, and that it opens free', (tester) async {
      final repaired = RepairLocalRecord(
        attemptId: 'm7',
        questionId: 'm7-q0',
        requestId: 'req-0000000000000007',
        status: RepairLocalStatus.explained,
        ackedAt: DateTime.utc(2026, 10, 12, 17, 5),
      );
      final item = itemOf('m7', 'm7-q0', records: [repaired]);
      expect(item.stage, MistakeStage.repaired);
      await pumpMockmob(tester, MistakeRow(item: item, clock: clock, onTap: () {}), size: const Size(390, 400));
      expect(find.textContaining('Saved repair from 12 Oct, 10:35'), findsOneWidget);
      expect(find.textContaining('Opens free.'), findsOneWidget);
    });
  });

  group('what Repair gives and what it costs, before the call (L13)', () {
    final wallet = AiCredits.fromJson({
      'state': 'available',
      'wallet': {'known': true, 'spendable': 9, 'resetAt': '2026-10-31T18:30:00Z'},
    });

    test('one mistake: the credit line with the balance, and no total beyond it', () {
      final plan = EntryPlan.of(1, wallet, clock);
      expect(plan.line, 'Uses 1 AI credit per mistake. You have 9.');
      expect(plan.after, isNull);
      expect(plan.usesCredits, isTrue);
    });

    test('several mistakes: what the whole repair takes and leaves', () {
      final plan = EntryPlan.of(3, wallet, clock);
      expect(plan.line, 'Uses 1 AI credit per mistake. You have 9.');
      expect(plan.after, 'This repair takes 3 and leaves 6.');
    });

    test('the lines carry no exclamation mark and no dash', () {
      expect(ReviewCopy.givesHeading, 'What Repair gives you');
      for (final line in [ReviewCopy.givesTry, ReviewCopy.givesReason, ReviewCopy.givesCheck, ReviewCopy.givesKey]) {
        expect(line.contains('!'), isFalse);
        expect(line.contains('—'), isFalse);
      }
    });
  });

  group('the receipt after Check it held', () {
    test('right, with a trap and the marks it cost: the owner\'s sentence', () {
      expect(
        CheckCopy.receipt(right: true, source: 'Mock 3', marks: 4, trap: true, held: 1, answered: 1),
        'Fixed. This trap cost you 4 marks in Mock 3. Held 1 of 1.',
      );
    });

    test('one mark is singular; no named trap says mistake', () {
      expect(
        CheckCopy.receipt(right: true, source: 'Mock 3', marks: 1, trap: false, held: 2, answered: 3),
        'Fixed. This mistake cost you 1 mark in Mock 3. Held 2 of 3.',
      );
    });

    test('a miss says so and keeps the same facts', () {
      expect(
        CheckCopy.receipt(right: false, source: 'Mock 3', marks: 4, trap: true, held: 0, answered: 1),
        'Not yet. This trap cost you 4 marks in Mock 3. Held 0 of 1.',
      );
    });

    test('an unknown marking scheme leaves the marks out and never guesses', () {
      final line = CheckCopy.receipt(right: true, source: 'Mock 3', marks: null, trap: true, held: 1, answered: 1);
      expect(line, 'Fixed. This trap was in Mock 3. Held 1 of 1.');
      expect(line, isNot(contains('marks')));
    });

    test('the tally counts only checks that were answered', () {
      expect(HeldTally.of(const [CheckView(), CheckView()]).answered, 0);
      final none = HeldTally.of(const <CheckView>[]);
      expect((none.held, none.answered), (0, 0));
    });
  });

  group('feature notes (F18)', () {
    late MemoryPrefsStore store;
    late ProviderContainer container;

    ProviderContainer makeContainer({String? userId = 'u1'}) => ProviderContainer(
      overrides: [
        authSnapshotProvider.overrideWithBuild((ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: userId)),
        featureNotesStoreProvider.overrideWithValue(store),
      ],
    );

    Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

    setUp(() {
      store = MemoryPrefsStore();
      container = makeContainer();
      container.listen(featureNotesProvider, (_, _) {});
    });
    tearDown(() => container.dispose());

    test('nothing shows before the memory has been read', () {
      final fresh = makeContainer()..listen(featureNotesProvider, (_, _) {});
      addTearDown(fresh.dispose);
      expect(fresh.read(featureNotesProvider).visible(FeatureNote.revise), isFalse);
    });

    test('every note shows once the memory is read and nothing is done', () async {
      await settle();
      final s = container.read(featureNotesProvider);
      for (final n in FeatureNote.values) {
        expect(s.visible(n), isTrue, reason: n.id);
      }
    });

    test('a note closed for good stays closed after the phone is reopened', () async {
      await settle();
      container.read(featureNotesProvider.notifier).done(FeatureNote.revise);
      await settle();
      expect(container.read(featureNotesProvider).visible(FeatureNote.revise), isFalse);
      expect(container.read(featureNotesProvider).visible(FeatureNote.lab), isTrue);
      final again = makeContainer()..listen(featureNotesProvider, (_, _) {});
      addTearDown(again.dispose);
      await settle();
      expect(again.read(featureNotesProvider).visible(FeatureNote.revise), isFalse);
      expect(again.read(featureNotesProvider).visible(FeatureNote.lab), isTrue);
    });

    test('a note shown three times and ignored has said what it had to say', () async {
      await settle();
      final notes = container.read(featureNotesProvider.notifier);
      for (var i = 0; i < FeatureNotesState.maxShows; i++) {
        expect(container.read(featureNotesProvider).visible(FeatureNote.colleges), isTrue);
        notes.impression(FeatureNote.colleges);
      }
      expect(container.read(featureNotesProvider).visible(FeatureNote.colleges), isFalse);
    });

    test('a note closed before the memory was read is kept, not lost', () async {
      container.read(featureNotesProvider.notifier).done(FeatureNote.askMobi);
      await settle();
      expect(container.read(featureNotesProvider).visible(FeatureNote.askMobi), isFalse);
    });

    test('another student on the same phone has their own notes', () async {
      await settle();
      container.read(featureNotesProvider.notifier).done(FeatureNote.revise);
      await settle();
      final other = makeContainer(userId: 'u2')..listen(featureNotesProvider, (_, _) {});
      addTearDown(other.dispose);
      await settle();
      expect(other.read(featureNotesProvider).visible(FeatureNote.revise), isTrue);
    });

    testWidgets('the note is inline, with its words, its key and Got it; Got it closes it and goes nowhere', (tester) async {
      var opened = 0;
      await pumpMockmob(
        tester,
        Padding(
          padding: const EdgeInsets.all(16),
          child: FeatureNoteView(
            note: FeatureNote.revise,
            lead: ReviewCopy.noteReviseLead,
            text: ReviewCopy.noteRevise,
            actionLabel: ReviewCopy.noteReviseAction,
            onAction: () => opened++,
          ),
        ),
        size: const Size(390, 300),
        overrides: [featureNotesStoreProvider.overrideWithValue(store)],
      );
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.textContaining('Revise. ', findRichText: true), findsOneWidget);
      expect(find.byType(Dialog), findsNothing);
      expect(find.byType(BottomSheet), findsNothing);
      await tester.tap(find.widgetWithText(KeyButton, FeatureNoteView.gotItLabel).first);
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.widgetWithText(KeyButton, FeatureNoteView.gotItLabel), findsNothing);
      expect(opened, 0);
    });

    testWidgets('its own key goes to the feature and closes the note', (tester) async {
      var opened = 0;
      await pumpMockmob(
        tester,
        FeatureNoteView(
          note: FeatureNote.revise,
          lead: ReviewCopy.noteReviseLead,
          text: ReviewCopy.noteRevise,
          actionLabel: ReviewCopy.noteReviseAction,
          onAction: () => opened++,
        ),
        size: const Size(390, 300),
        overrides: [featureNotesStoreProvider.overrideWithValue(store)],
      );
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.widgetWithText(KeyButton, ReviewCopy.noteReviseAction).first);
      await tester.pump(const Duration(milliseconds: 50));
      expect(opened, 1);
      expect(find.widgetWithText(KeyButton, ReviewCopy.noteReviseAction), findsNothing);
    });

    test('no note carries hype, an exclamation mark or a dash', () {
      for (final s in [
        ReviewCopy.noteRevise,
        ReviewCopy.noteLab('Mock 3'),
        ReviewCopy.noteColleges,
        ReviewCopy.noteAsk,
        ReviewCopy.noteReviseAction,
        ReviewCopy.noteLabAction,
        ReviewCopy.noteCollegesAction,
      ]) {
        expect(s.contains('!'), isFalse, reason: s);
        expect(s.contains('—'), isFalse, reason: s);
        expect(RegExp(r'\b(amazing|powerful|unlock|supercharge)\b', caseSensitive: false).hasMatch(s), isFalse, reason: s);
      }
    });
  });

  group('empty states that teach', () {
    testWidgets('the sample row says Example in words, takes no taps and is one example to a screen reader', (tester) async {
      await pumpMockmob(
        tester,
        const SampleRow(leading: SampleRank(1), value: '172 / 250', title: 'Best mock', note: 'Your subject and the date show here.'),
        size: const Size(390, 200),
      );
      expect(find.text(SampleRow.tag), findsOneWidget);
      expect(tester.getSemantics(find.byType(SampleRow)).label, startsWith('Example. Best mock'));
    });
  });
}
