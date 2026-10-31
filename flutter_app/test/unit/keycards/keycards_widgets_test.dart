import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/keycards/data/keycards_rules.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/keycards/screens/keycards_deck_screen.dart';
import 'package:mockmob/features/keycards/screens/keycards_home_screen.dart';
import 'package:mockmob/features/keycards/widgets/keycards_entries.dart';
import 'package:mockmob/features/keycards/widgets/line_you_needed.dart';
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

import '../../helpers/golden_harness.dart';
import 'support/keycards_fakes.dart';

Future<void> _pump(WidgetTester tester, Widget child, List<Override> overrides, {Size size = const Size(360, 1400)}) async {
  // A fresh scope each time (a scope's overrides cannot change in place).
  await tester.pumpWidget(const SizedBox());
  await pumpMockmob(tester, child, overrides: overrides, size: size, disableAnimations: true, wrapInScaffold: true);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

Finder _key(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f.first);
  await tester.tap(f.first);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  group('entries show only while Key cards are on', () {
    testWidgets('off (the default, or the server says off): the Learn row and the chapter link take no space', (tester) async {
      await _pump(tester, const Column(children: [KeyCardsLearnEntry(), KeyCardsChapterLink(subject: 'business_studies', chapter: 'Nature and Significance of Management')]), const []);
      expect(find.text(KeyCardsCopy.title), findsNothing);
      expect(tester.getSize(find.byType(KeyCardsLearnEntry)).height, 0);
      await _pump(tester, const KeyCardsLearnEntry(), keyCardsOverrides(FakeKeyCardsApi(off: true)));
      expect(find.text(KeyCardsCopy.title), findsNothing);
    });

    testWidgets('on: the Learn row says what is due; the chapter link names the chapter its questions use', (tester) async {
      await _pump(
        tester,
        const Column(
          children: [
            KeyCardsLearnEntry(),
            KeyCardsChapterLink(subject: 'business_studies', chapter: 'Nature and Significance of Management'),
            KeyCardsChapterLink(subject: 'business_studies', chapter: 'A chapter with no cards'),
          ],
        ),
        keyCardsOverrides(FakeKeyCardsApi.withProgress()),
      );
      expect(find.text(KeyCardsCopy.title), findsOneWidget);
      expect(find.text(KeyCardsCopy.learnRowDue(5, 2)), findsOneWidget);
      expect(find.text(KeyCardsCopy.chapterLink('Nature and Significance of Management')), findsOneWidget);
      expect(find.textContaining('A chapter with no cards'), findsNothing);
    });
  });

  group('Free and Pro', () {
    testWidgets('Free: "5 of 8 open" on the home and one quiet locked row in the deck; Pro: neither', (tester) async {
      await _pump(tester, const KeyCardsHomeScreen(), keyCardsOverrides(FakeKeyCardsApi.withProgress()));
      expect(find.text(KeyCardsCopy.openOf(5, 8)), findsOneWidget);
      expect(find.text(KeyCardsCopy.reviewsLeft(10)), findsOneWidget);
      await _pump(tester, const KeyCardsHomeScreen(), keyCardsOverrides(FakeKeyCardsApi.withProgress(isPro: true)));
      expect(find.text(KeyCardsCopy.openOf(5, 8)), findsNothing);
      expect(find.textContaining('reviews left'), findsNothing);

      await _pump(tester, const KeyCardsDeckScreen(chapterKey: kcChapter1), keyCardsOverrides(FakeKeyCardsApi()), size: const Size(360, 2400));
      // Read builds its rows as they scroll into view (a chapter can hold 165 cards).
      await tester.scrollUntilVisible(find.text(KeyCardsCopy.locked(3)), 400);
      expect(find.text(KeyCardsCopy.locked(3)), findsOneWidget);
      expect(find.text(KeyCardsCopy.proLine), findsOneWidget);
      expect(find.text(KeyCardsCopy.shareSheet), findsNothing);
      await _pump(tester, const KeyCardsDeckScreen(chapterKey: kcChapter1), keyCardsOverrides(FakeKeyCardsApi(isPro: true)), size: const Size(360, 2400));
      expect(find.textContaining('more cards in this chapter'), findsNothing);
      expect(find.text(KeyCardsCopy.shareSheet), findsOneWidget);
    });

    testWidgets('Add chapter to Revise adds the chapter\'s set and says how many, only after the server answered', (tester) async {
      final api = FakeKeyCardsApi(isPro: true);
      await _pump(tester, const KeyCardsDeckScreen(chapterKey: kcChapter1), keyCardsOverrides(api), size: const Size(360, 2400));
      await _tap(tester, _key(KeyCardsCopy.addToRevise));
      expect(find.text(KeyCardsCopy.added(6)), findsOneWidget);
      expect(api.states.keys.toSet(), KeyCardRules.chapterAddSet(api.cards, kcChapter1, isPro: true).toSet());
    });

    test('the upgrade sheet has its own reason and words, inside the store\'s rules', () {
      final head = ProNudgeCopy.head(ProReason.keycards);
      expect(head.lede, KeyCardsCopy.proLine);
      expect(ProNudgeCopy.sheetHeadline(ProReason.keycards), head.title);
      expect(head.title.length, lessThanOrEqualTo(ProNudgeCopy.sheetHeadlineMax));
    });
  });

  group('a session', () {
    testWidgets('Space shows the answer; 1, 2 and 3 rate it; "4 of 5"; the end shows counts only', (tester) async {
      final api = FakeKeyCardsApi.withProgress(isPro: true);
      await _pump(tester, const KeyCardsDeckScreen(chapterKey: kcChapter1, initialMode: KcMode.study), keyCardsOverrides(api), size: const Size(360, 1600));
      expect(find.text(KeyCardsCopy.position(1, 8)), findsOneWidget);
      expect(find.text(KeyCardsCopy.missed), findsNothing);
      for (final key in [LogicalKeyboardKey.digit2, LogicalKeyboardKey.digit3, LogicalKeyboardKey.digit1]) {
        await tester.sendKeyEvent(LogicalKeyboardKey.space);
        await tester.pump(const Duration(milliseconds: 400));
        expect(find.text(KeyCardsCopy.missed), findsOneWidget);
        await tester.sendKeyEvent(key);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 400));
      }
      expect(find.text(KeyCardsCopy.position(4, 8)), findsOneWidget);
      expect([for (final r in api.reviews) (r['rating'], r['mode'])], [(3, 'study'), (4, 'study'), (1, 'study')]);
      expect(api.reviews.every((r) => r['clientReviewedAt'] == kcNow.toUtc().toIso8601String()), isTrue);
      for (var i = 0; i < 5; i++) {
        await _tap(tester, find.text(KeyCardsCopy.tapToReveal));
        await _tap(tester, _key(KeyCardsCopy.gotIt));
      }
      expect(find.text(KeyCardsCopy.studyDone), findsOneWidget);
      expect(find.text(KeyCardsCopy.studyEnd(missed: 1, gotIt: 6, easy: 1)), findsOneWidget);
    });

    testWidgets('Free over today\'s reviews: the limit is said once, in place, and nothing more is sent', (tester) async {
      final api = FakeKeyCardsApi.withProgress(reviewsLeft: 0);
      await _pump(tester, const KeyCardsDeckScreen(chapterKey: kcChapter1, initialMode: KcMode.study), keyCardsOverrides(api), size: const Size(360, 1600));
      await _tap(tester, find.text(KeyCardsCopy.tapToReveal));
      await _tap(tester, _key(KeyCardsCopy.gotIt));
      expect(find.text(KeyCardsCopy.reviewCapTitle), findsOneWidget);
      expect(api.reviews, isEmpty);
    });

    testWidgets('Last look sends nothing and schedules nothing', (tester) async {
      final api = FakeKeyCardsApi(isPro: true);
      await _pump(tester, const KeyCardsDeckScreen(chapterKey: kcChapter2, initialMode: KcMode.lastLook), keyCardsOverrides(api), size: const Size(360, 1400));
      expect(find.text(KeyCardsCopy.position(1, 3)), findsOneWidget);
      await _tap(tester, _key(KeyCardsCopy.nextCard));
      await _tap(tester, _key(KeyCardsCopy.nextCard));
      await _tap(tester, _key(KeyCardsCopy.finish));
      expect(find.text(KeyCardsCopy.lastLookDone), findsOneWidget);
      expect(api.reviews, isEmpty);
      expect(api.states, isEmpty);
    });
  });

  group('the line you needed', () {
    testWidgets('shows the linked cards and adds them to Revise; hides when there is no line', (tester) async {
      final api = FakeKeyCardsApi.withProgress();
      api.states.clear();
      await _pump(tester, const Column(children: [LineYouNeeded(questionId: 'q-wrong-1'), LineYouNeeded(questionId: 'q-unknown')]), keyCardsOverrides(api));
      expect(find.text(KeyCardsCopy.lineTitle), findsOneWidget);
      expect(find.text(KeyCardsCopy.lineLinked), findsOneWidget);
      await _tap(tester, find.text(KeyCardsCopy.lineAdd));
      expect(find.text(KeyCardsCopy.lineAdded), findsOneWidget);
      expect(api.states, hasLength(2));
    });
  });

  group('the line you needed, when Free has read today\'s lines', () {
    testWidgets('the Pro gate stands in the block\'s place once per screen; lines already read stay', (tester) async {
      final api = FakeKeyCardsApi.withProgress();
      api.states.clear();
      api.links['q-wrong-2'] = api.links['q-wrong-1']!;
      api.gatedLines.addAll(['q-wrong-2', 'q-wrong-3']);
      api.links['q-wrong-3'] = api.links['q-wrong-1']!;
      await _pump(
        tester,
        const Column(children: [LineYouNeeded(questionId: 'q-wrong-1'), LineYouNeeded(questionId: 'q-wrong-2'), LineYouNeeded(questionId: 'q-wrong-3')]),
        [...keyCardsOverrides(api), proNudgesOnProvider.overrideWithValue(true)],
      );
      // The line read today is still there, and the gate shows once, not under every wrong answer.
      expect(find.text(KeyCardsCopy.lineLinked), findsOneWidget);
      expect(find.text(KeyCardsCopy.proLine), findsOneWidget);
      expect(find.text(KeyCardsCopy.upgrade), findsOneWidget);
      expect(find.text(KeyCardsCopy.lineTitle), findsNWidgets(2));
    });
  });

  group('the words', () {
    test('no "mastered", no mastery, no marks to recover, no exclamation marks, sentence case labels', () {
      final all = <String>[
        KeyCardsCopy.title,
        KeyCardsCopy.learnRowNote,
        KeyCardsCopy.learnRowDue(6, 2),
        KeyCardsCopy.dueHead(1),
        KeyCardsCopy.dueHead(6),
        KeyCardsCopy.nothingDue,
        KeyCardsCopy.nothingDueNote,
        KeyCardsCopy.reviseNow,
        KeyCardsCopy.proLine,
        KeyCardsCopy.reviewCapTitle,
        KeyCardsCopy.reviewCapNote,
        KeyCardsCopy.savedOnPhone,
        KeyCardsCopy.lineTitle,
        KeyCardsCopy.emptyChapter,
        KeyCardsCopy.emptyChapterNote,
        KeyCardsCopy.off,
        KeyCardsCopy.offNote,
        KeyCardsCopy.studyEnd(missed: 1, gotIt: 2, easy: 3),
        for (final s in ['none', 'thin', 'weak', 'mid', 'strong']) KeyCardsCopy.stateText(KcStateLabels.of(s), fading: s == 'strong'),
        ...KeyCardsCopy.reportReasons,
        for (final k in ['definition', 'term', 'key_line', 'list', 'difference', 'steps', 'types', 'formula', 'fact', 'example', 'entry', 'quote']) KeyCardsCopy.kindLabel(k),
      ];
      final banned = RegExp(r'master|marks? (you could )?(to )?recover|!|→|->', caseSensitive: false);
      for (final line in all) {
        expect(banned.hasMatch(line), isFalse, reason: line);
        expect(line[0], line[0].toUpperCase(), reason: line);
      }
      // The state labels are the spec's, exactly.
      expect([for (final s in ['none', 'thin', 'weak', 'mid', 'strong']) KcStateLabels.of(s)], ['Not started', 'Too few answers', 'Needs work', 'Getting there', 'Holding']);
    });
  });
}

/// The state labels by state.
abstract final class KcStateLabels {
  static String of(String state) => switch (state) {
    'thin' => KeyCardsCopy.stateThin,
    'weak' => KeyCardsCopy.stateWeak,
    'mid' => KeyCardsCopy.stateMid,
    'strong' => KeyCardsCopy.stateStrong,
    _ => KeyCardsCopy.stateNone,
  };
}
