// The Cards view and Find as plain values: the groups a list draws, Free's one locked line, the head lines, and the searched
// words of a front from the server's spans.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/learn2/cards/card_model.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';

import '../support/fixture_learn_api.dart';

KeyCard card(String id, {String front = 'What is goodwill?', String kind = 'definition'}) =>
    KeyCard(id: id, kind: kind, front: front, back: 'Goodwill is the value of the good name.', chapterKey: 'accountancy.goodwill-valuation');

LearnCardRow row(KeyCard c, {bool locked = false, bool inRevise = false, bool missed = false}) => LearnCardRow(
  card: locked ? null : c,
  stub: locked ? LearnLockedCard(id: c.id, kind: c.kind, label: 'Definition') : null,
  locked: locked,
  inRevise: inRevise,
  missedLately: missed,
);

void main() {
  group('visibleSections', () {
    test('keeps the open cards of each section in order, with the words that say more about them', () {
      final groups = CardsModel.visibleSections([
        LearnCardSection(title: 'One', cards: [row(card('a')), row(card('b'), inRevise: true, missed: true)]),
        LearnCardSection(title: 'Two', cards: [row(card('c'))]),
      ], null);
      expect(groups.map((g) => g.title), ['One', 'Two']);
      expect(groups.map((g) => g.cards.length), [2, 1]);
      expect(groups.first.cards[1].inRevise, isTrue);
      expect(groups.first.cards[1].missedLately, isTrue);
      expect(CardsModel.ids(groups), ['a', 'b', 'c']);
      expect(groups.every((g) => g.lockedLine == null), isTrue);
    });

    test('puts the locked line where the first locked card sits, and once', () {
      final groups = CardsModel.visibleSections([
        LearnCardSection(title: 'One', cards: [row(card('a'))]),
        LearnCardSection(title: 'Two', cards: [row(card('b')), row(card('c'), locked: true), row(card('d'), locked: true)]),
        LearnCardSection(title: 'Three', cards: [row(card('e'), locked: true)]),
      ], 'Pro opens the rest.');
      expect(groups.map((g) => g.title), ['One', 'Two']);
      expect(groups[1].lockedLine, 'Pro opens the rest.');
      expect(groups[0].lockedLine, isNull);
      // "1 of 3": the count says how many are open and how many there are.
      expect(groups[1].countText, '1 of 3');
      expect(groups[0].countText, '1');
    });

    test('closes the last section with the line when the server sent only the open cards', () {
      final groups = CardsModel.visibleSections([
        LearnCardSection(title: 'One', cards: [row(card('a'))]),
        LearnCardSection(title: 'Two', cards: [row(card('b'))]),
      ], 'Pro opens the rest.');
      expect(groups[0].lockedLine, isNull);
      expect(groups[1].lockedLine, 'Pro opens the rest.');
    });

    test('leaves a section with nothing in it out, and keeps two sections of one name apart', () {
      final groups = CardsModel.visibleSections([
        LearnCardSection(title: 'Same', cards: [row(card('a'))]),
        const LearnCardSection(title: 'Empty'),
        LearnCardSection(title: 'Same', cards: [row(card('b'))]),
      ], null);
      expect(groups.map((g) => g.title), ['Same', 'Same']);
      expect(groups.map((g) => g.id).toSet(), hasLength(2));
    });

    test('reads the recorded chapter: 16 sections and 60 cards, and Free\'s 5 with the server\'s line', () {
      final pro = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_pro'));
      final proGroups = CardsModel.visibleSections(pro.sections, pro.lockedLine);
      expect(proGroups, hasLength(16));
      expect(CardsModel.ids(proGroups), hasLength(60));
      final free = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_free'));
      final freeGroups = CardsModel.visibleSections(free.sections, free.lockedLine);
      expect(CardsModel.ids(freeGroups), hasLength(5));
      expect(freeGroups.last.lockedLine, free.lockedLine);
      expect(freeGroups.where((g) => g.lockedLine != null), hasLength(1));
    });
  });

  group('resultGroups', () {
    test('groups the open hits by chapter in the order they came and leaves a locked hit out', () {
      final search = LearnSearch.parse(LearnFixtures.json('search_goodwill_free'));
      final groups = CardsModel.resultGroups(search.cards);
      expect(groups.map((g) => g.chapterKey), [
        'accountancy.goodwill-valuation',
        'accountancy.change-in-profit-sharing-ratio',
        'accountancy.retirement-and-death-of-partner',
      ]);
      expect(CardsModel.ids(groups), hasLength(10));
      expect(CardsModel.lockedMatches(search.cards), 40);
      expect(groups.first.title, 'Goodwill: Nature and Valuation');
      // Every row carries the server's spans.
      expect(groups.first.cards.first.match.spans('front'), isNotEmpty);
    });

    test('groups the Pro recording 34, 13, 2 and 1', () {
      final groups = CardsModel.resultGroups(LearnSearch.parse(LearnFixtures.json('search_goodwill_pro')).cards);
      expect(groups.map((g) => g.cards.length), [34, 13, 2, 1]);
    });
  });

  group('the lines', () {
    test('the Cards view says the subject, the chapter and how many cards', () {
      final pro = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_pro'));
      expect(CardsModel.headLine('accountancy.admission-of-partner', pro), 'Accountancy, Ch 2, 60 cards');
      final free = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_free'));
      expect(CardsModel.headLine('accountancy.admission-of-partner', free), 'Accountancy, Ch 2, 5 of 60 cards open on Free');
      final body = asJson(pro.raw)..['chapter'] = {'key': 'business_studies.x', 'title': 'X'};
      expect(CardsModel.headLine('business_studies.x', LearnChapterCards.parse(body)), 'Business Studies, 60 cards');
    });

    test('a search says what it found', () {
      expect(CardsModel.findCountLine(cards: 50, groups: 4, chapterLinks: 0, lessons: 0), '50 cards in 4 chapters');
      expect(CardsModel.findCountLine(cards: 1, groups: 1, chapterLinks: 0, lessons: 1), '1 card in 1 chapter, 1 lesson');
      expect(CardsModel.findCountLine(cards: 0, groups: 0, chapterLinks: 2, lessons: 3), '2 chapters, 3 lessons');
      expect(CardsModel.findCountLine(cards: 0, groups: 0, chapterLinks: 0, lessons: 0), '');
    });

    test('chapter matches already shown as a group are not listed again', () {
      final search = LearnSearch.parse(LearnFixtures.json('search_goodwill_pro'));
      final groups = CardsModel.resultGroups(search.cards);
      expect(CardsModel.chapterLinks(search, groups), isEmpty);
      expect(CardsModel.chapterLinks(search, const []), hasLength(1));
      expect(CardsModel.chapterLinks(search, const []).single.meta, 'chapter, 48 cards');
    });

    test('a filter from a link is one of the four, else All', () {
      expect(CardsModel.filterOf('must'), 'must');
      expect(CardsModel.filterOf('revise'), 'revise');
      expect(CardsModel.filterOf('missed'), 'missed');
      expect(CardsModel.filterOf('due'), 'all');
      expect(CardsModel.filterOf(null), 'all');
    });
  });

  group('the searched words of a front', () {
    test('spanParts marks the spans, joins overlaps and clips what runs past the text', () {
      expect(CardsModel.spanParts('Goodwill is the value', [const LearnSpan(0, 8)]), [(text: 'Goodwill', hit: true), (text: ' is the value', hit: false)]);
      expect(CardsModel.spanParts('abcdef', [const LearnSpan(1, 3), const LearnSpan(2, 5)]), [(text: 'a', hit: false), (text: 'bcde', hit: true), (text: 'f', hit: false)]);
      expect(CardsModel.spanParts('abc', [const LearnSpan(1, 40)]), [(text: 'a', hit: false), (text: 'bc', hit: true)]);
      expect(CardsModel.spanParts('abc', const []), [(text: 'abc', hit: false)]);
      expect(CardsModel.spanParts('', [const LearnSpan(0, 3)]), [(text: '', hit: false)]);
    });

    test('a front whose kind says itself is drawn without the prefix, and its spans move with the words', () {
      final c = card('f', front: 'Formula: Goodwill by capitalisation.', kind: 'formula');
      final spans = CardsModel.frontSpans(c, LearnMatch.parse({'front': [{'start': 9, 'end': 17}]}));
      expect(spans, [const LearnSpan(0, 8)]);
      // A span that sat inside the prefix goes with it.
      expect(CardsModel.frontSpans(c, LearnMatch.parse({'front': [{'start': 0, 'end': 7}]})), isEmpty);
      // A front that does not change keeps its spans.
      expect(CardsModel.frontSpans(card('g'), LearnMatch.parse({'front': [{'start': 8, 'end': 16}]})), [const LearnSpan(8, 16)]);
      expect(CardsModel.frontSpans(card('g'), LearnMatch.none), isEmpty);
    });

    test('a front with blanks is text, a gap, text, and the spans stay on the right words', () {
      const front = 'Goodwill, if existing, is ____ at the time of ____.';
      final parts = CardsModel.frontParts(front, [const LearnSpan(0, 8), const LearnSpan(38, 42)]);
      expect(parts.where((p) => p.blank), hasLength(2));
      expect(parts.where((p) => p.hit).map((p) => p.text), ['Goodwill', 'time']);
      expect(parts.where((p) => !p.blank).map((p) => p.text).join(), front.replaceAll('____', ''));
      expect(CardsModel.frontParts('No blank here', const []), [(text: 'No blank here', blank: false, hit: false)]);
    });
  });
}
