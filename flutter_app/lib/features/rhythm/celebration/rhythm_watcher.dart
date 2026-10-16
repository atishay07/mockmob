// Notices milestones that just arrived in a fresh rhythm read and hands them to the controller,
// then writes the best-effort `rhythm_seen` week record (spec 6.1). Watch it once from the app
// shell or Today: `ref.watch(rhythmWatcherProvider)`.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/repositories/rhythm_seen_repository.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../logic/dates.dart';
import '../logic/derived_badges.dart';
import 'celebration_controller.dart';
import 'celebration_event.dart';

/// A milestone this old or older is history, not news: it never gets a moment. On a phone that
/// already knows the student it gets one quiet receipt line instead.
const Duration freshMilestoneWindow = Duration(hours: 48);

class MilestonePlan {
  const MilestonePlan({this.events = const [], this.silent = const []});

  /// Milestones to celebrate now, and at most one receipt for the ones that landed while the
  /// app was away.
  final List<CelebrationEvent> events;

  /// Earned milestones to remember without showing anything (history on a new phone, or an id
  /// this app version has no words for).
  final List<String> silent;
}

/// Pure: which earned milestones are news. The first read on a phone (no `lastSeenWeek` yet) is a
/// baseline: everything earned so far is remembered silently, so a new phone never replays a
/// student's history. Later, a milestone inside 48 hours is a moment (or a dated row), and the
/// older ones that landed while the app was away become one receipt ("Your first repair landed
/// on 11 October.") for the newest of them, with the others counted in it.
MilestonePlan planMilestones(Rhythm rhythm, RhythmSeenState seen, DateTime now, {List<RhythmMilestone>? milestones}) {
  final events = <CelebrationEvent>[];
  final silent = <String>[];
  final away = <RhythmMilestone>[];
  final baseline = seen.lastSeenWeek == null;
  for (final m in milestones ?? rhythm.milestones) {
    final at = m.achievedAt;
    if (at == null || seen.celebratedIds.contains(m.id)) continue;
    if (baseline) {
      silent.add(m.id);
    } else if (now.difference(at) > freshMilestoneWindow) {
      if (RhythmCopy.knowsMilestone(m.id)) {
        away.add(m);
      } else {
        silent.add(m.id);
      }
    } else {
      events.add(CelebrationEvent.milestone(m, date: formatAchievedDate(at, rhythm.timeZone, now)));
    }
  }
  if (away.isNotEmpty) {
    away.sort((a, b) => b.achievedAt!.compareTo(a.achievedAt!));
    final newest = away.first;
    events.add(
      CelebrationEvent.milestoneReceipt(
        newest: newest,
        date: formatAchievedDate(newest.achievedAt!, rhythm.timeZone, now),
        others: [for (final m in away.skip(1)) m.id],
      ),
    );
  }
  return MilestonePlan(events: events, silent: silent);
}

/// Handles a fresh rhythm read. While the student has turned rhythm off nothing is planned,
/// marked or recorded, so the milestones wait (as news or a receipt) until it is back on.
Future<void> processFreshRhythm(Ref ref, Rhythm rhythm) async {
  final prefs = ref.read(rhythmPrefsProvider.notifier);
  await prefs.ensureLoaded();
  if (ref.read(rhythmPrefsProvider).hidden) return;
  final seenRepo = ref.read(rhythmSeenRepositoryProvider);
  final seen = await seenRepo.read();
  // The badges the phone works out from the attempts list (clean set, new best, ...) are news in
  // the same way as the server's: dated by their paper, celebrated once, and an old one on a phone
  // that already knows the student is remembered quietly (never five ceremonies at once).
  final attempts = ref.read(attemptsRepositoryProvider).value;
  final merged = attempts == null ? null : mergeDerived(rhythm.milestones, deriveBadges(attempts));
  final plan = planMilestones(rhythm, seen, ref.read(nowProvider)(), milestones: merged);
  for (final id in plan.silent) {
    await seenRepo.markCelebrated(id);
  }
  final controller = ref.read(celebrationControllerProvider.notifier);
  // Moments first (highest level; the away receipt only when nothing fresher wants Today), then
  // the dated rows.
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

/// A scored paper that lands after the rhythm was read can earn a derived badge: read the badges
/// again against the rhythm already on the phone.
(int, String?)? _attemptsKey(RemoteState<List<Attempt>> s) {
  final list = s.value;
  return list == null ? null : (list.length, list.isEmpty ? null : list.first.id);
}

final rhythmWatcherProvider = Provider<void>((ref) {
  ref.listen<RemoteState<List<Attempt>>>(attemptsRepositoryProvider, (prev, next) {
    final rhythm = ref.read(rhythmRepositoryProvider).value;
    if (rhythm != null && next.value != null && _attemptsKey(prev ?? next) != _attemptsKey(next)) unawaited(_safely(ref, rhythm));
  });
  ref.listen<RemoteState<Rhythm>>(rhythmRepositoryProvider, (prev, next) {
    if (_isFreshRead(prev, next)) unawaited(_safely(ref, next.value!));
  }, fireImmediately: true);
});
