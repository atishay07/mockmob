import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/features/keycards/data/keycards_api.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';

import '../core_data/support/fakes.dart';
import 'support/keycards_fakes.dart';

/// The routes of KEYCARDS-BUILD-SPEC 2e: the app's calls name exactly the spec's paths, query parameters and
/// bodies, and read exactly its answers.
void main() {
  late FakeHttpAdapter http;
  late HttpKeyCardsApi api;
  late List<RequestOptions> seen;
  late FakeReply Function(RequestOptions) answer;

  setUp(() {
    http = FakeHttpAdapter();
    seen = [];
    answer = (_) => const FakeReply(200, {});
    http.handler = (o) {
      seen.add(o);
      return answer(o);
    };
    api = HttpKeyCardsApi(newApiClient(http, now: () => kcNow));
  });

  test('GET /api/keycards reads the home as the spec writes it', () async {
    final server = FakeKeyCardsApi.withProgress();
    answer = (_) => FakeReply(200, server.homeBody());
    final (home, _) = await api.home();
    expect(seen.single.method, 'GET');
    expect(seen.single.path, '/api/keycards');
    expect(home.enabled, isTrue);
    expect(home.subjects.map((s) => s.subject), ['business_studies', 'accountancy']);
    final ch = home.subjects.first.units.first.chapters.single;
    expect(ch.key, kcChapter1);
    expect(ch.ncertBook, 'Business Studies Part 1');
    expect(ch.ncertChapter, 1);
    expect((ch.cards, ch.mustKnow, ch.unlocked), (8, 6, 5));
    expect(ch.state.label, 'Getting there');
    expect(home.subjects.last.options!.choices.map((c) => c.id), ['AFS', 'CAS']);
    expect(home.today.due, 5);
    expect(home.today.reviewsLeft, 10);
  });

  test('GET /api/keycards/deck?chapter= and the locked stubs', () async {
    answer = (_) => FakeReply(200, FakeKeyCardsApi().deckBody(kcChapter1));
    final (deck, body) = await api.deck(kcChapter1);
    expect(seen.single.path, '/api/keycards/deck');
    expect(seen.single.queryParameters, {'chapter': kcChapter1});
    expect(deck.cards, hasLength(5));
    expect(deck.entries.where((e) => e.locked), hasLength(3));
    expect((deck.total, deck.mustKnow, deck.locked), (8, 6, 3));
    expect(body['chapter'], isA<Map<String, dynamic>>());
  });

  test('POST /api/keycards/add takes { chapter } or { cardIds }', () async {
    answer = (_) => const FakeReply(200, {'added': 5, 'today': {'due': 5, 'newLeft': 0, 'minutes': 2}});
    final r = await api.add(chapter: kcChapter1);
    expect(r.added, 5);
    await api.add(cardIds: const ['a', 'b']);
    expect(seen.map((o) => o.path), ['/api/keycards/add', '/api/keycards/add']);
    expect(seen.first.data, {'chapter': kcChapter1});
    expect(seen.last.data, {'cardIds': ['a', 'b']});
  });

  test('GET /api/keycards/due?limit= reads each card with its state', () async {
    final (_, body) = await FakeKeyCardsApi.withProgress().due();
    answer = (_) => FakeReply(200, body);
    final (due, _) = await api.due(limit: 20);
    expect(seen.single.path, '/api/keycards/due');
    expect(seen.single.queryParameters, {'limit': '20'});
    expect(due.cards, hasLength(5));
    expect(due.cards.first.reps, greaterThan(0));
    expect(due.cards.last.isNew, isTrue);
  });

  test('POST /api/keycards/review sends the device time as clientReviewedAt, in UTC', () async {
    answer = (_) => const FakeReply(200, {'ok': true, 'next': {'due_at': '2026-11-03T16:10:00.000Z', 'interval_days': 3}, 'today': {'due': 4}});
    final r = await api.review(cardId: 'c1', rating: 3, mode: 'revise', clientReviewedAt: kcNow);
    expect(seen.single.path, '/api/keycards/review');
    expect(seen.single.data, {'cardId': 'c1', 'rating': 3, 'mode': 'revise', 'clientReviewedAt': kcNow.toUtc().toIso8601String()});
    expect(r.ok, isTrue);
    expect(r.intervalDays, 3);
    expect(r.nextDueAt, DateTime.utc(2026, 11, 3, 16, 10));
  });

  test('a 402 PRO_REQUIRED on a review is Free\'s daily limit', () async {
    answer = (_) => const FakeReply(402, {'error': 'PRO_REQUIRED', 'reason': 'keycard_reviews'});
    await expectLater(api.review(cardId: 'c1', rating: 1, mode: 'study'), throwsA(isA<KeyCardsProRequired>()));
  });

  test('a 404 KEY_CARDS_OFF on any route is "off", and another 404 stays an error', () async {
    answer = (_) => const FakeReply(404, {'error': 'KEY_CARDS_OFF'});
    await expectLater(api.home(), throwsA(isA<KeyCardsOff>()));
    await expectLater(api.line('q1'), throwsA(isA<KeyCardsOff>()));
    answer = (_) => const FakeReply(404, {'error': 'not_found'});
    await expectLater(api.deck('nope'), throwsA(isA<ApiError>()));
  });

  test('GET /api/keycards/line?questionId= reads at most two cards and the source', () async {
    final cards = kcFixtureCards();
    answer = (_) => FakeReply(200, {
      'cards': [for (final c in cards.take(3)) c.toJson()],
      'source': 'matched',
      'left': 2,
    });
    final line = await api.line('q9');
    expect(seen.single.queryParameters, {'questionId': 'q9'});
    expect(line.cards, hasLength(2));
    expect(line.source, 'matched');
    expect(line.left, 2);
    expect(line.shows, isTrue);
    expect(KcLine.parse({'cards': <Object>[], 'source': 'none'}).shows, isFalse);
  });

  test('report, my chapters and the subject option', () async {
    answer = (o) => switch (o.path) {
      '/api/me/chapters' => const FakeReply(200, {
        'subject': 'business_studies',
        'option': null,
        'units': [
          {
            'unit': 'U',
            'chapters': [
              {'key': 'k', 'title': 'T', 'state': 'strong', 'label': 'Holding', 'fading': true, 'n': 12, 'right': 10, 'reason': 'r', 'memory': {'holding': 3, 'added': 5, 'mustKnow': 6}, 'marksLost': 4, 'available': {'questions': 40, 'cards': 8}},
            ],
          },
        ],
      }),
      '/api/me/subject-options' => const FakeReply(200, {'subject': 'mathematics', 'option': 'B2'}),
      _ => const FakeReply(200, {'ok': true}),
    };
    await api.report(cardId: 'c1', reason: 'x' * 400);
    expect(seen.last.path, '/api/keycards/report');
    expect((seen.last.data as Map)['reason'], hasLength(300));
    final mine = await api.myChapters('business_studies');
    expect(seen.last.queryParameters, {'subject': 'business_studies'});
    final k = mine.chapter('k')!;
    expect(k.state.text, 'Holding, fading');
    expect((k.n, k.right, k.marksLost, k.questions, k.cards), (12, 10, 4.0, 40, 8));
    expect(k.memory, (holding: 3, added: 5, mustKnow: 6));
    final set = await api.setOption(subject: 'mathematics', option: 'B2');
    expect(seen.last.method, 'PUT');
    expect(seen.last.data, {'subject': 'mathematics', 'option': 'B2'});
    expect(set, (subject: 'mathematics', option: 'B2'));
  });

  test('a card with no id, front or back is left out, and a strange state reads as not started', () {
    final deck = KcDeck.parse({
      'cards': [
        {'id': 'a', 'front': 'f', 'back': 'b'},
        {'id': 'b', 'front': 'f'},
        {'front': 'f', 'back': 'b'},
        {'id': 'c', 'locked': true, 'kind': 'list', 'label': 'List'},
        'nonsense',
      ],
    });
    expect(deck.entries.map((e) => e.entryId), ['a', 'c']);
    expect(KcChapterState.parse({'state': 'mastered'}).label, 'Not started');
  });
}
