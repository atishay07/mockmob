// What the Cards view and Find draw, as plain values (the website's CardList.jsx `visibleSections`, FindView.jsx
// `resultSections` and the counting lines around them): the cards in groups, a group's count, the line that says what a
// search found, and the matched words of a front from the server's spans. No widgets here, so tests read it directly.
library;

import '../../keycards/data/keycards_lines.dart' show cardFace;
import '../../keycards/data/keycards_models.dart' show KeyCard;
import '../data/learn_models.dart';
import 'cards_copy.dart';
import 'cards_shared.dart';

/// One card of a list as a row draws it: the whole card, whether it is in Revise or was missed lately, and, in Find, what
/// the search matched.
class CardEntry {
  const CardEntry({required this.card, required this.chapterKey, this.inRevise = false, this.missedLately = false, this.match = LearnMatch.none});

  final KeyCard card;
  final String chapterKey;
  final bool inRevise;
  final bool missedLately;

  /// The server's spans per field (`front`, `quote`); empty outside Find.
  final LearnMatch match;

  String get id => card.id;
}

/// A group of cards under one bar: a section of the book (the Cards view) or a chapter (Find).
class CardGroup {
  const CardGroup({required this.id, required this.title, required this.cards, required this.total, this.lockedLine, this.chapterKey});

  /// Unique in its list (the position and the key), so two sections with one title are two groups.
  final String id;
  final String title;

  /// The open cards.
  final List<CardEntry> cards;

  /// Every card the server listed here, open or locked.
  final int total;

  /// Free's one locked line, set on the group where it is drawn.
  final String? lockedLine;

  /// Find: the chapter this group heads (its bar opens the chapter page).
  final String? chapterKey;

  /// "5" or, with locked cards among them, "5 of 9".
  String get countText => CardsCopy.sectionCount(cards.length, total);

  CardGroup withLocked(String line) => CardGroup(id: id, title: title, cards: cards, total: total, lockedLine: line, chapterKey: chapterKey);
}

/// A chapter or a lesson a search found that is not one of the card groups: a row that opens it.
class FindLink {
  const FindLink({required this.id, required this.title, required this.meta, required this.lesson});

  final String id;
  final String title;
  final String meta;

  /// A lesson (else a chapter).
  final bool lesson;
}

abstract final class CardsModel {
  static const List<String> filters = ['all', 'must', 'revise', 'missed'];

  /// A filter from a link: one of the four, else All.
  static String filterOf(String? f) => filters.contains(f) ? f! : 'all';

  /// The sections as drawn: the open cards, and Free's one locked line where the first locked card sits. When the server
  /// sends only the open cards (Free's chapter read) the line closes the last section.
  static List<CardGroup> visibleSections(List<LearnCardSection> sections, String? lockedLine) {
    var lockedDone = false;
    final out = <CardGroup>[];
    for (final (i, s) in sections.indexed) {
      final cards = [
        for (final r in s.cards)
          if (!r.locked && r.card != null) CardEntry(card: r.card!, chapterKey: r.card!.chapterKey, inRevise: r.inRevise, missedLately: r.missedLately),
      ];
      final total = s.cards.length;
      final hasLocked = total > cards.length;
      final String? locked = hasLocked && !lockedDone && lockedLine != null ? lockedLine : null;
      if (hasLocked && lockedLine != null) lockedDone = true;
      if (cards.isEmpty && locked == null) continue;
      out.add(CardGroup(id: 'sec-$i', title: s.title, cards: cards, total: total, lockedLine: locked));
    }
    if (lockedLine != null && !lockedDone && out.isNotEmpty) out[out.length - 1] = out.last.withLocked(lockedLine);
    return out;
  }

  /// Search results' open cards, grouped by chapter in the order they came. A locked hit is not a row (it is counted, see
  /// [lockedMatches]).
  static List<CardGroup> resultGroups(List<LearnSearchCard> hits) {
    final order = <String>[];
    final titles = <String, String>{};
    final cards = <String, List<CardEntry>>{};
    for (final h in hits) {
      final card = h.card;
      if (card == null || h.locked) continue;
      final key = h.chapterKey ?? card.chapterKey;
      if (!cards.containsKey(key)) {
        order.add(key);
        titles[key] = h.chapterTitle ?? card.chapter ?? key;
        cards[key] = [];
      }
      cards[key]!.add(CardEntry(card: card, chapterKey: key, match: h.match));
    }
    return [
      for (final (i, key) in order.indexed)
        CardGroup(id: 'chap-$i', title: titles[key]!, cards: cards[key]!, total: cards[key]!.length, chapterKey: key),
    ];
  }

  /// How many of a search's card hits Free cannot open.
  static int lockedMatches(List<LearnSearchCard> hits) => hits.where((h) => h.locked || h.card == null).length;

  /// The ids of the open cards in [groups], in order.
  static List<String> ids(List<CardGroup> groups) => [for (final g in groups) for (final c in g.cards) c.id];

  /// "Accountancy, Ch 1, 46 cards" (Free: "Accountancy, Ch 1, 5 of 46 cards open on Free").
  static String headLine(String chapterKey, LearnChapterCards data) {
    final free = !data.isPro && data.lockedCount > 0;
    return CardsCopy.headLine(
      subject: CardsShared.subjectLabel(chapterKey.split('.').first),
      ref: data.chapter.ref,
      cards: data.counts.all,
      of: free ? data.counts.all + data.lockedCount : null,
    );
  }

  /// A search's chapter matches that are not already a group, and its lesson matches.
  static List<FindLink> chapterLinks(LearnSearch search, List<CardGroup> groups) {
    final inGroups = {for (final g in groups) g.chapterKey};
    return [
      for (final c in search.chapters)
        if (!inGroups.contains(c.key)) FindLink(id: c.key, title: c.title, meta: CardsCopy.chapterMeta(c.cards), lesson: false),
    ];
  }

  static List<FindLink> lessonLinks(LearnSearch search) => [
    for (final l in search.lessons) FindLink(id: l.id, title: l.title, meta: CardsCopy.lessonMeta, lesson: true),
  ];

  /// What a search found, in one line: "50 cards in 4 chapters" (", 1 lesson" after it), or the chapters and lessons alone.
  static String findCountLine({required int cards, required int groups, required int chapterLinks, required int lessons}) {
    final lesson = lessons > 0 ? CardsShared.countWord(lessons, 'lesson') : null;
    if (cards > 0) return ['${CardsShared.countWord(cards, 'card')} in ${CardsShared.countWord(groups, 'chapter')}', ?lesson].join(', ');
    return [if (chapterLinks > 0) CardsShared.countWord(chapterLinks, 'chapter'), ?lesson].join(', ');
  }

  // ---- The matched words of a front ----

  /// [text] in runs with every span marked. Spans may overlap or run past the text: they are clipped and joined first.
  static List<HitPart> spanParts(String text, List<LearnSpan> spans) {
    final clipped = <(int, int)>[];
    for (final s in spans) {
      final start = s.start < 0 ? 0 : s.start;
      final end = s.end > text.length ? text.length : s.end;
      if (end > start) clipped.add((start, end));
    }
    if (clipped.isEmpty || text.isEmpty) return [(text: text, hit: false)];
    clipped.sort((a, b) => a.$1.compareTo(b.$1));
    final parts = <HitPart>[];
    var at = 0;
    for (final (start, end) in clipped) {
      if (end <= at) continue;
      final from = start < at ? at : start;
      if (from > at) parts.add((text: text.substring(at, from), hit: false));
      // Spans that touch or overlap are one run.
      if (from == at && parts.isNotEmpty && parts.last.hit) {
        parts[parts.length - 1] = (text: parts.last.text + text.substring(from, end), hit: true);
      } else {
        parts.add((text: text.substring(from, end), hit: true));
      }
      at = end;
    }
    if (at < text.length) parts.add((text: text.substring(at), hit: false));
    return parts;
  }

  /// The server's spans of a card's front moved onto the front as the row shows it: a kind that says itself ("Formula:
  /// Current ratio") is drawn without its prefix, so the offsets move back by the prefix.
  static List<LearnSpan> frontSpans(KeyCard card, LearnMatch match) {
    final spans = match.spans('front');
    if (spans.isEmpty) return const [];
    final shown = cardFace(card).front;
    final shift = card.front.length - shown.length;
    return [
      for (final s in spans)
        if (s.end - shift > 0) LearnSpan(s.start - shift < 0 ? 0 : s.start - shift, s.end - shift),
    ].where((s) => s.end > s.start).toList();
  }

  /// The front in drawing order: text runs (marked or not) and the blanks of a term or key line, each `____` one blank.
  static List<({String text, bool blank, bool hit})> frontParts(String shown, List<LearnSpan> spans) {
    final out = <({String text, bool blank, bool hit})>[];
    void text(int from, int to) {
      final local = [
        for (final s in spans)
          if (s.end > from && s.start < to) LearnSpan((s.start < from ? from : s.start) - from, (s.end > to ? to : s.end) - from),
      ];
      for (final p in spanParts(shown.substring(from, to), local)) {
        out.add((text: p.text, blank: false, hit: p.hit));
      }
    }

    var at = 0;
    for (final m in RegExp(r'_{3,}').allMatches(shown)) {
      if (m.start > at) text(at, m.start);
      out.add((text: '', blank: true, hit: false));
      at = m.end;
    }
    if (at < shown.length) text(at, shown.length);
    return out;
  }
}
