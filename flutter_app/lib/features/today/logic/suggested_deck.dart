// "Suggested for you" (D51, TODAY-SWIPE-1018, refined by SWIPE-V2-1018 for D90) as plain values:
// the lead card's other moves as cards (what each costs, its title, one line of evidence, its art),
// the pass through them (Not now sends the top card to the back; after every card was passed on
// once the end card shows; Undo takes back the last one), the first run's coaching ([DeckCoach]:
// the demo once in the phone's life, then coaching until both directions were used or 3 visits),
// and what the deck learns ([DeckMemory]: kinds passed on on 2 of the last 7 days sit lower).
// Pure except the two stores: the stack widget renders the result and the tests feed fixtures.
// The cards are the choices' own (`buildChoices`), so the deck never invents a move the lead card
// could not swap to; the weakest chapter opens the deck when it is there (the approved
// d51-stack-rest: its object and its counts are the strongest evidence), and the rest keep the
// choices' ranking.
import 'dart:async';
import 'dart:convert';

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

  /// The choice behind the card: "Up next" swaps the lead card to it (or runs its action).
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
      // The round's own size, the number the lead card and the Revise page print (final walk, H3).
      final due = glance?.queue.reviseRound ?? glance?.queue.reviseDue;
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
        // A title that stands on its own, never "instead": the lead card shows it once it swaps.
        title: kind == MoveKind.mock ? SuggestedCopy.titleMock : (m.title ?? SuggestedCopy.titleMock),
        line: _first(m.meaning),
        art: SuggestedArt.stopwatch,
        subjectId: m.subjectId,
      );
    case MoveKind.repair || MoveKind.firstRepair || MoveKind.returning:
      return SuggestedCard(
        choice: c,
        // A repair spends AI credits, so its card says so beside the free ones (the lead card's
        // price line: "Each repair uses 1 AI credit").
        cost: SuggestedCopy.costRepair(minutes),
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
        // The title names the move ("Practise Economics", as the alternatives sheet does).
        title: kind == MoveKind.otherSubject && subject.isNotEmpty ? TodayCopy.altPractiseTitle(subject) : (m.title ?? c.title),
        line: _first(m.meaning),
        art: m.art.isMobi ? SuggestedArt.mobi : SuggestedArt.subject,
        pose: m.art.art,
        subjectId: m.subjectId,
      );
  }
}

/// The move's length in minutes, from the one source the rest of the screen reads: what its key
/// says (the Repairs and Revise tile, the alternatives sheet and the key it arms all show that),
/// else the chosen length, else the first, else 10.
int _minutes(MoveHero m) {
  final keyed = int.tryParse((TodayCopy.keyLength(m.primary.label) ?? '').split(' ').first);
  if (keyed != null) return keyed;
  final picked = m.durations.where((d) => d.minutes == m.selectedMinutes).firstOrNull;
  if (picked != null) return picked.minutes;
  return m.durations.isEmpty ? 10 : m.durations.first.minutes;
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

/// Where the student is in one pass through the deck: the order (Not now rotates the top card to
/// the back), how many were passed on, and whether every card was seen. Pure.
class DeckPass {
  DeckPass(List<String> keys) : _keys = List.of(keys), _order = List.of(keys);

  DeckPass._copy(DeckPass from) : _keys = from._keys, _order = List.of(from._order), _skips = from._skips;

  final List<String> _keys;
  List<String> _order;
  int _skips = 0;

  /// The deck's keys in the order they show, the top first.
  List<String> get order => List.unmodifiable(_order);

  /// The deck's keys in the order the pass started with ("Go through them again" returns to it).
  List<String> get keys => List.unmodifiable(_keys);
  int get length => _keys.length;
  int get skips => _skips;

  /// Every card was passed on once: the end card shows.
  bool get ended => _keys.isNotEmpty && _skips >= _keys.length;

  /// Cards still to come after the top one in this pass.
  int get moreAfter => ended ? 0 : (_keys.length - _skips - 1).clamp(0, _keys.length);

  /// The count over the stack.
  String get countLine => ended ? SuggestedCopy.noneLeft : SuggestedCopy.moreAfter(moreAfter, _keys.length);

  /// The top card's key, or null at the end.
  String? get top => ended || _order.isEmpty ? null : _order.first;

  /// The card under the top one, or null when the top is the last of the pass.
  String? get next => ended || moreAfter == 0 || _order.length < 2 ? null : _order[1];

  /// Whether this pass is over the same deck as [keys] (a pick changes the deck and starts anew).
  bool sameDeck(List<String> keys) => keys.length == _keys.length && Iterable<int>.generate(keys.length).every((k) => keys[k] == _keys[k]);

  /// A copy to come back to (the undo of a pick restores the pass as it was).
  DeckPass copy() => DeckPass._copy(this);

  /// Not now: the top card goes to the back.
  void skip() {
    if (ended || _order.isEmpty) return;
    _order = [..._order.skip(1), _order.first];
    _skips++;
  }

  /// Undo of the last Not now: the card at the back comes back on top.
  void unskip() {
    if (_skips <= 0 || _order.isEmpty) return;
    _order = [_order.last, ..._order.take(_order.length - 1)];
    _skips--;
  }

  /// "Go through them again": the deck in its first order.
  void again() {
    _order = List.of(_keys);
    _skips = 0;
  }
}

/// One phone's first-run coaching for the deck, as this app run sees it (persisted under
/// [DeckCoach.key]). Mutable within the run: the stack marks what the student did.
class DeckCoachRun {
  DeckCoachRun({this.demoShown = false, this.rightDone = false, this.leftDone = false, this.visits = 0, bool? coaching})
      : coaching = coaching ?? (!(rightDone && leftDone) && visits < DeckCoach.maxVisits);

  /// A phone that has finished the coaching (goldens of a returning visit).
  factory DeckCoachRun.taught() => DeckCoachRun(demoShown: true, rightDone: true, leftDone: true, visits: DeckCoach.maxVisits);

  /// A phone that has never seen the deck (goldens of the first run).
  factory DeckCoachRun.fresh() => DeckCoachRun();

  /// The card performed both directions by itself once (any touch stopped it): never again.
  bool demoShown;

  /// The student has used Up next (any way) at least once.
  bool rightDone;

  /// The student has used Not now (any way) at least once.
  bool leftDone;

  /// Visits on which the deck was on screen, this one included once counted.
  int visits;

  /// This visit coaches: the intro line and the coach line show. Fixed for the run, so nothing
  /// leaves mid-visit once the student has done both directions; the next visit is plain.
  final bool coaching;

  /// The student has never moved a card at all (visits 2 and 3 nudge the top card once).
  bool get neverSwiped => !rightDone && !leftDone;

  Map<String, Object> toJson() => {'demo': demoShown, 'right': rightDone, 'left': leftDone, 'visits': visits};

  static DeckCoachRun fromJson(Object? json) {
    if (json is! Map) return DeckCoachRun();
    bool b(String k) => json[k] == true;
    final v = json['visits'];
    return DeckCoachRun(demoShown: b('demo'), rightDone: b('right'), leftDone: b('left'), visits: v is int ? v : 0);
  }
}

/// The deck's first run (SWIPE-V2-1018 section 5), persisted on the phone. The first visit gets the
/// intro line, the demo (the top card performs right then left, about 2.2 s, once in the phone's
/// life) and the coach line; coaching ends for good once both directions were used, or after
/// [maxVisits] visits. Replaces the old caption hint (`today_suggested_hint_shown`): a phone that
/// saw it twice counts as taught.
abstract final class DeckCoach {
  static const String key = 'today_deck_coach';

  /// The old hint's key, migrated once.
  static const String oldHintKey = 'today_suggested_hint_shown';

  /// Coaching visits at most.
  static const int maxVisits = 3;

  /// The store; null uses the phone's (tests set a memory store).
  static PrefsStore? store;

  /// Goldens pin the run; null reads the store.
  static DeckCoachRun? debugRun;

  static Future<DeckCoachRun>? _thisRun;
  static DeckCoachRun? _loaded;
  static bool _visitCounted = false;

  /// This run's coaching, read once (every later call gets the same object). Any error reads as a
  /// phone already taught: never a half-shown coach.
  static Future<DeckCoachRun> load() {
    final pinned = debugRun;
    if (pinned != null) return Future.value(pinned);
    return _thisRun ??= _load().then((run) => _loaded = run);
  }

  /// The run once [load] has finished, else null (the stack's first frame reads it).
  static DeckCoachRun? get loaded => debugRun ?? _loaded;

  static Future<DeckCoachRun> _load() async {
    try {
      final s = store ?? SharedPrefsStore();
      final raw = await s.getString(key);
      if (raw != null) return DeckCoachRun.fromJson(jsonDecode(raw));
      final old = await s.getInt(oldHintKey) ?? 0;
      if (old >= 2) {
        final taught = DeckCoachRun.taught();
        await s.setString(key, jsonEncode(taught.toJson()));
        return taught;
      }
      return DeckCoachRun();
    } catch (_) {
      return DeckCoachRun.taught();
    }
  }

  static Future<void> _save(DeckCoachRun run) async {
    if (identical(run, debugRun)) return;
    try {
      await (store ?? SharedPrefsStore()).setString(key, jsonEncode(run.toJson()));
    } catch (_) {}
  }

  /// The deck was on screen (at least 60% of it): one visit per app run.
  static Future<void> countVisit(DeckCoachRun run) async {
    if (_visitCounted) return;
    _visitCounted = true;
    run.visits++;
    await _save(run);
  }

  /// The demo ran (or began and was stopped by a touch): never again on this phone.
  static Future<void> demoDone(DeckCoachRun run) async {
    run.demoShown = true;
    await _save(run);
  }

  /// The student used a direction (a swipe or its button).
  static Future<void> used(DeckCoachRun run, {required bool right}) async {
    if (right ? run.rightDone : run.leftDone) return;
    if (right) {
      run.rightDone = true;
    } else {
      run.leftDone = true;
    }
    await _save(run);
  }

  /// Forgets this run's answer (tests).
  static void debugReset() {
    _thisRun = null;
    _loaded = null;
    _visitCounted = false;
    debugRun = null;
  }
}

/// What the deck learns, truthfully (SWIPE-V2-1018 section 6): for each kind of card, the IST days
/// in the last week it was passed on (one per day at most). A kind passed on on [sinkDays] or more
/// of the last [window] days sinks to the end of the deck; nothing is removed, the recommended
/// card never moves, and a pick clears the kind's passes. Local to the phone; nothing goes to the
/// server. Pure; [DeckMemoryStore] keeps it.
class DeckMemory {
  DeckMemory([Map<String, List<int>>? passes]) : _passes = {for (final e in (passes ?? const <String, List<int>>{}).entries) e.key: List.of(e.value)};

  /// Days counted back from today, today included.
  static const int window = 7;

  /// Pass days in the window that sink a kind.
  static const int sinkDays = 2;

  final Map<String, List<int>> _passes;

  /// The kind a card belongs to: its choice's key, the subject for another subject's practice.
  static String kindOf(SuggestedCard card) => card.key == 'other' && card.subjectId != null ? 'other:${card.subjectId}' : card.key;

  /// The IST calendar day of [at], as a day number.
  static int dayOf(DateTime at) {
    final ist = at.toUtc().add(const Duration(hours: 5, minutes: 30));
    return DateTime.utc(ist.year, ist.month, ist.day).millisecondsSinceEpoch ~/ Duration.millisecondsPerDay;
  }

  /// The pass days kept for [kind] (a copy).
  List<int> passesOf(String kind) => List.of(_passes[kind] ?? const []);

  /// Puts [kind]'s days back as they were (the undo of a Not now or a pick).
  void restore(String kind, List<int> days) {
    if (days.isEmpty) {
      _passes.remove(kind);
    } else {
      _passes[kind] = List.of(days);
    }
  }

  /// [kind] was passed on on [day]: kept once per day, and only the last [window] days.
  void passed(String kind, int day) {
    final days = {...?_passes[kind], day}.where((d) => d > day - window).toList()..sort();
    _passes[kind] = days;
  }

  /// [kind] was picked (Up next): its passes are cleared.
  void picked(String kind) => _passes.remove(kind);

  /// Whether [kind] sits lower on [today].
  bool sinks(String kind, int today) => (_passes[kind] ?? const []).where((d) => d <= today && d > today - window).length >= sinkDays;

  /// [cards] in deck order on [today]: the recommended card first as it was, then those that do not
  /// sink in their order, then those that sink in theirs. Never adds or removes a card.
  List<SuggestedCard> order(List<SuggestedCard> cards, int today) {
    final kept = <SuggestedCard>[];
    final sunk = <SuggestedCard>[];
    for (final c in cards) {
      (!c.suggested && sinks(kindOf(c), today) ? sunk : kept).add(c);
    }
    return [...kept, ...sunk];
  }

  Map<String, Object> toJson() => {for (final e in _passes.entries) e.key: e.value};

  static DeckMemory fromJson(Object? json) {
    if (json is! Map) return DeckMemory();
    return DeckMemory({
      for (final e in json.entries)
        if (e.key is String && e.value is List) e.key as String: [for (final d in e.value as List) if (d is int) d],
    });
  }
}

/// The phone's [DeckMemory] under [key], read once per app run.
abstract final class DeckMemoryStore {
  static const String key = 'today_deck_memory';

  /// The store; null uses the phone's (tests set a memory store).
  static PrefsStore? store;

  /// The clock (tests set it).
  static DateTime Function() clock = DateTime.now;

  static Future<DeckMemory>? _thisRun;
  static DeckMemory? _loaded;

  /// Today's IST day number.
  static int get today => DeckMemory.dayOf(clock());

  /// The memory once read, else null.
  static DeckMemory? get loaded => _loaded;

  /// Reads the memory once; any error reads as an empty one.
  static Future<DeckMemory> load() => _thisRun ??= _load().then((m) => _loaded = m);

  static Future<DeckMemory> _load() async {
    try {
      final raw = await (store ?? SharedPrefsStore()).getString(key);
      return raw == null ? DeckMemory() : DeckMemory.fromJson(jsonDecode(raw));
    } catch (_) {
      return DeckMemory();
    }
  }

  static Future<void> save() async {
    final m = _loaded;
    if (m == null) return;
    try {
      await (store ?? SharedPrefsStore()).setString(key, jsonEncode(m.toJson()));
    } catch (_) {}
  }

  /// Forgets this run's memory (tests).
  static void debugReset() {
    _thisRun = null;
    _loaded = null;
    clock = DateTime.now;
  }
}
