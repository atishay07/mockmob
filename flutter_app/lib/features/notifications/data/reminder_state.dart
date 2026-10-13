import 'dart:convert';

/// A reminder that was scheduled and is waiting to be seen, so a later app open can tell
/// whether the student responded to it.
class DeliveredReminder {
  const DeliveredReminder({
    required this.taskId,
    required this.prefKey,
    required this.at,
  });

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

  factory CategoryStatus.fromJson(Map<String, Object?> j) => CategoryStatus(
    ignoredInRow: (j['i'] as int?) ?? 0,
    paused: (j['p'] as bool?) ?? false,
    hintPending: (j['h'] as bool?) ?? false,
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

/// Everything the notifications feature keeps on this phone (never sent to the server): the
/// mute, the weekly plan choice, unopened-reminder counts and the pre-prompt history.
class ReminderState {
  const ReminderState({
    this.mutedUntil,
    this.weeklyPlanOn = false,
    this.repairReadyOn = true,
    this.categories = const {},
    this.delivered = const [],
    this.prePromptNotNowCount = 0,
  });

  factory ReminderState.fromJsonString(String? raw) {
    if (raw == null || raw.isEmpty) return const ReminderState();
    try {
      final j = jsonDecode(raw) as Map<String, Object?>;
      final cats = (j['c'] as Map<String, Object?>? ?? const {});
      return ReminderState(
        mutedUntil: _date(j['m']),
        weeklyPlanOn: (j['w'] as bool?) ?? false,
        repairReadyOn: (j['r'] as bool?) ?? true,
        categories: {
          for (final e in cats.entries)
            e.key: CategoryStatus.fromJson(
              (e.value as Map).cast<String, Object?>(),
            ),
        },
        delivered: [
          for (final d in (j['d'] as List? ?? const []))
            DeliveredReminder.fromJson((d as Map).cast<String, Object?>()),
        ],
        prePromptNotNowCount: (j['n'] as int?) ?? 0,
      );
    } on Object {
      // Unreadable state is the same as none: nothing here is authoritative.
      return const ReminderState();
    }
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

  /// How many times the student pressed Not now on the pre-prompt sheet.
  final int prePromptNotNowCount;

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
    int? prePromptNotNowCount,
  }) => ReminderState(
    mutedUntil: clearMute ? null : (mutedUntil ?? this.mutedUntil),
    weeklyPlanOn: weeklyPlanOn ?? this.weeklyPlanOn,
    repairReadyOn: repairReadyOn ?? this.repairReadyOn,
    categories: categories ?? this.categories,
    delivered: delivered ?? this.delivered,
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
    'n': prePromptNotNowCount,
  });
}
