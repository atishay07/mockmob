// Notices milestones that just arrived in a fresh rhythm read and hands them to the controller,
// then writes the best-effort `rhythm_seen` week record (spec 6.1). Watch it once from the app
// shell or Today: `ref.watch(rhythmWatcherProvider)`.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/repositories/rhythm_seen_repository.dart';
import '../data/rhythm_providers.dart';
import 'celebration_controller.dart';
import 'celebration_event.dart';

/// A milestone this old or older is history, not news: it never celebrates.
const Duration freshMilestoneWindow = Duration(hours: 48);

class MilestonePlan {
  const MilestonePlan({this.events = const [], this.silent = const []});

  /// Milestones to celebrate now.
  final List<CelebrationEvent> events;

  /// Earned milestones to remember without celebrating (history on a new phone, or old).
  final List<String> silent;
}

/// Pure: which earned milestones are news. The first read on a phone (no `lastSeenWeek` yet) is a
/// baseline: everything earned so far is remembered silently, so a new phone never replays a
/// student's history.
MilestonePlan planMilestones(Rhythm rhythm, RhythmSeenState seen, DateTime now) {
  final events = <CelebrationEvent>[];
  final silent = <String>[];
  final baseline = seen.lastSeenWeek == null;
  for (final m in rhythm.milestones) {
    final at = m.achievedAt;
    if (at == null || seen.celebratedIds.contains(m.id)) continue;
    if (baseline || now.difference(at) > freshMilestoneWindow) {
      silent.add(m.id);
    } else {
      events.add(CelebrationEvent.milestone(m));
    }
  }
  return MilestonePlan(events: events, silent: silent);
}

Future<void> processFreshRhythm(Ref ref, Rhythm rhythm) async {
  final seenRepo = ref.read(rhythmSeenRepositoryProvider);
  final seen = await seenRepo.read();
  final plan = planMilestones(rhythm, seen, ref.read(nowProvider)());
  for (final id in plan.silent) {
    await seenRepo.markCelebrated(id);
  }
  final controller = ref.read(celebrationControllerProvider.notifier);
  // Moments first (highest level), then the dated rows.
  await controller.celebrateBest([for (final e in plan.events) if (e.level != CelebrationLevel.l3) e]);
  for (final e in plan.events) {
    if (e.level == CelebrationLevel.l3) await controller.celebrate(e);
  }
  await seenRepo.saveSeen(rhythm);
  ref.invalidate(rhythmSeenProvider);
}

// Best effort: the provider may be gone or the database closed by the time this finishes.
Future<void> _safely(Ref ref, Rhythm rhythm) async {
  try {
    await processFreshRhythm(ref, rhythm);
  } on Object {
    // Nothing to recover: the next fresh read tries again.
  }
}

bool _isFreshRead(RemoteState<Rhythm>? prev, RemoteState<Rhythm> next) =>
    next.value != null && !next.fromCache && !next.loading && next.error == null && next.fetchedAt != prev?.fetchedAt;

final rhythmWatcherProvider = Provider<void>((ref) {
  ref.listen<RemoteState<Rhythm>>(rhythmRepositoryProvider, (prev, next) {
    if (_isFreshRead(prev, next)) unawaited(_safely(ref, next.value!));
  }, fireImmediately: true);
});
