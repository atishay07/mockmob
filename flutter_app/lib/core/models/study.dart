import 'json_helpers.dart';

/// `UnitView.status` from the study catalog [API 2.10]. Never worded "mastered".
enum StudyUnitStatus {
  newUnit,
  inProgress,
  lockIn,
  due,
  learned,
  unknown;

  static StudyUnitStatus fromWire(String? s) => switch (s) {
        'new' => newUnit,
        'in_progress' => inProgress,
        'lock_in' => lockIn,
        'due' => due,
        'learned' => learned,
        _ => unknown,
      };
}

class StudyUnitView {
  const StudyUnitView({
    required this.id,
    required this.title,
    required this.status,
    this.subject,
    this.chapter,
    this.version,
    this.contentHash,
    this.summary,
    this.estimatedMinutes,
  });

  factory StudyUnitView.fromJson(Json j) => StudyUnitView(
        id: asStringOr(j['id'], ''),
        title: asStringOr(j['title'], ''),
        status: StudyUnitStatus.fromWire(asString(j['status'])),
        subject: asString(j['subject']),
        chapter: asString(j['chapter']),
        version: asString(j['version']),
        contentHash: asString(j['contentHash']),
        summary: asString(j['summary']),
        estimatedMinutes: asInt(j['estimatedMinutes']),
      );

  final String id;
  final String title;
  final StudyUnitStatus status;
  final String? subject;
  final String? chapter;
  final String? version;
  final String? contentHash;
  final String? summary;
  final int? estimatedMinutes;
}

class StudyQueue {
  const StudyQueue({
    this.dueCount = 0,
    this.overdueCount = 0,
    this.newAllowance = 0,
    this.availableCount = 0,
    this.newCount = 0,
    this.pausedNew = false,
  });

  factory StudyQueue.fromJson(Json j) => StudyQueue(
        dueCount: asInt(j['dueCount']) ?? 0,
        overdueCount: asInt(j['overdueCount']) ?? 0,
        newAllowance: asInt(j['newAllowance']) ?? 0,
        availableCount: asInt(j['availableCount']) ?? 0,
        newCount: asInt(j['newCount']) ?? 0,
        pausedNew: asBool(j['pausedNew']) ?? false,
      );

  final int dueCount;
  final int overdueCount;
  final int newAllowance;
  final int availableCount;
  final int newCount;
  final bool pausedNew;
}

class StudyActiveRun {
  const StudyActiveRun({required this.id, this.mode, this.title, this.step, this.total, this.unitId});

  factory StudyActiveRun.fromJson(Json j) => StudyActiveRun(
        id: asStringOr(j['id'], ''),
        mode: asString(j['mode']),
        title: asString(j['title']),
        step: asInt(j['step']),
        total: asInt(j['total']),
        unitId: asString(j['unitId']),
      );

  final String id;
  final String? mode;
  final String? title;
  final int? step;
  final int? total;
  final String? unitId;
}

/// `GET /api/study/catalog` [API 2.10].
class StudyCatalog {
  const StudyCatalog({
    required this.state,
    this.units = const [],
    this.queue = const StudyQueue(),
    this.active,
    this.recallEnabled = false,
    this.newCardsPerDay = 5,
    this.introducedToday = 0,
    this.raw = const {},
  });

  factory StudyCatalog.fromJson(Json j) => StudyCatalog(
        state: asStringOr(j['state'], 'disabled'),
        units: [for (final u in asJsonList(j['units'])) StudyUnitView.fromJson(u)],
        queue: StudyQueue.fromJson(asJson(j['queue'])),
        active: j['active'] is Map ? StudyActiveRun.fromJson(asJson(j['active'])) : null,
        recallEnabled: asBool(j['recallEnabled']) ?? false,
        newCardsPerDay: asInt(j['newCardsPerDay']) ?? 5,
        introducedToday: asInt(j['introducedToday']) ?? 0,
        raw: j,
      );

  /// `ready` or `disabled`.
  final String state;
  final List<StudyUnitView> units;
  final StudyQueue queue;
  final StudyActiveRun? active;
  final bool recallEnabled;
  final int newCardsPerDay;
  final int introducedToday;
  final Json raw;

  bool get isDisabled => state == 'disabled';
}

/// `POST /api/study/runs` and `GET /api/study/runs/{id}`. The item payload differs by card
/// type, so it stays as received and the Learn module reads what it needs.
class StudyRun {
  const StudyRun({
    required this.id,
    required this.state,
    this.mode,
    this.title,
    this.cursor = 0,
    this.revision = 0,
    this.total = 0,
    this.revealed = false,
    this.item,
    this.feedback,
    this.units = const [],
    this.raw = const {},
  });

  factory StudyRun.fromJson(Json j) => StudyRun(
        id: asStringOr(j['id'], ''),
        state: asStringOr(j['state'], 'active'),
        mode: asString(j['mode']),
        title: asString(j['title']),
        cursor: asInt(j['cursor']) ?? 0,
        revision: asInt(j['revision']) ?? 0,
        total: asInt(j['total']) ?? 0,
        revealed: asBool(j['revealed']) ?? false,
        item: j['item'] is Map ? asJson(j['item']) : null,
        feedback: j['feedback'] is Map ? asJson(j['feedback']) : null,
        units: [for (final u in asJsonList(j['units'])) StudyUnitView.fromJson(u)],
        raw: j,
      );

  final String id;

  /// `active`, `complete`, `set_aside` or `invalidated`.
  final String state;
  final String? mode;
  final String? title;
  final int cursor;

  /// Send as `expectedRevision` with the next event.
  final int revision;
  final int total;
  final bool revealed;
  final Json? item;
  final Json? feedback;

  /// For `invalidated` runs: the replacement lessons to open.
  final List<StudyUnitView> units;
  final Json raw;

  bool get isActive => state == 'active';
  bool get isComplete => state == 'complete';
  bool get isInvalidated => state == 'invalidated';
}

/// `GET /api/study/units/{id}`. Reading it records an exposure on the server, so only fetch
/// when the student opens the lesson. Content stays as received and is cached by
/// `id + version + contentHash`.
class StudyUnit {
  const StudyUnit({
    required this.id,
    required this.title,
    this.version,
    this.contentHash,
    this.subject,
    this.chapter,
    this.summary,
    this.estimatedMinutes,
    this.objectives = const [],
    this.recallAvailable = 0,
    this.raw = const {},
  });

  factory StudyUnit.fromJson(Json j) => StudyUnit(
        id: asStringOr(j['id'], ''),
        title: asStringOr(j['title'], ''),
        version: asString(j['version']),
        contentHash: asString(j['contentHash']),
        subject: asString(j['subject']),
        chapter: asString(j['chapter']),
        summary: asString(j['summary']),
        estimatedMinutes: asInt(j['estimatedMinutes']),
        objectives: asStringList(j['objectives']),
        recallAvailable: asInt(asJson(j['recall'])['available']) ?? 0,
        raw: j,
      );

  final String id;
  final String title;
  final String? version;
  final String? contentHash;
  final String? subject;
  final String? chapter;
  final String? summary;
  final int? estimatedMinutes;
  final List<String> objectives;
  final int recallAvailable;
  final Json raw;
}
