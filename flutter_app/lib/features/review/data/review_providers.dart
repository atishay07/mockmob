import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../../core/api/api_providers.dart';
import '../../../core/models/attempt.dart';
import '../../../core/notifications/timezones.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/notification_prefs_repository.dart';
import '../../../core/repositories/pending_result_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/repositories/repair_local_repository.dart';
import '../../../core/router/quick_start.dart' show QuickRepair;
import '../../../core/router/routes.dart';
import '../../learn/data/catalog_repository.dart';
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

/// Start's "Repair the next mistake": tonight's first mistake, or null when there is none.
final quickRepairFromReviewProvider = Provider<QuickRepair?>((ref) {
  final tonight = ref.watch(reviewIndexProvider)?.tonight;
  if (tonight == null) return null;
  return QuickRepair(location: AppRoutes.reviewRepair(tonight.attemptId, tonight.items.first.questionId), chapter: tonight.chapter);
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
  bool get isLateNight {
    final h = now().hour;
    return h >= 23 || h < 5;
  }
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
