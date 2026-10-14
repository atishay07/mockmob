import 'dart:convert';

/// A reminder that was scheduled and is waiting to be seen, so a later app open can tell
/// whether the student responded to it.
class DeliveredReminder {
  const DeliveredReminder({
    required this.taskId,
    required this.prefKey,
    required this.at,
  });

  /// Throws when a field is missing or the wrong type; [ReminderState.parse] skips such an entry
  /// and keeps the rest.
  factory DeliveredReminder.fromJson(Map<String, Object?> j) =>
      DeliveredReminder(
        taskId: j['t'] as String,
        prefKey: j['k'] as String,
        at: DateTime.fromMillisecondsSinceEpoch(j['a'] as int),
      );

  final String taskId;

  /// The channel key on the wire (`study_window`, `weekly_plan`, `check_due`).
  final String prefKey;

  /// When it was due to show.
  final DateTime at;

  Map<String, Object?> toJson() => {
    't': taskId,
    'k': prefKey,
    'a': at.millisecondsSinceEpoch,
  };
}

/// How a category (one channel key) is doing: how many reminders in a row went unopened, and
/// whether it has been paused because of that.
class CategoryStatus {
  const CategoryStatus({
    this.ignoredInRow = 0,
    this.paused = false,
    this.hintPending = false,
  });

  /// One wrong-typed field falls back to its default; the mute and the pause that were stored
  /// beside it stay.
  factory CategoryStatus.fromJson(Map<String, Object?> j) => CategoryStatus(
    ignoredInRow: j['i'] is num ? (j['i'] as num).toInt() : 0,
    paused: j['p'] == true,
    hintPending: j['h'] == true,
  );

  final int ignoredInRow;

  /// Stopped after three unopened reminders. Turned on again only by the student.
  final bool paused;

  /// "Want fewer reminders? You can turn this one off." has not been shown yet.
  final bool hintPending;

  CategoryStatus copyWith({
    int? ignoredInRow,
    bool? paused,
    bool? hintPending,
  }) => CategoryStatus(
    ignoredInRow: ignoredInRow ?? this.ignoredInRow,
    paused: paused ?? this.paused,
    hintPending: hintPending ?? this.hintPending,
  );

  Map<String, Object?> toJson() => {
    'i': ignoredInRow,
    'p': paused,
    'h': hintPending,
  };
}

/// A reminder that was counted as unopened when the app opened, kept for a day with what its
/// category looked like before it was counted. A tap that arrives after the app already settled
/// (the resume event runs before the notification's tap callback) can then undo the count: the
/// student did open it.
class SettledReminder {
  const SettledReminder({
    required this.taskId,
    required this.prefKey,
    required this.settledAt,
    required this.before,
  });

  factory SettledReminder.fromJson(Map<String, Object?> j) => SettledReminder(
    taskId: j['t'] as String,
    prefKey: j['k'] as String,
    settledAt: DateTime.fromMillisecondsSinceEpoch(j['s'] as int),
    before: CategoryStatus.fromJson((j['b'] as Map).cast<String, Object?>()),
  );

  final String taskId;
  final String prefKey;

  /// When the app counted it as unopened.
  final DateTime settledAt;

  /// The category's status just before this reminder was counted.
  final CategoryStatus before;

  Map<String, Object?> toJson() => {
    't': taskId,
    'k': prefKey,
    's': settledAt.millisecondsSinceEpoch,
    'b': before.toJson(),
  };
}

/// What reading the stored text found: the state, and whether the text itself could be read.
/// An entry that cannot be read is skipped on its own; [unreadable] is only for a text that is
/// not a JSON object at all.
class ParsedReminderState {
  const ParsedReminderState(this.state, {this.unreadable = false});

  final ReminderState state;
  final bool unreadable;
}

/// Everything the notifications feature keeps on this phone (never sent to the server): the
/// mute, the weekly plan choice, unopened-reminder counts and the pre-prompt history.
class ReminderState {
  const ReminderState({
    this.mutedUntil,
    this.weeklyPlanOn = false,
    this.repairReadyOn = true,
    this.categories = const {},
    this.delivered = const [],
    this.settled = const [],
    this.prePromptNotNowCount = 0,
  });

  /// The stored state, or an empty one when the text cannot be read at all. One unreadable
  /// entry never costs the rest: see [parse].
  factory ReminderState.fromJsonString(String? raw) => parse(raw).state;

  /// Reads the stored text one record at a time. A delivered reminder, a category or a field
  /// that is the wrong shape is skipped; the mute, the pauses and every other record that can
  /// be read are kept. Only text that is not a JSON object returns the empty state, and then
  /// [ParsedReminderState.unreadable] is true so the store can keep a copy before it writes.
  static ParsedReminderState parse(String? raw) {
    if (raw == null || raw.isEmpty) return const ParsedReminderState(ReminderState());
    final Map<String, Object?> j;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return const ParsedReminderState(ReminderState(), unreadable: true);
      j = decoded.cast<String, Object?>();
    } on Object {
      return const ParsedReminderState(ReminderState(), unreadable: true);
    }

    final categories = <String, CategoryStatus>{};
    final cats = j['c'];
    if (cats is Map) {
      for (final e in cats.entries) {
        final value = e.value;
        if (e.key is! String || value is! Map) continue;
        try {
          categories[e.key as String] = CategoryStatus.fromJson(value.cast<String, Object?>());
        } on Object {
          // This category alone is lost.
        }
      }
    }
    List<T> each<T>(Object? list, T Function(Map<String, Object?>) read) {
      final out = <T>[];
      if (list is! List) return out;
      for (final item in list) {
        if (item is! Map) continue;
        try {
          out.add(read(item.cast<String, Object?>()));
        } on Object {
          // This record alone is lost.
        }
      }
      return out;
    }

    return ParsedReminderState(
      ReminderState(
        mutedUntil: _date(j['m']),
        weeklyPlanOn: j['w'] is bool ? j['w'] as bool : false,
        repairReadyOn: j['r'] is bool ? j['r'] as bool : true,
        categories: categories,
        delivered: each(j['d'], DeliveredReminder.fromJson),
        settled: each(j['s'], SettledReminder.fromJson),
        prePromptNotNowCount: j['n'] is num ? (j['n'] as num).toInt() : 0,
      ),
    );
  }

  static DateTime? _date(Object? ms) =>
      ms is int ? DateTime.fromMillisecondsSinceEpoch(ms) : null;

  /// Reminders are muted until this moment (Mute for 7 days). Null when not muted.
  final DateTime? mutedUntil;

  /// The student turned the weekly plan on. It is off until they do (spec 8).
  final bool weeklyPlanOn;

  /// The repair-ready reminder is on. On until the student turns it off; kept on this phone
  /// because the server has no key for it.
  final bool repairReadyOn;
  final Map<String, CategoryStatus> categories;

  /// Reminders scheduled earlier whose outcome is still unknown.
  final List<DeliveredReminder> delivered;

  /// Reminders counted as unopened in the last day, so a late tap can still clear its count.
  final List<SettledReminder> settled;

  /// How many times the pre-prompt was put to the student without turning reminders on: the
  /// sheet opened (and then Not now, a refused system question or a closed sheet) or the recap
  /// row answered with Not now. Kept under its first name so stored state still reads. It sets
  /// the spacing and the wording of the next ask.
  final int prePromptNotNowCount;

  /// [prePromptNotNowCount] under the name the cadence uses.
  int get prePromptAskCount => prePromptNotNowCount;

  bool isMuted(DateTime now) => mutedUntil != null && now.isBefore(mutedUntil!);

  CategoryStatus category(String key) =>
      categories[key] ?? const CategoryStatus();

  ReminderState copyWith({
    DateTime? mutedUntil,
    bool clearMute = false,
    bool? weeklyPlanOn,
    bool? repairReadyOn,
    Map<String, CategoryStatus>? categories,
    List<DeliveredReminder>? delivered,
    List<SettledReminder>? settled,
    int? prePromptNotNowCount,
  }) => ReminderState(
    mutedUntil: clearMute ? null : (mutedUntil ?? this.mutedUntil),
    weeklyPlanOn: weeklyPlanOn ?? this.weeklyPlanOn,
    repairReadyOn: repairReadyOn ?? this.repairReadyOn,
    categories: categories ?? this.categories,
    delivered: delivered ?? this.delivered,
    settled: settled ?? this.settled,
    prePromptNotNowCount: prePromptNotNowCount ?? this.prePromptNotNowCount,
  );

  ReminderState withCategory(String key, CategoryStatus status) =>
      copyWith(categories: {...categories, key: status});

  String toJsonString() => jsonEncode({
    if (mutedUntil != null) 'm': mutedUntil!.millisecondsSinceEpoch,
    'w': weeklyPlanOn,
    'r': repairReadyOn,
    'c': {for (final e in categories.entries) e.key: e.value.toJson()},
    'd': [for (final d in delivered) d.toJson()],
    's': [for (final d in settled) d.toJson()],
    'n': prePromptNotNowCount,
  });
}
