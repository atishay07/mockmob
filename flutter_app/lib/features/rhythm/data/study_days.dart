// Which weekdays the student plans to study (0 = Monday). The server keeps the goal, the number
// of study days a week; which days is the student's own plan and stays on this phone, first
// chosen in onboarding and changed in the study days editor. The plan only shapes the words and
// the rest-day marks: the server alone decides what counted.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/goal_repository.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../onboarding/onboarding.dart';
import 'rhythm_prefs.dart';

/// The days chosen in the editor on this phone, or null when none were chosen here.
class PlannedDays extends Notifier<Set<int>?> {
  String get _key => 'rhythm_days_${ref.read(userIdProvider) ?? 'none'}';

  @override
  Set<int>? build() {
    ref.watch(userIdProvider);
    scheduleMicrotask(_load);
    return null;
  }

  Future<void> _load() async {
    try {
      final stored = await ref.read(rhythmPrefsStoreProvider).getStringList(_key);
      if (!ref.mounted || stored == null) return;
      final days = decodeDays(stored);
      if (days.isNotEmpty) state = days;
    } on Object {
      // Nothing stored: the onboarding choice, if any, is used.
    }
  }

  /// Keeps [days] on this phone. Call only after the goal they imply was saved on the server.
  Future<void> save(Set<int> days) async {
    state = {...days};
    await ref.read(rhythmPrefsStoreProvider).setStringList(_key, encodeDays(days));
  }
}

List<String> encodeDays(Set<int> days) => [for (final d in days.toList()..sort()) '$d'];

Set<int> decodeDays(List<String> raw) => {
      for (final s in raw)
        if (int.tryParse(s) case final d? when d >= 0 && d < 7) d,
    };

final plannedDaysProvider = NotifierProvider<PlannedDays, Set<int>?>(PlannedDays.new);

/// Where the chosen weekdays would be kept on the account (WEB-PARITY B4).
///
/// No endpoint holds them yet: `PUT /api/me/goal` keeps only the number of days (and the pause),
/// and `PUT /api/study/preferences` keeps the website's Pro `weeklyPlan` (seven
/// `{subject, minutes}` entries for the lesson subjects, with no rest days), which is a different
/// thing. So the default keeps the days on this phone and says so in the receipt. When the
/// server gains a weekday field, override [studyDaysRemoteProvider] with an implementation whose
/// [storesOnAccount] is true and whose [save] returns only after the server acknowledged.
abstract class StudyDaysRemote {
  bool get storesOnAccount;

  /// Saves the weekdays (0 = Monday). Throws when the server refused.
  Future<void> save(Set<int> days);
}

class PhoneOnlyStudyDays implements StudyDaysRemote {
  const PhoneOnlyStudyDays();

  @override
  bool get storesOnAccount => false;

  @override
  Future<void> save(Set<int> days) async {}
}

final studyDaysRemoteProvider = Provider<StudyDaysRemote>((ref) => const PhoneOnlyStudyDays());

/// The study days to draw: the editor's choice, else the onboarding's, and only while their count
/// matches the goal on the server (a goal changed elsewhere makes an old plan wrong, so then no
/// day is drawn as rest). Null when there is no plan to show.
final studyDayPlanProvider = Provider<Set<int>?>((ref) {
  final days = ref.watch(plannedDaysProvider) ?? ref.watch(studentSheetProvider)?.days;
  final goal = ref.watch(goalRepositoryProvider).value?.daysPerWeek ?? ref.watch(rhythmRepositoryProvider).value?.daysGoal;
  return planFor(days, goal);
});

Set<int>? planFor(Set<int>? days, int? goal) {
  if (days == null || days.isEmpty || goal == null || days.length != goal) return null;
  return days;
}
