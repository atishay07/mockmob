// The badge list the screens read: the server's milestones with the phone's derived badges merged
// in (`derived_badges.dart`), and the exact counts toward the next ones. While the attempts list
// has not loaded, the five derived badges are "unknown" on the board (never guessed earned, and never
// called "not yet" either).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/rhythm.dart';
import '../../../core/repositories/repositories.dart';
import '../logic/badge_record.dart';
import '../logic/derived_badges.dart';
import '../logic/milestone_progress.dart';
import '../logic/milestone_tracks.dart';
import 'rhythm_providers.dart';

/// Ids of every derived badge, so each shows even before the attempts list has loaded.
final List<String> derivedBadgeIds = [for (final s in milestoneSteps) if (s.source == BadgeSource.derived) s.id];

/// The derived badges earned, keyed by id (empty until the attempts list loads).
final derivedBadgesProvider = Provider<Map<String, DerivedBadge>>((ref) {
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  return attempts == null ? const {} : deriveBadges(attempts);
});

/// The merged badge list (server first, then derived). Null while the rhythm has no data.
final badgeMilestonesProvider = Provider<List<RhythmMilestone>?>((ref) {
  final server = ref.watch(rhythmSnapshotProvider.select((s) => s.rhythm?.milestones));
  if (server == null) return null;
  return mergeDerived(server, ref.watch(derivedBadgesProvider), derivedIds: derivedBadgeIds);
});

/// The derived badges the phone cannot read yet: all of them while the attempts list has not loaded
/// (no value, neither cached nor fresh), none once it has.
final badgeUnreadableProvider = Provider<Set<String>>((ref) {
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  return attempts == null ? {...derivedBadgeIds} : const {};
});

/// The board: the four paths with every badge's state. Null while the rhythm has no data.
final badgeTracksProvider = Provider<List<TrackView>?>((ref) {
  final milestones = ref.watch(badgeMilestonesProvider);
  if (milestones == null) return null;
  return milestoneTracks(milestones, unreadable: ref.watch(badgeUnreadableProvider));
});

/// Exact counts toward the next badges (see `milestoneProgress`).
final badgeProgressProvider = Provider<Map<String, int>>((ref) {
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  final rhythm = ref.watch(rhythmSnapshotProvider.select((s) => s.rhythm));
  return milestoneProgress(attempts: attempts, rhythm: rhythm);
});

/// The paper behind each derived badge earned (for the badge sheet's record line).
final badgeRecordsProvider = Provider<Map<String, BadgeRecord>>((ref) {
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  if (attempts == null) return const {};
  return badgeRecords(ref.watch(derivedBadgesProvider), attempts);
});
