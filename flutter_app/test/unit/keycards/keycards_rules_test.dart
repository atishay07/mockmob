import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/keycards/data/keycards_rules.dart';

import 'support/keycards_fakes.dart';

KcDueCard _due(KeyCard c, {required DateTime? due, int reps = 1}) => KcDueCard(card: c, reps: reps, due: due);

void main() {
  final cards = kcFixtureCards();
  final ch1 = [for (final c in cards) if (c.chapterKey == kcChapter1) c];
  final now = kcNow;

  group('the website\'s KEYCARD_RULES, held equal', () {
    test('limits, ratings and the exam horizon are the spec\'s numbers', () {
      expect(KeyCardRules.retention, 0.9);
      expect(KeyCardRules.examHorizon, '2027-05-15');
      expect(KeyCardRules.freeTastePerChapter, 5);
      expect(KeyCardRules.freeReviewsPerDay, 10);
      expect(KeyCardRules.freeNewPerDay, 5);
      expect(KeyCardRules.freeLineNeededPerDay, 3);
      expect(KeyCardRules.proNewPerDayChoices, [10, 15, 25]);
      expect(KeyCardRules.proNewPerDayDefault, 15);
      expect(KeyCardRules.overduePauseNew, 40);
      expect(KeyCardRules.minutesPerCard, 0.25);
      expect([KeyCardRules.missed, KeyCardRules.gotIt, KeyCardRules.easy], [1, 3, 4]);
    });

    test('about how long: 15 seconds a card, at least a minute when there is anything', () {
      expect(KeyCardRules.minutesFor(0), 0);
      expect(KeyCardRules.minutesFor(1), 1);
      expect(KeyCardRules.minutesFor(4), 1);
      expect(KeyCardRules.minutesFor(5), 2);
      expect(KeyCardRules.minutesFor(20), 5);
    });
  });

  group('gating (deckView, chapterAddSet)', () {
    test('Free sees the first five Must-know cards of each chapter whole, in book order, and the rest as locked stubs', () {
      final view = KeyCardRules.deckView(cards, isPro: false);
      List<KeyCard> must(String chapter) => [for (final c in cards) if (c.chapterKey == chapter && c.mustKnow) c]..sort(KeyCardRules.bookOrder);
      final open1 = [for (final e in view) if (!e.locked && e.card!.chapterKey == kcChapter1) e.card!.order];
      expect(open1, [for (final c in must(kcChapter1).take(5)) c.order]);
      expect(open1, hasLength(5));
      final locked = [for (final e in view) if (e.locked) e];
      expect(locked, hasLength(cards.length - [for (final c in cards.map((c) => c.chapterKey).toSet()) ...must(c).take(5)].length));
      expect(locked.every((e) => e.card == null && e.id != null && e.kind != null), isTrue);
      // Good-to-know cards are never open on Free.
      expect(view.where((e) => !e.locked && !e.card!.mustKnow), isEmpty);
      // A locked stub carries no words of the card.
      for (final e in locked) {
        expect(e.toJson().keys.toSet(), {'id', 'kind', 'label', 'locked'});
      }
    });

    test('Pro sees every card whole', () {
      expect(KeyCardRules.deckView(cards, isPro: true).every((e) => !e.locked), isTrue);
    });

    test('cards at the same place in the book go by id, as on the website (Must-know is not a tie-break)', () {
      final a = KeyCard(id: 'a', kind: 'fact', front: 'f', back: 'b', chapterKey: 'x', order: 10);
      final b = KeyCard(id: 'b', kind: 'fact', front: 'f', back: 'b', chapterKey: 'x', order: 10, importance: 'must');
      expect([for (final e in KeyCardRules.deckView([b, a], isPro: true)) e.card!.id], ['a', 'b']);
    });

    test('adding a chapter: Pro adds every Must-know card, Free only the taste cards, Good-to-know never by the chapter key', () {
      final pro = KeyCardRules.chapterAddSet(cards, kcChapter1, isPro: true);
      expect(pro, hasLength(6));
      expect(pro.every((id) => ch1.firstWhere((c) => c.id == id).mustKnow), isTrue);
      final free = KeyCardRules.chapterAddSet(cards, kcChapter1, isPro: false);
      expect(free, hasLength(5));
      expect(free.toSet(), KeyCardRules.tasteIds(ch1));
    });
  });

  group('the queue (dueQueue)', () {
    test('due cards first, Must-know first then by when they fell due; then new cards in book order up to the allowance', () {
      final good = ch1.firstWhere((c) => !c.mustKnow);
      final must = ch1.where((c) => c.mustKnow).toList();
      final states = [
        _due(good, due: now.subtract(const Duration(days: 3))),
        _due(must[2], due: now.subtract(const Duration(hours: 1))),
        _due(must[1], due: now.subtract(const Duration(hours: 5))),
        _due(must[0], due: now.add(const Duration(days: 1))), // not due yet
        _due(must[4], due: now, reps: 0), // new
        _due(must[3], due: now, reps: 0), // new
      ];
      final q = KeyCardRules.dueQueue(states, now: now, newAllowanceLeft: 1);
      expect([for (final s in q) s.card.id], [must[1].id, must[2].id, good.id, must[3].id]);
    });

    test('new cards pause while more than 40 are overdue', () {
      final overdue = [
        for (var i = 0; i < 41; i++)
          _due(KeyCard(id: 'o$i', kind: 'fact', front: 'f', back: 'b', order: i), due: now.subtract(Duration(minutes: i + 1))),
      ];
      final fresh = _due(ch1.first, due: now, reps: 0);
      final q = KeyCardRules.dueQueue([...overdue, fresh], now: now, newAllowanceLeft: 5, limit: 100);
      expect(q.any((s) => s.isNew), isFalse);
      final fewer = KeyCardRules.dueQueue([...overdue.take(40), fresh], now: now, newAllowanceLeft: 5, limit: 100);
      expect(fewer.last.card.id, ch1.first.id);
    });

    test('suspended and unpublished cards are skipped, and the queue stops at its limit', () {
      final states = [for (final c in ch1) _due(c, due: now.subtract(const Duration(hours: 1)))];
      final q = KeyCardRules.dueQueue(states, now: now, newAllowanceLeft: 0, suspended: {ch1[0].id}, published: {for (final c in ch1.skip(2)) c.id}, limit: 3);
      expect(q, hasLength(3));
      expect(q.map((s) => s.card.id), isNot(contains(ch1[0].id)));
      expect(q.map((s) => s.card.id), isNot(contains(ch1[1].id)));
    });

    test('a card rated on this phone leaves a kept queue until the server has moved it', () {
      final rated = now.subtract(const Duration(minutes: 5));
      final queue = [
        _due(ch1[0], due: now.subtract(const Duration(hours: 1))), // read before the rating: drop
        _due(ch1[1], due: now.subtract(const Duration(minutes: 1))), // the server moved it after: keep
        _due(ch1[2], due: now.subtract(const Duration(hours: 1))), // not rated: keep
      ];
      final left = KeyCardRules.withoutReviewed(queue, {ch1[0].id: rated, ch1[1].id: rated});
      expect([for (final s in left) s.card.id], [ch1[1].id, ch1[2].id]);
    });
  });

  group("taste (code review L10), the website's shared fixture", () {
    final fixture = jsonDecode(File('test/unit/keycards/support/taste.json').readAsStringSync()) as Map<String, dynamic>;
    final tasteCards = [
      for (final c in fixture['cards'] as List)
        KeyCard(
          id: (c as Map)['id'] as String,
          kind: 'fact',
          front: 'f',
          back: 'b',
          chapterKey: c['chapterKey'] as String,
          order: c['order'] as int,
          importance: c['importance'] as String,
        ),
    ];

    test("every chapter's taste is its first five Must-know cards in book order, and nothing else", () {
      final taste = KeyCardRules.tasteIds(tasteCards, per: fixture['per'] as int);
      final want = <String>{
        for (final ids in (fixture['taste'] as Map).values) ...(ids as List).cast<String>(),
      };
      expect(taste, want);
      for (final entry in (fixture['taste'] as Map).entries) {
        final mine = KeyCardRules.chapterAddSet(tasteCards, entry.key as String, isPro: false);
        expect(mine, (entry.value as List).cast<String>(), reason: '${entry.key} in book order');
      }
    });

    test("Free's deck opens only Must-know cards; a chapter with none has no taste", () {
      final view = KeyCardRules.deckView(tasteCards, isPro: false);
      for (final e in view) {
        if (!e.locked) expect(e.card!.mustKnow, isTrue);
      }
      expect(view.where((e) => !e.locked && e.card!.chapterKey == 'business_studies.directing'), isEmpty);
    });
  });

  group('new cards in the queue (code review L7)', () {
    test("chapter by chapter in the syllabus order, then the card's order in its chapter", () {
      KeyCard card(String id, String chapter, int order) =>
          KeyCard(id: id, kind: 'fact', front: 'f', back: 'b', subject: 's', chapterKey: chapter, order: order);
      final states = [
        for (final c in [card('b10', 's.b', 10), card('a20', 's.a', 20), card('b5', 's.b', 5), card('a10', 's.a', 10)]) _due(c, due: now, reps: 0),
      ];
      const rank = {'s.a': 1, 's.b': 0};
      final q = KeyCardRules.dueQueue(states, now: now, newAllowanceLeft: 10, chapterRank: (k) => rank[k]!);
      expect([for (final s in q) s.card.id], ['b5', 'b10', 'a10', 'a20']);
      // Without a rank: by the chapter key, so chapters are never interleaved.
      final plain = KeyCardRules.dueQueue(states, now: now, newAllowanceLeft: 10);
      expect([for (final s in plain) s.card.id], ['a10', 'a20', 'b5', 'b10']);
    });
  });

  group('blanks', () {
    test('a question keeps its gaps; an answer marks the words that carry marks', () {
      final term = ch1.firstWhere((c) => c.kind == 'term');
      final front = BlankedLine.front(term.front);
      expect(front.parts.first.blank, isTrue);
      expect(front.parts.first.text, '');
      final back = BlankedLine.marked(term.back, term.blanks);
      expect(back.parts.first, (text: 'Efficiency', blank: true));
      expect(back.parts.map((p) => p.text).join(), term.back);
      // A blank not in the line is ignored; the line is whole.
      expect(BlankedLine.marked('abc', ['zzz']).parts.single, (text: 'abc', blank: false));
    });

    test('every fixture term or key line keeps the content spec: its front is the quote with the blanks as ____', () {
      for (final c in cards.where((c) => c.kind == 'term' || c.kind == 'key_line')) {
        var line = c.quote!;
        for (final b in c.blanks) {
          line = line.replaceFirst(b, '____');
        }
        expect(c.front, line, reason: c.id);
        expect(c.back, c.quote, reason: c.id);
      }
    });
  });
}
