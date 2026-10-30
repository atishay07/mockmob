import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/models/mistake_lab_traps.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/keycards/data/keycards_cache.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/keycards/data/keycards_providers.dart' show keyCardsApiProvider, keyCardsPrefsStoreProvider;
import 'package:mockmob/features/keycards/data/keycards_rules.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/review/again/review_again_copy.dart';
import 'package:mockmob/features/review/again/review_again_entry.dart';
import 'package:mockmob/features/review/revise/revise_copy.dart';
import 'package:mockmob/features/review/revise/revise_data.dart';
import 'package:mockmob/features/review/revise/revise_screen.dart';

import '../../golden/review/review_golden_support.dart' show reviewOverrides;
import '../../helpers/golden_harness.dart';
import 'support/keycards_fakes.dart';

/// The server's due cards for the student with progress (five: three due, two new), as `/api/keycards/due`
/// and the merged Revise queue both carry them.
List<Json> _due() {
  final api = FakeKeyCardsApi.withProgress();
  final states = [
    for (final c in api.cards)
      if (api.states[c.id] case final s?) KcDueCard(card: c, reps: s.reps, lapses: s.lapses, due: s.due),
  ];
  return [for (final d in KeyCardRules.dueQueue(states, now: kcNow, newAllowanceLeft: KeyCardRules.freeNewPerDay)) d.toJson()];
}

/// A merged queue (`?queue=1`) with the server's Key cards in it: [questions] wrong answers back, then the cards.
Json _queueBody({int questions = 0, List<Json>? keyCards}) {
  final cards = keyCards ?? _due();
  return {
    'version': 2,
    'state': questions > 0 ? 'ready' : 'empty',
    'today': '2026-10-31',
    'cap': 10,
    'due': questions,
    'shown': 0,
    'answeredToday': 0,
    'minutes': 0,
    'boxes': [questions, 0, 0, 0],
    'cards': 0,
    'head': 'Nothing to revise today',
    'next': 'Questions you get wrong in a paper or a practice set come back here after 1, 3, 7 and 21 days.',
    'items': <dynamic>[],
    'queue': {
      'items': [
        for (var i = 0; i < questions; i++)
          {
            'kind': 'question',
            'questionId': 'rq$i',
            'subject': 'business_studies',
            'chapter': 'Planning',
            'question': 'Which is the first step of the planning process?',
            'options': ['Developing premises', 'Setting objectives', 'Implementing the plan', 'Follow-up action'],
            'box': 1,
          },
        for (final c in cards) {'kind': 'keycard', 'cardId': c['id'], 'card': c},
      ],
      'counts': {'questions': questions, 'again': 0, 'checks': 0, 'cards': 0, 'back': questions, 'keycards': cards.length},
      'total': questions + cards.length,
      // The website's own sum: about 40 seconds a question, 15 a Key card, each rounded up.
      'minutes': (questions * 40 / 60).ceil() + (cards.length * 15 / 60).ceil(),
    },
  };
}

class _Revise implements ReviseApi {
  _Revise(this.body, {this.failWith});

  final Json? body;
  final Object? failWith;

  @override
  Future<ReviseRead> read({required int cap}) async {
    if (failWith != null) throw failWith!;
    return ReviseRead.parse({...?body, 'cap': cap});
  }

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) => throw StateError('not in these tests');
}

Future<void> _pump(WidgetTester tester, List<Override> overrides) async {
  await pumpMockmob(tester, const ReviseScreen(), overrides: overrides, size: const Size(390, 1600), disableAnimations: true, wrapInScaffold: false);
  for (var i = 0; i < 3; i++) {
    await tester.pump(const Duration(milliseconds: 300));
  }
}

Finder _key(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f.first);
  await tester.tap(f.first);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  group('the merged Revise queue', () {
    test('Key cards the server merged are counted apart, so nothing is counted twice', () {
      final queue = ReviseQueue.tryParse(asJson(_queueBody(questions: 2)['queue']))!;
      expect(queue.back, hasLength(2));
      expect(queue.keyCards, 5);
      // The head counts what the phone plays from its own sources; the Key cards are added by Revise.
      expect(queue.total, 2);
      expect(queue.minutes, 2 + 2);
      expect(queue.minutesWithoutKeyCards, 2);
      expect(ReviseQueue.keyCardMinutes(5), KeyCardRules.minutesFor(5));
      expect(ReviseQueue.keyCardMinutes(0), 0);
    });

    test('an older server, with no Key cards in its queue, reads as before', () {
      final queue = ReviseQueue.tryParse(asJson(_queueBody(questions: 1, keyCards: const [])['queue']))!;
      expect(queue.keyCards, 0);
      expect(queue.minutesWithoutKeyCards, queue.minutes);
    });
  });

  group('Revise plays Key cards as its third kind of item', () {
    testWidgets('the head counts each card once; a rating is sent as a revise review with the phone\'s time', (tester) async {
      final api = FakeKeyCardsApi.withProgress();
      await _pump(tester, [
        ...keyCardsOverrides(api),
        reviseApiProvider.overrideWithValue(_Revise(_queueBody())),
        revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ]);
      expect(find.text(ReviseCopy.runHead(5, 2)), findsOneWidget);
      expect(find.text(KeyCardsCopy.mixKeyCards(5)), findsOneWidget);
      expect(find.text(KeyCardsCopy.position(1, 5)), findsOneWidget);
      // A run of only Key cards has no questions, so none of the question-only controls.
      expect(find.text(ReviseCopy.questionsADay), findsNothing);
      expect(find.text(ReviseCopy.scheduleTitle), findsNothing);

      await _tap(tester, _key(KeyCardsCopy.tapToReveal));
      await _tap(tester, _key(KeyCardsCopy.gotIt));
      expect(api.reviews.single['mode'], KeyCardRules.modeRevise);
      expect(api.reviews.single['rating'], KeyCardRules.gotIt);
      expect(api.reviews.single['clientReviewedAt'], kcNow.toUtc().toIso8601String());
      expect(find.text(KeyCardsCopy.position(2, 5)), findsOneWidget);
    });

    testWidgets('offline: Revise\'s questions cannot be read, and the cards this phone kept play on their own', (tester) async {
      final api = FakeKeyCardsApi.withProgress(failWith: kcOffline);
      final store = MemoryPrefsStore()
        ..values[KeyCardsCache.dueKey] = jsonEncode({
          'user': 'u1',
          'savedAt': kcNow.subtract(const Duration(hours: 1)).toUtc().toIso8601String(),
          'body': {'cards': _due(), 'today': {'due': 5, 'newLeft': 5, 'reviewsLeft': 10, 'minutes': 2}},
        });
      await _pump(tester, [
        ...keyCardsOverrides(api, store: store),
        reviseApiProvider.overrideWithValue(_Revise(null, failWith: kcOffline)),
        revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ]);
      expect(find.text(KeyCardsCopy.questionsWaitOffline), findsOneWidget);
      expect(find.text('${KeyCardsCopy.mixKeyCards(5)}. ${KeyCardsCopy.asOf('8:40 PM')}'), findsOneWidget);
      expect(find.text(ReviseCopy.unavailable), findsNothing);

      await _tap(tester, _key(KeyCardsCopy.tapToReveal));
      await _tap(tester, _key(KeyCardsCopy.missed));
      // Nothing reached the server; the rating waits on the phone and the card leaves the kept queue.
      expect(api.reviews, isEmpty);
      expect(find.text(KeyCardsCopy.savedOnPhone), findsOneWidget);
      expect(find.text(KeyCardsCopy.position(2, 5)), findsOneWidget);
    });

    testWidgets('offline with nothing kept: Revise says it cannot be read, as before', (tester) async {
      await _pump(tester, [
        ...keyCardsOverrides(FakeKeyCardsApi.withProgress(failWith: kcOffline)),
        reviseApiProvider.overrideWithValue(_Revise(null, failWith: kcOffline)),
        revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ]);
      expect(find.text(ReviseCopy.unavailable), findsOneWidget);
      expect(find.text(KeyCardsCopy.questionsWaitOffline), findsNothing);
    });
  });

  group('Review\'s Revise row', () {
    Future<void> pumpRow(WidgetTester tester, {required int questions, required bool cards}) async {
      final api = FakeKeyCardsApi.withProgress();
      if (!cards) api.states.clear();
      await pumpMockmob(
        tester,
        const ReviewAgainRow(),
        overrides: [
          ...reviewOverrides(revise: ReviseRead.parse({..._queueBody(questions: questions, keyCards: cards ? null : const [])})),
          keyCardsApiProvider.overrideWithValue(api),
          keyCardsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
          reviseApiProvider.overrideWithValue(_Revise(_queueBody(questions: questions, keyCards: cards ? null : const []))),
          revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
        size: const Size(390, 400),
        disableAnimations: true,
      );
      for (var i = 0; i < 3; i++) {
        await tester.pump(const Duration(milliseconds: 300));
      }
    }

    testWidgets('shows when only Key cards are due, counting the cards and their minutes', (tester) async {
      await pumpRow(tester, questions: 0, cards: true);
      expect(find.text(ReviewAgainCopy.reviseTitle), findsOneWidget);
      expect(find.text(KeyCardsCopy.learnRowDue(5, KeyCardRules.minutesFor(5))), findsOneWidget);
    });

    testWidgets('adds the cards to the questions due', (tester) async {
      await pumpRow(tester, questions: 2, cards: true);
      expect(find.text(KeyCardsCopy.learnRowDue(7, 2 + KeyCardRules.minutesFor(5))), findsOneWidget);
    });

    testWidgets('stays out of the way with nothing due at all', (tester) async {
      await pumpRow(tester, questions: 0, cards: false);
      expect(find.text(ReviewAgainCopy.reviseTitle), findsNothing);
    });
  });
}
