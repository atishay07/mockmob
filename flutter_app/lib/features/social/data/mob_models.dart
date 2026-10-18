// The Mob, as the server sends it (SOCIAL-SPEC sections 6 and 15; the server's request and reply shapes
// are the fixtures in test/fixtures/mob, copied byte for byte from the website's data/tests/fixtures/mob).
// Parsed additively: an unknown field is ignored, a missing one takes a safe default, and nothing here
// ever invents a figure the server did not send. Which plan may open what is decided on the server and
// arrives in the view (`plan`, `compare.access`); the app only draws it and never grants anything.

import '../../../core/models/json_helpers.dart';

/// At most 5 members (P2).
const int mobMaxSize = 5;

/// What the paper costs, as the server quotes it. The weekly Mob paper is free of credits (`free`);
/// the other types stay readable so an older or newer server never breaks the screen.
enum MobCostType { free, included, allowance, credits, unknown }

class MobPaper {
  const MobPaper({this.count = 10, this.durationSec = 600, this.costType = MobCostType.unknown, this.credits, this.balance, this.freeUsed = false});

  factory MobPaper.fromJson(Json j) {
    final cost = asJson(j['cost']);
    return MobPaper(
      count: asInt(j['count']) ?? 10,
      durationSec: asInt(j['durationSec']) ?? 600,
      costType: switch (asString(cost['type'])) {
        'free' => MobCostType.free,
        'included' => MobCostType.included,
        'allowance' => MobCostType.allowance,
        'credits' => MobCostType.credits,
        _ => MobCostType.unknown,
      },
      credits: asInt(cost['credits']),
      balance: asInt(cost['balance']),
      // A free student gets one Mob paper a week, whichever Mob it is in; `blocked` says it was used.
      freeUsed: asString(j['blocked']) == 'free_used',
    );
  }

  final int count;
  final int durationSec;
  final MobCostType costType;
  final int? credits;
  final int? balance;

  /// This week's one free Mob paper went to another of the student's Mobs.
  final bool freeUsed;

  /// 10 minutes for 600 seconds: the runner's own clock (a Mob paper is 60 seconds a question).
  int get minutes => (durationSec / 60).round();

  /// A paper whose cost is a number of credits the student cannot cover. The weekly paper costs no
  /// credits on any plan, so this is only ever false if a server says otherwise; never sold here.
  bool get affordable => costType != MobCostType.credits || credits == null || balance == null || balance! >= credits!;
}

class MobMember {
  const MobMember({required this.memberId, required this.name, this.colour = 0, this.you = false, this.sat = false, this.score, this.maxScore, this.owner = false});

  factory MobMember.fromJson(Json j) {
    // The score arrives only when its owner chose to show it (P5): `{ value, of }`.
    final score = asJson(j['score']);
    return MobMember(
      memberId: asStringOr(j['memberId'], ''),
      name: asStringOr(j['name'], '').trim(),
      colour: (asInt(j['colour']) ?? 0).clamp(0, 7),
      you: asBool(j['you']) ?? false,
      sat: asBool(j['sat']) ?? false,
      score: asDouble(score['value']),
      maxScore: asDouble(score['of']),
      owner: asBool(j['owner']) ?? false,
    );
  }

  final String memberId;
  final String name;
  final int colour;
  final bool you;
  final bool sat;
  final bool owner;

  /// Only present when this member chose to show it.
  final double? score;
  final double? maxScore;

  String get initial {
    final t = name.trim();
    if (t.isEmpty) return '?';
    return String.fromCharCode(t.runes.first).toUpperCase();
  }

  /// "7 of 10", or null when the member keeps the score private.
  String? get scoreLine {
    final s = score;
    if (s == null) return null;
    String n(double v) => v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(1);
    final m = maxScore;
    return m == null ? n(s) : '${n(s)} of ${n(m)}';
  }
}

class MobYou {
  const MobYou({this.memberId = '', this.name = '', this.colour = 0, this.owner = false, this.showScore = false, this.nudgesMuted = false});

  factory MobYou.fromJson(Json j) => MobYou(
        memberId: asStringOr(j['memberId'], ''),
        name: asStringOr(j['name'], ''),
        colour: (asInt(j['colour']) ?? 0).clamp(0, 7),
        owner: asString(j['role']) == 'owner',
        showScore: asBool(j['showScore']) ?? false,
        nudgesMuted: asBool(j['nudgesMuted']) ?? false,
      );

  final String memberId;
  final String name;
  final int colour;
  final bool owner;

  /// The Mob's "Share my score and answers" switch (stored as `show_score` on the server).
  final bool showScore;
  final bool nudgesMuted;
}

/// What the account's plan lets the student do in the Mob (17 Oct decision). Free STARTS one Mob and
/// joins any number by invite; Pro starts up to 3 and also gets extra papers, the full side-by-side
/// and the history. `maxMobs` is how many Mobs the plan lets the student start, `started` how many
/// of their Mobs they started, `mobCount` how many Mobs they are in (started or joined).
class MobPlan {
  const MobPlan({this.pro = false, this.maxMobs = 1, this.mobCount = 1, this.started, this.canMakeExtra = false, this.canStartAnother = false});

  factory MobPlan.fromJson(Json j) => MobPlan(
        pro: asBool(j['pro']) ?? false,
        maxMobs: asInt(j['maxMobs']) ?? 1,
        mobCount: asInt(j['mobCount']) ?? 1,
        // Older servers do not send it: then the app does not guess which Mobs the student started.
        started: asInt(j['started']),
        canMakeExtra: asBool(j['canMakeExtra']) ?? false,
        canStartAnother: asBool(j['canStartAnother']) ?? false,
      );

  final bool pro;
  final int maxMobs;
  final int mobCount;
  final int? started;
  final bool canMakeExtra;
  final bool canStartAnother;

  /// The student has started none of the Mobs they are in (they joined friends'): the key to start
  /// their own says "Start your own Mob", not "Start another".
  bool get startedNone => started == 0;

  /// Pro, and every Mob the plan lets them start is started: no start key, and one quiet line says why.
  bool get atProCap => pro && started != null && started! >= maxMobs && !canStartAnother;
}

/// One of the student's Mobs, for the switcher. Every call names its Mob by this id.
class MobRef {
  const MobRef({required this.id, required this.subject, required this.subjectName, this.active = false});

  factory MobRef.fromJson(Json j) {
    final subject = asStringOr(j['subject'], '');
    return MobRef(
      id: asStringOr(j['id'], ''),
      subject: subject,
      subjectName: asString(j['subjectName']) ?? subjectNameOf(subject),
      active: asBool(j['active']) ?? false,
    );
  }

  final String id;
  final String subject;
  final String subjectName;
  final bool active;
}

class MobWeek {
  const MobWeek({this.start, this.closesAt, this.paper = const MobPaper(), this.sat = 0, this.size = 1, this.youSat = false, this.yourResultId, this.closedFlag = false});

  factory MobWeek.fromJson(Json j) {
    final size = (asInt(j['size']) ?? 1).clamp(1, mobMaxSize);
    return MobWeek(
      start: asDate(j['start']),
      closesAt: asDate(j['closesAt']),
      paper: MobPaper.fromJson(asJson(j['paper'])),
      sat: (asInt(j['sat']) ?? 0).clamp(0, size),
      size: size,
      youSat: asBool(j['youSat']) ?? false,
      yourResultId: asString(j['yourResultId']),
      closedFlag: asBool(j['closed']) ?? false,
    );
  }

  final DateTime? start;
  final DateTime? closesAt;
  final MobPaper paper;
  final int sat;
  final int size;
  final bool youSat;
  final String? yourResultId;
  final bool closedFlag;

  bool closedAt(DateTime now) => closedFlag || (closesAt != null && now.isAfter(closesAt!));
  bool get complete => size > 1 && sat >= size;

  /// The week's Monday as `YYYY-MM-DD`, the key a "seen" memory or a once-a-week moment hangs on
  /// and the value the compare route takes.
  String get key {
    final s = start;
    if (s == null) return 'unknown';
    String two(int v) => v.toString().padLeft(2, '0');
    return '${s.year}-${two(s.month)}-${two(s.day)}';
  }
}

/// The shared trap (P7): aggregate only, never who picked it.
class MobTrap {
  const MobTrap({
    required this.questionNumber,
    this.questionId,
    required this.option,
    required this.count,
    required this.of,
    this.trapName,
    this.youPickedIt = false,
    this.youGotItRight = false,
  });

  static MobTrap? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final q = asInt(j['questionNumber']);
    final count = asInt(j['count']);
    final of = asInt(j['of']);
    final letter = asString(j['option']);
    if (q == null || count == null || of == null || letter == null || letter.isEmpty) return null;
    // The server applies P7 already; the app refuses a payload that breaks it rather than show it.
    if (of < 3 || count < 2 || count * 2 < of) return null;
    final name = asString(j['trapName'])?.trim();
    return MobTrap(
      questionNumber: q,
      questionId: asString(j['questionId']),
      option: letter,
      count: count,
      of: of,
      trapName: name == null || name.isEmpty ? null : name,
      youPickedIt: asBool(j['youPickedIt']) ?? false,
      youGotItRight: asBool(j['youGotItRight']) ?? false,
    );
  }

  final int questionNumber;
  final String? questionId;
  final String option;
  final int count;
  final int of;
  final String? trapName;

  /// This student picked the trap option too ("Repair it").
  final bool youPickedIt;

  /// This student got the question right ("See why B is wrong").
  final bool youGotItRight;
}

/// "You and 1 other member both got the same 6 questions right": a count and one shared miss. Never
/// who did better, never a member who keeps their score private.
class MobTogether {
  const MobTogether({required this.withCount, required this.sameRight, required this.of, this.sharedMiss});

  static MobTogether? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final w = asInt(j['with']);
    final s = asInt(j['sameRight']);
    final of = asInt(j['of']);
    if (w == null || w < 1 || s == null || of == null || of < 1) return null;
    return MobTogether(withCount: w, sameRight: s, of: of, sharedMiss: asInt(j['sharedMiss']));
  }

  final int withCount;
  final int sameRight;
  final int of;
  final int? sharedMiss;
}

/// What the plan lets the student open next to the teaser.
///   full    Pro: every week, every Mob
///   sample  free: the one free first side-by-side is this paper's, and it stays open
///   offer   free, and the one free side-by-side is still unused: opening it uses it
///   locked  free, and the free one went to another week
enum MobCompareAccess { full, sample, offer, locked, unknown }

/// "You and Riya split on 3 questions" (one line, never who was right).
class MobTeaser {
  const MobTeaser({required this.split, required this.of, this.withName, required this.text});

  static MobTeaser? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final split = asInt(j['split']);
    final of = asInt(j['of']);
    final text = asString(j['text'])?.trim();
    if (split == null || of == null || text == null || text.isEmpty) return null;
    return MobTeaser(split: split, of: of, withName: asString(j['with']), text: text);
  }

  final int split;
  final int of;
  final String? withName;

  /// The server's own sentence.
  final String text;
}

class MobCompareSummary {
  const MobCompareSummary({this.available = false, this.access = MobCompareAccess.unknown, this.youShare = false, this.needsShare = false, this.teaser});

  static MobCompareSummary? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return MobCompareSummary(
      available: asBool(j['available']) ?? false,
      access: switch (asString(j['access'])) {
        'full' => MobCompareAccess.full,
        'sample' => MobCompareAccess.sample,
        'offer' => MobCompareAccess.offer,
        'locked' => MobCompareAccess.locked,
        _ => MobCompareAccess.unknown,
      },
      youShare: asBool(j['youShare']) ?? false,
      needsShare: asBool(j['needsShare']) ?? false,
      teaser: MobTeaser.fromJson(j['teaser']),
    );
  }

  final bool available;
  final MobCompareAccess access;
  final bool youShare;
  final bool needsShare;
  final MobTeaser? teaser;

  /// The side-by-side opens now: Pro, the sample week, or the free one that is still unused and has
  /// something to read (you share and another sitter does too).
  bool get canOpen => available && (access == MobCompareAccess.full || access == MobCompareAccess.sample || (access == MobCompareAccess.offer && !needsShare));

  bool get locked => access == MobCompareAccess.locked;
}

/// An extra paper (Pro makes them; any member sits them). It closes 7 days after it was made.
class MobExtra {
  const MobExtra({
    required this.id,
    this.chapter,
    this.count = 10,
    this.createdByYou = false,
    this.closesAt,
    this.closed = false,
    this.sat = 0,
    this.youSat = false,
    this.yourResultId,
    this.compare,
  });

  factory MobExtra.fromJson(Json j) => MobExtra(
        id: asStringOr(j['id'], ''),
        chapter: asString(j['chapter']),
        count: asInt(j['count']) ?? 10,
        createdByYou: asBool(j['createdByYou']) ?? false,
        closesAt: asDate(j['closesAt']),
        closed: asBool(j['closed']) ?? false,
        sat: asInt(j['sat']) ?? 0,
        youSat: asBool(j['youSat']) ?? false,
        yourResultId: asString(j['yourResultId']),
        compare: MobCompareSummary.fromJson(j['compare']),
      );

  final String id;
  final String? chapter;
  final int count;
  final bool createdByYou;
  final DateTime? closesAt;
  final bool closed;
  final int sat;
  final bool youSat;
  final String? yourResultId;
  final MobCompareSummary? compare;
}

/// Why the nudge key is on or off, as the server says it.
enum MobNudgeReason { none, notSat, sent, everyoneSat, closed }

class MobNudge {
  const MobNudge({this.canSend = false, this.reason = MobNudgeReason.none, this.receivedFrom});

  factory MobNudge.fromJson(Json j) {
    final received = j['received'];
    final from = received is Map ? asString(asJson(received)['fromName'])?.trim() : null;
    return MobNudge(
      canSend: asBool(j['canSend']) ?? false,
      reason: switch (asString(j['reason'])) {
        'not_sat' => MobNudgeReason.notSat,
        'sent' => MobNudgeReason.sent,
        'everyone_sat' => MobNudgeReason.everyoneSat,
        'closed' => MobNudgeReason.closed,
        _ => MobNudgeReason.none,
      },
      receivedFrom: from == null || from.isEmpty ? null : from,
    );
  }

  final bool canSend;
  final MobNudgeReason reason;
  final String? receivedFrom;
}

class MobInvite {
  const MobInvite({required this.code, required this.url, this.expiresAt, this.usesLeft});

  static MobInvite? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final code = asString(j['code']);
    if (code == null || code.isEmpty) return null;
    return MobInvite(
      code: code,
      url: asString(j['url']) ?? 'https://www.mockmob.in/join/$code',
      expiresAt: asDate(j['expiresAt']),
      usesLeft: asInt(j['usesLeft']),
    );
  }

  final String code;
  final String url;
  final DateTime? expiresAt;
  final int? usesLeft;
}

class Mob {
  const Mob({
    this.id = '',
    required this.subject,
    this.subjectLabel,
    this.plan = const MobPlan(),
    this.mobs = const [],
    this.you = const MobYou(),
    this.members = const [],
    this.week = const MobWeek(),
    this.trap,
    this.together,
    this.compare,
    this.extras = const [],
    this.pastWeeks = 0,
    this.nudge = const MobNudge(),
    this.invite,
    this.invitesPaused = false,
  });

  factory Mob.fromJson(Json j) {
    final members = [for (final m in asJsonList(j['members'])) MobMember.fromJson(m)];
    return Mob(
      id: asStringOr(j['id'], ''),
      subject: asStringOr(j['subject'], ''),
      subjectLabel: asString(j['subjectName']),
      plan: MobPlan.fromJson(asJson(j['plan'])),
      mobs: [for (final m in asJsonList(j['mobs'])) MobRef.fromJson(m)],
      you: MobYou.fromJson(asJson(j['you'])),
      // Join order, as sent (P5). Never re-sorted here.
      members: members.length > mobMaxSize ? members.sublist(0, mobMaxSize) : members,
      week: MobWeek.fromJson(asJson(j['week'])),
      trap: MobTrap.fromJson(j['trap']),
      together: MobTogether.fromJson(j['together']),
      compare: MobCompareSummary.fromJson(j['compare']),
      extras: [for (final x in asJsonList(j['extras'])) MobExtra.fromJson(x)],
      pastWeeks: asInt(j['pastWeeks']) ?? 0,
      nudge: MobNudge.fromJson(asJson(j['nudge'])),
      invite: MobInvite.fromJson(j['invite']),
      // Sent only while the owner's stop rule has paused new invites (MOB_INVITES_ENABLED=false); the
      // invite is then null and the Mob works as before.
      invitesPaused: asBool(j['invitesPaused']) ?? false,
    );
  }

  final String id;
  final String subject;
  final String? subjectLabel;
  final MobPlan plan;
  final List<MobRef> mobs;
  final MobYou you;
  final List<MobMember> members;
  final MobWeek week;
  final MobTrap? trap;
  final MobTogether? together;
  final MobCompareSummary? compare;
  final List<MobExtra> extras;
  final int pastWeeks;
  final MobNudge nudge;
  final MobInvite? invite;

  /// New invite links and joining by link are paused on the server. Say so; offer no invite key.
  final bool invitesPaused;

  /// A new member may be invited now: there is a seat and the invites are not paused.
  bool get canInvite => seatsLeft > 0 && !invitesPaused;

  /// "Business Studies" from `business_studies` when the server sent no label.
  String get subjectName {
    final label = subjectLabel?.trim();
    if (label != null && label.isNotEmpty) return label;
    return subjectNameOf(subject);
  }

  int get seatsLeft => (mobMaxSize - members.length).clamp(0, mobMaxSize);
  bool get alone => members.length <= 1;
  bool get several => mobs.length > 1;

  /// The trap shows only to a member who has sat, with 3 or more sitters (P7); the server also
  /// leaves it out for a free student outside the sample week.
  MobTrap? get visibleTrap => week.youSat && week.sat >= 3 ? trap : null;
}

/// "Business Studies" from `business_studies`.
String subjectNameOf(String subject) => subject
    .split('_')
    .where((w) => w.isNotEmpty)
    .map((w) => w[0].toUpperCase() + w.substring(1))
    .join(' ');

/// `GET /api/mob` and every reply that carries the same shape (create, join, patch, remove): `{ mob:
/// null }` or `{ mob: {...} }`.
class MobRead {
  const MobRead(this.mob);

  factory MobRead.fromJson(Json j) {
    final raw = j['mob'];
    return MobRead(raw is Map ? Mob.fromJson(asJson(raw)) : null);
  }

  final Mob? mob;
}

/// One member's pick on one question, from the side-by-side.
class MobPick {
  const MobPick({this.picked, this.right, this.changed, this.seconds});

  factory MobPick.fromJson(Json j) => MobPick(
        picked: asString(j['picked']),
        right: asBool(j['right']),
        changed: asInt(j['changed']),
        seconds: asInt(j['seconds']),
      );

  final String? picked;
  final bool? right;

  /// How many times the answer changed (null when the paper's record did not keep it).
  final int? changed;
  final int? seconds;
}

/// A member's row on one question. Only members who share their answers appear (and only when the
/// student shares theirs): sharing is reciprocal, and nobody is ranked.
class MobOtherPick {
  const MobOtherPick({required this.memberId, required this.name, this.colour = 0, required this.pick});

  factory MobOtherPick.fromJson(Json j) => MobOtherPick(
        memberId: asStringOr(j['memberId'], ''),
        name: asStringOr(j['name'], '').trim(),
        colour: (asInt(j['colour']) ?? 0).clamp(0, 7),
        pick: MobPick.fromJson(j),
      );

  final String memberId;
  final String name;
  final int colour;
  final MobPick pick;

  String get initial {
    final t = name.trim();
    return t.isEmpty ? '?' : String.fromCharCode(t.runes.first).toUpperCase();
  }
}

/// How the whole Mob picked a question: a count per option, no names (needs 3 sitters).
class MobPickCount {
  const MobPickCount({this.option, required this.count});

  final String? option;
  final int count;
}

class MobCompareTrap {
  const MobCompareTrap({required this.option, required this.count, required this.of, this.trapName});

  final String option;
  final int count;
  final int of;
  final String? trapName;
}

class MobCompareQuestion {
  const MobCompareQuestion({
    required this.number,
    required this.id,
    this.stem = '',
    this.key,
    this.you,
    this.others = const [],
    this.picks,
    this.split,
    this.trap,
  });

  factory MobCompareQuestion.fromJson(Json j) {
    final picks = j['picks'];
    final trap = j['trap'];
    final trapJson = trap is Map ? asJson(trap) : null;
    return MobCompareQuestion(
      number: asInt(j['number']) ?? 0,
      id: asStringOr(j['id'], ''),
      stem: asStringOr(j['stem'], ''),
      key: asString(j['key']),
      you: j['you'] is Map ? MobPick.fromJson(asJson(j['you'])) : null,
      others: [for (final o in asJsonList(j['others'])) MobOtherPick.fromJson(o)],
      picks: picks is List ? [for (final p in asJsonList(picks)) MobPickCount(option: asString(p['option']), count: asInt(p['count']) ?? 0)] : null,
      split: asBool(j['split']),
      trap: trapJson == null || asString(trapJson['option']) == null
          ? null
          : MobCompareTrap(
              option: asString(trapJson['option'])!,
              count: asInt(trapJson['count']) ?? 0,
              of: asInt(trapJson['of']) ?? 0,
              trapName: asString(trapJson['trapName']),
            ),
    );
  }

  final int number;
  final String id;
  final String stem;
  final String? key;
  final MobPick? you;
  final List<MobOtherPick> others;
  final List<MobPickCount>? picks;

  /// Whether the Mob split on this question; null when too few sitters share for it to be said.
  final bool? split;
  final MobCompareTrap? trap;
}

/// `GET /api/mob/compare`: the side-by-side of one paper.
class MobCompare {
  const MobCompare({
    this.kind = 'weekly',
    this.week = '',
    this.extraId,
    this.chapter,
    this.access = MobCompareAccess.unknown,
    this.youShare = false,
    this.sat = 0,
    this.size = 0,
    this.hidden = 0,
    this.teaser,
    this.questions = const [],
    this.mobId = '',
    this.yourResultId,
  });

  factory MobCompare.fromJson(Json j) {
    final c = j.containsKey('compare') ? asJson(j['compare']) : j;
    return MobCompare(
      kind: asStringOr(c['kind'], 'weekly'),
      week: asStringOr(c['week'], ''),
      extraId: asString(c['extraId']),
      chapter: asString(c['chapter']),
      access: MobCompareSummary.fromJson({'access': c['access']})!.access,
      youShare: asBool(c['youShare']) ?? false,
      sat: asInt(c['sat']) ?? 0,
      size: asInt(c['size']) ?? 0,
      hidden: asInt(c['hidden']) ?? 0,
      teaser: MobTeaser.fromJson(c['teaser']),
      questions: [for (final q in asJsonList(c['questions'])) MobCompareQuestion.fromJson(q)],
      mobId: asStringOr(c['mobId'], ''),
      yourResultId: asString(c['yourResultId']),
    );
  }

  final String kind;
  final String week;
  final String? extraId;
  final String? chapter;
  final MobCompareAccess access;
  final bool youShare;
  final int sat;
  final int size;

  /// Sitters you are not shown, because they keep their answers private (or you do). Counted, never named.
  final int hidden;
  final MobTeaser? teaser;
  final List<MobCompareQuestion> questions;
  final String mobId;
  final String? yourResultId;

  bool get isExtra => kind == 'extra';
}

/// One closed week of the Mob (Pro).
class MobHistoryWeek {
  const MobHistoryWeek({required this.week, this.closedAt, this.sat = 0, this.extras = 0, this.youSat = false, this.score, this.scoreOf, this.resultId});

  factory MobHistoryWeek.fromJson(Json j) {
    final you = asJson(j['you']);
    final score = asJson(you['score']);
    return MobHistoryWeek(
      week: asStringOr(j['week'], ''),
      closedAt: asDate(j['closedAt']),
      sat: asInt(j['sat']) ?? 0,
      extras: asInt(j['extras']) ?? 0,
      youSat: asBool(you['sat']) ?? false,
      score: asInt(score['value']),
      scoreOf: asInt(score['of']),
      resultId: asString(you['resultId']),
    );
  }

  /// The week's Monday, `YYYY-MM-DD`.
  final String week;
  final DateTime? closedAt;
  final int sat;
  final int extras;
  final bool youSat;
  final int? score;
  final int? scoreOf;
  final String? resultId;
}

/// `GET /api/mob/history` (Pro).
class MobHistory {
  const MobHistory({this.mobId = '', this.weeks = const []});

  factory MobHistory.fromJson(Json j) => MobHistory(
        mobId: asStringOr(j['mobId'], ''),
        weeks: [for (final w in asJsonList(j['weeks'])) MobHistoryWeek.fromJson(w)],
      );

  final String mobId;
  final List<MobHistoryWeek> weeks;
}

/// `GET /api/mob/join/<code>`: no names of members, ever. A signed-in student also gets `inviter`
/// (the first name of whoever made the link).
class MobInvitePreview {
  const MobInvitePreview({required this.code, required this.subject, this.subjectLabel, required this.size, required this.seatsLeft, this.expiresAt, this.inviter});

  factory MobInvitePreview.fromJson(Json j) {
    final inviter = asString(j['inviter'])?.trim();
    return MobInvitePreview(
      code: asStringOr(j['code'], ''),
      subject: asStringOr(j['subject'], ''),
      subjectLabel: asString(j['subjectName']),
      size: (asInt(j['size']) ?? 1).clamp(1, mobMaxSize),
      seatsLeft: (asInt(j['seatsLeft']) ?? 0).clamp(0, mobMaxSize),
      expiresAt: asDate(j['expiresAt']),
      inviter: inviter == null || inviter.isEmpty ? null : inviter,
    );
  }

  final String code;
  final String subject;
  final String? subjectLabel;
  final int size;
  final int seatsLeft;
  final DateTime? expiresAt;
  final String? inviter;

  String get subjectName => Mob(subject: subject, subjectLabel: subjectLabel).subjectName;
}

/// The reply of `POST /api/mob/extra`: the Mob's view plus the new paper's id.
class MobExtraMade {
  const MobExtraMade(this.read, this.extraId);

  factory MobExtraMade.fromJson(Json j) => MobExtraMade(MobRead.fromJson(j), asString(j['extraId']));

  final MobRead read;
  final String? extraId;
}

/// One chapter the extra-paper chooser offers: `ready` questions the bank can really use and
/// `longest`, the longest paper (5, 10, 15 or 20) this chapter can build.
class MobChapter {
  const MobChapter({required this.chapter, required this.ready, this.longest});

  static MobChapter? fromJson(Json j) {
    final name = asString(j['chapter'])?.trim();
    if (name == null || name.isEmpty) return null;
    return MobChapter(chapter: name, ready: asInt(j['ready']) ?? 0, longest: asInt(j['longest']));
  }

  final String chapter;
  final int ready;
  final int? longest;
}

/// `GET /api/mob/extra?mob=` (Pro): the lengths a paper may have and the chapters of the Mob's
/// subject the bank can build a paper from, most questions first. A chapter the bank cannot build a
/// paper from is not listed; the whole subject always works.
class MobChapters {
  const MobChapters({this.mobId = '', this.lengths = const [5, 10, 15, 20], this.chapters = const []});

  factory MobChapters.fromJson(Json j) => MobChapters(
        mobId: asStringOr(j['mobId'], ''),
        lengths: [
          for (final n in j['lengths'] is List ? j['lengths'] as List : const []) if (n is num) n.toInt(),
        ].where((n) => n > 0).toList(),
        chapters: [
          for (final c in asJsonList(j['chapters'])) ?MobChapter.fromJson(c),
        ],
      );

  final String mobId;
  final List<int> lengths;
  final List<MobChapter> chapters;

  MobChapter? named(String? chapter) {
    if (chapter == null) return null;
    for (final c in chapters) {
      if (c.chapter == chapter) return c;
    }
    return null;
  }
}

/// The nearest paper the bank can build, when it cannot build the one asked for (BANK_THIN's
/// `detail.suggest`): the same chapter at a shorter length, or the whole subject (`chapter` null).
class MobSuggestion {
  const MobSuggestion({this.chapter, required this.count, this.ready, this.asked});

  final String? chapter;
  final int count;

  /// Questions ready for what was asked, and the length that was asked.
  final int? ready;
  final int? asked;
}

/// Display names (P3): 2 to 18 characters, a letter first, then letters, marks (vowel signs in
/// Indian scripts), spaces, dots, apostrophes and hyphens. The server's blocklist is the final word.
final RegExp _nameRule = RegExp(r"^\p{L}[\p{L}\p{M} .'\-]{1,17}$", unicode: true);

bool isValidMobName(String raw) => _nameRule.hasMatch(raw.trim().replaceAll(RegExp(r'\s+'), ' '));

/// The Mob name to prefill from the account's display name, or '' when none would pass
/// [isValidMobName] (the field then stays empty with its hint). A prefilled name must never fail the
/// screen's own rule (owner walk, 18 Oct: "app-e2e-student" did).
///
/// A plain name ("Asha Verma") gives its first word. A handle or an email ("asha.verma99@gmail.com",
/// "app-e2e-student") is cut at every character that is not a letter, and its first part of 2 or
/// more letters is used ("Asha", "App"). Anything left is trimmed to 18 characters, and a lower-case
/// first letter is raised. Digits alone give ''.
String mobNameFrom(String? display) {
  var raw = (display ?? '').trim();
  if (raw.isEmpty) return '';
  final handle = raw.contains('@') || RegExp(r'[\d_]').hasMatch(raw);
  if (raw.contains('@')) raw = raw.substring(0, raw.indexOf('@'));
  final parts = handle
      ? raw.split(RegExp(r'[^\p{L}\p{M}]+', unicode: true))
      : raw.split(RegExp(r'\s+')).map((w) => w.replaceAll(RegExp(r"[^\p{L}\p{M}.'\-]", unicode: true), ''));
  for (final part in parts) {
    var name = part.replaceFirst(RegExp(r'^[^\p{L}]+', unicode: true), '');
    if (name.length > 18) name = name.substring(0, 18);
    name = name.replaceFirst(RegExp(r"[ .'\-]+$"), '');
    if (name.isEmpty) continue;
    name = name[0].toUpperCase() + name.substring(1);
    if (isValidMobName(name)) return name;
  }
  return '';
}

/// Crockford base32, 8 characters (P1). Lower case and the look-alikes I, L and O are read as
/// the server reads them.
String? normaliseInviteCode(String raw) {
  final s = raw.trim().toUpperCase().replaceAll(RegExp(r'[\s-]+'), '').replaceAll('O', '0').replaceAll(RegExp(r'[IL]'), '1');
  return RegExp(r'^[0-9A-HJKMNP-TV-Z]{8}$').hasMatch(s) ? s : null;
}

/// The code from `https://www.mockmob.in/join/<code>` (or a bare code).
String? inviteCodeFromLink(String link) {
  final uri = Uri.tryParse(link.trim());
  if (uri != null && uri.pathSegments.length >= 2 && uri.pathSegments[uri.pathSegments.length - 2] == 'join') {
    return normaliseInviteCode(uri.pathSegments.last);
  }
  return normaliseInviteCode(link);
}

/// A uuid, as the server names a Mob or an extra paper.
final RegExp _uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', caseSensitive: false);

bool isMobId(String? v) => v != null && _uuid.hasMatch(v);
