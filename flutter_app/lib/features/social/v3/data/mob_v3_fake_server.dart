// The fixture server (spec 8.2 step 3: "the app against fixtures before the server lands"). It answers
// every v3 route with the contract's shapes (section 3) and plays the server's rules: CUET marks, the
// answer held until close (F1), places with shared ties, moments, the trap ("most of you", F3), the
// quest with its true total (F8), Free and Pro starts (3.3), Fix it together after close only.
//
// The fixture Mob is the spec's: Chai Circle, Accountancy, Aarav (you, Dart), Riya (Patang), Kabir
// (Naav), Zoya (Cutting). Times are relative to the phone's clock, so "Open until 2:05 PM tomorrow"
// reads true whenever the walk runs.
//
// Debug and test only. It never runs in a release build unless MOB_V3_FIXTURES=true is passed.

import 'dart:math' as math;

import '../../../../core/api/api.dart';
import '../../../../core/models/json_helpers.dart';
import 'mob_v3_api.dart';
import 'mob_v3_bank.dart';
import 'mob_v3_models.dart';

ApiError _err(String code, int status, {Map<String, Object?> details = const {}}) => ApiError(
      kind: switch (status) {
        402 => ApiErrorKind.paymentRequired,
        403 => ApiErrorKind.forbidden,
        404 => ApiErrorKind.notFound,
        409 => ApiErrorKind.conflict,
        410 => ApiErrorKind.conflict,
        422 => ApiErrorKind.validation,
        503 => ApiErrorKind.unavailable,
        _ => ApiErrorKind.unknown,
      },
      code: code,
      status: status,
      details: details,
    );

class _Member {
  _Member(this.id, this.name, this.colour, this.fold, {this.you = false, this.owner = false});
  final String id;
  String name;
  int colour;
  FoldKey fold;
  final bool you;
  final bool owner;
}

class _Answer {
  _Answer(this.pick, this.correct, this.elapsedMs);
  final int pick;
  final bool? correct;
  final int elapsedMs;
}

class _Run {
  _Run(this.startedAt, this.endsAt);
  final DateTime startedAt;
  final DateTime endsAt;
  final Map<int, _Answer> answers = {};
  DateTime? finishedAt;

  int get right => answers.values.where((a) => a.correct == true).length;
  int get wrong => answers.values.where((a) => a.correct == false).length;
  int get marks => 5 * right - wrong;
  bool get finished => finishedAt != null;
}

class _Game {
  _Game({required this.id, required this.format, required this.count, required this.chapter, required this.hostId, required this.openedAt, required this.questions, this.mode = GameMode.async});
  final String id;
  final GameFormat format;
  final GameMode mode;
  final int count;
  final String? chapter;
  final String hostId;
  final DateTime openedAt;
  final List<int> questions;
  final Map<String, _Run> runs = {};
  final Map<String, Map<String, bool>> fixes = {}; // stage -> member -> correct
  DateTime get closesAt => openedAt.add(const Duration(hours: 24));
  bool closedAt(DateTime now) => !now.isBefore(closesAt);
}

class _Mob {
  _Mob({required this.id, required this.name, required this.nameKey, required this.members});
  final String id;
  String name;
  int? nameKey;
  bool showPodium = true;
  final List<_Member> members;
  final List<_Game> games = [];
  int questAnswered = 0;
  DateTime? questDoneAt;
  int chainWeeks = 0;
  int chainBest = 0;
  bool stitchedThisWeek = false;
  bool youSteppedOut = false;
  int trapsFixed = 0;
  bool ownsHop = false;
  final List<Reaction> reactions = [];
  final Map<String, int> questBySource = {};
  bool youSatPaper = false;

  _Member get you => members.firstWhere((m) => m.you);
  int get questTarget => math.max(15, 15 * (members.length - (youSteppedOut ? 1 : 0)));
}

/// In-memory server with the contract's behaviour. One per app run ([mobV3FakeServerProvider]).
class MobV3FakeServer implements MobV3Api {
  MobV3FakeServer({this.scenario = 'heavy', this.billing = 'off', DateTime Function()? clock}) : _clock = clock ?? (() => DateTime.now().toUtc()) {
    _seed();
  }

  final String scenario;
  String billing;
  final DateTime Function() _clock;

  /// Added to the clock, so a test or the walk can jump past a game's close.
  Duration skew = Duration.zero;
  DateTime get now => _clock().add(skew);

  final List<_Mob> _mobs = [];
  String? _selected;
  FoldKey? _seat;
  FoldFinish _seatFinish = FoldFinish.plain;
  final Set<FoldKey> _owned = {...FoldKey.starters};
  final Set<String> _seen = {};
  bool _freeStartUsed = false;
  int _micsHeld = 0;
  int _micsToGive = 2;
  int _ids = 0;

  // Personal chain fixture.
  int _chainDays = 13;
  int _chainBest = 13;
  int _todayAnswered = 2;
  bool _chainHidden = false;
  final List<String> _pauseDays = [];
  int _cleanGames = 1;
  int _fixesHeld = 2;

  String _id(String p) => '$p-${(++_ids).toString().padLeft(4, '0')}';

  // ---- Seeding ---------------------------------------------------------------------------------------

  void _seed() {
    if (billing == 'used') _freeStartUsed = true;
    if (billing == 'mic') _micsHeld = 1;
    if (scenario == 'fresh') {
      _seat = null;
      return;
    }
    _seat = FoldKey.dart;
    final you = _Member('AARAV0000001', 'Aarav', 5, FoldKey.dart, you: true, owner: true);
    if (scenario == 'one') {
      final mob = _Mob(id: 'mob-chai-0001', name: 'Chai Circle', nameKey: 0, members: [you]);
      mob.questAnswered = 0;
      _mobs.add(mob);
      return;
    }
    final mob = _Mob(id: 'mob-chai-0001', name: 'Chai Circle', nameKey: 0, members: [
      you,
      _Member('RIYA00000002', 'Riya', 3, FoldKey.patang),
      _Member('KABIR0000003', 'Kabir', 0, FoldKey.naav),
      _Member('ZOYA00000004', 'Zoya', 6, FoldKey.cutting),
    ]);
    mob.chainWeeks = 3;
    mob.chainBest = 3;
    mob.questAnswered = 51;
    mob.questBySource
      ..["Monday's Mob paper"] = 37
      ..["Riya's sprint"] = 14;
    mob.trapsFixed = 1;
    mob.youSatPaper = true;
    _mobs.add(mob);
    if (scenario == 'quiet') return;

    final t = now;
    // Riya's sprint, open, three finished runs (D2). You have not played it.
    if (scenario == 'open' || scenario == 'heavy' || scenario == 'questdone' || scenario == 'live') {
      final g = _Game(id: 'game-riya-sprint', format: GameFormat.sprint, count: 5, chapter: 'Goodwill', hostId: 'RIYA00000002', openedAt: t.subtract(const Duration(hours: 6, minutes: 35)), questions: [0, 1, 2, 3, 4], mode: scenario == 'live' ? GameMode.live : GameMode.async);
      _bake(g, 'RIYA00000002', [true, true, true, true, null], [41000, 79000, 130000, 151000, 190000], const Duration(minutes: 5));
      _bake(g, 'KABIR0000003', [true, true, false, true, true], [38000, 84000, 126000, 160000, 205000], const Duration(hours: 2, minutes: 45));
      _bake(g, 'ZOYA00000004', [true, false, true, false, true], [52000, 101000, 150000, 199000, 236000], const Duration(hours: 4, minutes: 20));
      mob.games.add(g);
    }
    if (scenario == 'played' || scenario == 'heavy' || scenario == 'questdone') {
      // Kabir's round, open, you played it (D3).
      final g = _Game(id: 'game-kabir-round', format: GameFormat.round, count: 10, chapter: 'Goodwill', hostId: 'KABIR0000003', openedAt: t.subtract(const Duration(hours: 3)), questions: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
      _bake(g, 'KABIR0000003', [true, true, true, false, true, true, null, true, true, true], [30000, 62000, 95000, 140000, 171000, 200000, 230000, 266000, 300000, 333000], const Duration(minutes: 10));
      _bake(g, 'AARAV0000001', [true, true, false, true, true, true, true, null, true, false], [35000, 70000, 101000, 139000, 168000, 205000, 240000, 281000, 312000, 350000], const Duration(hours: 1, minutes: 5));
      mob.games.add(g);
    }
    if (scenario == 'heavy' || scenario == 'questdone' || scenario == 'quiet') {
      // Zoya's sprint, closed yesterday, with a trap on question 4 (index 3).
      final g = _Game(id: 'game-zoya-closed', format: GameFormat.sprint, count: 5, chapter: 'Goodwill', hostId: 'ZOYA00000004', openedAt: t.subtract(const Duration(hours: 30)), questions: [15, 16, 3, 17, 18]);
      // Question 4 here is bank 17 (correct 0): the trap is option B, picked by Kabir, Zoya and you.
      _bake(g, 'ZOYA00000004', [true, true, true, false, true], [40000, 81000, 120000, 160000, 201000], const Duration(minutes: 20), trapPicks: {3: 1});
      _bake(g, 'RIYA00000002', [true, true, true, true, true], [36000, 70000, 105000, 139000, 170000], const Duration(hours: 2));
      _bake(g, 'KABIR0000003', [true, false, true, false, true], [44000, 90000, 133000, 170000, 214000], const Duration(hours: 5), trapPicks: {3: 1});
      _bake(g, 'AARAV0000001', [true, true, null, false, true], [39000, 77000, 118000, 151000, 190000], const Duration(hours: 9), trapPicks: {3: 1});
      mob.games.add(g);
    }
    if (scenario == 'questdone') {
      mob.questAnswered = 70;
      mob.questDoneAt = t.subtract(const Duration(minutes: 3));
      mob.questBySource["Kabir's round"] = 19;
    }
  }

  /// A finished run of [memberId] with the given right (true), wrong (false) or skipped (null) answers.
  void _bake(_Game g, String memberId, List<bool?> rights, List<int> arrivals, Duration after, {Map<int, int> trapPicks = const {}}) {
    final start = g.openedAt.add(after);
    final run = _Run(start, start.add(Duration(seconds: g.count * 60 + 60)));
    for (var i = 0; i < g.count; i++) {
      final r = rights[i];
      final correctIdx = mobV3Bank[g.questions[i]].correct;
      final pick = r == null ? -1 : (r ? correctIdx : (trapPicks[i] ?? (correctIdx + 1) % 4));
      run.answers[i] = _Answer(pick, r, arrivals[i]);
    }
    run.finishedAt = start.add(Duration(milliseconds: arrivals.last));
    g.runs[memberId] = run;
  }

  // ---- Lookups ---------------------------------------------------------------------------------------

  _Mob? _mob([String? id]) {
    if (_mobs.isEmpty) return null;
    final want = id ?? _selected;
    for (final m in _mobs) {
      if (m.id == want) return m;
    }
    return _mobs.first;
  }

  ({_Mob mob, _Game game}) _game(String id) {
    for (final m in _mobs) {
      for (final g in m.games) {
        if (g.id == id) return (mob: m, game: g);
      }
    }
    throw _err('GAME_NOT_FOUND', 404);
  }

  String _title(_Mob mob, _Game g) {
    final host = mob.members.firstWhere((m) => m.id == g.hostId, orElse: () => mob.you);
    final kind = switch (g.format) { GameFormat.sprint => 'sprint', GameFormat.round => 'round', GameFormat.rematch => 'rematch' };
    return host.you ? 'Your $kind' : "${host.name}'s $kind";
  }

  String _iso(DateTime d) => d.toUtc().toIso8601String();

  // ---- Views -----------------------------------------------------------------------------------------

  Json _startsJson(_Mob mob) {
    final liveModes = ['async'];
    return switch (billing) {
      'free' when !_freeStartUsed => {'billingOn': true, 'can': true, 'via': 'free_weekly', 'modes': liveModes, 'formats': ['sprint', 'round', 'rematch'], 'freeLeft': 1, 'mics': _micsHeld},
      'free' || 'used' when _micsHeld == 0 => {'billingOn': true, 'can': false, 'reason': 'used', 'via': 'none', 'modes': <String>[], 'formats': <String>[], 'freeLeft': 0, 'mics': 0},
      'free' || 'used' || 'mic' => {'billingOn': true, 'can': true, 'via': 'mic', 'modes': ['async', 'live'], 'formats': ['sprint', 'round', 'rematch'], 'freeLeft': 0, 'mics': _micsHeld, 'micFrom': {'memberId': 'RIYA00000002', 'name': 'Riya'}},
      'pro' => {'billingOn': true, 'can': true, 'via': 'pro', 'modes': liveModes, 'formats': ['sprint', 'round', 'rematch'], 'freeLeft': null, 'mics': 0, 'micsToGive': _micsToGive},
      _ => {'billingOn': false, 'can': true, 'via': 'open', 'modes': liveModes, 'formats': ['sprint', 'round', 'rematch'], 'freeLeft': null, 'mics': 0, 'micsToGive': null},
    };
  }

  Json _gameSummary(_Mob mob, _Game g) {
    final you = mob.you;
    final yourRun = g.runs[you.id];
    final finished = [for (final e in g.runs.entries) if (e.value.finished) e]..sort((a, b) => a.value.finishedAt!.compareTo(b.value.finishedAt!));
    final host = mob.members.firstWhere((m) => m.id == g.hostId, orElse: () => you);
    return {
      'id': g.id,
      'format': g.format.name,
      'mode': g.mode.name,
      'count': g.count,
      'chapter': g.chapter,
      'subjectName': 'Accountancy',
      'host': {'memberId': host.id, 'name': host.name},
      'openedAt': _iso(g.openedAt),
      'closesAt': _iso(g.closesAt),
      'closed': g.closedAt(now),
      'room': g.mode == GameMode.live ? {'state': 'lobby', 'startsAt': null} : null,
      'runs': [
        for (final e in finished) {'memberId': e.key, 'name': mob.members.firstWhere((m) => m.id == e.key).name, 'at': _iso(e.value.finishedAt!)},
      ],
      'yourRun': yourRun == null ? 'none' : (yourRun.finished ? 'finished' : 'playing'),
      'podiumReady': (yourRun?.finished ?? false) || g.closedAt(now),
    };
  }

  String get _week {
    final ist = now.add(const Duration(hours: 5, minutes: 30));
    final monday = DateTime.utc(ist.year, ist.month, ist.day).subtract(Duration(days: ist.weekday - 1));
    String two(int v) => v.toString().padLeft(2, '0');
    return '${monday.year}-${two(monday.month)}-${two(monday.day)}';
  }

  Json _parcel(_Mob mob) {
    if (!mob.ownsHop) return {'kind': 'fold', 'fold': 'hop'};
    final next = mob.chainWeeks + 1;
    const items = {2: 'den_stamp', 4: 'desk_bell', 8: 'brass_lamp', 12: 'foil_seal', 20: 'den_stamp_row'};
    if (items.containsKey(next)) return {'kind': 'item', 'item': items[next]};
    return {'kind': 'stitch'};
  }

  List<String> _items(_Mob mob) => [
        if (mob.chainWeeks >= 2) 'den_stamp',
        if (mob.chainWeeks >= 4) 'desk_bell',
        if (mob.chainWeeks >= 8) 'brass_lamp',
        if (mob.chainWeeks >= 12) 'foil_seal',
      ];

  Json? _nextItem(_Mob mob) {
    const items = [(2, 'den_stamp'), (4, 'desk_bell'), (8, 'brass_lamp'), (12, 'foil_seal'), (20, 'den_stamp_row')];
    for (final (at, item) in items) {
      if (mob.chainWeeks < at) return {'at': at, 'item': item};
    }
    return null;
  }

  List<String> _due(_Mob mob) {
    final w = _week;
    return [
      if (mob.questDoneAt != null && !_seen.contains('quest_done:${mob.id}:$w')) 'quest_done:${mob.id}:$w',
      if (mob.questDoneAt != null && !_seen.contains('stitch:${mob.id}:$w')) 'stitch:${mob.id}:$w',
      if (mob.questDoneAt != null && !_seen.contains('reveal:hop') && _owned.contains(FoldKey.hop)) 'reveal:hop',
    ];
  }

  void _settleQuest(_Mob mob) {
    if (mob.questDoneAt == null && mob.questAnswered >= mob.questTarget) {
      mob.questDoneAt = now;
    }
    if (mob.questDoneAt != null && !mob.stitchedThisWeek) {
      mob.stitchedThisWeek = true;
      mob.chainWeeks += 1;
      mob.chainBest = math.max(mob.chainBest, mob.chainWeeks);
      if (!mob.ownsHop) {
        mob.ownsHop = true;
        _owned.add(FoldKey.hop);
      }
    }
  }

  Json _v3(_Mob mob) {
    _settleQuest(mob);
    final w = _week;
    return {
      'name': {'key': mob.nameKey, 'text': mob.name},
      'showPodium': mob.showPodium,
      'youOwn': mob.you.owner,
      'members': [
        for (final m in mob.members) {'memberId': m.id, 'name': m.name, 'colour': m.colour, 'fold': m.fold.name, 'finish': m.you ? _seatFinish.name : 'plain', 'you': m.you, 'owner': m.owner},
      ],
      'games': [for (final g in mob.games) if (!g.closedAt(now) || now.difference(g.closesAt).inDays < 7) _gameSummary(mob, g)],
      'quest': {
        'week': w,
        'target': mob.questTarget,
        'answered': mob.questAnswered,
        'done': mob.questDoneAt != null,
        'doneAt': mob.questDoneAt == null ? null : _iso(mob.questDoneAt!),
        'sizedFor': mob.members.length - (mob.youSteppedOut ? 1 : 0),
        'youSteppedOut': mob.youSteppedOut,
        'bySource': [for (final e in mob.questBySource.entries) {'label': e.key, 'answered': e.value}],
        'parcel': _parcel(mob),
      },
      'mobChain': {'weeks': mob.chainWeeks, 'best': mob.chainBest, 'passes': mob.chainWeeks >= 4 ? 1 : 0, 'stitchedThisWeek': mob.stitchedThisWeek, 'next': _nextItem(mob)},
      'shelf': {'items': _items(mob), 'nextItem': _nextItem(mob)},
      'starts': _startsJson(mob),
      'chainChip': {'hidden': _chainHidden, 'days': _chainDays, 'todayDone': _todayAnswered >= 5},
      'reactions': [
        for (final r in mob.reactions) {'memberId': r.memberId, 'kind': r.kind.wire, 'at': _iso(r.at ?? now)},
      ],
      'moments': _due(mob),
      'live': {'enabled': false, 'hoursOk': true},
    };
  }

  Json _denJson() {
    final mob = _mob();
    if (mob == null) {
      return {
        'mob': null,
        'v3': {
          'name': {'key': null, 'text': ''},
          'members': <Object>[],
          'seat': _seat?.name,
          'chainChip': {'hidden': _chainHidden, 'days': _chainDays, 'todayDone': _todayAnswered >= 5},
          'starts': _startsJson(_Mob(id: '', name: '', nameKey: null, members: [])),
        },
      };
    }
    final you = mob.you;
    final ist = now.add(const Duration(hours: 5, minutes: 30));
    final monday = DateTime.utc(ist.year, ist.month, ist.day).subtract(Duration(days: ist.weekday - 1));
    return {
      'mob': {
        'id': mob.id,
        'subject': 'accountancy',
        'subjectName': 'Accountancy',
        'plan': {'pro': billing == 'pro', 'maxMobs': billing == 'pro' ? 3 : 1, 'mobCount': _mobs.length, 'started': 1, 'canMakeExtra': false, 'canStartAnother': false},
        'mobs': [for (final m in _mobs) {'id': m.id, 'subject': 'accountancy', 'subjectName': 'Accountancy', 'active': m == mob}],
        'you': {'memberId': you.id, 'name': you.name, 'colour': you.colour, 'role': you.owner ? 'owner' : 'member', 'showScore': true},
        'members': [
          for (final m in mob.members) {'memberId': m.id, 'name': m.name, 'colour': m.colour, 'you': m.you, 'owner': m.owner},
        ],
        'week': {
          'start': _iso(monday.subtract(const Duration(hours: 5, minutes: 30))),
          'closesAt': _iso(monday.add(const Duration(days: 7)).subtract(const Duration(hours: 5, minutes: 30, seconds: 1))),
          'paper': {'count': 10, 'durationSec': 600, 'cost': {'type': 'free'}},
          'sat': mob.youSatPaper ? 1 : 0,
          'size': mob.members.length,
          'youSat': mob.youSatPaper,
        },
        'nudge': {'canSend': false, 'reason': 'none'},
        'invite': {'code': 'K7P2M9', 'url': 'https://www.mockmob.in/join/K7P2M9', 'expiresAt': _iso(now.add(const Duration(days: 7)))},
      },
      'v3': _v3(mob),
    };
  }

  Json _gameJson(_Mob mob, _Game g) {
    final you = mob.you;
    final yourRun = g.runs[you.id];
    final host = mob.members.firstWhere((m) => m.id == g.hostId, orElse: () => you);
    return {
      'id': g.id,
      'mobId': mob.id,
      'format': g.format.name,
      'mode': g.mode.name,
      'count': g.count,
      'secondsPerQuestion': 60,
      'subjectName': 'Accountancy',
      'chapter': g.chapter,
      'title': _title(mob, g),
      'host': {'memberId': host.id, 'name': host.name, 'you': host.you},
      'openedAt': _iso(g.openedAt),
      'closesAt': _iso(g.closesAt),
      'closed': g.closedAt(now),
      'serverNow': _iso(now),
      'room': null,
      'runs': [
        for (final e in g.runs.entries)
          if (e.value.finished)
            {
              'memberId': e.key,
              'name': mob.members.firstWhere((m) => m.id == e.key).name,
              'colour': mob.members.firstWhere((m) => m.id == e.key).colour,
              'fold': mob.members.firstWhere((m) => m.id == e.key).fold.name,
              'at': _iso(e.value.finishedAt!),
              'finished': true,
            },
      ],
      'you': {'run': yourRun == null ? 'none' : (yourRun.finished ? 'finished' : 'playing'), 'marks': yourRun?.marks, 'answered': yourRun?.answers.length ?? 0},
      'ghosts': _ghosts(mob, g),
      'podiumReady': (yourRun?.finished ?? false) || g.closedAt(now),
    };
  }

  List<Json> _ghosts(_Mob mob, _Game g) => [
        for (final e in g.runs.entries)
          if (e.value.finished && e.key != mob.you.id)
            () {
              final m = mob.members.firstWhere((x) => x.id == e.key);
              final arrivals = [for (var i = 0; i < g.count; i++) e.value.answers[i]?.elapsedMs ?? 0];
              return <String, dynamic>{
                'memberId': m.id,
                'name': m.name,
                'colour': m.colour,
                'fold': m.fold.name,
                'playedAt': _iso(e.value.startedAt),
                'arrivalsMs': arrivals,
                'finishedMs': arrivals.isEmpty ? 0 : arrivals.last,
              };
            }(),
      ];

  // ---- The den and the Mob ---------------------------------------------------------------------------

  /// The `GET /api/mob` body now, synchronously (tests and goldens seed the repository with it).
  Json denNow() => _denJson();

  @override
  Future<Object?> den({String? mob}) async {
    if (mob != null) _selected = mob;
    return _denJson();
  }

  @override
  Future<Object?> createMob({required String subject, required String name, required int colour, required int nameKey, required FoldKey fold}) async {
    if (!_owned.contains(fold)) throw _err('FOLD_LOCKED', 409);
    if (nameKey < 0 || nameKey > 23) throw _err('NAME_KEY_INVALID', 422);
    _seat = fold;
    final you = _Member('AARAV0000001', name, colour, fold, you: true, owner: true);
    final mob = _Mob(id: _id('mob'), name: _nameFor(nameKey), nameKey: nameKey, members: [you]);
    _mobs.insert(0, mob);
    _selected = mob.id;
    return _denJson();
  }

  String _nameFor(int key) => const [
        'Chai Circle', 'Quiet Comets', 'Margin Makers', 'Steady Kites', 'Ledger Club', 'Paper Planes', 'Tea Break Crew', 'Bright Folds', 'Page Turners', 'Desk Mates', 'Little Lamps', 'Sharp Pencils', //
        'Kind Keys', 'Graph Gang', 'Inkwell', 'Clear Skies', 'First Light', 'Long Paper', 'Neat Notes', 'Blue Margins', 'Five Desks', 'Steady Hands', 'Fresh Pages', 'Calm Clocks',
      ][key.clamp(0, 23)];

  @override
  Future<JoinPreview> joinPreview(String code) async {
    final c = normalizeJoinCode(code);
    if (!isJoinCode(c)) return const JoinPreview(status: 'invalid');
    if (c == 'EXP1RE') return const JoinPreview(status: 'expired');
    if (c == 'FU11MB') return const JoinPreview(status: 'full');
    return JoinPreview.fromJson({
      'status': 'valid',
      'subject': 'accountancy',
      'subjectName': 'Accountancy',
      'name': 'Steady Kites',
      'size': 3,
      'seatsLeft': 2,
      'folds': ['patang', 'naav', 'cutting'],
    });
  }

  @override
  Future<Object?> join({required String code, required String name, required int colour, required FoldKey fold}) async {
    if (!_owned.contains(fold)) throw _err('FOLD_LOCKED', 409);
    final preview = await joinPreview(code);
    if (!preview.valid) throw _err(preview.status == 'expired' ? 'INVITE_EXPIRED' : 'INVITE_INVALID', 410);
    _seat = fold;
    final mob = _Mob(id: _id('mob'), name: 'Steady Kites', nameKey: 3, members: [
      _Member('RIYA00000012', 'Riya', 3, FoldKey.patang, owner: true),
      _Member('KABIR0000013', 'Kabir', 0, FoldKey.naav),
      _Member('ZOYA00000014', 'Zoya', 6, FoldKey.cutting),
      _Member('AARAV0000001', name, colour, fold, you: true),
    ]);
    mob.chainWeeks = 2;
    mob.chainBest = 2;
    mob.questAnswered = 22;
    mob.questBySource["Monday's Mob paper"] = 22;
    _mobs.add(mob);
    _selected = mob.id;
    return _denJson();
  }

  @override
  Future<InviteV3> invite(String mob) async => InviteV3.fromJson({'code': 'K7P2M9', 'display': 'K7P 2M9', 'url': 'https://www.mockmob.in/join/K7P2M9', 'expiresAt': _iso(now.add(const Duration(days: 7)))});

  @override
  Future<Object?> settings({required String mob, bool? showPodium, int? nameKey}) async {
    final m = _mob(mob)!;
    if (!m.you.owner) throw _err('NOT_OWNER_SETTINGS', 403);
    if (nameKey != null) {
      if (nameKey < 0 || nameKey > 23) throw _err('NAME_KEY_INVALID', 422);
      m.nameKey = nameKey;
      m.name = _nameFor(nameKey);
    }
    if (showPodium != null) m.showPodium = showPodium;
    return _denJson();
  }

  @override
  Future<void> profile(FoldKey fold, {FoldFinish finish = FoldFinish.plain}) async {
    if (!_owned.contains(fold)) throw _err('FOLD_LOCKED', 409);
    if (finish == FoldFinish.foil && _chainBest < 30) throw _err('FOLD_LOCKED', 409);
    _seat = fold;
    _seatFinish = finish;
    for (final m in _mobs) {
      m.you.fold = fold;
    }
  }

  @override
  Future<Shelf> shelf() async {
    final mob = _mob();
    final mobName = mob?.name;
    Json locked(FoldKey k, int folds, String rule, int have, int need, {bool mobEarned = false}) => {
          'key': k.name,
          'owned': _owned.contains(k),
          'starter': false,
          'folds': folds,
          'rule': rule,
          'have': have,
          'need': need,
          if (mobEarned && mobName != null) 'mob': mobName,
          'finishes': {'foil': {'owned': false, 'rule': 'chain_30', 'have': _chainBest, 'need': 30}},
        };
    return Shelf.fromJson({
      'seat': {'fold': (_seat ?? FoldKey.dart).name, 'finish': _seatFinish.name},
      'folds': [
        for (final k in FoldKey.starters) {'key': k.name, 'owned': true, 'starter': true, 'folds': 1, 'finishes': {'foil': {'owned': false, 'rule': 'chain_30', 'have': _chainBest, 'need': 30}}},
        locked(FoldKey.hop, 3, 'mob_quest', mob?.ownsHop == true ? 1 : 0, 1, mobEarned: true),
        locked(FoldKey.crane, 3, 'mob_traps', mob?.trapsFixed ?? 0, 3, mobEarned: true),
        locked(FoldKey.stamp, 3, 'mob_weeks', mob?.chainWeeks ?? 0, 4, mobEarned: true),
        locked(FoldKey.naav, 2, 'first_full_mock', 0, 1),
        locked(FoldKey.tally, 2, 'clean_games', _cleanGames, 3),
        locked(FoldKey.patang, 2, 'beat_best', 0, 1),
        locked(FoldKey.sticky, 2, 'fixes_held', _fixesHeld, 5),
        locked(FoldKey.cutting, 2, 'came_back', 0, 1),
      ],
      'mobItems': [
        for (final m in _mobs)
          {
            'mobId': m.id,
            'name': m.name,
            'items': [
              for (final (at, item) in const [(2, 'den_stamp'), (4, 'desk_bell'), (8, 'brass_lamp'), (12, 'foil_seal')])
                {'item': item, 'owned': m.chainWeeks >= at, if (m.chainWeeks < at) 'have': m.chainWeeks, if (m.chainWeeks < at) 'need': at},
            ],
          },
      ],
    });
  }

  // ---- Games -----------------------------------------------------------------------------------------

  @override
  Future<MobGame> openGame({required String mob, required GameFormat format, required GameMode mode, required int count, String? chapter, String? rematchOf}) async {
    final m = _mob(mob)!;
    if (mode == GameMode.live) throw _err('LIVE_OFF', 409);
    if (![5, 10, 15, 20].contains(count)) throw _err('LENGTH_INVALID', 422);
    final open = m.games.where((g) => !g.closedAt(now)).length;
    if (open >= 3) throw _err('GAMES_OPEN_LIMIT', 409);
    final starts = _startsJson(m);
    if (starts['can'] != true) throw _err('START_USED', 409);
    if (starts['via'] == 'free_weekly') _freeStartUsed = true;
    if (starts['via'] == 'mic') _micsHeld = math.max(0, _micsHeld - 1);
    // New questions: the bank's next unused ones, wrapping (rematch takes new questions too).
    final used = {for (final g in m.games) ...g.questions};
    final pool = [for (var i = 0; i < 20; i++) if (!used.contains(i)) i];
    final qs = <int>[...pool, for (var i = 0; i < 20; i++) i].take(count).toList();
    final g = _Game(id: _id('game'), format: format, count: count, chapter: chapter ?? 'Goodwill', hostId: m.you.id, openedAt: now, questions: qs);
    m.games.add(g);
    return MobGame.fromJson(_gameJson(m, g));
  }

  @override
  Future<MobGame> game(String id) async {
    final r = _game(id);
    return MobGame.fromJson(_gameJson(r.mob, r.game));
  }

  @override
  Future<RunStart> run(String id) async {
    final r = _game(id);
    final g = r.game;
    final me = r.mob.you.id;
    var run = g.runs[me];
    if (run != null && run.finished) throw _err('RUN_DONE', 409);
    if (g.closedAt(now) || now.add(Duration(seconds: g.count * 60)).isAfter(g.closesAt)) throw _err('GAME_CLOSED', 410);
    run ??= g.runs[me] = _Run(now, now.add(Duration(seconds: g.count * 60 + 60)));
    return RunStart.fromJson({
      'run': {
        'startedAt': _iso(run.startedAt),
        'endsAt': _iso(run.endsAt),
        'serverNow': _iso(now),
        'live': false,
        'answers': [
          for (final e in run.answers.entries) {'q': e.key, 'pick': e.value.pick, 'correct': e.value.correct, 'elapsedMs': e.value.elapsedMs},
        ],
      },
      'questions': [
        for (var i = 0; i < g.count; i++) {'q': i, 'stem': mobV3Bank[g.questions[i]].stem, 'options': mobV3Bank[g.questions[i]].options, 'passage': null},
      ],
      'ghosts': _ghosts(r.mob, g),
    });
  }

  /// Simulated network delay for the walk (the "Saving your answer" state appears after 600 ms).
  Duration answerDelay = const Duration(milliseconds: 180);

  @override
  Future<AnswerResult> answer(String id, {required int q, required int pick}) async {
    await Future<void>.delayed(answerDelay);
    final r = _game(id);
    final g = r.game;
    final run = g.runs[r.mob.you.id];
    if (run == null) throw _err('NO_RUN', 409);
    if (q < 0 || q >= g.count || pick < -1 || pick > 3) throw _err('Q_INVALID', 422);
    final stored = run.answers[q];
    if (stored == null) {
      if (run.finished) throw _err('RUN_DONE', 409);
      if (now.isAfter(run.endsAt)) {
        _finishRun(r.mob, g, run);
        throw _err('RUN_EXPIRED', 410);
      }
      final correct = pick < 0 ? null : pick == mobV3Bank[g.questions[q]].correct;
      run.answers[q] = _Answer(pick, correct, now.difference(run.startedAt).inMilliseconds);
      if (pick >= 0) {
        r.mob.questAnswered += 1;
        final label = _title(r.mob, g);
        r.mob.questBySource[label] = (r.mob.questBySource[label] ?? 0) + 1;
        _todayAnswered += 1;
        if (_todayAnswered == 5) {
          _chainDays += 1;
          _chainBest = math.max(_chainBest, _chainDays);
        }
      }
      if (run.answers.length >= g.count) _finishRun(r.mob, g, run);
    }
    final a = run.answers[q]!;
    return AnswerResult.fromJson({
      'correct': a.correct,
      'delta': a.correct == null ? 0 : (a.correct! ? 5 : -1),
      'marks': run.marks,
      'elapsedMs': a.elapsedMs,
      'answered': run.answers.length,
      'count': g.count,
      'finished': run.finished,
      'serverNow': _iso(now),
    });
  }

  void _finishRun(_Mob mob, _Game g, _Run run) {
    for (var i = 0; i < g.count; i++) {
      run.answers.putIfAbsent(i, () => _Answer(-1, null, now.difference(run.startedAt).inMilliseconds));
    }
    run.finishedAt ??= now;
    if (run.wrong == 0) _cleanGames += 1;
  }

  @override
  Future<int> finish(String id) async {
    final r = _game(id);
    final run = r.game.runs[r.mob.you.id];
    if (run == null) throw _err('NO_RUN', 409);
    _finishRun(r.mob, r.game, run);
    return run.marks;
  }

  @override
  Future<Podium> podium(String id) async {
    final r = _game(id);
    final g = r.game;
    final mob = r.mob;
    final mine = g.runs[mob.you.id];
    final closed = g.closedAt(now);
    if (!closed && !(mine?.finished ?? false)) throw _err('PODIUM_NOT_YET', 409);
    return Podium.fromJson(_podiumJson(mob: mob, game: g, closed: closed));
  }

  Json _podiumJson({required _Mob mob, required _Game game, required bool closed}) {
    final runs = [for (final e in game.runs.entries) if (e.value.finished) (id: e.key, run: e.value)];
    // Time order first, so equal marks keep the order they played in.
    runs.sort((a, b) => a.run.finishedAt!.compareTo(b.run.finishedAt!));
    final ordered = [...runs]..sort((a, b) => b.run.marks.compareTo(a.run.marks));
    int placeOf(int marks) => 1 + runs.where((x) => x.run.marks > marks).length;
    final trap = closed ? _trapOf(game) : null;
    final places = [
      for (final x in (mob.showPodium ? ordered : runs))
        () {
          final m = mob.members.firstWhere((mm) => mm.id == x.id);
          final place = placeOf(x.run.marks);
          return <String, dynamic>{
            'memberId': m.id,
            'name': m.name,
            'fold': m.fold.name,
            'colour': m.colour,
            'marks': x.run.marks,
            if (mob.showPodium) 'place': place,
            'you': m.you,
            if (mob.showPodium) 'floor': place > 3,
          };
        }(),
    ];
    Json? tie;
    if (mob.showPodium) {
      final groups = <int, List<String>>{};
      for (final x in ordered) {
        groups.putIfAbsent(placeOf(x.run.marks), () => []).add(x.id);
      }
      final shared = groups.entries.where((e) => e.value.length > 1).toList();
      shared.sort((a, b) => (b.value.contains(mob.you.id) ? 1 : 0).compareTo(a.value.contains(mob.you.id) ? 1 : 0));
      if (shared.isNotEmpty) {
        final e = shared.first;
        final names = [for (final id in e.value) mob.members.firstWhere((m) => m.id == id)];
        names.sort((a, b) => (b.you ? 1 : 0).compareTo(a.you ? 1 : 0));
        tie = {'place': e.key, 'names': [for (final m in names) m.you ? 'You' : m.name], 'marks': game.runs[e.value.first]!.marks};
      }
    }
    return {
      'soFar': !closed,
      'closesAt': _iso(game.closesAt),
      'showPodium': mob.showPodium,
      'headline': {'kind': 'together', 'right': runs.fold<int>(0, (s, x) => s + x.run.right), 'of': runs.length * game.count},
      'places': places,
      'tie': tie,
      'moments': _moments(game, ordered, trap?['q'] as int?),
      'trap': trap,
    };
  }

  /// The trap (spec 3.6): at least 3 finished runs; one wrong option picked by at least 2 and at least
  /// half. 1-based `q`; never a count.
  Json? _trapOf(_Game g) {
    final runs = g.runs.values.where((r) => r.finished).toList();
    if (runs.length < 3) return null;
    for (var q = 0; q < g.count; q++) {
      final correct = mobV3Bank[g.questions[q]].correct;
      final counts = <int, int>{};
      for (final r in runs) {
        final p = r.answers[q]?.pick ?? -1;
        if (p >= 0 && p != correct) counts[p] = (counts[p] ?? 0) + 1;
      }
      for (final c in counts.values) {
        if (c >= 2 && c * 2 >= runs.length) return {'q': q, 'number': q + 1, 'caught': 'most'};
      }
    }
    return null;
  }

  List<Json> _moments(_Game g, List<({String id, _Run run})> ordered, int? trapQ) {
    final trapIdx = trapQ;
    int? fastestHolder;
    var fastest = (q: -1, ms: 1 << 30, id: '');
    for (final x in ordered) {
      var prev = 0;
      for (var i = 0; i < g.count; i++) {
        final a = x.run.answers[i];
        if (a == null) continue;
        final took = a.elapsedMs - prev;
        prev = a.elapsedMs;
        if (a.correct == true && i != trapIdx && took < fastest.ms) fastest = (q: i, ms: took, id: x.id);
      }
    }
    fastestHolder = fastest.q >= 0 ? ordered.indexWhere((x) => x.id == fastest.id) : null;
    ({String id, _Run run})? quickest;
    for (final x in ordered) {
      if (x.run.answers.values.any((a) => a.pick < 0)) continue;
      final t = x.run.answers[g.count - 1]?.elapsedMs ?? 0;
      if (quickest == null || t < (quickest.run.answers[g.count - 1]?.elapsedMs ?? 0)) quickest = x;
    }
    final used = <String>{};
    final out = <Json>[];
    for (var idx = 0; idx < ordered.length; idx++) {
      final x = ordered[idx];
      Json? pick;
      final candidates = <Json Function()?>[
        x.run.right == g.count ? () => {'kind': 'all_right', 'count': g.count} : null,
        fastestHolder == idx ? () => {'kind': 'fastest_right', 'q': fastest.q, 'number': fastest.q + 1, 'seconds': (fastest.ms / 1000).round()} : null,
        quickest?.id == x.id ? () => {'kind': 'quickest_finish', 'count': g.count, 'seconds': ((x.run.answers[g.count - 1]?.elapsedMs ?? 0) / 1000).round()} : null,
        () {
          for (var i = 0; i + 2 < g.count; i++) {
            if (trapIdx != null && trapIdx >= i && trapIdx <= i + 2) continue;
            if ([0, 1, 2].every((d) => x.run.answers[i + d]?.correct == true)) return () => <String, dynamic>{'kind': 'three_in_a_row', 'from': i + 1, 'to': i + 3};
          }
          return null;
        }(),
        x.run.wrong == 0 ? () => {'kind': 'no_minus'} : null,
      ];
      for (final c in candidates) {
        if (c == null) continue;
        final j = c();
        if (used.contains(j['kind'])) continue;
        pick = j;
        break;
      }
      pick ??= {'kind': 'finished_all', 'count': g.count};
      if (pick['kind'] != 'finished_all') used.add(pick['kind'] as String);
      out.add({'memberId': x.id, ...pick});
    }
    return out;
  }

  DateTime _checkOpens(_Game g) {
    // The next Wednesday 12:00 AM IST at least 48 hours after close.
    final earliest = g.closesAt.add(const Duration(hours: 48)).add(const Duration(hours: 5, minutes: 30));
    var d = DateTime.utc(earliest.year, earliest.month, earliest.day);
    if (d.isBefore(earliest)) d = d.add(const Duration(days: 1));
    while (d.weekday != DateTime.wednesday) {
      d = d.add(const Duration(days: 1));
    }
    return d.subtract(const Duration(hours: 5, minutes: 30));
  }

  @override
  Future<Review> review(String id) async {
    final r = _game(id);
    final g = r.game;
    if (!g.closedAt(now)) throw _err('REVIEW_NOT_YET', 409, details: {'opensAt': _iso(g.closesAt)});
    final mine = g.runs[r.mob.you.id];
    final trap = _trapOf(g);
    final opens = _checkOpens(g);
    return Review.fromJson({
      'questions': [
        for (var i = 0; i < g.count; i++)
          {
            'q': i,
            'stem': mobV3Bank[g.questions[i]].stem,
            'options': mobV3Bank[g.questions[i]].options,
            'correctIndex': mobV3Bank[g.questions[i]].correct,
            'explanation': mobV3Bank[g.questions[i]].explanation,
            'yourPick': mine?.answers[i]?.pick,
          },
      ],
      'trap': trap == null
          ? null
          : {
              'q': trap['q'],
              'number': trap['number'],
              'caught': 'most',
              'fix': {
                'now': (g.fixes['now']?.containsKey(r.mob.you.id) ?? false) ? 'done' : 'open',
                'check': {'opensAt': _iso(opens), 'closesAt': _iso(opens.add(const Duration(days: 5)).subtract(const Duration(seconds: 1))), 'state': now.isBefore(opens) ? 'not_yet' : 'open'},
                'fixed': {'count': r.mob.trapsFixed, 'of': 3},
              },
            },
    });
  }

  @override
  Future<void> sticker({required String mob, String? game, required StickerKind kind}) async {
    final m = _mob(mob)!;
    m.reactions.insert(0, Reaction(memberId: m.you.id, kind: kind, at: now));
    if (m.reactions.length > 20) m.reactions.removeLast();
  }

  @override
  Future<int?> mic({required String mob, required String to}) async {
    if (billing == 'off') throw _err('BILLING_OFF', 409);
    if (billing != 'pro') throw _err('START_PRO', 402);
    final m = _mob(mob)!;
    if (to == m.you.id) throw _err('MIC_SELF', 422);
    if (_micsToGive <= 0) throw _err('MIC_LIMIT', 409);
    _micsToGive -= 1;
    return _micsToGive;
  }

  @override
  Future<Object?> stepOut({required String mob, required bool on}) async {
    final m = _mob(mob)!;
    if (m.questDoneAt != null) throw _err('STEP_OUT_DONE', 409);
    m.youSteppedOut = on;
    return _denJson();
  }

  @override
  Future<FixStart> fixStart({required String game, required int q, required String stage}) async {
    final r = _game(game);
    final g = r.game;
    if (!g.closedAt(now)) throw _err('FIX_NOT_YET', 409, details: {'opensAt': _iso(g.closesAt)});
    final opens = _checkOpens(g);
    if (stage == 'check' && now.isBefore(opens)) throw _err('FIX_NOT_YET', 409, details: {'opensAt': _iso(opens)});
    final trapQ = q;
    final bankIdx = g.questions[trapQ.clamp(0, g.count - 1)];
    final fresh = stage == 'now' ? 20 : 21;
    return FixStart.fromJson({
      'question': {'stem': mobV3Bank[fresh].stem, 'options': mobV3Bank[fresh].options, 'passage': null, 'answered': r.game.fixes[stage]?.containsKey(r.mob.you.id) ?? false},
      'trap': {'q': q, 'number': q + 1, 'why': mobV3Bank[bankIdx].explanation, 'yourPick': g.runs[r.mob.you.id]?.answers[trapQ]?.pick, 'correctIndex': mobV3Bank[bankIdx].correct},
    });
  }

  @override
  Future<FixAnswer> fixAnswer({required String game, required int q, required String stage, required int pick}) async {
    final r = _game(game);
    final fresh = stage == 'now' ? 20 : 21;
    final correct = pick == mobV3Bank[fresh].correct;
    r.game.fixes.putIfAbsent(stage, () => {})[r.mob.you.id] = correct;
    var fixedTogether = false;
    if (stage == 'check' && correct) {
      _fixesHeld += 1;
      final rights = r.game.fixes['check']!.values.where((v) => v).length;
      if (rights == 2) {
        r.mob.trapsFixed += 1;
        fixedTogether = true;
      }
    }
    return FixAnswer.fromJson({
      'correct': correct,
      'correctIndex': mobV3Bank[fresh].correct,
      'explanation': mobV3Bank[fresh].explanation,
      'fixedTogether': fixedTogether,
      'fixed': {'count': r.mob.trapsFixed, 'of': 3},
    });
  }

  @override
  Future<void> seen(List<String> keys) async => _seen.addAll(keys);

  // ---- The personal chain ------------------------------------------------------------------------------

  String _day(DateTime d) {
    String two(int v) => v.toString().padLeft(2, '0');
    return '${d.year}-${two(d.month)}-${two(d.day)}';
  }

  Json _chainJson() {
    final ist = now.add(const Duration(hours: 5, minutes: 30));
    final today = DateTime.utc(ist.year, ist.month, ist.day);
    final restedDay = today.subtract(const Duration(days: 4));
    final makeUp = scenario == 'makeup';
    final missedDay = today.subtract(const Duration(days: 1));
    final days = makeUp ? 0 : _chainDays;
    ChainDayState stateOf(DateTime d) {
      if (_pauseDays.contains(_day(d))) return ChainDayState.paused;
      if (d.isAfter(today)) return ChainDayState.none;
      if (d == today) return ChainDayState.today;
      if (makeUp && d == missedDay) return ChainDayState.open;
      if (d == restedDay) return ChainDayState.rested;
      if (today.difference(d).inDays <= _chainDays - (_todayAnswered >= 5 ? 1 : 0)) return ChainDayState.practised;
      return ChainDayState.none;
    }

    final monthStart = DateTime.utc(today.year, today.month - 1, 1);
    final monthEnd = DateTime.utc(today.year, today.month + 1, 1);
    const milestones = [(3, 'rest_pass'), (7, 'rest_pass'), (14, null), (21, 'rest_pass'), (30, 'foil'), (50, 'ribbon'), (75, 'ribbon'), (100, 'ribbon'), (150, 'ribbon')];
    final todayDone = _todayAnswered >= 5;
    return {
      'hidden': _chainHidden,
      'days': days,
      'practised': makeUp ? 0 : days - 1,
      'rested': makeUp ? 0 : 1,
      'madeUp': 0,
      'best': makeUp ? 23 : _chainBest,
      'today': {'answered': _todayAnswered, 'needed': 5, 'done': todayDone},
      'passes': {'held': makeUp ? 0 : 2, 'max': 2, 'next': {'kind': 'days', 'at': 21}},
      'week': [
        for (var i = 6; i >= 0; i--)
          () {
            final d = today.subtract(Duration(days: i));
            final s = stateOf(d);
            return <String, dynamic>{'day': _day(d), 'state': s == ChainDayState.today && todayDone ? 'practised' : _wire(s), if (i == 0) 'answered': _todayAnswered};
          }(),
      ],
      'calendar': [
        for (var d = monthStart; d.isBefore(monthEnd); d = d.add(const Duration(days: 1))) {'day': _day(d), 'state': _wire(stateOf(d))},
      ],
      'milestones': [
        for (final (at, reward) in milestones) {'at': at, 'reward': reward, 'done': _chainBest >= at, if (_chainBest < at) 'left': at - days},
      ],
      'makeUp': makeUp ? {'day': _day(missedDay), 'needed': 10, 'answeredToday': _todayAnswered} : null,
      'pause': {'days': _pauseDays, 'usedThisSeason': _pauseDays.length, 'max': 14},
      'notices': [
        if (!_seen.contains('rest:${_day(restedDay)}') && !makeUp) {'key': 'rest:${_day(restedDay)}', 'kind': 'rested', 'day': _day(restedDay), 'days': _chainDays},
      ],
      'due': [if (_chainDays == 14 && !_seen.contains('chain:14')) 'chain:14'],
      if (makeUp) 'brokeFrom': 23,
    };
  }

  String _wire(ChainDayState s) => switch (s) {
        ChainDayState.madeUp => 'made_up',
        _ => s.name,
      };

  @override
  Future<ChainState> chain() async => ChainState.fromJson(_chainJson());

  @override
  Future<ChainState> chainHidden(bool hidden) async {
    _chainHidden = hidden;
    return chain();
  }

  @override
  Future<ChainState> pause(List<String> days) async {
    final ist = now.add(const Duration(hours: 5, minutes: 30));
    final todayKey = _day(DateTime.utc(ist.year, ist.month, ist.day));
    if (days.any((d) => d.compareTo(todayKey) <= 0)) throw _err('PAUSE_PAST', 422);
    final next = {..._pauseDays, ...days};
    if (next.length > 14) throw _err('PAUSE_LIMIT', 409);
    _pauseDays
      ..clear()
      ..addAll(next.toList()..sort());
    return chain();
  }

  @override
  Future<ChainState> unpause(List<String> days) async {
    _pauseDays.removeWhere(days.contains);
    return chain();
  }

  // ---- Test and walk hooks -------------------------------------------------------------------------------

  /// Moves the clock past every open game's close (for the closed-game states).
  void closeAllGames() {
    var latest = now;
    for (final m in _mobs) {
      for (final g in m.games) {
        if (g.closesAt.isAfter(latest)) latest = g.closesAt;
      }
    }
    skew += latest.difference(now) + const Duration(minutes: 1);
  }
}
