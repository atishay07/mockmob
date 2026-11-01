/// The Learn run's state and actions (the web's `RunPlayer.jsx` `Player`, BUILD-1101 B2 with B7, A4 3.3 to 3.5, A8 F7 to F11),
/// owned by the run screen. It holds what the phone knows about one run: the items and what was done with each, the item on
/// screen, the In Revise pile, the streak, and the end the server added up. Every number on screen comes from the server or
/// from what the student did here; nothing is invented.
///
///   start     `POST /api/learn/runs` (kind, chapter, minutes, left-out piles, card ids, fresh, add the next chapter) or, with a
///             run id (Learn home's "Pick up", a closed run's link), `GET /api/learn/runs/:id`; a closed or gone run goes to its
///             end; `end` opens on the end only
///   a card    [turn] (front and back; a recap shows its back), [rate] (Missed 1, Got it 3, Easy 4: the card leaves only after
///             the server took the rating, a tap while it leaves is ignored, a failure keeps the card with its line), [lookNext]
///             (a look past Free's ratings: one Next, logged with rating 3 and not waited for)
///   a question [pick] (one send per item, the server grades, the re-insert, the streak), [skip] (never a mistake), [save]
///   a lesson  [readLesson] (opens the lesson, counted read on return), [skipLesson]
///   moving    [advance] (a cards run pauses after every 20 rated), [goRecap] (Previous and Next), [finish] (the end, or the recap's
///             own end), the stop rule ([asksToStop]: before any item is done Close leaves, after one it asks)
///   end       read from `GET /end` (never invented numbers), read again on Try again
///
/// What the screen draws as a side effect is a callback: [onSay] (a polite announcement), [onRated] (the confirm or tick haptic
/// and the card's flight), [onSeePro], [onSaved], [openLesson].
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../../../core/models/json_helpers.dart';
import '../data/learn_api.dart';
import '../data/learn_models.dart';
import '../data/learn_prefs.dart';
import '../learn2_links.dart';
import 'run_copy.dart';
import 'run_math.dart';
import 'run_view.dart';

/// What the run shows.
enum RunStatus { loading, ready, error, notFound, free, empty }

/// Where the player is: on its items, between the rounds of a cards run, at a recap's own end, or at the end.
enum RunPhase { play, round, recapEnd, end }

/// The end's read.
enum RunEndStatus { idle, loading, ready, error }

/// A question's answer: the choice on its way, or graded by the server.
class RunAnswer {
  const RunAnswer.pending(this.choice) : res = null;
  const RunAnswer.graded(this.choice, LearnAnswer this.res);

  final String choice;
  final LearnAnswer? res;

  bool get pending => res == null;
}

/// A question's Save.
enum RunSave { saved, busy, pro }

const Object _keep = Object();

/// What was done with one item here.
@immutable
class RunItemState {
  const RunItemState({this.turned, this.answer, this.skipped, this.byStudent = false, this.error});

  /// Null: not set (a recap card shows its back, any other its front).
  final bool? turned;
  final RunAnswer? answer;

  /// A question the server left out (409): its line.
  final String? skipped;

  /// The student pressed Skip.
  final bool byStudent;

  /// "That answer was not saved. Try again."
  final String? error;

  RunItemState copyWith({Object? turned = _keep, Object? answer = _keep, Object? skipped = _keep, bool? byStudent, Object? error = _keep}) => RunItemState(
    turned: identical(turned, _keep) ? this.turned : turned as bool?,
    answer: identical(answer, _keep) ? this.answer : answer as RunAnswer?,
    skipped: identical(skipped, _keep) ? this.skipped : skipped as String?,
    byStudent: byStudent ?? this.byStudent,
    error: identical(error, _keep) ? this.error : error as String?,
  );
}

/// The stamp under the keys after a rating: the server's real day ("Back Wed", "Back in 12 days").
@immutable
class RunStamp {
  const RunStamp(this.text, this.n);

  final String text;

  /// Which stamp (so the same words show again as a new one).
  final int n;
}

/// The one line under the keys: an error, a note, the stamp, a coach line or Free's look line.
@immutable
class RunStatusLine {
  const RunStatusLine(this.text, {this.bad = false, this.stamp = false, this.n});

  final String text;
  final bool bad;
  final bool stamp;
  final int? n;
}

/// A card that left after its rating (or its look): what the screen plays (the haptic and the flight).
@immutable
class RunRated {
  const RunRated({required this.itemId, required this.kind, required this.look, this.stamp, this.viaRating = false});

  final String itemId;

  /// A rating key made it (its haptic comes after the server's answer); false for a look's Next, whose key gave its own.
  final bool viaRating;

  /// `got` and `easy` fly into the In Revise pile; `missed` (and a look) drop away.
  final String kind;

  /// A look past Free's ratings: nothing was sent to Revise.
  final bool look;
  final String? stamp;

  bool get flies => !look && kind != 'missed';
}

class RunController extends ChangeNotifier {
  RunController({required this.api, required this.launch, this.prefs, this.onSay, this.onRated, this.onSeePro, this.onSaved, this.openLesson});

  final LearnApi api;
  RunLaunch launch;
  final LearnPrefs? prefs;
  final ValueChanged<String>? onSay;
  final ValueChanged<RunRated>? onRated;
  final ValueChanged<String>? onSeePro;
  final VoidCallback? onSaved;

  /// Opens a lesson's own page and completes when the student comes back.
  final Future<void> Function(String lessonId)? openLesson;

  /// The cards run pauses after this many rated.
  static const int roundEvery = 20;

  /// A card that flew into the pile: the next item may rise this far into the flight, and the pile counts it this far in
  /// (the 100 ms lift and the 320 ms arc; Easy's arc is 280). Missed and a look: 160 and 260. Reduced motion: 120.
  static const Duration handoffFly = Duration(milliseconds: 220);
  static const Duration handoffDrop = Duration(milliseconds: 160);
  static const Duration landGot = Duration(milliseconds: 420);
  static const Duration landEasy = Duration(milliseconds: 380);
  static const Duration landDrop = Duration(milliseconds: 260);
  static const Duration reducedFade = Duration(milliseconds: 120);
  static const Duration stampFor = Duration(milliseconds: 1120);
  static const Duration stampForReduced = Duration(milliseconds: 1500);
  static const Duration noteFor = Duration(seconds: 3);

  // ---------------------------------------------------------------- state

  RunStatus status = RunStatus.loading;
  RunPhase phase = RunPhase.play;
  LearnRun? run;

  /// Free's day is used (402 FREE_SESSION_USED): the server's line, options and the run that holds the day.
  LearnSessionUsed? free;

  List<LearnItem> _items = const [];
  Map<String, RunItemState> _states = const {};
  final Map<String, bool> _graded = {};
  Map<String, RunSave> _saves = const {};

  /// The item on screen (an index into [items]).
  int at = 0;

  /// Items done before this phone's list starts (a picked-up run).
  int offset = 0;

  /// The In Revise count and its pop (it changes when a card lands).
  int pile = 0;
  int pop = 0;

  /// The rating on its way (1, 3 or 4), and the card leaving after one.
  int? busy;
  bool leaving = false;

  RunStamp? stamp;
  String? note;
  String? error;
  String? lookLine;
  bool lookSaid = false;
  RunTally tally = const RunTally();

  /// The cards run's pause: how many rounds of 20 are done.
  int round = 0;

  RunEndStatus endStatus = RunEndStatus.idle;
  LearnEnd? endData;
  int? stoppedAt;

  /// Something the server holds changed in this run (the Learn reads are stale once the run is left).
  bool changed = false;

  /// Reduced motion (the screen keeps it current): no flight, a 120 ms hand-off, a 1.5 s plain stamp.
  bool reduced = false;

  bool _started = false;
  bool _disposed = false;
  bool _flying = false;
  bool _lessonOpen = false;
  int _gen = 0;
  int _stamps = 0;
  int _endGen = 0;
  final Set<String> _sent = {};
  final Set<String> _coachSeen = {};
  final Set<String> _coachMarked = {};
  Timer? _stampTimer;
  Timer? _noteTimer;
  Timer? _landTimer;

  static const List<String> _coachIds = ['front', 'rate', 'pick', 'recap'];

  // ---------------------------------------------------------------- reads

  List<LearnItem> get items => _items;

  RunItemState stateOf(String itemId) => _states[itemId] ?? const RunItemState();

  RunSave? saveOf(String questionId) => _saves[questionId];

  /// The item on screen, null outside play.
  LearnItem? get item => phase == RunPhase.play && at >= 0 && at < _items.length ? _items[at] : null;

  bool get isRecap => (run?.kind ?? launch.kind) == LearnKinds.recap;

  String get kind => run?.kind ?? launch.kind;

  /// The chapter's title ('' until it is known).
  String get title => run?.chapter.title == run?.chapter.key ? '' : (run?.chapter.title ?? '');

  /// The chapter: the link's, else the run's.
  String? get chapterKey {
    final own = launch.chapterKey;
    if (own != null && own.isNotEmpty) return own;
    final key = run?.chapter.key;
    return key == null || key.isEmpty ? null : key;
  }

  /// Items in all, the done ones before a pick-up included.
  int get total => offset + _items.length;

  /// "3" of "3 of 21".
  int get position => offset + at + 1;

  bool isTurned(LearnItem? it) => it is LearnCardItem && (stateOf(it.id).turned ?? isRecap);

  bool isAnswered(LearnItem it) {
    final st = stateOf(it.id);
    return st.answer?.res != null || st.skipped != null || st.byStudent;
  }

  /// A card shown without a rating (Free past its ratings; the server's flag, or its limit line after the first look).
  bool isLook(LearnItem it) => it is LearnCardItem && !isRecap && (it.look || (lookLine != null && lookSaid));

  /// Items finished: the ones before the current one, and the current one once its question is answered.
  int get finished => phase == RunPhase.play ? at + (item is LearnQuestionItem && isAnswered(item!) ? 1 : 0) : _items.length;

  /// Items done, for the stop rule (before any, Close leaves; after one, it asks).
  int get doneCount => offset + finished;

  RunAnswerTally get answers => RunView.answerTally(_items, _graded);

  /// "about 6 min left".
  String? get left => phase == RunPhase.play ? RunMath.minutesLeftLine(_items, finished, kind) : null;

  /// The stop rule applies: the items are on screen and one is done.
  bool get asksToStop => status == RunStatus.ready && phase == RunPhase.play && doneCount > 0;

  /// The stop sheet's detail ("2 of 3 questions right. 4 sent to Revise.").
  String? get stopDetail {
    final parts = [if (tally.asked > 0) RunCopy.questionsRight(tally.right, tally.asked), if (tally.toRevise > 0) RunCopy.sentToRevise(tally.toRevise)];
    return parts.isEmpty ? null : parts.join(' ');
  }

  /// The last item.
  bool get last => at + 1 >= _items.length;

  /// Mobi's one reaction on the end.
  String get endAct => RunMath.endAct(tally);

  bool _coachWanted(String name) {
    // Only what is on screen is wanted: a line is kept as seen the moment it shows, never while the run is still starting.
    if (status != RunStatus.ready || run == null) return false;
    final firstCard = _items.indexWhere((x) => x is LearnCardItem && !x.look);
    final firstQuestion = _items.indexWhere((x) => x is LearnQuestionItem);
    final it = item;
    final onFirstCard = phase == RunPhase.play && !isRecap && offset == 0 && at == firstCard && it is LearnCardItem;
    return switch (name) {
      'front' => onFirstCard && !isTurned(it),
      'rate' => onFirstCard && isTurned(it),
      'pick' => phase == RunPhase.play && offset == 0 && at == firstQuestion && it is LearnQuestionItem && !isAnswered(it),
      'recap' => phase == RunPhase.play && isRecap,
      _ => false,
    };
  }

  bool _coachShow(String name) => _coachWanted(name) && !_coachSeen.contains(name);

  /// The one status line (A4 3.3.5): an error, a note, the stamp, a first-run coach line, Free's look line; else none.
  RunStatusLine? get statusLine {
    final it = item;
    if (error != null) return RunStatusLine(error!, bad: true);
    if (note != null) return RunStatusLine(note!);
    final s = stamp;
    if (s != null) return RunStatusLine(s.text, stamp: true, n: s.n);
    if (it is LearnCardItem && !isTurned(it) && _coachShow('front')) return const RunStatusLine(RunCopy.coachFront);
    if (it is LearnCardItem && isTurned(it) && !isLook(it) && _coachShow('rate')) return const RunStatusLine(RunCopy.coachRate);
    if (it is LearnQuestionItem && !isAnswered(it) && _coachShow('pick')) return const RunStatusLine(RunCopy.coachPick);
    if (_coachShow('recap')) return const RunStatusLine(RunCopy.coachRecap);
    if (it is LearnCardItem && isLook(it) && isTurned(it) && lookLine != null && it.look) return RunStatusLine(lookLine!);
    return null;
  }

  /// What the pager says when an item comes up (the web's live region).
  String announceOf(LearnItem it) => RunView.positionWords(it, position, total);

  // ---------------------------------------------------------------- start, resume, end

  /// Starts the run once: the end only when the link asks for it, else a start or a pick-up.
  Future<void> start() async {
    if (_started) return;
    _started = true;
    await begin();
  }

  Future<void> _loadCoach() async {
    final p = prefs;
    if (p == null) return;
    for (final id in _coachIds) {
      try {
        if (await p.coachSeen(id)) _coachSeen.add(id);
      } on Object {
        _coachSeen.add(id);
      }
    }
  }

  void _reset() {
    run = null;
    free = null;
    _items = const [];
    _states = const {};
    _graded.clear();
    _saves = const {};
    _sent.clear();
    at = 0;
    offset = 0;
    pile = 0;
    pop = 0;
    busy = null;
    leaving = false;
    _flying = false;
    stamp = null;
    note = null;
    error = null;
    lookLine = null;
    lookSaid = false;
    tally = const RunTally();
    round = 0;
    phase = RunPhase.play;
    endStatus = RunEndStatus.idle;
    endData = null;
    stoppedAt = null;
    _stampTimer?.cancel();
    _noteTimer?.cancel();
    _landTimer?.cancel();
    _endGen += 1;
  }

  /// Starts (or with a run id, picks up) the run again from the start of the launch.
  Future<void> begin() async {
    final gen = ++_gen;
    _reset();
    status = RunStatus.loading;
    _notify();
    final p = launch;
    final id = p.runId;
    if (p.end && id != null) {
      _openOnEnd(id);
      return;
    }
    final coach = _loadCoach();
    try {
      final r = id != null
          ? await api.getRun(id)
          : await api.startRun(
              RunStart(
                kind: p.kind,
                chapterKey: p.chapterKey,
                cardIds: p.cardIds,
                minutes: p.minutes,
                leaveOut: p.leaveOut,
                fresh: p.fresh,
                addNext: p.addNext,
              ),
            );
      await coach;
      if (gen != _gen || _disposed) return;
      _adopt(r);
      // A resumed run with nothing left is already done: its end.
      if (r.items.isEmpty && r.resumed != null && r.id.isNotEmpty) unawaited(loadEnd(r.id));
    } on Object catch (e) {
      if (gen != _gen || _disposed) return;
      if (id != null && (isRunClosed(e) || (e is LearnError && e.status == 404 && !isChapterMissing(e)))) {
        _openOnEnd(id);
        return;
      }
      if (isSessionUsed(e)) {
        free = (e as LearnError).sessionUsed;
        status = RunStatus.free;
      } else if (isChapterMissing(e)) {
        status = RunStatus.notFound;
      } else {
        status = RunStatus.error;
      }
      _notify();
    }
  }

  /// A run that is only an end: its id and the link's kind and chapter.
  void _openOnEnd(String runId) {
    run = LearnRun(
      id: runId,
      kind: launch.kind,
      chapter: LearnRunChapter(key: launch.chapterKey ?? '', title: launch.chapterKey ?? ''),
    );
    status = RunStatus.ready;
    _notify();
    unawaited(loadEnd(runId));
  }

  /// Takes a run from the server as the player's items: the picked-up place, the pile, Free's look line.
  void _adopt(LearnRun r) {
    run = r;
    _items = List.unmodifiable(r.items);
    offset = r.resumed?.done ?? 0;
    pile = r.revisePile;
    final looks = r.looks?.text;
    if (looks != null && looks.isNotEmpty) lookLine = looks;
    at = 0;
    phase = RunPhase.play;
    status = _items.isEmpty && r.resumed == null ? RunStatus.empty : RunStatus.ready;
    _notify();
    final first = item;
    if (first != null) _say(announceOf(first));
  }

  /// The end (`GET /end`): the skeleton while it comes, an error with Try again when it fails.
  Future<void> loadEnd(String runId) async {
    final gen = ++_endGen;
    phase = RunPhase.end;
    endStatus = RunEndStatus.loading;
    endData = null;
    _notify();
    try {
      final data = await api.end(runId);
      if (_disposed || gen != _endGen) return;
      endData = data;
      endStatus = RunEndStatus.ready;
    } on Object {
      if (_disposed || gen != _endGen) return;
      endStatus = RunEndStatus.error;
    }
    _notify();
  }

  /// The end's Try again.
  void retryEnd() {
    final r = run;
    if (r != null && r.id.isNotEmpty) unawaited(loadEnd(r.id));
  }

  /// Ends the run here: a recap goes to its own end; any other run reads the server's end. [stopAt] is how far the student
  /// got ("You stopped at 8 of 21.").
  void finish([int? stopAt]) {
    if (isRecap) {
      phase = RunPhase.recapEnd;
      _notify();
      return;
    }
    stoppedAt = stopAt;
    final r = run;
    if (r != null && r.id.isNotEmpty) unawaited(loadEnd(r.id));
  }

  /// A new set of cards in this player (the recap's "Study these 12"): the run starts again from [next].
  Future<void> restart(RunLaunch next) {
    launch = next;
    return begin();
  }

  /// The recap's own end: "Study these N" reads the distinct cards the recap showed.
  RunLaunch? studyThese() {
    final ids = [
      ...{
        for (final i in _items)
          if (i is LearnCardItem) i.card.id,
      },
    ];
    if (ids.isEmpty) return null;
    return RunLaunch(chapterKey: chapterKey, cardIds: ids, minutes: math.max(5, (ids.length * 15 * 1.1 / 60).ceil()), kind: LearnKinds.cards);
  }

  /// The recap again from its first card.
  void recapAgain() {
    at = 0;
    phase = RunPhase.play;
    _notify();
  }

  // ---------------------------------------------------------------- a card

  /// Turns a card over (or back; a recap shows its back to begin with). A look's line comes with its first turn.
  void turn(LearnCardItem it) {
    if (_flying || leaving) return;
    final now = isTurned(it);
    _patch(it.id, (s) => s.copyWith(turned: !now));
    if (!now && it.look && lookLine != null) lookSaid = true;
    _notify();
  }

  /// Rates the card on screen: Missed 1, Got it 3, Easy 4. The card leaves only after the server took the rating.
  Future<void> rate(int rating) async {
    final it = item;
    final r = run;
    if (it is! LearnCardItem || r == null || busy != null || _flying || leaving) return;
    busy = rating;
    error = null;
    _notify();
    final LearnRateResult res;
    try {
      res = await api.rate(r.id, it.id, rating);
      if (_disposed || run?.id != r.id) return;
      if (!res.ok) throw StateError('unconfirmed');
    } on Object catch (e) {
      if (_disposed || run?.id != r.id) return;
      busy = null;
      if (isRunClosed(e)) {
        finish();
        return;
      }
      if (e is LearnError && e.status == 402) {
        lookLine = asString(asJson(e.data['limit'])['text']) ?? lookLine;
        lookSaid = true;
        _notify();
        return;
      }
      error = RunCopy.ratingNotSaved;
      _notify();
      return;
    }
    _flying = true;
    leaving = true;
    busy = null;
    changed = true;
    final kind = RunMath.flight[rating] ?? 'got';
    tally = tally.copyWith(
      missed: tally.missed + (kind == 'missed' ? 1 : 0),
      got: tally.got + (kind == 'got' ? 1 : 0),
      easy: tally.easy + (kind == 'easy' ? 1 : 0),
    );
    final limit = res.limit?.text;
    if (limit != null && limit.isNotEmpty) lookLine = limit;
    if (res.look) lookSaid = true;
    _reinsert(res.reinsert);
    _showStamp(res.stamp);
    final flightKind = res.look ? 'missed' : kind;
    final fly = flightKind != 'missed';
    final pileNow = res.raw['revisePile'] is Map ? asInt(asJson(res.raw['revisePile'])['count']) : null;
    final land = reduced ? reducedFade : (fly ? (flightKind == 'easy' ? landEasy : landGot) : landDrop);
    _landTimer?.cancel();
    _landTimer = Timer(land, () {
      if (_disposed || pileNow == null || pileNow == pile) return;
      pile = pileNow;
      if (!reduced) pop += 1;
      _notify();
    });
    _notify();
    onRated?.call(RunRated(itemId: it.id, kind: flightKind, look: res.look, stamp: res.stamp, viaRating: true));
    await Future<void>.delayed(reduced ? reducedFade : (fly ? handoffFly : handoffDrop));
    if (_disposed || run?.id != r.id) return;
    _flying = false;
    leaving = false;
    advance();
  }

  /// A look (a recap card, a card past Free's ratings, a lesson read or skipped) is logged with rating 3; the run does not
  /// wait for it.
  void _logLook(LearnItem it) {
    final r = run;
    if (r == null || it.id.isEmpty) return;
    unawaited(api.rate(r.id, it.id, 3).then<void>((_) {}, onError: (Object _) {}));
  }

  /// The Next of a look: logged, the card drops away, and the next item comes.
  Future<void> lookNext() async {
    final it = item;
    final r = run;
    if (it is! LearnCardItem || r == null || _flying || leaving) return;
    _logLook(it);
    _flying = true;
    leaving = true;
    _notify();
    onRated?.call(RunRated(itemId: it.id, kind: 'missed', look: true));
    await Future<void>.delayed(reduced ? reducedFade : handoffDrop);
    if (_disposed || run?.id != r.id) return;
    _flying = false;
    leaving = false;
    advance();
  }

  // ---------------------------------------------------------------- a question

  /// Answers the question on screen once; the server grades it (no key on the phone before).
  Future<void> pick(String choice) async {
    final it = item;
    final r = run;
    if (it is! LearnQuestionItem || r == null) return;
    final st = stateOf(it.id);
    if (_sent.contains(it.id) || st.answer != null || st.skipped != null || st.byStudent) return;
    _sent.add(it.id);
    _patch(it.id, (s) => s.copyWith(answer: RunAnswer.pending(choice), error: null));
    _notify();
    try {
      final res = await api.answer(r.id, it.id, choice);
      if (_disposed || run?.id != r.id) return;
      _patch(it.id, (s) => s.copyWith(answer: RunAnswer.graded(res.choice ?? choice, res)));
      _graded[it.id] = res.correct;
      tally = tally.copyWith(right: tally.right + (res.correct ? 1 : 0), wrong: tally.wrong + (res.correct ? 0 : 1));
      changed = true;
      _reinsert(res.reinsert);
      final key = res.key ?? '';
      if (res.correct) {
        _say(res.fixedText ?? 'Right.');
      } else {
        final card = res.line;
        _say('Not quite. The answer is $key.${card != null && !card.locked && card.card != null ? RunCopy.lineYouNeeded : ''}');
      }
    } on Object catch (e) {
      _sent.remove(it.id);
      if (_disposed || run?.id != r.id) return;
      if (isQuestionSkipped(e)) {
        final line = (e as LearnError).kind == LearnErrorKind.questionHeld ? RunCopy.questionHeld : RunCopy.questionChanged;
        _patch(it.id, (s) => s.copyWith(answer: null, skipped: line));
        _showNote(line);
      } else if (isRunClosed(e)) {
        _patch(it.id, (s) => s.copyWith(answer: null));
        finish();
        return;
      } else if (isSessionUsed(e)) {
        // Free, a second tab: the day's session belongs to another run. This one ends calmly with the line.
        _patch(it.id, (s) => s.copyWith(answer: null));
        finish(doneCount);
        return;
      } else {
        _patch(it.id, (s) => s.copyWith(answer: null, error: RunCopy.answerNotSaved));
      }
    }
    _notify();
  }

  /// A quiet Skip on a question not answered yet: it moves on and is never a mistake. Nothing is written; the item stays not
  /// done (a picked-up run offers it again).
  void skip() {
    final it = item;
    if (it is! LearnQuestionItem) return;
    final st = stateOf(it.id);
    if (_sent.contains(it.id) || st.answer != null) return;
    _patch(it.id, (s) => s.copyWith(byStudent: true));
    advance();
  }

  /// Saves the question on screen (`POST /api/bookmarks`). Free's limit turns the key into Pro, which opens the Pro sheet.
  Future<void> save(LearnQuestionItem it) async {
    final now = _saves[it.question.id];
    if (now == RunSave.saved || now == RunSave.busy) return;
    if (now == RunSave.pro) {
      onSeePro?.call('saved');
      return;
    }
    _setSave(it.question.id, RunSave.busy);
    try {
      await api.saveQuestion(it.question.id);
      if (_disposed) return;
      _setSave(it.question.id, RunSave.saved);
      onSaved?.call();
    } on Object catch (e) {
      if (_disposed) return;
      final pro = e is LearnError && e.status == 402;
      _setSave(it.question.id, pro ? RunSave.pro : null);
      if (!pro) _showNote(RunCopy.questionNotSaved);
    }
  }

  void _setSave(String id, RunSave? s) {
    final next = {..._saves};
    if (s == null) {
      next.remove(id);
    } else {
      next[id] = s;
    }
    _saves = next;
    _notify();
  }

  // ---------------------------------------------------------------- a lesson

  /// The lesson opens on its own page; it counts as read when the student comes back, and the run goes on.
  Future<void> readLesson() async {
    final it = item;
    if (it is! LearnLessonItem || _lessonOpen) return;
    _lessonOpen = true;
    try {
      final open = openLesson;
      if (open != null) await open(it.lesson.id);
    } finally {
      _lessonOpen = false;
    }
    if (_disposed || item?.id != it.id) return;
    _logLook(it);
    advance();
  }

  /// "Skip it": logged as a look, and on.
  void skipLesson() {
    final it = item;
    if (it is! LearnLessonItem) return;
    _logLook(it);
    advance();
  }

  // ---------------------------------------------------------------- moving

  /// To the next item, the cards run's pause, or the end.
  void advance() {
    busy = null;
    error = null;
    final next = at + 1;
    if (next >= _items.length) {
      finish();
      return;
    }
    if (run?.kind == LearnKinds.cards && _items[at] is LearnCardItem) {
      final rated = _items.take(next).whereType<LearnCardItem>().length;
      if (rated % roundEvery == 0 && _items.skip(next).any((x) => x is LearnCardItem)) {
        round = rated ~/ roundEvery;
        at = next;
        phase = RunPhase.round;
        _notify();
        return;
      }
    }
    at = next;
    _notify();
    final shown = item;
    if (shown != null) _say(announceOf(shown));
  }

  /// A recap moves with Previous and Next (and a swipe); a card passed is logged as a look.
  void goRecap(int step) {
    if (phase != RunPhase.play) return;
    if (step > 0) {
      final it = item;
      if (it != null) _logLook(it);
      if (at + 1 >= _items.length) {
        phase = RunPhase.recapEnd;
      } else {
        at += 1;
      }
    } else if (at > 0) {
      at -= 1;
    } else {
      return;
    }
    _notify();
    final shown = item;
    if (shown != null) _say(announceOf(shown));
  }

  /// The cards run's pause: Next round.
  void nextRound() {
    phase = RunPhase.play;
    _notify();
    final shown = item;
    if (shown != null) _say(announceOf(shown));
  }

  /// The cards run's pause: Finish here.
  void finishRound() => finish(offset + at);

  // ---------------------------------------------------------------- plumbing

  /// Puts an item back in after a wrong answer or a Missed: three on (the server's place), a card already ahead moves
  /// closer (never a copy).
  void _reinsert(LearnReinsert? r) {
    if (r == null || r.itemId.isEmpty) return;
    final back = r.item == null ? null : RunView.again(r.item!);
    final next = RunView.placeReinsert(_items, itemId: r.itemId, at: r.raw['at'] is num ? r.at : null, item: back, moved: r.moved, current: at, offset: offset);
    if (!identical(next, _items)) _items = List.unmodifiable(next);
  }

  void _showStamp(String? text) {
    if (text == null || text.isEmpty) return;
    _stampTimer?.cancel();
    stamp = RunStamp(text, ++_stamps);
    _stampTimer = Timer(reduced ? stampForReduced : stampFor, () {
      stamp = null;
      _notify();
    });
  }

  void _showNote(String text) {
    _noteTimer?.cancel();
    note = text;
    _noteTimer = Timer(noteFor, () {
      note = null;
      _notify();
    });
    _say(text);
    _notify();
  }

  void _patch(String id, RunItemState Function(RunItemState s) f) {
    _states = {..._states, id: f(stateOf(id))};
  }

  void _say(String text) {
    if (text.isEmpty || _disposed) return;
    onSay?.call(text);
  }

  Future<void> _coachWrites = Future<void>.value();

  /// A coach line is kept as seen the first time it shows (it stays for as long as it is wanted in this run). The writes
  /// queue, so two lines shown close together both reach the phone.
  void _markCoach() {
    final p = prefs;
    if (p == null) return;
    for (final id in _coachIds) {
      if (_coachShow(id) && _coachMarked.add(id)) _coachWrites = _coachWrites.then((_) => p.markCoachSeen(id));
    }
  }

  void _notify() {
    if (_disposed) return;
    _markCoach();
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _gen += 1;
    _endGen += 1;
    _stampTimer?.cancel();
    _noteTimer?.cancel();
    _landTimer?.cancel();
    super.dispose();
  }
}
