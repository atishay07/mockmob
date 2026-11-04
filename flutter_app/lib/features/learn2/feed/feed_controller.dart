/// The Explore feed's state and actions (the web's `ChapterFeed.jsx` `Feed`, BUILD-1101 B3 with B7, A1 3.1-3.18, A8
/// F1-F18), owned by the feed screen. It holds what the phone knows about one feed: the items and their states, the
/// current screen, the streak, whether the run is closed, and the end the server added up. Every number on screen
/// comes from the server or from what the student did here; nothing is invented.
///
///   start     `POST /api/learn/runs` (kind feed, the lesson left out, the cover's source when there is one) or
///             `GET /api/learn/runs/:id` for a feed being picked up ("Picked up at 7 of 21" in the title for 2.4 s);
///             `end` opens on the end only
///   moving    [go] to a slot or the end (a slot index; the end is [endAt]); a card is "seen" once it is on screen
///   actions   [turn], [keep] (the stamp "In Revise" once the server has it, 402: "This card is on Pro."), [save], [choose]
///             (one send per item, the re-insert, the streak, 409 left-out lines, Free's day claimed elsewhere ends calmly)
///   end       read on arrival and again when something changed since (never invented numbers); [stopHere] shows it and
///             tells the server the feed stays open to pick up today; [againFeed] starts a fresh feed of the chapter
///             ("Keep going · 10 min"), [resumeFeed] picks a stopped one up by its id ("Continue · 6 min"). Every start or
///             resume takes a token: an answer for an older one is dropped, and the end's keys wait while one is on its way
///
/// Side effects the screen draws are callbacks: [onSay] (a polite announcement), [onKept] (the confirm haptic after the
/// server's 200; a phone's bar has no pile to fly to), [onSaved] (the app's Saved list reads again), [onSeePro] (`keycards`
/// for a locked card, `saved` for Free's save limit).
///
/// The first visit's cue (R2 ruling 7): [cueDue] is true on a student's first feed until the student moves once, by any means;
/// only that first move marks it seen (once per student, in Learn's prefs), never its showing.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../../../core/models/json_helpers.dart';
import '../../keycards/data/keycards_lines.dart' show cardFace;
import '../data/learn_api.dart';
import '../data/learn_models.dart';
import '../data/learn_prefs.dart';
import '../learn2_links.dart';
import '../stage/stage_text.dart';
import 'feed_copy.dart';
import 'feed_model.dart';

/// What the feed shows.
enum FeedStatus { loading, ready, error, notFound, empty, free }

/// The end's read.
enum FeedEndStatus { idle, loading, ready, error }

/// The items, or the end over them.
enum FeedMode { items, end }

class FeedController extends ChangeNotifier {
  FeedController({
    required this.api,
    required this.launch,
    this.prefs,
    this.onSay,
    this.onKept,
    this.studentId,
    this.onSaved,
    this.onSeePro,
    this.slowAfter = const Duration(seconds: 8),
  });

  final LearnApi api;
  final FeedLaunch launch;
  final LearnPrefs? prefs;
  final ValueChanged<String>? onSay;
  final ValueChanged<String>? onKept;

  /// The student's id, so the first visit's cue and the run's coach lines are once per student, not once per phone.
  final String? studentId;
  final VoidCallback? onSaved;
  final ValueChanged<String>? onSeePro;

  /// "Taking longer than usual" comes after this.
  final Duration slowAfter;

  /// The cue chip's id in Learn's prefs (v2: the earlier track nudge is gone).
  static String cueId(String? studentId) => 'feed.nudge.v2:${studentId ?? 'anon'}';

  /// The cue leaves over this long once the student moves.
  static const Duration cueLeave = Duration(milliseconds: 160);

  /// The step key's label changes to Next this far into the turn (the faces swap at 90 degrees).
  static const Duration backAfter = Duration(milliseconds: 170);

  // ---------------------------------------------------------------- state

  FeedStatus status = FeedStatus.loading;
  LearnRun? run;

  /// The feed opened on its end only (a closed run, `end=1`, a pick-up with nothing left).
  bool onlyEnd = false;

  /// Free's day is used (402 FREE_SESSION_USED): the server's line, options and the run that holds the day.
  LearnSessionUsed? free;

  List<LearnItem> _items = const [];
  List<FeedSlot> _slots = const [];
  Map<String, ({int n, int of})> _places = const {};
  Map<String, FeedItemState> _states = const {};

  /// The current slot; [endAt] is the end.
  int active = 0;

  /// Items done before this phone's list starts (a picked-up feed).
  int base = 0;

  /// Right answers in a row, this one included.
  int streak = 0;

  /// The run is over (its end was read, or the server said it ended): nothing more is counted.
  bool closed = false;

  /// The furthest item reached (1-based).
  int furthest = 0;

  FeedEndStatus endStatus = FeedEndStatus.idle;
  LearnEnd? endData;
  int endVersion = -1;

  /// Bumped by every write the server took; the end is read again when it moved.
  int dirty = 0;

  /// The title's note ("Picked up at 7 of 21").
  String? note;

  /// The start is taking longer than [slowAfter].
  bool slow = false;

  /// A new feed or a pick-up is starting ("Keep going", "Continue"): the end's keys wait.
  bool again = false;

  /// The student stopped part way ("Stop here"): the end reads with `?stop=1` and says "5 of 20 done".
  bool stoppedHere = false;

  /// Walk I12: the seconds the feed had left where it was left (the checkpoint's own figure), for the stopped end's
  /// "Continue · N min". Null until the end is reached from the items.
  int? stopSeconds;

  /// The first visit's cue shows (until the first move) and is leaving (the 160 ms fade).
  bool cueDue = false;
  bool cueLeaving = false;

  /// Reduced motion (the screen keeps it current): the turn's Next comes at once.
  bool reduced = false;

  /// Something the server holds changed in this feed (the Learn reads are stale once the feed is left).
  bool changed = false;

  bool _stopping = false;
  bool _started = false;
  bool _disposed = false;
  int _gen = 0;
  final Set<String> _sent = {};
  Timer? _slowTimer;
  Timer? _cueTimer;
  final Map<String, Timer> _backTimers = {};

  // ---------------------------------------------------------------- reads

  /// The feed's cards and questions, in order (a re-insert adds to it).
  List<LearnItem> get items => _items;

  /// The screens: items and checkpoints.
  List<FeedSlot> get slots => _slots;

  /// The end's place in the pager (one past the last slot).
  int get endAt => _slots.length;

  /// Items in all, the done ones before a pick-up included.
  int get of => base + _items.length;

  FeedItemState stateOf(String itemId) => _states[itemId] ?? const FeedItemState();

  Map<String, FeedItemState> get states => _states;

  ({int n, int of})? placeOf(String itemId) => _places[itemId];

  FeedNumbers get numbers => FeedModel.numbers(_items, _states);

  bool get hasCards => _items.any((i) => i is LearnCardItem);

  /// The chapter's title ('' until it is known).
  String get title {
    final c = run?.chapter;
    if (c == null) return '';
    if (c.raw.isEmpty) return c.title == c.key ? '' : c.title;
    return asString(c.raw['title'])?.trim() ?? '';
  }

  /// The chapter: the link's, else the run's.
  String? get chapterKey {
    final own = launch.chapterKey;
    if (own != null && own.isNotEmpty) return own;
    final key = run?.chapter.key;
    return key == null || key.isEmpty ? null : key;
  }

  FeedMode get mode => onlyEnd || (status == FeedStatus.ready && active >= endAt) ? FeedMode.end : FeedMode.items;

  /// The current slot (the end past the last), null until the feed is ready.
  FeedSlot? get slot => status != FeedStatus.ready ? null : (active >= endAt ? const FeedEndSlot() : _slots[active]);

  /// "3" of "3 of 21".
  int get position => switch (slot) {
    FeedItemSlot(:final n) => base + n,
    FeedCheckpointSlot(:final after) => base + after,
    _ => of,
  };

  /// Ticks drawn done before the current one.
  int get doneCount => switch (slot) {
    FeedItemSlot(:final n) => base + n - 1,
    FeedCheckpointSlot(:final after) => base + after,
    _ => of,
  };

  /// The current tick (0-based), -1 on a checkpoint and the end.
  int get current => switch (slot) {
    FeedItemSlot(:final n) => base + n - 1,
    _ => -1,
  };

  /// Items done, for the stop rule (before any, Close leaves; after one, it asks).
  int get itemsDone => FeedModel.itemsDone(_items, _states, base: base);

  /// The stop rule applies: the items are on screen and one is done.
  bool get asksToStop => status == FeedStatus.ready && mode == FeedMode.items && itemsDone > 0;

  /// "This feed": a row per item.
  List<FeedSheetRow> sheetRows() => FeedModel.sheetRows(_items, _states, base);

  /// The slot of an item, -1 when it is not in the feed.
  int slotIndexOf(String itemId) => _slots.indexWhere((s) => s is FeedItemSlot && s.item.id == itemId);

  /// What the pager says when a page becomes the current one (the web's `announce`).
  String announceOf(int i) {
    if (i >= endAt) return FeedCopy.endSaid;
    final s = _slots[i];
    switch (s) {
      case FeedCheckpointSlot(:final after):
        return FeedCopy.checkpointLabel(base + after, of);
      case FeedItemSlot(:final item, :final n):
        final pos = base + n;
        if (item is LearnCardItem) {
          final f = cardFace(item.card);
          return '${FeedCopy.cardLabel(pos, of)}. ${f.label}. ${StageText.speakable(f.front)}';
        }
        if (item is LearnQuestionItem) {
          final head = item.isMistake ? '${item.mistake?.label ?? FeedCopy.openMistake}. ' : '';
          final body = item.question.body;
          return '${FeedCopy.questionLabel(pos, of)}. $head${body.length > 160 ? body.substring(0, 160) : body}';
        }
        return FeedCopy.questionLabel(pos, of);
      case FeedEndSlot():
        return FeedCopy.endSaid;
    }
  }

  // ---------------------------------------------------------------- start, resume, end

  /// Starts the feed once: the end only when the link asks for it, else a start or a pick-up.
  Future<void> start() async {
    if (_started) return;
    _started = true;
    unawaited(_readCue());
    final id = launch.runId;
    if (launch.end && id != null) {
      _openOnEnd(id);
      return;
    }
    await begin();
  }

  Future<void> _readCue() async {
    final p = prefs;
    if (p == null) return;
    try {
      cueDue = !await p.coachSeen(cueId(studentId));
    } on Object {
      cueDue = false;
    }
    _notify();
  }

  /// The first move of a student's first feed: the cue fades out (160 ms) and only now is it marked seen.
  void _cueMoved() {
    unawaited(prefs?.markCoachSeen(cueId(studentId)));
    cueLeaving = true;
    _cueTimer?.cancel();
    _cueTimer = Timer(reduced ? Duration.zero : cueLeave, () {
      cueDue = false;
      cueLeaving = false;
      _notify();
    });
  }

  /// A run that is only an end: its id and the link's chapter.
  void _openOnEnd(String runId) {
    run = LearnRun(id: runId, kind: LearnKinds.feed, chapter: LearnRunChapter(key: launch.chapterKey ?? '', title: ''));
    onlyEnd = true;
    status = FeedStatus.ready;
    _notify();
    unawaited(readEnd(runId, 0));
  }

  /// Starts (or with a run id, picks up) the feed; [fresh] never picks up.
  Future<void> begin({bool fresh = false}) async {
    final gen = ++_gen;
    status = FeedStatus.loading;
    slow = false;
    _slowTimer?.cancel();
    _slowTimer = Timer(slowAfter, () {
      if (gen != _gen || status != FeedStatus.loading) return;
      slow = true;
      _notify();
    });
    _notify();
    final id = launch.runId;
    try {
      final r = id != null && !fresh
          ? await api.getRun(id)
          : await api.startRun(
              RunStart(
                kind: LearnKinds.feed,
                chapterKey: launch.chapterKey,
                minutes: launch.minutes,
                leaveOut: const [LearnPiles.lesson],
                fresh: fresh,
                source: launch.source,
                forYou: launch.source != null ? launch.forYou : null,
                position: launch.source != null ? launch.position : null,
              ),
            );
      if (gen != _gen || _disposed) return;
      _adopt(r);
      if (r.items.isEmpty && (r.resumed?.done ?? 0) > 0) {
        active = 0;
        onlyEnd = true;
        status = FeedStatus.ready;
        _notify();
        unawaited(readEnd(r.id, 0));
      }
    } on Object catch (e) {
      if (gen != _gen || _disposed) return;
      if (isSessionUsed(e)) {
        _freeUsed(e as LearnError);
      } else if (isRunClosed(e) && id != null) {
        _openOnEnd(id);
        return;
      } else if (e is LearnError && e.status == 404) {
        run = null;
        status = FeedStatus.notFound;
      } else {
        run = null;
        status = FeedStatus.error;
      }
      _notify();
    } finally {
      if (gen == _gen) _slowTimer?.cancel();
    }
  }

  void _freeUsed(LearnError e) {
    free = e.sessionUsed;
    run = null;
    onlyEnd = false;
    status = FeedStatus.free;
  }

  /// Takes a run from the server as the feed: its cards and questions, the first card seen, the pick-up's place.
  void _adopt(LearnRun r) {
    final all = [
      for (final i in r.items)
        if (i is LearnCardItem || i is LearnQuestionItem) i,
    ];
    final done = r.resumed?.done ?? 0;
    _sent.clear();
    _stopping = false;
    stoppedHere = false;
    stopSeconds = null;
    for (final t in _backTimers.values) {
      t.cancel();
    }
    _backTimers.clear();
    _setItems(all);
    _states = all.isNotEmpty && all.first is LearnCardItem ? {all.first.id: const FeedItemState(seen: true)} : {};
    base = done;
    active = 0;
    furthest = 0;
    streak = 0;
    closed = false;
    endStatus = FeedEndStatus.idle;
    endData = null;
    endVersion = -1;
    dirty = 0;
    run = r;
    onlyEnd = false;
    free = null;
    status = all.isNotEmpty || done > 0 ? FeedStatus.ready : FeedStatus.empty;
    note = done > 0 && all.isNotEmpty ? FeedCopy.pickedUp(done + 1, done + all.length) : null;
    _notify();
  }

  void _setItems(List<LearnItem> items) {
    _items = List.unmodifiable(items);
    _slots = List.unmodifiable(FeedModel.slots(_items));
    _places = FeedModel.questionPlaces(_items);
  }

  /// Reads the end (`GET /end`; `?stop=1` after "Stop here", so the server keeps the feed open to pick up today). The previous
  /// end stays on screen while the same version is read again; a newer version shows the end's skeleton until the new
  /// numbers come. A failure keeps what was there.
  Future<void> readEnd(String runId, int version, {bool stop = false}) async {
    endStatus = endData != null && endVersion == version ? FeedEndStatus.ready : FeedEndStatus.loading;
    _notify();
    try {
      final data = await api.end(runId, stop: stop);
      if (_disposed || run?.id != runId) return;
      endData = data;
      endVersion = version;
      endStatus = FeedEndStatus.ready;
      closed = true;
    } on Object {
      if (_disposed || run?.id != runId) return;
      endStatus = FeedEndStatus.error;
    }
    _notify();
  }

  /// "Continue · 6 min" on a stopped feed's end: the same feed by its id, picked up where it stopped. A closed run goes to its end.
  Future<void> resumeFeed(String runId) async {
    if (again) return;
    again = true;
    final gen = ++_gen;
    _notify();
    try {
      final r = await api.getRun(runId);
      if (_disposed || gen != _gen) return;
      _adopt(r);
    } on Object catch (e) {
      if (_disposed || gen != _gen) return;
      if (isRunClosed(e)) {
        unawaited(readEnd(runId, dirty));
      } else {
        run = null;
        status = FeedStatus.error;
      }
    } finally {
      if (!_disposed && gen == _gen) {
        again = false;
        _notify();
      }
    }
  }

  /// "Keep going · 10 min": a fresh feed of the chapter (never the one that ended).
  Future<void> againFeed() async {
    if (again) return;
    again = true;
    final gen = ++_gen;
    _notify();
    try {
      final r = await api.startRun(
        RunStart(kind: LearnKinds.feed, chapterKey: chapterKey, minutes: launch.minutes, leaveOut: const [LearnPiles.lesson], fresh: true),
      );
      if (_disposed || gen != _gen) return;
      _adopt(r);
    } on Object catch (e) {
      if (_disposed || gen != _gen) return;
      if (isSessionUsed(e)) _freeUsed(e as LearnError);
    } finally {
      if (!_disposed && gen == _gen) {
        again = false;
        _notify();
      }
    }
  }

  // ---------------------------------------------------------------- moving

  /// Shows slot [i] (the end at [endAt] and past it). A card is seen once it is on screen; the end is read when it
  /// comes into view and something changed since the last read.
  void go(int i) {
    final n = i.clamp(0, endAt);
    final moved = n != active;
    if (n >= endAt && active < endAt) {
      final was = _slots[active];
      stopSeconds = FeedModel.secondsFrom(
        _items,
        switch (was) {
          FeedItemSlot(:final n) => n - 1,
          FeedCheckpointSlot(:final after) => after,
          _ => _items.length,
        },
      );
    }
    active = n;
    if (note != null && note!.startsWith('Carrying on')) note = null;
    final s = n < endAt ? _slots[n] : null;
    if (s is FeedItemSlot) {
      furthest = math.max(furthest, s.n);
      if (s.item is LearnCardItem) _patch(s.item.id, (st) => st.copyWith(seen: true));
    }
    if (s is FeedCheckpointSlot) furthest = math.max(furthest, s.after);
    final r = run;
    if (n >= endAt && r != null && r.id.isNotEmpty) {
      // A stop part way keeps the furthest item it reached: the end says "5 of 20 done".
      if (!_stopping) furthest = _items.length;
      if (endStatus != FeedEndStatus.ready || endVersion != dirty) unawaited(readEnd(r.id, dirty, stop: _stopping));
    }
    if (moved && cueDue && !cueLeaving) _cueMoved();
    _notify();
  }

  /// "Stop here": shows the end and tells the server the feed stays open to pick up today.
  void stopHere() {
    _stopping = true;
    stoppedHere = true;
    go(endAt);
  }

  // ---------------------------------------------------------------- actions

  /// Turns a card over (or back). The back counts as read a moment into the turn (the step key then says Next).
  void turn(LearnCardItem item) {
    final st = stateOf(item.id);
    _patch(item.id, (s) => s.copyWith(turned: !st.turned));
    if (!st.turned) {
      if (reduced) {
        _patch(item.id, (s) => s.copyWith(seenBack: true));
      } else {
        _backTimers[item.id]?.cancel();
        _backTimers[item.id] = Timer(backAfter, () {
          _backTimers.remove(item.id);
          _patch(item.id, (s) => s.copyWith(seenBack: true));
          _notify();
        });
      }
      final back = item.card.back;
      _say(FeedCopy.ncertLine(back.length > 600 ? back.substring(0, 600) : back));
    } else {
      _say(FeedCopy.cardSide);
    }
    _notify();
  }

  /// Keeps a card in Revise (`rate {keep: true}`). A locked card's key opens Pro instead.
  Future<void> keep(LearnCardItem item) async {
    final st = stateOf(item.id);
    if (st.keepPro) {
      onSeePro?.call('keycards');
      return;
    }
    final r = run;
    if (st.kept || st.keeping || r == null || item.look) return;
    _patch(item.id, (s) => s.copyWith(keeping: true, stamp: null));
    _notify();
    try {
      final res = await api.keep(r.id, item.id);
      if (_disposed || run?.id != r.id) return;
      // "In Revise" with a check, once the server has it (never before); the server's own line (when the card comes back) is spoken.
      _patch(item.id, (s) => s.copyWith(kept: true, keeping: false, stamp: const FeedStamp(FeedCopy.inRevise)));
      dirty += 1;
      changed = true;
      _say(FeedCopy.keptSaid(res.line ?? ''));
      onKept?.call(item.id);
    } on Object catch (e) {
      if (_disposed || run?.id != r.id) return;
      if (isRunClosed(e)) {
        _patch(item.id, (s) => s.copyWith(keeping: false));
        closed = true;
        go(endAt);
        return;
      }
      final pro = e is LearnError && e.status == 402;
      _patch(
        item.id,
        (s) => s.copyWith(keeping: false, keepPro: pro, stamp: pro ? const FeedStamp(FeedCopy.keepProStamp) : const FeedStamp(FeedCopy.notAdded, bad: true)),
      );
      _say(pro ? FeedCopy.keepProStamp : FeedCopy.couldNotAdd);
    }
    _notify();
  }

  /// Saves a question to the app's Saved list (`POST /api/bookmarks`). Free's limit's key opens Pro instead.
  Future<void> save(LearnQuestionItem item) async {
    final st = stateOf(item.id);
    if (st.savePro) {
      onSeePro?.call('saved');
      return;
    }
    if (st.saved || st.saving) return;
    _patch(item.id, (s) => s.copyWith(saving: true));
    _notify();
    try {
      await api.saveQuestion(item.question.id);
      if (_disposed) return;
      _patch(item.id, (s) => s.copyWith(saved: true, saving: false));
      _say(FeedCopy.savedSaid);
      onSaved?.call();
    } on Object catch (e) {
      if (_disposed) return;
      final pro = e is LearnError && e.status == 402;
      _patch(item.id, (s) => s.copyWith(saving: false, savePro: pro));
      _say(pro ? FeedCopy.saveOnPro : FeedCopy.couldNotSave);
    }
    _notify();
  }

  /// Answers a question once; the server grades it (no key on the phone before).
  Future<void> choose(LearnQuestionItem item, String choice) async {
    final st = stateOf(item.id);
    final r = run;
    if (st.answer != null || st.skipped != null || closed || r == null || _sent.contains(item.id)) return;
    _sent.add(item.id);
    _patch(item.id, (s) => s.copyWith(answer: FeedAnswer.pending(choice), error: null));
    _notify();
    try {
      final res = await api.answer(r.id, item.id, choice);
      if (_disposed || run?.id != r.id) return;
      final picked = res.choice ?? choice;
      _patch(item.id, (s) => s.copyWith(answer: FeedAnswer.graded(picked, res)));
      final nextStreak = res.correct ? streak + 1 : 0;
      streak = nextStreak;
      dirty += 1;
      changed = true;
      final back = res.reinsert;
      if (back != null) _reinsert(item.id, back);
      final options = [for (final o in item.question.options) (key: o.key, text: o.text)];
      final key = res.key ?? '';
      if (res.correct) {
        _say(res.fixedText ?? FeedCopy.right(nextStreak));
      } else {
        final at = options.indexWhere((o) => o.key == key);
        final texts = StageText.optionTexts(options);
        final text = at >= 0 && at < texts.length ? texts[at] : '';
        final card = res.line?.card;
        final lineBack = card != null && !(res.line?.locked ?? false) ? card.back : null;
        final said = lineBack == null ? '' : FeedCopy.lineSaid(lineBack.length > 400 ? lineBack.substring(0, 400) : lineBack);
        _say(FeedCopy.notQuite(StageText.letterOf(options, key), text, said));
      }
    } on Object catch (e) {
      _sent.remove(item.id);
      if (_disposed || run?.id != r.id) return;
      if (isQuestionSkipped(e)) {
        final line = (e as LearnError).kind == LearnErrorKind.questionHeld ? FeedCopy.questionHeld : FeedCopy.questionChanged;
        _patch(item.id, (s) => s.copyWith(answer: null, skipped: line));
        _say(line);
      } else if (isRunClosed(e)) {
        _patch(item.id, (s) => s.copyWith(answer: null));
        closed = true;
        go(endAt);
        return;
      } else if (isSessionUsed(e)) {
        final said = asString((e as LearnError).data['line']);
        _patch(item.id, (s) => s.copyWith(answer: null, skipped: said ?? FeedCopy.freeDoneShort));
        closed = true;
        _say(said ?? '');
      } else {
        _patch(item.id, (s) => s.copyWith(answer: null, error: FeedCopy.notSaved));
      }
    }
    _notify();
  }

  /// An answer's re-insert. The current screen stays on the same item: a checkpoint that a longer list now earns
  /// before it must not slide the student back a page (the web's `active` index would).
  void _reinsert(String answeredId, LearnReinsert back) {
    final before = active < endAt ? _slots[active] : null;
    final next = FeedModel.spliceReinsert(_items, answeredId: answeredId, reinsert: back, resumed: base > 0);
    if (identical(next, _items)) return;
    _setItems(next);
    switch (before) {
      case FeedItemSlot(:final item):
        final at = slotIndexOf(item.id);
        if (at >= 0) active = at;
      case FeedCheckpointSlot(:final id):
        final at = _slots.indexWhere((s) => s is FeedCheckpointSlot && s.id == id);
        if (at >= 0) active = at;
      default:
        active = math.min(active, endAt);
    }
  }

  // ---------------------------------------------------------------- plumbing

  void _patch(String id, FeedItemState Function(FeedItemState s) f) {
    _states = {..._states, id: f(stateOf(id))};
  }

  void _say(String text) {
    if (text.isEmpty || _disposed) return;
    onSay?.call(text);
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _gen += 1;
    _slowTimer?.cancel();
    _cueTimer?.cancel();
    for (final t in _backTimers.values) {
      t.cancel();
    }
    _backTimers.clear();
    super.dispose();
  }
}
