import 'keycards_models.dart';

/// The website's `KEYCARD_RULES` (`data/keycards.js`, KEYCARDS-BUILD-SPEC 2c), held equal by a test. The
/// server decides every gate; the phone uses these only to order a queue it kept while offline and to say
/// the same numbers the server says.
abstract final class KeyCardRules {
  static const double retention = 0.9;
  static const String examHorizon = '2027-05-15';
  static const int freeTastePerChapter = 5;
  static const int freeReviewsPerDay = 10;
  static const int freeNewPerDay = 5;
  static const int freeLineNeededPerDay = 3;
  static const List<int> proNewPerDayChoices = [10, 15, 25];
  static const int proNewPerDayDefault = 15;
  static const int overduePauseNew = 40;

  /// 15 seconds a card.
  static const double minutesPerCard = 0.25;

  static const int missed = 1;
  static const int gotIt = 3;
  static const int easy = 4;
  static const List<int> ratings = [missed, gotIt, easy];

  /// The modes a review is logged with.
  static const String modeRevise = 'revise';
  static const String modeStudy = 'study';
  static const String modeLastLook = 'last_look';

  /// "About N minutes" for [cards] cards: at least 1 when there is anything to do.
  static int minutesFor(int cards) => cards <= 0 ? 0 : (cards * minutesPerCard).ceil().clamp(1, 1 << 20);

  /// Book order, Must-know first among cards of the same place.
  static int bookOrder(KeyCard a, KeyCard b) {
    final byOrder = a.order.compareTo(b.order);
    if (byOrder != 0) return byOrder;
    if (a.mustKnow != b.mustKnow) return a.mustKnow ? -1 : 1;
    return a.id.compareTo(b.id);
  }

  /// `deckView(cards, { isPro })`: book order; Free sees the first [freeTastePerChapter] cards of each chapter
  /// whole and the rest as locked stubs; Pro sees everything.
  static List<KcDeckEntry> deckView(List<KeyCard> cards, {required bool isPro}) {
    final sorted = [...cards]..sort(bookOrder);
    if (isPro) return [for (final c in sorted) KcDeckEntry.card(c)];
    final open = tasteIds(sorted);
    return [
      for (final c in sorted)
        open.contains(c.id) ? KcDeckEntry.card(c) : KcDeckEntry.locked(id: c.id, kind: c.kind, stubLabel: c.label),
    ];
  }

  /// The taste cards of every chapter in [cards]: the first five in book order, Must-know first among ties.
  static Set<String> tasteIds(List<KeyCard> cards) {
    final byChapter = <String, List<KeyCard>>{};
    for (final c in cards) {
      byChapter.putIfAbsent(c.chapterKey, () => []).add(c);
    }
    return {
      for (final list in byChapter.values) ...([...list]..sort(bookOrder)).take(freeTastePerChapter).map((c) => c.id),
    };
  }

  /// `chapterAddSet(cards, chapterKey, { isPro })`: Pro adds every Must-know card of the chapter; Free only its
  /// taste cards. Good-to-know cards are never added by the chapter key.
  static List<String> chapterAddSet(List<KeyCard> cards, String chapterKey, {required bool isPro}) {
    final chapter = [for (final c in cards) if (c.chapterKey == chapterKey) c]..sort(bookOrder);
    if (isPro) return [for (final c in chapter) if (c.mustKnow) c.id];
    return [...tasteIds(chapter).where((id) => chapter.any((c) => c.id == id))];
  }

  /// `dueQueue`: the due cards first (Must-know first, then by when they fell due), then new cards (added,
  /// never reviewed) in book order up to [newAllowanceLeft]. New cards pause while more than
  /// [overduePauseNew] are overdue. Cards no longer published ([published] given and missing the id) and
  /// cards in [suspended] are skipped. At most [limit].
  static List<KcDueCard> dueQueue(
    List<KcDueCard> states, {
    required DateTime now,
    required int newAllowanceLeft,
    int limit = 20,
    Set<String> suspended = const {},
    Set<String>? published,
  }) {
    bool live(KcDueCard s) => !suspended.contains(s.card.id) && (published == null || published.contains(s.card.id));
    final due = [
      for (final s in states)
        if (live(s) && !s.isNew && s.due != null && !s.due!.isAfter(now)) s,
    ]..sort((a, b) {
        if (a.card.mustKnow != b.card.mustKnow) return a.card.mustKnow ? -1 : 1;
        return a.due!.compareTo(b.due!);
      });
    final fresh = due.length > overduePauseNew
        ? const <KcDueCard>[]
        : ([for (final s in states) if (live(s) && s.isNew) s]..sort((a, b) => bookOrder(a.card, b.card)))
              .take(newAllowanceLeft.clamp(0, 1 << 20))
              .toList();
    return [...due, ...fresh].take(limit).toList();
  }

  /// A queue without the cards this phone rated after the queue's state of them was read: their reviews may
  /// still be in the outbox, so the server (or the kept copy) does not know of them yet. A card whose schedule
  /// the server moved after the rating (it is due again) stays.
  static List<KcDueCard> withoutReviewed(List<KcDueCard> queue, Map<String, DateTime> reviewed) =>
      [for (final c in queue) if (!_ratedSince(c, reviewed[c.card.id])) c];

  static bool _ratedSince(KcDueCard c, DateTime? at) => at != null && (c.due == null || !c.due!.isAfter(at));
}

/// A line split at its blanks: the text between them, and for a `term` or `key_line` the words that go in them.
class BlankedLine {
  const BlankedLine(this.parts);

  /// Text runs and blanks in order: a blank is `(text: word, blank: true)`.
  final List<({String text, bool blank})> parts;

  /// [front] with each `____` kept as a blank run (its word unknown until revealed).
  static BlankedLine front(String front) {
    final parts = <({String text, bool blank})>[];
    final pieces = front.split(RegExp(r'_{3,}'));
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].isNotEmpty) parts.add((text: pieces[i], blank: false));
      if (i < pieces.length - 1) parts.add((text: '', blank: true));
    }
    return BlankedLine(parts);
  }

  /// [back] with each of [blanks] marked where it first appears after the previous one, so the words that
  /// carry marks stand out in the full line. A blank that is not in the line is ignored.
  static BlankedLine marked(String back, List<String> blanks) {
    final parts = <({String text, bool blank})>[];
    var at = 0;
    for (final word in blanks) {
      if (word.trim().isEmpty) continue;
      final i = back.toLowerCase().indexOf(word.toLowerCase(), at);
      if (i < 0) continue;
      if (i > at) parts.add((text: back.substring(at, i), blank: false));
      parts.add((text: back.substring(i, i + word.length), blank: true));
      at = i + word.length;
    }
    if (at < back.length) parts.add((text: back.substring(at), blank: false));
    return BlankedLine(parts);
  }
}
