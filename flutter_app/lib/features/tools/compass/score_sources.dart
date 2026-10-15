// Where Compass can take a score from without the student typing one: their latest full mocks
// in the ticked subjects, and (for an account with Compass Pro) the practice projection. Both
// are real records; when neither exists the score simply stays optional.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attempt.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../practice/data/practice_catalog.dart';
import '../domain/du_mock_score.dart';
import '../pro/compass_pro_repository.dart';
import 'compass_controller.dart';

/// The student's attempts as Compass reads them (newest first), or null while unknown. A seam:
/// tests answer it without the attempts database.
final compassAttemptsProvider = Provider<List<Attempt>?>((ref) => ref.watch(attemptsRepositoryProvider).value);

/// The latest-mocks total for the subjects ticked in Compass, or null when there is not a full
/// mock in one ticked language and three ticked domain subjects.
final compassMockScoreProvider = Provider<DuMockScore?>((ref) {
  final selection = ref.watch(compassControllerProvider.select((s) => s.value?.selection));
  final attempts = ref.watch(compassAttemptsProvider);
  if (selection == null || attempts == null || attempts.isEmpty) return null;
  final subjects = ref.watch(practiceSubjectsProvider).value ?? const [];
  final publicOf = {for (final s in subjects) s.internalId: s.id};
  return duMockScore(
    attempts,
    selection,
    publicIdOf: (internal) => publicOf[internal] ?? internal,
  );
});

/// The middle of a complete four-paper practice projection (Compass Pro), or null: no access,
/// not loaded, or fewer than four papers projected.
final compassProjectionScoreProvider = Provider<int?>((ref) {
  if (!ref.watch(compassProAccessProvider)) return null;
  final pro = ref.watch(compassProRepositoryProvider).value;
  final total = pro?.total;
  if (pro == null || pro.locked || total == null || !total.complete || total.max != 1000) return null;
  return total.mid;
});
