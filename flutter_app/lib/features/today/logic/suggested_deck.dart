// "Suggested for you" (D51, TODAY-SWIPE-1018) as plain values: the lead card's other moves as
// cards (what each costs, its title, one line of evidence, its art), the pass through them (skip
// sends the top card to the back; after every card was skipped once the end card shows), and how
// many times the swipe hint has shown (twice, then never). Pure except the hint's store: the stack
// widget renders the result and the tests feed fixtures. The cards are the choices' own
// (`buildChoices`), so the deck never invents a move the lead card could not swap to; the weakest
// chapter opens the deck when it is there (the approved d51-stack-rest: its object and its counts
// are the strongest evidence), and the rest keep the choices' ranking.
import 'dart:async';

import '../../../core/storage/prefs_store.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../copy.dart';
import '../copy_suggested.dart';
import 'today_model.dart';

/// Cards the deck holds: the lead's three best alternatives, or, after a pick, the recommended
/// move (marked Suggested) and three others.
const int deckSize = 4;

/// What stands in a card's art corner.
enum SuggestedArt {
  /// The subject's object.
  subject,

  /// Mobi in a pose ([SuggestedCard.pose]).
  mobi,

  /// The stopwatch object: a full mock is timed like the real paper.
  stopwatch,
}

/// One card of the deck.
class SuggestedCard {
  const SuggestedCard({required this.choice, required this.title, required this.line, this.cost, this.art = SuggestedArt.subject, this.subjectId, this.pose});

  /// The choice behind the card: "Do this instead" swaps the lead card to it (or runs its action).
  final MoveChoice choice;

  String get key => choice.key;

  /// The recommended move, back in the deck after the student picked another.
  bool get suggested => choice.suggested;

  /// What it costs and how long: "Accountancy, 10 questions", "Free, about 10 min". Null when the
  /// card opens something rather than holding a move.
  final String? cost;
  final String title;

  /// One line of evidence from the record ("Partnership fundamentals: 15 of 63 missed, 75 marks open.").
  final String line;
  final SuggestedArt art;
  final String? subjectId;

  /// Mobi's pose when [art] is [SuggestedArt.mobi].
  final MmArt? pose;

  /// A swipe may make this card the lead: a swipe never starts a session or spends a credit, so a
  /// card whose only action would start one waits for its button (TODAY-SWIPE-1018, safeguard).
  bool get swipeable => choice.hero != null || !(choice.action?.startsSession ?? false);
}

/// The deck for [choices] (in the lead card's order, the recommended move first after a pick), at
/// most [deckSize] cards: the recommended move stays first, then the weakest chapter, then the
/// rest in their order. [glance] gives the weakest chapter's counts and Revise's due count;
/// without it a card says what its move says.
List<SuggestedCard> buildSuggestedDeck(List<MoveChoice> choices, {TodayGlance? glance}) {
  final shown = choices.take(deckSize).toList();
  final suggested = [
    for (final c in shown)
      if (c.suggested) c,
  ];
  final weakest = [
    for (final c in shown)
      if (!c.suggested && c.key == 'weakest') c,
  ];
  final rest = [
    for (final c in shown)
      if (!c.suggested && c.key != 'weakest') c,
  ];
  return [
    for (final c in [...suggested, ...weakest, ...rest]) _card(c, glance),
  ];
}

SuggestedCard _card(MoveChoice c, TodayGlance? glance) {
  final m = c.hero;
  if (m == null) return SuggestedCard(choice: c, title: c.title, line: c.line, art: SuggestedArt.mobi, pose: MmArt.mobiPoint);
  final subject = m.subjectLine ?? '';
  final minutes = _minutes(m);
  final questions = _questions(m);
  final kind = m.kind;
  switch (kind) {
    case MoveKind.weakest:
      final w = glance?.weak.rows.where((r) => r.subjectId == m.subjectId).firstOrNull;
      return SuggestedCard(
        choice: c,
        cost: questions == null ? SuggestedCopy.costMinutes(subject, minutes) : SuggestedCopy.costQuestions(subject, questions),
        title: m.title ?? SuggestedCopy.titleWeakest,
        line: w != null && w.chapter == _chapterOf(m)
            ? SuggestedCopy.weakestLine(w.chapter, w.missed, w.asked, w.marks)
            : '${_chapterOf(m) ?? subject}: ${m.valueLine ?? _first(m.meaning)}${(m.valueLine ?? '').endsWith('.') ? '' : '.'}',
        subjectId: m.subjectId,
      );
    case MoveKind.revise:
      final due = glance?.queue.reviseDue;
      return SuggestedCard(
        choice: c,
        cost: SuggestedCopy.costFree(minutes),
        title: m.title ?? SuggestedCopy.titleRevise,
        line: due != null && due > 0 ? SuggestedCopy.reviseLine(due) : _first(m.meaning),
        art: SuggestedArt.mobi,
        pose: MmArt.mobiPoint,
        subjectId: m.subjectId,
      );
    case MoveKind.mock || MoveKind.firstMock:
      return SuggestedCard(
        choice: c,
        cost: SuggestedCopy.costMock(subject, int.tryParse(m.number ?? '') ?? 50, minutes),
        title: m.title ?? SuggestedCopy.titleMock,
        line: _first(m.meaning),
        art: SuggestedArt.stopwatch,
        subjectId: m.subjectId,
      );
    case MoveKind.repair || MoveKind.firstRepair || MoveKind.returning:
      return SuggestedCard(
        choice: c,
        cost: SuggestedCopy.costMinutes(subject, minutes),
        title: m.title ?? SuggestedCopy.titleRepair,
        line: _first(m.meaning),
        art: m.art.isMobi ? SuggestedArt.mobi : SuggestedArt.subject,
        pose: m.art.art,
        subjectId: m.subjectId,
      );
    default:
      return SuggestedCard(
        choice: c,
        cost: subject.isEmpty ? null : (questions == null ? SuggestedCopy.costMinutes(subject, minutes) : SuggestedCopy.costQuestions(subject, questions)),
        title: m.title ?? c.title,
        line: _first(m.meaning),
        art: m.art.isMobi ? SuggestedArt.mobi : SuggestedArt.subject,
        pose: m.art.art,
        subjectId: m.subjectId,
      );
  }
}

/// The move's length in minutes, as the lead card's length pill would show it once this move is
/// the lead: with a choice of lengths, the chosen one (else the first); else what its key says,
/// else 10. (The pill and the key can still differ inside the lead card; that is the move's own.)
int _minutes(MoveHero m) {
  if (m.durations.length > 1) return m.selectedMinutes ?? m.durations.first.minutes;
  final picked = m.durations.where((d) => d.minutes == m.selectedMinutes).firstOrNull;
  if (picked != null) return picked.minutes;
  return int.tryParse((TodayCopy.keyLength(m.primary.label) ?? '').split(' ').first) ?? (m.durations.isEmpty ? 10 : m.durations.first.minutes);
}

/// The questions the move asks when its length is a count of questions, else null.
int? _questions(MoveHero m) {
  if (m.durations.isEmpty) return null;
  final d = m.durations.where((d) => d.minutes == m.selectedMinutes).firstOrNull ?? m.durations.first;
  return d.questions;
}

/// The chapter a weakest-chapter move practises ("questions on\nPartnership fundamentals").
String? _chapterOf(MoveHero m) {
  final label = m.numberLabel;
  if (label == null) return null;
  final at = label.indexOf('\n');
  return at < 0 ? null : label.substring(at + 1);
}

/// The first sentence of [text] (a move's why: its source sentence comes first).
String _first(String text) {
  final at = text.indexOf('. ');
  return at < 0 ? text : text.substring(0, at + 1);
}

/// Where the student is in one pass through the deck: the order (skips rotate the top card to the
/// back), how many were skipped, and whether every card was seen. Pure.
class DeckPass {
  DeckPass(List<String> keys) : _keys = List.of(keys), _order = List.of(keys);

  final List<String> _keys;
  List<String> _order;
  int _skips = 0;

  /// The deck's keys in the order they show, the top first.
  List<String> get order => List.unmodifiable(_order);
  int get length => _keys.length;
  int get skips => _skips;

  /// Every card was skipped once: the end card shows.
  bool get ended => _keys.isNotEmpty && _skips >= _keys.length;

  /// Cards still to come after the top one in this pass.
  int get moreAfter => ended ? 0 : (_keys.length - _skips - 1).clamp(0, _keys.length);

  /// The count over the stack.
  String get countLine => ended ? SuggestedCopy.noneLeft : SuggestedCopy.moreAfter(moreAfter, _keys.length);

  /// The top card's key, or null at the end.
  String? get top => ended || _order.isEmpty ? null : _order.first;

  /// The card under the top one, or null when the top is the last of the pass.
  String? get next => ended || moreAfter == 0 || _order.length < 2 ? null : _order[1];

  /// The page dots: the one on is the card on top; those before it were seen.
  List<DotState> get dots => [
    for (var k = 0; k < _keys.length; k++) ended ? DotState.seen : (k < _skips ? DotState.seen : (k == _skips ? DotState.on : DotState.ahead)),
  ];

  /// Whether this pass is over the same deck as [keys] (a pick changes the deck and starts anew).
  bool sameDeck(List<String> keys) => keys.length == _keys.length && Iterable<int>.generate(keys.length).every((k) => keys[k] == _keys[k]);

  /// The top card goes to the back.
  void skip() {
    if (ended || _order.isEmpty) return;
    _order = [..._order.skip(1), _order.first];
    _skips++;
  }

  /// "Go through them again": the deck in its first order.
  void again() {
    _order = List.of(_keys);
    _skips = 0;
  }
}

enum DotState { ahead, on, seen }

/// The swipe hint shows on the first two visits only (persisted on the phone), and never again
/// once the student has swiped.
abstract final class SuggestedHint {
  static const String key = 'today_suggested_hint_shown';

  /// Visits the hint shows on.
  static const int visits = 2;

  /// The store; null uses the phone's (tests set a memory store).
  static PrefsStore? store;

  /// Goldens pin the hint on or off; null reads the store.
  static bool? debugShow;

  static Future<bool>? _thisRun;

  /// Whether the hint shows on this visit. One visit per app run: the first call counts it, and
  /// every later call in the run gets the same answer. Any error reads as no hint.
  static Future<bool> claim() {
    final forced = debugShow;
    if (forced != null) return Future.value(forced);
    return _thisRun ??= _claim();
  }

  static Future<bool> _claim() async {
    try {
      final s = store ?? SharedPrefsStore();
      final shown = await s.getInt(key) ?? 0;
      if (shown >= visits) return false;
      await s.setInt(key, shown + 1);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// The student swiped: the hint has done its job.
  static Future<void> learned() async {
    _thisRun = Future.value(false);
    try {
      await (store ?? SharedPrefsStore()).setInt(key, visits);
    } catch (_) {}
  }

  /// Forgets this run's answer (tests).
  static void debugReset() {
    _thisRun = null;
    debugShow = null;
  }
}
