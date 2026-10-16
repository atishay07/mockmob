// The Mob (SOCIAL-SPEC section 6): `GET /api/mob` and the replies that carry the same shape.
// Parsed additively: an unknown field is ignored, a missing one takes a safe default, and nothing
// here ever invents a figure the server did not send. Built against the spec's API section; the
// server contract file (SOCIAL-APP-CONTRACT.json) did not exist when this was written.

import '../../../core/models/json_helpers.dart';

/// At most 5 members (P2).
const int mobMaxSize = 5;

/// What a Mob paper costs, exactly as the server quotes it. The Mob itself never prices or sells
/// anything: the app shows only whether the paper is included, and leaves any charge to the
/// practice confirm step that already states it (AGENT_RULES 19 and 23).
enum MobCostType { included, allowance, credits, unknown }

class MobPaper {
  const MobPaper({this.count = 10, this.durationSec = 720, this.costType = MobCostType.unknown});

  factory MobPaper.fromJson(Json j) {
    final cost = asJson(j['cost']);
    return MobPaper(
      count: asInt(j['count']) ?? 10,
      durationSec: asInt(j['durationSec']) ?? 720,
      costType: switch (asString(cost['type'])) {
        'included' => MobCostType.included,
        'allowance' => MobCostType.allowance,
        'credits' => MobCostType.credits,
        _ => MobCostType.unknown,
      },
    );
  }

  final int count;
  final int durationSec;
  final MobCostType costType;

  /// About 12 minutes for 720 seconds.
  int get minutes => (durationSec / 60).round();
}

class MobMember {
  const MobMember({required this.memberId, required this.name, this.colour = 0, this.you = false, this.sat = false, this.score, this.maxScore});

  factory MobMember.fromJson(Json j) {
    final score = j['score'];
    // The score arrives only when its owner opted in (P5). "7 of 10" may come as a number with a
    // separate max, or as {score, max}.
    double? s;
    double? m;
    if (score is num) {
      s = score.toDouble();
      m = asDouble(j['maxScore']);
    } else if (score is Map) {
      final sj = asJson(score);
      s = asDouble(sj['score']) ?? asDouble(sj['value']);
      m = asDouble(sj['max']) ?? asDouble(sj['maxScore']) ?? asDouble(sj['of']);
    }
    return MobMember(
      memberId: asStringOr(j['memberId'], ''),
      name: asStringOr(j['name'], '').trim(),
      colour: (asInt(j['colour']) ?? asInt(j['color']) ?? 0).clamp(0, 7),
      you: asBool(j['you']) ?? false,
      sat: asBool(j['sat']) ?? false,
      score: s,
      maxScore: m,
    );
  }

  final String memberId;
  final String name;
  final int colour;
  final bool you;
  final bool sat;

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
  final bool showScore;
  final bool nudgesMuted;
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
  bool get complete => size > 0 && sat >= size;

  /// The key a "seen" memory or a once-a-week moment hangs on.
  String get key => start == null ? 'unknown' : '${start!.year}-${start!.month}-${start!.day}';
}

/// The shared trap (P7): aggregate only, never who picked it.
class MobTrap {
  const MobTrap({required this.questionNumber, this.questionId, required this.option, required this.count, required this.of, this.trapName, this.youPickedIt});

  static MobTrap? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final q = asInt(j['questionNumber']);
    final count = asInt(j['count']);
    final of = asInt(j['of']);
    final option = j['option'];
    final letter = option is int ? optionLetter(option) : asString(option);
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
      youPickedIt: asBool(j['youPickedIt']) ?? asBool(j['youGotItWrong']),
    );
  }

  final int questionNumber;
  final String? questionId;
  final String option;
  final int count;
  final int of;
  final String? trapName;

  /// True when this student picked the trap too (then "Repair it"), false when they got it right
  /// ("See why B is wrong"), null when the server did not say.
  final bool? youPickedIt;
}

String? optionLetter(int index) => index >= 0 && index < 26 ? String.fromCharCode(65 + index) : null;

class MobNudge {
  const MobNudge({this.canSend = false, this.receivedFrom});

  factory MobNudge.fromJson(Json j) {
    final received = j['received'];
    final from = received is Map ? asString(asJson(received)['fromName'])?.trim() : null;
    return MobNudge(canSend: asBool(j['canSend']) ?? false, receivedFrom: from == null || from.isEmpty ? null : from);
  }

  final bool canSend;
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
    required this.subject,
    this.subjectLabel,
    this.you = const MobYou(),
    this.members = const [],
    this.week = const MobWeek(),
    this.trap,
    this.nudge = const MobNudge(),
    this.invite,
  });

  factory Mob.fromJson(Json j) {
    final members = [for (final m in asJsonList(j['members'])) MobMember.fromJson(m)];
    return Mob(
      subject: asStringOr(j['subject'], ''),
      subjectLabel: asString(j['subjectLabel']),
      you: MobYou.fromJson(asJson(j['you'])),
      // Join order, as sent (P5). Never re-sorted here.
      members: members.length > mobMaxSize ? members.sublist(0, mobMaxSize) : members,
      week: MobWeek.fromJson(asJson(j['week'])),
      trap: MobTrap.fromJson(j['trap']),
      nudge: MobNudge.fromJson(asJson(j['nudge'])),
      invite: MobInvite.fromJson(j['invite']),
    );
  }

  final String subject;
  final String? subjectLabel;
  final MobYou you;
  final List<MobMember> members;
  final MobWeek week;
  final MobTrap? trap;
  final MobNudge nudge;
  final MobInvite? invite;

  /// "Business Studies" from `business_studies` when the server sent no label.
  String get subjectName {
    final label = subjectLabel?.trim();
    if (label != null && label.isNotEmpty) return label;
    return subject
        .split('_')
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase() + w.substring(1))
        .join(' ');
  }

  int get seatsLeft => (mobMaxSize - members.length).clamp(0, mobMaxSize);
  bool get alone => members.length <= 1;

  /// The trap shows only to a member who has sat, with 3 or more sitters (P7).
  MobTrap? get visibleTrap => week.youSat && week.sat >= 3 ? trap : null;
}

/// `GET /api/mob`: `{ mob: null }` or `{ mob: {...} }`. A body without a `mob` key reads as the
/// Mob itself (some replies send the inner shape).
class MobRead {
  const MobRead(this.mob);

  factory MobRead.fromJson(Json j) {
    if (j.containsKey('mob')) {
      final raw = j['mob'];
      return MobRead(raw is Map ? Mob.fromJson(asJson(raw)) : null);
    }
    return MobRead(j.containsKey('members') ? Mob.fromJson(j) : null);
  }

  final Mob? mob;
}

/// `GET /api/mob/join/<code>`: no names, ever.
class MobInvitePreview {
  const MobInvitePreview({required this.subject, this.subjectLabel, required this.size, required this.seatsLeft, this.expiresAt});

  factory MobInvitePreview.fromJson(Json j) => MobInvitePreview(
        subject: asStringOr(j['subject'], ''),
        subjectLabel: asString(j['subjectLabel']),
        size: (asInt(j['size']) ?? 1).clamp(1, mobMaxSize),
        seatsLeft: (asInt(j['seatsLeft']) ?? 0).clamp(0, mobMaxSize),
        expiresAt: asDate(j['expiresAt']),
      );

  final String subject;
  final String? subjectLabel;
  final int size;
  final int seatsLeft;
  final DateTime? expiresAt;

  String get subjectName => Mob(subject: subject, subjectLabel: subjectLabel).subjectName;
}

/// Display names (P3): 2 to 18 characters, a letter first, then letters, spaces, dots,
/// apostrophes and hyphens. The server's blocklist is the final word.
final RegExp _nameRule = RegExp(r"^\p{L}[\p{L} .'\-]{1,17}$", unicode: true);

bool isValidMobName(String raw) => _nameRule.hasMatch(raw.trim());

/// Crockford base32, 8 characters (P1). Lower case and the look-alikes I, L and O are read as
/// the server reads them.
String? normaliseInviteCode(String raw) {
  final s = raw.trim().toUpperCase().replaceAll('I', '1').replaceAll('L', '1').replaceAll('O', '0').replaceAll('-', '');
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
