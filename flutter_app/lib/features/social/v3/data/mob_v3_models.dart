// Mob v3 data, parsed exactly per MOB-BUILD-SPEC-V3 section 3 (the canonical contract). Lenient like
// every reader in the app: an unknown field is ignored, a missing one takes a safe default, and no
// number is ever derived here. The server computes every figure on screen (spec 2.0); the only figure
// the app computes is the ghost pace chip (logic/ghost_pace.dart).
//
// Privacy, held by the shapes themselves: no member carries a played or not-played state (F2), runs
// are finished runs only, the game view never holds another member's pick, and a question never
// carries its correct index before the game closes (F1).

import '../../../../core/models/json_helpers.dart';

// ---------------------------------------------------------------------------------------------------
// Folds
// ---------------------------------------------------------------------------------------------------

/// The 12 Folds (spec 0.4). Mobi is never collected and is not one of them.
enum FoldKey {
  dart,
  dogear,
  hexa,
  kandil,
  hop,
  crane,
  stamp,
  naav,
  tally,
  patang,
  sticky,
  cutting;

  static FoldKey? parse(Object? v) {
    final s = asString(v);
    for (final k in FoldKey.values) {
      if (k.name == s) return k;
    }
    return null;
  }

  static const List<FoldKey> starters = [dart, dogear, hexa, kandil];
  bool get starter => starters.contains(this);
}

/// The five shipped poses (spec 5.2). `shrug` is the calm "not this one", never sad.
enum FoldPose { idle, cheer, think, shrug, wave }

enum FoldFinish {
  plain,
  foil;

  static FoldFinish parse(Object? v) => asString(v) == 'foil' ? foil : plain;
}

// ---------------------------------------------------------------------------------------------------
// The den (`GET /api/mob` -> v3)
// ---------------------------------------------------------------------------------------------------

class MobV3Name {
  const MobV3Name({this.key, required this.text});

  factory MobV3Name.fromJson(Json j) => MobV3Name(key: asInt(j['key']), text: asStringOr(j['text'], '').trim());

  /// Null: the Mob has no name from the list yet, and [text] is its subject.
  final int? key;
  final String text;
}

class MobV3Member {
  const MobV3Member({required this.memberId, required this.name, this.colour = 0, this.fold, this.finish = FoldFinish.plain, this.you = false, this.owner = false});

  factory MobV3Member.fromJson(Json j) => MobV3Member(
        memberId: asStringOr(j['memberId'], ''),
        name: asStringOr(j['name'], '').trim(),
        colour: (asInt(j['colour']) ?? 0).clamp(0, 7),
        fold: FoldKey.parse(j['fold']),
        finish: FoldFinish.parse(j['finish']),
        you: asBool(j['you']) ?? false,
        owner: asBool(j['owner']) ?? false,
      );

  final String memberId;
  final String name;
  final int colour;

  /// Null when the member has not picked one (an old account): the den draws their initial disc.
  final FoldKey? fold;
  final FoldFinish finish;
  final bool you;
  final bool owner;

  String get initial {
    final t = name.trim();
    if (t.isEmpty) return '?';
    return String.fromCharCode(t.runes.first).toUpperCase();
  }
}

class MobV3Person {
  const MobV3Person({required this.memberId, required this.name, this.you = false});

  factory MobV3Person.fromJson(Json j) => MobV3Person(memberId: asStringOr(j['memberId'], ''), name: asStringOr(j['name'], '').trim(), you: asBool(j['you']) ?? false);

  final String memberId;
  final String name;
  final bool you;
}

enum GameFormat {
  sprint,
  round,
  rematch;

  static GameFormat parse(Object? v) => switch (asString(v)) { 'round' => round, 'rematch' => rematch, _ => sprint };
}

enum GameMode {
  live,
  async;

  static GameMode parse(Object? v) => asString(v) == 'live' ? live : async;
}

enum RoomState {
  lobby,
  running,
  done,
  cancelled;

  static RoomState? parse(Object? v) => switch (asString(v)) { 'lobby' => lobby, 'running' => running, 'done' => done, 'cancelled' => cancelled, _ => null };
}

class GameRoom {
  const GameRoom({required this.state, this.startsAt, this.endsAt, this.hostMemberId});

  static GameRoom? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final s = RoomState.parse(j['state']);
    if (s == null) return null;
    return GameRoom(state: s, startsAt: asDate(j['startsAt']), endsAt: asDate(j['endsAt']), hostMemberId: asString(j['hostMemberId']));
  }

  final RoomState state;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String? hostMemberId;
}

/// One finished run, for the den's "Runs so far" row (F2: finished runs only, in time order).
class FinishedRun {
  const FinishedRun({required this.memberId, required this.name, this.at});

  factory FinishedRun.fromJson(Json j) => FinishedRun(memberId: asStringOr(j['memberId'], ''), name: asStringOr(j['name'], '').trim(), at: asDate(j['at']));

  final String memberId;
  final String name;
  final DateTime? at;
}

enum YourRun {
  none,
  playing,
  finished;

  static YourRun parse(Object? v) => switch (asString(v)) { 'playing' => playing, 'finished' => finished, _ => none };
}

/// A game as the den lists it (spec 3.1 `v3.games[]`).
class MobGameSummary {
  const MobGameSummary({
    required this.id,
    this.format = GameFormat.sprint,
    this.mode = GameMode.async,
    this.count = 5,
    this.chapter,
    this.subjectName = '',
    this.host,
    this.openedAt,
    this.closesAt,
    this.closed = false,
    this.room,
    this.runs = const [],
    this.yourRun = YourRun.none,
    this.podiumReady = false,
    this.title,
  });

  factory MobGameSummary.fromJson(Json j) => MobGameSummary(
        id: asStringOr(j['id'], ''),
        format: GameFormat.parse(j['format']),
        mode: GameMode.parse(j['mode']),
        count: asInt(j['count']) ?? 5,
        chapter: asString(j['chapter']),
        subjectName: asStringOr(j['subjectName'], ''),
        host: j['host'] is Map ? MobV3Person.fromJson(asJson(j['host'])) : null,
        openedAt: asDate(j['openedAt']),
        closesAt: asDate(j['closesAt']),
        closed: asBool(j['closed']) ?? false,
        room: GameRoom.fromJson(j['room']),
        runs: [for (final r in asJsonList(j['runs'])) FinishedRun.fromJson(r)],
        yourRun: YourRun.parse(j['yourRun']),
        podiumReady: asBool(j['podiumReady']) ?? false,
        title: asString(j['title']),
      );

  /// "Riya's sprint", when the server sends it.
  final String? title;

  final String id;
  final GameFormat format;
  final GameMode mode;
  final int count;
  final String? chapter;
  final String subjectName;
  final MobV3Person? host;
  final DateTime? openedAt;
  final DateTime? closesAt;
  final bool closed;
  final GameRoom? room;
  final List<FinishedRun> runs;
  final YourRun yourRun;
  final bool podiumReady;

  bool get live => mode == GameMode.live && room != null;
}

enum ParcelKind {
  fold,
  item,
  stitch;

  static ParcelKind parse(Object? v) => switch (asString(v)) { 'fold' => fold, 'item' => item, _ => stitch };
}

class QuestParcel {
  const QuestParcel({this.kind = ParcelKind.stitch, this.fold, this.item});

  factory QuestParcel.fromJson(Json j) => QuestParcel(kind: ParcelKind.parse(j['kind']), fold: FoldKey.parse(j['fold']), item: asString(j['item']));

  final ParcelKind kind;
  final FoldKey? fold;
  final String? item;
}

class QuestSource {
  const QuestSource({required this.label, required this.answered});

  factory QuestSource.fromJson(Json j) => QuestSource(label: asStringOr(j['label'], '').trim(), answered: asInt(j['answered']) ?? 0);

  /// "Monday's Mob paper", "Riya's sprint": by game, never by person.
  final String label;
  final int answered;
}

class Quest {
  const Quest({this.week, this.target = 15, this.answered = 0, this.done = false, this.doneAt, this.sizedFor = 1, this.youSteppedOut = false, this.bySource = const [], this.parcel = const QuestParcel(), this.endsAt});

  factory Quest.fromJson(Json j) => Quest(
        week: asString(j['week']),
        target: asInt(j['target']) ?? 15,
        answered: asInt(j['answered']) ?? 0,
        done: asBool(j['done']) ?? false,
        doneAt: asDate(j['doneAt']),
        sizedFor: asInt(j['sizedFor']) ?? 1,
        youSteppedOut: asBool(j['youSteppedOut']) ?? false,
        bySource: [for (final s in asJsonList(j['bySource'])) QuestSource.fromJson(s)],
        parcel: QuestParcel.fromJson(asJson(j['parcel'])),
        endsAt: asDate(j['endsAt']),
      );

  final String? week;
  final int target;

  /// The true total, also past the target (F8: "70 answered. The quest needed 60.").
  final int answered;
  final bool done;
  final DateTime? doneAt;
  final int sizedFor;
  final bool youSteppedOut;
  final List<QuestSource> bySource;
  final QuestParcel parcel;
  final DateTime? endsAt;

  bool get past => answered > target;
}

class MilestoneRef {
  const MilestoneRef({required this.at, required this.item});

  static MilestoneRef? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final at = asInt(j['at']);
    if (at == null) return null;
    return MilestoneRef(at: at, item: asStringOr(j['item'], ''));
  }

  final int at;
  final String item;
}

class MobChainSummary {
  const MobChainSummary({this.weeks = 0, this.best = 0, this.passes = 0, this.stitchedThisWeek = false, this.next, this.restarted = false});

  factory MobChainSummary.fromJson(Json j) => MobChainSummary(
        weeks: asInt(j['weeks']) ?? 0,
        best: asInt(j['best']) ?? 0,
        passes: asInt(j['passes']) ?? 0,
        stitchedThisWeek: asBool(j['stitchedThisWeek']) ?? false,
        next: MilestoneRef.fromJson(j['next']),
        restarted: asBool(j['restarted']) ?? false,
      );

  /// A week was missed with no pass: "A new chain starts this week."
  final bool restarted;
  final int weeks;
  final int best;
  final int passes;
  final bool stitchedThisWeek;
  final MilestoneRef? next;
}

class DenShelf {
  const DenShelf({this.items = const [], this.nextItem});

  factory DenShelf.fromJson(Json j) => DenShelf(items: asStringList(j['items']), nextItem: MilestoneRef.fromJson(j['nextItem']));

  /// Den objects earned: den_stamp, desk_bell, brass_lamp, foil_seal, den_stamp_row.
  final List<String> items;
  final MilestoneRef? nextItem;
}

enum StartVia {
  open,
  pro,
  freeWeekly,
  mic,
  none;

  static StartVia parse(Object? v) => switch (asString(v)) { 'open' => open, 'pro' => pro, 'free_weekly' => freeWeekly, 'mic' => mic, _ => none };
}

/// Who may start a game here, as the server decided (spec 3.3). The app only draws it.
class StartRight {
  const StartRight({
    this.billingOn = false,
    this.can = true,
    this.via = StartVia.open,
    this.modes = const [GameMode.async],
    this.formats = const [GameFormat.sprint, GameFormat.round],
    this.freeLeft,
    this.mics = 0,
    this.micsToGive,
    this.reason,
    this.micFrom,
  });

  factory StartRight.fromJson(Json j) => StartRight(
        billingOn: asBool(j['billingOn']) ?? false,
        can: asBool(j['can']) ?? false,
        via: StartVia.parse(j['via']),
        modes: j.containsKey('modes') ? [for (final m in asStringList(j['modes'])) GameMode.parse(m)] : const [GameMode.async],
        formats: j.containsKey('formats') ? [for (final f in asStringList(j['formats'])) GameFormat.parse(f)] : const [GameFormat.sprint, GameFormat.round],
        freeLeft: asInt(j['freeLeft']),
        mics: asInt(j['mics']) ?? 0,
        micsToGive: asInt(j['micsToGive']),
        reason: asString(j['reason']),
        micFrom: j['micFrom'] is Map ? asString(asJson(j['micFrom'])['name']) : asString(j['micFrom']),
      );

  final bool billingOn;
  final bool can;
  final StartVia via;
  final List<GameMode> modes;
  final List<GameFormat> formats;
  final int? freeLeft;
  final int mics;

  /// Only for Pro, only you see it.
  final int? micsToGive;

  /// `used` when Free's weekly start is spent.
  final String? reason;

  /// The first name of the member who passed you the mic, when the server names one.
  final String? micFrom;

  bool get liveAllowed => modes.contains(GameMode.live);
}

class ChainChip {
  const ChainChip({this.hidden = false, this.days = 0, this.todayDone = false});

  factory ChainChip.fromJson(Json j) => ChainChip(hidden: asBool(j['hidden']) ?? false, days: asInt(j['days']) ?? 0, todayDone: asBool(j['todayDone']) ?? false);

  final bool hidden;
  final int days;
  final bool todayDone;
}

/// The eight preset stickers (spec 2.1). No free text: an enum, drawn locally.
enum StickerKind {
  niceOne('nice_one'),
  soClose('so_close'),
  teachMe('teach_me'),
  again('again'),
  goodLuck('good_luck'),
  letsGo('lets_go'),
  oneSec('one_sec'),
  ready('ready');

  const StickerKind(this.wire);
  final String wire;

  static StickerKind? parse(Object? v) {
    final s = asString(v);
    for (final k in StickerKind.values) {
      if (k.wire == s) return k;
    }
    return null;
  }

  static const List<StickerKind> results = [niceOne, soClose, teachMe, again];
  static const List<StickerKind> lobby = [goodLuck, letsGo, oneSec, ready];
}

class Reaction {
  const Reaction({required this.memberId, required this.kind, this.at, this.game});

  static Reaction? fromJson(Json j) {
    final k = StickerKind.parse(j['kind']);
    if (k == null) return null;
    return Reaction(memberId: asStringOr(j['memberId'], ''), kind: k, at: asDate(j['at']), game: asString(j['game']));
  }

  final String memberId;
  final StickerKind kind;
  final DateTime? at;
  final String? game;
}

class LiveSwitch {
  const LiveSwitch({this.enabled = false, this.hoursOk = false});

  factory LiveSwitch.fromJson(Json j) => LiveSwitch(enabled: asBool(j['enabled']) ?? false, hoursOk: asBool(j['hoursOk']) ?? false);

  final bool enabled;
  final bool hoursOk;
}

/// The whole `v3` object of `GET /api/mob` (spec 3.1).
class MobV3 {
  const MobV3({
    required this.name,
    this.showPodium = true,
    this.youOwn = false,
    this.members = const [],
    this.games = const [],
    this.quest = const Quest(),
    this.mobChain = const MobChainSummary(),
    this.shelf = const DenShelf(),
    this.starts = const StartRight(),
    this.chainChip = const ChainChip(),
    this.reactions = const [],
    this.moments = const [],
    this.live = const LiveSwitch(),
    this.seat,
    this.lastTrapChapter,
    this.paperSatAt,
  });

  /// Null when the read has no v3 object (the server's MOB_V3_ENABLED is off): today's Mob shows.
  static MobV3? fromJsonOrNull(Object? raw) => raw is Map ? MobV3.fromJson(asJson(raw)) : null;

  factory MobV3.fromJson(Json j) => MobV3(
        name: MobV3Name.fromJson(asJson(j['name'])),
        showPodium: asBool(j['showPodium']) ?? true,
        youOwn: asBool(j['youOwn']) ?? false,
        members: [for (final m in asJsonList(j['members'])) MobV3Member.fromJson(m)],
        games: [for (final g in asJsonList(j['games'])) MobGameSummary.fromJson(g)],
        quest: Quest.fromJson(asJson(j['quest'])),
        mobChain: MobChainSummary.fromJson(asJson(j['mobChain'])),
        shelf: DenShelf.fromJson(asJson(j['shelf'])),
        starts: StartRight.fromJson(asJson(j['starts'])),
        chainChip: ChainChip.fromJson(asJson(j['chainChip'])),
        reactions: [for (final r in asJsonList(j['reactions'])) ?Reaction.fromJson(r)],
        moments: asStringList(j['moments']),
        live: LiveSwitch.fromJson(asJson(j['live'])),
        seat: FoldKey.parse(j['seat']),
        lastTrapChapter: asString(j['lastTrapChapter']),
        paperSatAt: asDate(j['paperSatAt']),
      );

  final MobV3Name name;
  final bool showPodium;
  final bool youOwn;
  final List<MobV3Member> members;
  final List<MobGameSummary> games;
  final Quest quest;
  final MobChainSummary mobChain;
  final DenShelf shelf;
  final StartRight starts;
  final ChainChip chainChip;
  final List<Reaction> reactions;

  /// One-time moments due for you, in play order: `quest_done:<week>`, `stitch:<week>`,
  /// `reveal:<fold>`, `chain:<n>`, `rest:<day>`.
  final List<String> moments;
  final LiveSwitch live;

  /// The student's seat Fold, when the server sends it beside the members (fresh account, no Mob).
  final FoldKey? seat;

  /// Additive (SHEETS, 19 Oct): the chapter of the Mob's latest trap, the default of P2's "What it covers".
  /// Null (a server that does not send it) means the whole subject.
  final String? lastTrapChapter;

  /// Additive (SHEETS, 19 Oct): when this student sat this week's Mob paper ("You sat it on Monday.").
  /// Null says "You sat it this week." instead.
  final DateTime? paperSatAt;

  MobV3Member? get you {
    for (final m in members) {
      if (m.you) return m;
    }
    return null;
  }

  MobV3Member? member(String memberId) {
    for (final m in members) {
      if (m.memberId == memberId) return m;
    }
    return null;
  }

  /// Open games, the one closing soonest first.
  List<MobGameSummary> get openGames {
    final open = [for (final g in games) if (!g.closed) g];
    open.sort((a, b) => (a.closesAt ?? DateTime(9999)).compareTo(b.closesAt ?? DateTime(9999)));
    return open;
  }

  List<MobGameSummary> get closedGames => [for (final g in games) if (g.closed) g];
}

// ---------------------------------------------------------------------------------------------------
// A game (`GET /api/mob/game/[id]`, spec 3.4)
// ---------------------------------------------------------------------------------------------------

class GameRunRow {
  const GameRunRow({required this.memberId, required this.name, this.colour = 0, this.fold, this.at, this.finished = true, this.answered});

  factory GameRunRow.fromJson(Json j) => GameRunRow(
        memberId: asStringOr(j['memberId'], ''),
        name: asStringOr(j['name'], '').trim(),
        colour: (asInt(j['colour']) ?? 0).clamp(0, 7),
        fold: FoldKey.parse(j['fold']),
        at: asDate(j['at']),
        finished: asBool(j['finished']) ?? true,
        answered: asInt(j['answered']),
      );

  final String memberId;
  final String name;
  final int colour;
  final FoldKey? fold;
  final DateTime? at;
  final bool finished;

  /// Live rooms only, for members in the room; never marks.
  final int? answered;
}

class GameYou {
  const GameYou({this.run = YourRun.none, this.marks, this.answered = 0});

  factory GameYou.fromJson(Json j) => GameYou(run: YourRun.parse(j['run']), marks: asInt(j['marks']), answered: asInt(j['answered']) ?? 0);

  final YourRun run;
  final int? marks;
  final int answered;
}

/// A finished run of another member, raced as a ghost: arrival times only, no picks, no correctness.
class Ghost {
  const Ghost({required this.memberId, required this.name, this.colour = 0, this.fold, this.playedAt, this.arrivalsMs = const [], this.finishedMs});

  factory Ghost.fromJson(Json j) => Ghost(
        memberId: asStringOr(j['memberId'], ''),
        name: asStringOr(j['name'], '').trim(),
        colour: (asInt(j['colour']) ?? 0).clamp(0, 7),
        fold: FoldKey.parse(j['fold']),
        playedAt: asDate(j['playedAt']),
        arrivalsMs: [for (final v in (j['arrivalsMs'] is List ? j['arrivalsMs'] as List : const [])) ?asInt(v)],
        finishedMs: asInt(j['finishedMs']),
      );

  final String memberId;
  final String name;
  final int colour;
  final FoldKey? fold;
  final DateTime? playedAt;

  /// `elapsed_ms` per answered question, in order.
  final List<int> arrivalsMs;
  final int? finishedMs;

  /// How many numbers this ghost has passed at [elapsedMs] of its own run.
  int reachedAt(int elapsedMs) {
    var n = 0;
    for (final a in arrivalsMs) {
      if (a <= elapsedMs) n++;
    }
    return n;
  }
}

class MobGame {
  const MobGame({
    required this.id,
    this.mobId = '',
    this.format = GameFormat.sprint,
    this.mode = GameMode.async,
    this.count = 5,
    this.secondsPerQuestion = 60,
    this.subjectName = '',
    this.chapter,
    this.title = '',
    this.host,
    this.openedAt,
    this.closesAt,
    this.closed = false,
    this.serverNow,
    this.room,
    this.runs = const [],
    this.you = const GameYou(),
    this.ghosts = const [],
    this.podiumReady = false,
  });

  factory MobGame.fromJson(Json j) => MobGame(
        id: asStringOr(j['id'], ''),
        mobId: asStringOr(j['mobId'], ''),
        format: GameFormat.parse(j['format']),
        mode: GameMode.parse(j['mode']),
        count: asInt(j['count']) ?? 5,
        secondsPerQuestion: asInt(j['secondsPerQuestion']) ?? 60,
        subjectName: asStringOr(j['subjectName'], ''),
        chapter: asString(j['chapter']),
        title: asStringOr(j['title'], '').trim(),
        host: j['host'] is Map ? MobV3Person.fromJson(asJson(j['host'])) : null,
        openedAt: asDate(j['openedAt']),
        closesAt: asDate(j['closesAt']),
        closed: asBool(j['closed']) ?? false,
        serverNow: asDate(j['serverNow']),
        room: GameRoom.fromJson(j['room']),
        runs: [for (final r in asJsonList(j['runs'])) GameRunRow.fromJson(r)],
        you: GameYou.fromJson(asJson(j['you'])),
        ghosts: [for (final g in asJsonList(j['ghosts'])) Ghost.fromJson(g)],
        podiumReady: asBool(j['podiumReady']) ?? false,
      );

  /// `{ game: {...} }` (POST /game, GET /game/[id]) or the bare object.
  factory MobGame.fromEnvelope(Json j) => MobGame.fromJson(j['game'] is Map ? asJson(j['game']) : j);

  final String id;
  final String mobId;
  final GameFormat format;
  final GameMode mode;
  final int count;
  final int secondsPerQuestion;
  final String subjectName;
  final String? chapter;
  final String title;
  final MobV3Person? host;
  final DateTime? openedAt;
  final DateTime? closesAt;
  final bool closed;
  final DateTime? serverNow;
  final GameRoom? room;
  final List<GameRunRow> runs;
  final GameYou you;
  final List<Ghost> ghosts;
  final bool podiumReady;
}

class RunAnswer {
  const RunAnswer({required this.q, required this.pick, this.correct, this.elapsedMs = 0});

  factory RunAnswer.fromJson(Json j) => RunAnswer(q: asInt(j['q']) ?? 0, pick: asInt(j['pick']) ?? -1, correct: asBool(j['correct']), elapsedMs: asInt(j['elapsedMs']) ?? 0);

  final int q;

  /// -1 is a skip.
  final int pick;

  /// Your own right or wrong; null for a skip.
  final bool? correct;
  final int elapsedMs;
}

/// A question as a game sends it: never the correct index, never the explanation (F1).
class GameQuestion {
  const GameQuestion({required this.q, required this.stem, required this.options, this.passage});

  factory GameQuestion.fromJson(Json j) => GameQuestion(q: asInt(j['q']) ?? 0, stem: asStringOr(j['stem'], ''), options: asStringList(j['options']), passage: asString(j['passage']));

  final int q;
  final String stem;
  final List<String> options;
  final String? passage;
}

class GameRun {
  const GameRun({this.startedAt, this.endsAt, this.serverNow, this.live = false, this.answers = const []});

  factory GameRun.fromJson(Json j) => GameRun(
        startedAt: asDate(j['startedAt']),
        endsAt: asDate(j['endsAt']),
        serverNow: asDate(j['serverNow']),
        live: asBool(j['live']) ?? false,
        answers: [for (final a in asJsonList(j['answers'])) RunAnswer.fromJson(a)],
      );

  final DateTime? startedAt;
  final DateTime? endsAt;
  final DateTime? serverNow;
  final bool live;
  final List<RunAnswer> answers;
}

/// `POST /api/mob/game/[id]/run`.
class RunStart {
  const RunStart({required this.run, this.questions = const [], this.ghosts = const []});

  factory RunStart.fromJson(Json j) => RunStart(
        run: GameRun.fromJson(asJson(j['run'])),
        questions: [for (final q in asJsonList(j['questions'])) GameQuestion.fromJson(q)],
        ghosts: [for (final g in asJsonList(j['ghosts'])) Ghost.fromJson(g)],
      );

  final GameRun run;
  final List<GameQuestion> questions;
  final List<Ghost> ghosts;
}

/// `POST /api/mob/game/[id]/answer`: your own right or wrong, your marks change. Never the correct option.
class AnswerResult {
  const AnswerResult({this.correct, this.delta = 0, this.marks = 0, this.elapsedMs = 0, this.answered = 0, this.count = 5, this.finished = false, this.serverNow});

  factory AnswerResult.fromJson(Json j) => AnswerResult(
        correct: asBool(j['correct']),
        delta: asInt(j['delta']) ?? 0,
        marks: asInt(j['marks']) ?? 0,
        elapsedMs: asInt(j['elapsedMs']) ?? 0,
        answered: asInt(j['answered']) ?? 0,
        count: asInt(j['count']) ?? 5,
        finished: asBool(j['finished']) ?? false,
        serverNow: asDate(j['serverNow']),
      );

  final bool? correct;
  final int delta;
  final int marks;
  final int elapsedMs;
  final int answered;
  final int count;
  final bool finished;
  final DateTime? serverNow;
}

// ---------------------------------------------------------------------------------------------------
// The podium (spec 3.6), the review (3.7) and Fix it together
// ---------------------------------------------------------------------------------------------------

class PodiumPlace {
  const PodiumPlace({required this.memberId, required this.name, this.fold, this.colour = 0, this.marks, this.place, this.you = false, this.floor = false, this.private = false});

  factory PodiumPlace.fromJson(Json j) => PodiumPlace(
        memberId: asStringOr(j['memberId'], ''),
        name: asStringOr(j['name'], '').trim(),
        fold: FoldKey.parse(j['fold']),
        colour: (asInt(j['colour']) ?? 0).clamp(0, 7),
        marks: asInt(j['marks']),
        place: asInt(j['place']),
        you: asBool(j['you']) ?? false,
        floor: asBool(j['floor']) ?? false,
        private: asBool(j['private']) ?? false,
      );

  final String memberId;
  final String name;
  final FoldKey? fold;
  final int colour;

  /// Null when the member keeps marks private ("Private").
  final int? marks;

  /// Null when the podium switch is off, or the marks are private.
  final int? place;
  final bool you;
  final bool floor;
  final bool private;
}

class PodiumTie {
  const PodiumTie({required this.place, required this.names, required this.marks});

  static PodiumTie? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final p = asInt(j['place']);
    final m = asInt(j['marks']);
    if (p == null || m == null) return null;
    return PodiumTie(place: p, names: asStringList(j['names']), marks: m);
  }

  final int place;
  final List<String> names;
  final int marks;
}

enum MomentKind {
  allRight('all_right'),
  fastestRight('fastest_right'),
  quickestFinish('quickest_finish'),
  threeInARow('three_in_a_row'),
  noMinus('no_minus'),
  finishedAll('finished_all');

  const MomentKind(this.wire);
  final String wire;

  static MomentKind parse(Object? v) {
    final s = asString(v);
    for (final k in MomentKind.values) {
      if (k.wire == s) return k;
    }
    return finishedAll;
  }
}

class PlayerMoment {
  const PlayerMoment({required this.memberId, required this.kind, this.q, this.number, this.seconds, this.from, this.to, this.count});

  factory PlayerMoment.fromJson(Json j) => PlayerMoment(
        memberId: asStringOr(j['memberId'], ''),
        kind: MomentKind.parse(j['kind']),
        q: asInt(j['q']),
        number: asInt(j['number']) ?? (asInt(j['q']) == null ? null : asInt(j['q'])! + 1),
        seconds: asInt(j['seconds']),
        from: asInt(j['from']),
        to: asInt(j['to']),
        count: asInt(j['count']),
      );

  final String memberId;
  final MomentKind kind;

  /// 0-based question index (the server's `q`).
  final int? q;

  /// 1-based question number for the copy ("question 5").
  final int? number;
  final int? seconds;
  final int? from;
  final int? to;
  final int? count;
}

class GameTrap {
  const GameTrap({required this.q, int? number, this.caught = 'most'}) : number = number ?? q + 1;

  static GameTrap? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final q = asInt(j['q']);
    if (q == null) return null;
    return GameTrap(q: q, number: asInt(j['number']), caught: asStringOr(j['caught'], 'most'));
  }

  /// 0-based question index (the server's `q`).
  final int q;

  /// 1-based question number for the copy ("Question 4 caught most of you.").
  final int number;

  /// Only ever "most" (F3). Never a number.
  final String caught;
}

class Podium {
  const Podium({this.soFar = true, this.closesAt, this.showPodium = true, this.right = 0, this.of = 0, this.places = const [], this.tie, this.moments = const [], this.trap});

  factory Podium.fromJson(Json j) {
    final h = asJson(j['headline']);
    return Podium(
      soFar: asBool(j['soFar']) ?? true,
      closesAt: asDate(j['closesAt']),
      showPodium: asBool(j['showPodium']) ?? true,
      right: asInt(h['right']) ?? 0,
      of: asInt(h['of']) ?? 0,
      places: [for (final p in asJsonList(j['places'])) PodiumPlace.fromJson(p)],
      tie: PodiumTie.fromJson(j['tie']),
      moments: [for (final m in asJsonList(j['moments'])) PlayerMoment.fromJson(m)],
      trap: GameTrap.fromJson(j['trap']),
    );
  }

  final bool soFar;
  final DateTime? closesAt;
  final bool showPodium;
  final int right;
  final int of;
  final List<PodiumPlace> places;
  final PodiumTie? tie;
  final List<PlayerMoment> moments;
  final GameTrap? trap;

  List<PodiumPlace> get stage => [for (final p in places) if (!p.floor && p.place != null) p];
  List<PodiumPlace> get floorPlaces => [for (final p in places) if (p.floor) p];
  PodiumPlace? get first {
    for (final p in places) {
      if (p.place == 1) return p;
    }
    return null;
  }
}

class FixCheck {
  const FixCheck({this.opensAt, this.closesAt, this.state});

  final DateTime? opensAt;
  final DateTime? closesAt;

  /// not_yet, open, closed, done (the server's; null from an older one).
  final String? state;
}

class FixState {
  const FixState({this.now = 'open', this.check = const FixCheck(), this.fixedCount = 0, this.fixedOf = 3});

  factory FixState.fromJson(Json j) {
    final c = asJson(j['check']);
    final f = asJson(j['fixed']);
    return FixState(
      now: asStringOr(j['now'], 'open'),
      check: FixCheck(opensAt: asDate(c['opensAt']), closesAt: asDate(c['closesAt']), state: asString(c['state'])),
      fixedCount: asInt(f['count']) ?? 0,
      fixedOf: asInt(f['of']) ?? 3,
    );
  }

  /// `open`, `done`.
  final String now;
  final FixCheck check;
  final int fixedCount;
  final int fixedOf;
}

class ReviewQuestion {
  const ReviewQuestion({required this.q, required this.stem, required this.options, required this.correctIndex, this.explanation = '', this.yourPick});

  factory ReviewQuestion.fromJson(Json j) => ReviewQuestion(
        q: asInt(j['q']) ?? 0,
        stem: asStringOr(j['stem'], ''),
        options: asStringList(j['options']),
        correctIndex: asInt(j['correctIndex']) ?? 0,
        explanation: asStringOr(j['explanation'], ''),
        yourPick: asInt(j['yourPick']),
      );

  final int q;
  final String stem;
  final List<String> options;
  final int correctIndex;
  final String explanation;

  /// Your own pick only. Nobody else's, ever.
  final int? yourPick;
}

class ReviewTrap {
  const ReviewTrap({required this.q, int? number, this.caught = 'most', this.fix = const FixState()}) : number = number ?? q + 1;

  static ReviewTrap? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final q = asInt(j['q']);
    if (q == null) return null;
    return ReviewTrap(q: q, number: asInt(j['number']), caught: asStringOr(j['caught'], 'most'), fix: FixState.fromJson(asJson(j['fix'])));
  }

  /// 0-based question index.
  final int q;

  /// 1-based question number for the copy.
  final int number;
  final String caught;
  final FixState fix;
}

class Review {
  const Review({this.questions = const [], this.trap});

  factory Review.fromJson(Json j) => Review(questions: [for (final q in asJsonList(j['questions'])) ReviewQuestion.fromJson(q)], trap: ReviewTrap.fromJson(j['trap']));

  final List<ReviewQuestion> questions;
  final ReviewTrap? trap;
}

class FixStart {
  const FixStart({required this.question, this.trapQ, this.trapNumber, this.why, this.yourPick, this.correctIndex, this.answered = false});

  factory FixStart.fromJson(Json j) {
    final t = asJson(j['trap']);
    return FixStart(
      question: GameQuestion.fromJson(asJson(j['question'])),
      trapQ: asInt(t['q']),
      trapNumber: asInt(t['number']) ?? (asInt(t['q']) == null ? null : asInt(t['q'])! + 1),
      answered: asBool(asJson(j['question'])['answered']) ?? false,
      why: asString(t['why']),
      yourPick: asInt(t['yourPick']),
      correctIndex: asInt(t['correctIndex']),
    );
  }

  final GameQuestion question;
  /// 0-based.
  final int? trapQ;

  /// 1-based, for the copy.
  final int? trapNumber;

  /// The fresh question was already answered (a reopened screen shows the result).
  final bool answered;
  final String? why;
  final int? yourPick;
  final int? correctIndex;
}

class FixAnswer {
  const FixAnswer({required this.correct, required this.correctIndex, this.explanation = '', this.fixedTogether = false, this.fixedCount = 0, this.fixedOf = 3});

  factory FixAnswer.fromJson(Json j) {
    final f = asJson(j['fixed']);
    return FixAnswer(
      correct: asBool(j['correct']) ?? false,
      correctIndex: asInt(j['correctIndex']) ?? 0,
      explanation: asStringOr(j['explanation'], ''),
      fixedTogether: asBool(j['fixedTogether']) ?? false,
      fixedCount: asInt(f['count']) ?? 0,
      fixedOf: asInt(f['of']) ?? 3,
    );
  }

  final bool correct;
  final int correctIndex;
  final String explanation;
  final bool fixedTogether;
  final int fixedCount;
  final int fixedOf;
}

// ---------------------------------------------------------------------------------------------------
// The shelf (spec 3.5)
// ---------------------------------------------------------------------------------------------------

class FinishProgress {
  const FinishProgress({this.owned = false, this.rule, this.have, this.need});

  factory FinishProgress.fromJson(Json j) => FinishProgress(owned: asBool(j['owned']) ?? false, rule: asString(j['rule']), have: asInt(j['have']), need: asInt(j['need']));

  final bool owned;
  final String? rule;
  final int? have;
  final int? need;
}

class ShelfFold {
  const ShelfFold({required this.key, this.owned = false, this.starter = false, this.folds = 1, this.rule, this.have, this.need, this.mob, this.foil = const FinishProgress()});

  static ShelfFold? fromJson(Json j) {
    final k = FoldKey.parse(j['key']);
    if (k == null) return null;
    return ShelfFold(
      key: k,
      owned: asBool(j['owned']) ?? false,
      starter: asBool(j['starter']) ?? false,
      folds: asInt(j['folds']) ?? 1,
      rule: asString(j['rule']),
      have: asInt(j['have']),
      need: asInt(j['need']),
      mob: asString(j['mob']),
      foil: FinishProgress.fromJson(asJson(asJson(j['finishes'])['foil'])),
    );
  }

  final FoldKey key;
  final bool owned;
  final bool starter;

  /// 1 starter, 2 earned yourself, 3 earned with your Mob.
  final int folds;
  final String? rule;
  final int? have;
  final int? need;

  /// The Mob that leads a Mob-earned Fold's count.
  final String? mob;
  final FinishProgress foil;
}

class ShelfItem {
  const ShelfItem({required this.item, this.owned = false, this.have, this.need});

  factory ShelfItem.fromJson(Json j) => ShelfItem(item: asStringOr(j['item'], ''), owned: asBool(j['owned']) ?? false, have: asInt(j['have']), need: asInt(j['need']));

  final String item;
  final bool owned;
  final int? have;
  final int? need;
}

class MobShelf {
  const MobShelf({required this.mobId, required this.name, this.items = const []});

  factory MobShelf.fromJson(Json j) => MobShelf(mobId: asStringOr(j['mobId'], ''), name: asStringOr(j['name'], ''), items: [for (final i in asJsonList(j['items'])) ShelfItem.fromJson(i)]);

  final String mobId;
  final String name;
  final List<ShelfItem> items;
}

class Shelf {
  const Shelf({this.seat = FoldKey.dart, this.seatFinish = FoldFinish.plain, this.folds = const [], this.mobItems = const []});

  factory Shelf.fromJson(Json j) {
    final s = asJson(j['seat']);
    return Shelf(
      seat: FoldKey.parse(s['fold']) ?? FoldKey.dart,
      seatFinish: FoldFinish.parse(s['finish']),
      folds: [for (final f in asJsonList(j['folds'])) ?ShelfFold.fromJson(f)],
      mobItems: [for (final m in asJsonList(j['mobItems'])) MobShelf.fromJson(m)],
    );
  }

  final FoldKey seat;
  final FoldFinish seatFinish;
  final List<ShelfFold> folds;
  final List<MobShelf> mobItems;

  List<FoldKey> get owned => [for (final f in folds) if (f.owned) f.key];
}

// ---------------------------------------------------------------------------------------------------
// The personal chain (spec 3.8)
// ---------------------------------------------------------------------------------------------------

enum ChainDayState {
  practised,
  rested,
  madeUp,
  paused,
  missed,
  open,
  today,
  none;

  static ChainDayState parse(Object? v) => switch (asString(v)) {
        'practised' => practised,
        'rested' => rested,
        'made_up' => madeUp,
        'paused' => paused,
        'missed' => missed,
        'open' => open,
        'today' => today,
        _ => none,
      };
}

class ChainDay {
  const ChainDay({required this.day, required this.state, this.answered});

  factory ChainDay.fromJson(Json j) => ChainDay(day: asStringOr(j['day'], ''), state: ChainDayState.parse(j['state']), answered: asInt(j['answered']));

  /// `YYYY-MM-DD`, an IST day.
  final String day;
  final ChainDayState state;
  final int? answered;

  DateTime? get date => DateTime.tryParse(day);
}

class ChainMilestone {
  const ChainMilestone({required this.at, this.reward, this.done = false, this.left});

  factory ChainMilestone.fromJson(Json j) => ChainMilestone(at: asInt(j['at']) ?? 0, reward: asString(j['reward']), done: asBool(j['done']) ?? false, left: asInt(j['left']));

  final int at;

  /// `rest_pass`, `foil`, `ribbon`, or null.
  final String? reward;
  final bool done;
  final int? left;
}

class ChainNotice {
  const ChainNotice({required this.key, required this.kind, this.day, this.days});

  factory ChainNotice.fromJson(Json j) => ChainNotice(key: asStringOr(j['key'], ''), kind: asStringOr(j['kind'], ''), day: asString(j['day']), days: asInt(j['days']));

  final String key;
  final String kind;
  final String? day;
  final int? days;
}

class ChainState {
  const ChainState({
    this.hidden = false,
    this.days = 0,
    this.practised = 0,
    this.rested = 0,
    this.madeUp = 0,
    this.best = 0,
    this.todayAnswered = 0,
    this.todayNeeded = 5,
    this.todayDone = false,
    this.passesHeld = 0,
    this.passesMax = 2,
    this.nextPassAt,
    this.week = const [],
    this.calendar = const [],
    this.milestones = const [],
    this.makeUpDay,
    this.makeUpNeeded = 10,
    this.makeUpAnsweredToday = 0,
    this.pauseDays = const [],
    this.pauseUsed = 0,
    this.pauseMax = 14,
    this.notices = const [],
    this.due = const [],
    this.brokeFrom,
  });

  factory ChainState.fromJson(Json j) {
    final t = asJson(j['today']);
    final p = asJson(j['passes']);
    final mu = j['makeUp'] is Map ? asJson(j['makeUp']) : null;
    final pause = asJson(j['pause']);
    return ChainState(
      hidden: asBool(j['hidden']) ?? false,
      days: asInt(j['days']) ?? 0,
      practised: asInt(j['practised']) ?? 0,
      rested: asInt(j['rested']) ?? 0,
      madeUp: asInt(j['madeUp']) ?? 0,
      best: asInt(j['best']) ?? 0,
      todayAnswered: asInt(t['answered']) ?? 0,
      todayNeeded: asInt(t['needed']) ?? 5,
      todayDone: asBool(t['done']) ?? false,
      passesHeld: asInt(p['held']) ?? 0,
      passesMax: asInt(p['max']) ?? 2,
      nextPassAt: asInt(asJson(p['next'])['at']),
      week: [for (final d in asJsonList(j['week'])) ChainDay.fromJson(d)],
      calendar: [for (final d in asJsonList(j['calendar'])) ChainDay.fromJson(d)],
      milestones: [for (final m in asJsonList(j['milestones'])) ChainMilestone.fromJson(m)],
      makeUpDay: mu == null ? null : asString(mu['day']),
      makeUpNeeded: mu == null ? 10 : (asInt(mu['needed']) ?? 10),
      makeUpAnsweredToday: mu == null ? 0 : (asInt(mu['answeredToday']) ?? 0),
      pauseDays: asStringList(pause['days']),
      pauseUsed: asInt(pause['usedThisSeason']) ?? 0,
      pauseMax: asInt(pause['max']) ?? 14,
      notices: [for (final n in asJsonList(j['notices'])) ChainNotice.fromJson(n)],
      due: asStringList(j['due']),
      brokeFrom: asInt(j['brokeFrom']),
    );
  }

  final bool hidden;
  final int days;
  final int practised;
  final int rested;
  final int madeUp;
  final int best;
  final int todayAnswered;
  final int todayNeeded;
  final bool todayDone;
  final int passesHeld;
  final int passesMax;
  final int? nextPassAt;
  final List<ChainDay> week;
  final List<ChainDay> calendar;
  final List<ChainMilestone> milestones;
  final String? makeUpDay;
  final int makeUpNeeded;
  final int makeUpAnsweredToday;
  final List<String> pauseDays;
  final int pauseUsed;
  final int pauseMax;
  final List<ChainNotice> notices;
  final List<String> due;

  /// Set by a server that names a chain which broke (the "A new chain starts today" line).
  final int? brokeFrom;

  int get pauseLeft => (pauseMax - pauseUsed).clamp(0, pauseMax);
}

// ---------------------------------------------------------------------------------------------------
// Create, join, invite
// ---------------------------------------------------------------------------------------------------

class InviteV3 {
  const InviteV3({required this.code, required this.display, required this.url, this.expiresAt});

  factory InviteV3.fromJson(Json j) {
    final code = asStringOr(j['code'], '');
    return InviteV3(
      code: code,
      display: asString(j['display']) ?? displayCode(code),
      url: asString(j['url']) ?? 'https://www.mockmob.in/join/$code',
      expiresAt: asDate(j['expiresAt']),
    );
  }

  final String code;
  final String display;
  final String url;
  final DateTime? expiresAt;
}

/// "K7P 2M9" from "K7P2M9" (a space in the middle of a 6-character code; 8-character codes as 4 4).
String displayCode(String code) {
  final c = code.trim().toUpperCase();
  if (c.length == 6) return '${c.substring(0, 3)} ${c.substring(3)}';
  if (c.length == 8) return '${c.substring(0, 4)} ${c.substring(4)}';
  return c;
}

/// The join preview: no names (judge F7).
class JoinPreview {
  const JoinPreview({required this.status, this.subject = '', this.subjectName = '', this.name = '', this.size = 0, this.seatsLeft = 0, this.inviter, this.folds = const []});

  factory JoinPreview.fromJson(Json j) => JoinPreview(
        status: asStringOr(j['status'], 'invalid'),
        subject: asStringOr(j['subject'], ''),
        subjectName: asStringOr(j['subjectName'], ''),
        name: asStringOr(j['name'], ''),
        size: asInt(j['size']) ?? 0,
        seatsLeft: asInt(j['seatsLeft']) ?? 0,
        inviter: asString(j['inviter']),
        folds: [for (final f in asStringList(j['folds'])) ?FoldKey.parse(f)],
      );

  /// valid, invalid, expired, full, paused.
  final String status;
  final String subject;
  final String subjectName;
  final String name;
  final int size;
  final int seatsLeft;
  final String? inviter;

  /// The members' Folds, drawn as silhouettes only (no names).
  final List<FoldKey> folds;

  bool get valid => status == 'valid';
}

/// Crockford-normalised code (spec 3.1): uppercase; O to 0; I and L to 1; spaces and hyphens dropped.
/// A pasted link keeps only its last path segment.
String normalizeJoinCode(String raw) {
  var s = raw.trim();
  final slash = s.lastIndexOf('/');
  if (slash >= 0) s = s.substring(slash + 1);
  final q = s.indexOf('?');
  if (q >= 0) s = s.substring(0, q);
  s = s.toUpperCase().replaceAll(RegExp(r'[\s\-]'), '').replaceAll('O', '0').replaceAll('I', '1').replaceAll('L', '1');
  return s;
}

/// 6 (new) or 8 (old, until they expire) Crockford characters.
bool isJoinCode(String code) => RegExp(r'^[0-9A-HJKMNP-TV-Z]{6}$').hasMatch(code) || RegExp(r'^[0-9A-HJKMNP-TV-Z]{8}$').hasMatch(code);

/// A one-time moment key (spec 5.6 queue; server: `quest_done:<mobId>:<week>`, `stitch:<mobId>:<week>`,
/// `reveal:<fold>`, `chain:<n>`; the older two-part forms are read too).
class MomentKey {
  const MomentKey(this.raw, this.kind, {this.mobId, this.week, this.fold, this.days});

  factory MomentKey.parse(String raw) {
    final parts = raw.split(':');
    final kind = parts.first;
    switch (kind) {
      case 'quest_done' || 'stitch':
        return parts.length >= 3 ? MomentKey(raw, kind, mobId: parts[1], week: parts[2]) : MomentKey(raw, kind, week: parts.length > 1 ? parts[1] : null);
      case 'reveal':
        return MomentKey(raw, kind, fold: FoldKey.parse(parts.length > 1 ? parts[1] : null));
      case 'chain':
        return MomentKey(raw, kind, days: parts.length > 1 ? int.tryParse(parts[1]) : null);
      default:
        return MomentKey(raw, kind);
    }
  }

  final String raw;

  /// quest_done, stitch, reveal, chain, rest.
  final String kind;
  final String? mobId;
  final String? week;
  final FoldKey? fold;
  final int? days;
}
