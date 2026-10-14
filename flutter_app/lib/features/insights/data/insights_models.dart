import '../../../core/models/json_helpers.dart';

/// A rate with its Wilson interval, exactly as the server computed it. [pct] is null when
/// nothing was answered: never show that as zero.
class Rate {
  const Rate({this.pct, this.low, this.high, this.n = 0});

  factory Rate.fromJson(Object? v) {
    final j = asJson(v);
    return Rate(pct: asInt(j['pct']), low: asInt(j['low']), high: asInt(j['high']), n: asInt(j['n']) ?? 0);
  }

  final int? pct;
  final int? low;
  final int? high;
  final int n;

  bool get known => pct != null && n > 0;
}

/// Marks as the record shows them: +5 per right, -1 per wrong, 0 per blank.
class Ledger {
  const Ledger({this.gained = 0, this.penalty = 0, this.net = 0, this.openWrong = 0, this.openSkipped = 0});

  factory Ledger.fromJson(Object? v) {
    final j = asJson(v);
    return Ledger(
      gained: asInt(j['gained']) ?? 0,
      penalty: asInt(j['penalty']) ?? 0,
      net: asInt(j['net']) ?? 0,
      openWrong: asInt(j['openWrong']) ?? 0,
      openSkipped: asInt(j['openSkipped']) ?? 0,
    );
  }

  final int gained;

  /// Marks deducted by wrong answers (1 each), as a positive number.
  final int penalty;
  final int net;
  final int openWrong;
  final int openSkipped;

  int get right => gained ~/ 5;
  int get wrong => penalty;
  int get blank => openSkipped ~/ 5;
}

/// One chapter's answers across the record.
class ChapterLine {
  const ChapterLine({
    required this.subject,
    required this.subjectName,
    required this.chapter,
    this.right = 0,
    this.wrong = 0,
    this.skip = 0,
    this.n = 0,
    this.sessions = 0,
    this.accuracy = const Rate(),
    this.open = 0,
  });

  factory ChapterLine.fromJson(Json j) => ChapterLine(
        subject: asStringOr(j['subject'], ''),
        subjectName: asStringOr(j['subjectName'], asStringOr(j['subject'], '')),
        chapter: asStringOr(j['chapter'], 'Unmapped chapter'),
        right: asInt(j['right']) ?? 0,
        wrong: asInt(j['wrong']) ?? 0,
        skip: asInt(j['skip']) ?? 0,
        n: asInt(j['n']) ?? 0,
        sessions: asInt(j['sessions']) ?? 0,
        accuracy: Rate.fromJson(j['accuracy']),
        open: asInt(j['open']) ?? 0,
      );

  final String subject;
  final String subjectName;
  final String chapter;
  final int right;
  final int wrong;
  final int skip;
  final int n;
  final int sessions;
  final Rate accuracy;

  /// What the wrong and blank questions were worth (5 each). Never "marks you could recover".
  final int open;
}

class ChangesSummary {
  const ChangesSummary({
    this.count = 0,
    this.gains = 0,
    this.losses = 0,
    this.marksGained = 0,
    this.marksLost = 0,
    this.net = 0,
    this.sessionsWithTelemetry = 0,
  });

  factory ChangesSummary.fromJson(Object? v) {
    final j = asJson(v);
    return ChangesSummary(
      count: asInt(j['count']) ?? 0,
      gains: asInt(j['gains']) ?? 0,
      losses: asInt(j['losses']) ?? 0,
      marksGained: asInt(j['marksGained']) ?? 0,
      marksLost: asInt(j['marksLost']) ?? 0,
      net: asInt(j['net']) ?? 0,
      sessionsWithTelemetry: asInt(j['sessionsWithTelemetry']) ?? 0,
    );
  }

  final int count;
  final int gains;
  final int losses;
  final int marksGained;
  final int marksLost;
  final int net;
  final int sessionsWithTelemetry;
}

class SlowQuestion {
  const SlowQuestion({required this.chapter, required this.seconds, this.position, this.outcome});

  factory SlowQuestion.fromJson(Json j) => SlowQuestion(
        chapter: asStringOr(j['chapter'], ''),
        seconds: asInt(j['seconds']) ?? 0,
        position: asInt(j['position']),
        outcome: asString(j['outcome']),
      );

  final String chapter;
  final int seconds;
  final int? position;
  final String? outcome;
}

/// Timing from device events. Only shown when [usable] (8 or more timed questions).
class Pace {
  const Pace({
    this.usable = false,
    this.questionsTimed = 0,
    this.sessionsTimed = 0,
    this.medianSec,
    this.p90Sec,
    this.medianRightSec,
    this.medianWrongSec,
    this.shareOnWrong,
    this.slowest = const [],
  });

  factory Pace.fromJson(Object? v) {
    final j = asJson(v);
    return Pace(
      usable: asBool(j['usable']) ?? false,
      questionsTimed: asInt(j['questionsTimed']) ?? 0,
      sessionsTimed: asInt(j['sessionsTimed']) ?? 0,
      medianSec: asInt(j['medianSec']),
      p90Sec: asInt(j['p90Sec']),
      medianRightSec: asInt(j['medianRightSec']),
      medianWrongSec: asInt(j['medianWrongSec']),
      shareOnWrong: asInt(j['shareOnWrong']),
      slowest: [for (final s in asJsonList(j['slowest'])) SlowQuestion.fromJson(s)],
    );
  }

  final bool usable;
  final int questionsTimed;
  final int sessionsTimed;
  final int? medianSec;
  final int? p90Sec;
  final int? medianRightSec;
  final int? medianWrongSec;
  final int? shareOnWrong;
  final List<SlowQuestion> slowest;
}

class WeekSummary {
  const WeekSummary({this.sessions = 0, this.questions = 0, this.right = 0, this.wrong = 0, this.skip = 0, this.net = 0, this.accuracy = const Rate()});

  factory WeekSummary.fromJson(Object? v) {
    final j = asJson(v);
    return WeekSummary(
      sessions: asInt(j['sessions']) ?? 0,
      questions: asInt(j['questions']) ?? 0,
      right: asInt(j['right']) ?? 0,
      wrong: asInt(j['wrong']) ?? 0,
      skip: asInt(j['skip']) ?? 0,
      net: asInt(j['net']) ?? 0,
      accuracy: Rate.fromJson(j['accuracy']),
    );
  }

  final int sessions;
  final int questions;
  final int right;
  final int wrong;
  final int skip;
  final int net;
  final Rate accuracy;
}

class DifficultyLine {
  const DifficultyLine({required this.level, this.n = 0, this.right = 0, this.wrong = 0, this.accuracy = const Rate()});

  factory DifficultyLine.fromJson(Json j) => DifficultyLine(
        level: asStringOr(j['level'], ''),
        n: asInt(j['n']) ?? 0,
        right: asInt(j['right']) ?? 0,
        wrong: asInt(j['wrong']) ?? 0,
        accuracy: Rate.fromJson(j['accuracy']),
      );

  final String level;
  final int n;
  final int right;
  final int wrong;
  final Rate accuracy;
}

/// One plain-language finding the server read out, strongest first. Always carries its [n].
class Finding {
  const Finding({required this.id, required this.kind, required this.headline, required this.detail, this.n = 0, this.actionLabel, this.actionHref});

  factory Finding.fromJson(Json j) {
    final action = asJson(j['action']);
    return Finding(
      id: asStringOr(j['id'], ''),
      kind: asStringOr(j['kind'], 'info'),
      headline: asStringOr(j['headline'], ''),
      detail: asStringOr(j['detail'], ''),
      n: asInt(j['n']) ?? 0,
      actionLabel: asString(action['label']),
      actionHref: asString(action['href']),
    );
  }

  final String id;

  /// `good`, `leak` or `info`.
  final String kind;
  final String headline;
  final String detail;
  final int n;
  final String? actionLabel;
  final String? actionHref;

  bool get isLeak => kind == 'leak';
  bool get isGood => kind == 'good';
}

/// `GET /api/prepos/insights`: the student's own server-scored record (last 60 sessions).
/// Read-only, no model, no credits. Every figure here comes from the server.
class PrepInsights {
  const PrepInsights({
    required this.state,
    this.sessions = 0,
    this.questions = 0,
    this.first,
    this.last,
    this.ledger = const Ledger(),
    this.accuracy = const Rate(),
    this.attemptRate,
    this.ranked = const [],
    this.thin = const [],
    this.difficulty = const [],
    this.pace = const Pace(),
    this.changes = const ChangesSummary(),
    this.thisWeek = const WeekSummary(),
    this.lastWeek = const WeekSummary(),
    this.activeDaysLast14 = 0,
    this.findings = const [],
  });

  factory PrepInsights.fromJson(Object? body) {
    final root = asJson(body);
    final j = asJson(root['insights']);
    final window = asJson(j['window']);
    final chapters = asJson(j['chapters']);
    final week = asJson(j['week']);
    return PrepInsights(
      state: asStringOr(j['state'], 'empty'),
      sessions: asInt(j['sessions']) ?? 0,
      questions: asInt(j['questions']) ?? 0,
      first: asDate(window['first']),
      last: asDate(window['last']),
      ledger: Ledger.fromJson(j['ledger']),
      accuracy: Rate.fromJson(j['accuracy']),
      attemptRate: asInt(j['attemptRate']),
      ranked: [for (final c in asJsonList(chapters['ranked'])) ChapterLine.fromJson(c)],
      thin: [for (final c in asJsonList(chapters['thin'])) ChapterLine.fromJson(c)],
      difficulty: [for (final d in asJsonList(j['difficulty'])) DifficultyLine.fromJson(d)],
      pace: Pace.fromJson(j['pace']),
      changes: ChangesSummary.fromJson(j['changes']),
      thisWeek: WeekSummary.fromJson(week['thisWeek']),
      lastWeek: WeekSummary.fromJson(week['lastWeek']),
      activeDaysLast14: asInt(week['activeDaysLast14']) ?? 0,
      findings: [for (final f in asJsonList(root['findings'])) Finding.fromJson(f)],
    );
  }

  /// `ready` or `empty`.
  final String state;
  final int sessions;
  final int questions;
  final DateTime? first;
  final DateTime? last;
  final Ledger ledger;
  final Rate accuracy;

  /// Share of questions answered (not left blank), 0 to 100.
  final int? attemptRate;
  final List<ChapterLine> ranked;
  final List<ChapterLine> thin;
  final List<DifficultyLine> difficulty;
  final Pace pace;
  final ChangesSummary changes;
  final WeekSummary thisWeek;
  final WeekSummary lastWeek;
  final int activeDaysLast14;
  final List<Finding> findings;

  bool get isReady => state == 'ready' && sessions > 0;
}
