import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../../core/api/api_providers.dart';
import '../../../core/domain/next_move.dart' show isLateNightHour;
import '../../../core/domain/repair_candidates.dart' show repairDurationOptions;
import '../../../core/models/attempt.dart';
import '../../../core/notifications/timezones.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/dismissal_repository.dart' show DismissalKey;
import '../../../core/repositories/notification_prefs_repository.dart';
import '../../../core/repositories/pending_result_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/repositories/repair_local_repository.dart';
import '../../../core/router/quick_start.dart' show QuickRepair;
import '../../../core/router/routes.dart';
import '../../learn/data/catalog_repository.dart';
import '../../today/data/today_providers.dart' show todayDismissalsProvider;
import '../../today/logic/move_builder.dart' show dismissalKeyFor;
import 'mistake_index.dart';

/// What the Review tab reads, in one place so tests and goldens can replace it whole.
class ReviewInputs {
  const ReviewInputs({required this.attempts, this.records = const [], this.unopened = const []});

  final RemoteState<List<Attempt>> attempts;
  final List<RepairLocalRecord> records;
  final List<PendingResult> unopened;
}

final reviewInputsProvider = Provider<ReviewInputs>(
  (ref) => ReviewInputs(
    attempts: ref.watch(attemptsRepositoryProvider),
    records: ref.watch(repairLocalRecordsProvider).value ?? const [],
    unopened: ref.watch(unopenedResultsProvider).value ?? const [],
  ),
);

/// The derived index, or null until the attempts list has a value.
final reviewIndexProvider = Provider<ReviewIndex?>((ref) {
  final inputs = ref.watch(reviewInputsProvider);
  final attempts = inputs.attempts.value;
  if (attempts == null) return null;
  return buildReviewIndex(attempts, inputs.records, unopened: {for (final u in inputs.unopened) u.attemptId});
});

/// How many of tonight's [open] mistakes a 10-minute repair holds: the same count as Today's
/// 10 min chip (3), or all of them when the chapter has fewer.
int tenMinuteRepairCount(int open) {
  for (final option in repairDurationOptions(open)) {
    if (option.minutes == 10) return option.mistakes;
  }
  return open;
}

/// Whether "Not today" has hidden tonight's repair [attemptId] on Today: the same key Today builds
/// for the paper (kind, subject, source attempt), read from the same live dismissals, so the Start
/// sheet and Today never name different things for one paper. The dismissal hides the suggestion
/// only: Review itself still lists the mistakes and tonight's hero (it never deletes or hides
/// anything there).
bool repairDismissedForToday(ReviewIndex index, Set<DismissalKey> dismissed, String attemptId) {
  if (dismissed.isEmpty) return false;
  final attempt = index.attempt(attemptId);
  return attempt != null && dismissed.contains(dismissalKeyFor(attempt));
}

/// Start's "Repair the next mistake": tonight's first mistake, or null when there is none or
/// when Today's "Not today" has hidden it until 4 AM. The launcher's "10-min repair" opens the
/// same mistake with a 10-minute count and follows the same rule.
final quickRepairFromReviewProvider = Provider<QuickRepair?>((ref) {
  final index = ref.watch(reviewIndexProvider);
  final tonight = index?.tonight;
  if (index == null || tonight == null) return null;
  final dismissed = ref.watch(todayDismissalsProvider).value ?? const <DismissalKey>{};
  if (repairDismissedForToday(index, dismissed, tonight.attemptId)) return null;
  final first = AppRoutes.reviewRepair(tonight.attemptId, tonight.items.first.questionId);
  return QuickRepair(
    location: first,
    chapter: tonight.chapter,
    tenMinuteLocation: '$first?count=${tenMinuteRepairCount(tonight.items.length)}',
  );
});

/// Converts instants to the student's timezone (notification prefs, default Asia/Kolkata), so
/// every date and time on Review reads in their own day.
final reviewClockProvider = Provider<ReviewClock>((ref) => ReviewClock(ref.watch(studentTimezoneProvider), ref.watch(nowProvider)));

class ReviewClock {
  ReviewClock(this.zone, this._now);

  final String zone;
  final DateTime Function() _now;

  DateTime local(DateTime t) => tz.TZDateTime.from(t, locationFor(zone));
  DateTime now() => local(_now());

  /// 11 PM to 5 AM in the student's day.
  bool get isLateNight => isLateNightHour(now().hour);
}

/// A concept that explains a chapter, opened through the Learn routes.
class ConceptLink {
  const ConceptLink({required this.unitId, required this.title});

  final String unitId;
  final String title;
}

String _norm(String s) => s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();

/// The lesson for a chapter, or null: while study content is off (or not loaded, or no lesson
/// matches) the link is simply not shown.
final conceptLinkProvider = Provider.family<ConceptLink?, String>((ref, chapter) {
  final catalog = ref.watch(learnCatalogProvider).value;
  if (catalog == null || catalog.isDisabled) return null;
  final want = _norm(chapter);
  if (want.isEmpty) return null;
  for (final unit in catalog.units) {
    final c = unit.chapter;
    if (c != null && _norm(c) == want) return ConceptLink(unitId: unit.id, title: unit.title);
  }
  return null;
});

/// Display name for an internal subject id.
String subjectName(String id) => switch (id) {
  'accountancy' || 'accounts' => 'Accountancy',
  'business_studies' || 'business' || 'bst' => 'Business Studies',
  'economics' || 'eco' => 'Economics',
  'english' => 'English',
  'general_test' || 'gat' => 'General Test',
  '' => 'Practice',
  _ => id.replaceAll('_', ' ').replaceFirstMapped(RegExp('^.'), (m) => m[0]!.toUpperCase()),
};
