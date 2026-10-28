import '../../../core/domain/domain.dart';
import '../../../core/models/attempt.dart';
import '../../../core/repositories/repair_local_repository.dart';
import 'reminder_plan.dart';

/// A repair reminder is only valid for a week after the mock it is about (spec 8: cancelled
/// when past validity).
const Duration repairReminderValidity = Duration(days: 7);

/// The most mistakes one repair reminder promises (the 20-minute option).
const int _maxMistakesPromised = 6;

/// The repair waiting for this student, or null when there is none: the newest attempt in the
/// last week that still has mistakes Mistake Repair can offer, minus the ones already repaired
/// on this phone. Pure.
RepairReady? computeRepairReady({
  required List<Attempt> attempts,
  required List<RepairLocalRecord> records,
  required DateTime now,
}) {
  final recent = [
    for (final a in attempts)
      if (now.difference(a.completedAt) <= repairReminderValidity) a,
  ]..sort((a, b) => b.completedAt.compareTo(a.completedAt));

  for (final attempt in recent) {
    final mine = [
      for (final r in records)
        if (r.attemptId == attempt.id) r,
    ];
    final candidates = repairCandidates(
      attempt,
      repairedIds: {
        for (final r in mine)
          if (r.isRepaired) r.questionId,
      },
      notAMistakeIds: {
        for (final r in mine)
          if (r.status == RepairLocalStatus.notAMistake) r.questionId,
      },
    );
    if (candidates.isEmpty) continue;
    final mistakes = candidates.length > _maxMistakesPromised
        ? _maxMistakesPromised
        : candidates.length;
    return RepairReady(
      attemptId: attempt.id,
      mistakes: mistakes,
      minutes: repairMinutes(mistakes)!,
    );
  }
  return null;
}
