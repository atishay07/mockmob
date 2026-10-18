// One estimate for every screen of the Colleges area (the tab, Compass, the chooser, Check a
// score, Your plan and Today's range card): what the student typed after their newest full mock,
// else the range from their full mocks, else the Compass Pro projection. Nothing when none exists,
// and nothing is ever asked for.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/attempts_repository.dart' show attemptsRepositoryProvider;
import '../../onboarding/data/subjects.dart' show SheetSubject;
import '../../practice/data/practice_catalog.dart';
import '../compass/compass_controller.dart';
import '../compass/score_sources.dart';
import '../data/tools_store.dart' show toolsStoreProvider;
import '../domain/du_helpers.dart' show duParseScore;
import '../domain/du_mock_score.dart';
import '../domain/du_models.dart';
import '../pro/compass_pro_repository.dart';
import 'estimate.dart';
import 'estimate_copy.dart';
import 'mock_estimate.dart';
import 'range_choice.dart';

/// The student's own subjects (their sheet) as DU papers: English is the one language MockMob
/// teaches, every other subject but the General Test is a domain paper. Read without the DU
/// catalogue, so Today never loads it. Null when the sheet holds no paper.
final ownRangeSelectionProvider = Provider<DuSelection?>((ref) {
  final key = ref.watch(authSnapshotProvider.select((a) => a.subjects.join(',')));
  if (key.isEmpty) return null;
  final languages = <String>[];
  final domains = <String>[];
  for (final raw in key.split(',')) {
    final s = SheetSubject.byId(raw.trim().toLowerCase());
    if (s == null) continue;
    if (s.isLanguage && !languages.contains(s.id)) languages.add(s.id);
    if (s.isListB && !domains.contains(s.id)) domains.add(s.id);
  }
  if (languages.isEmpty && domains.isEmpty) return null;
  return DuSelection(languages: languages, domains: domains);
});

/// The papers the estimate counts: the student's own subjects, else the ones ticked in Compass.
final rangeSelectionProvider = Provider<DuSelection?>((ref) {
  return ref.watch(ownRangeSelectionProvider) ?? ref.watch(compassControllerProvider.select((s) => s.value?.selection));
});

/// Attempt subject ids (internal) to the public ids the selection uses. Read only once the subject
/// list is up (the two differ for a few subjects only), so a screen never starts that fetch for it.
final _publicIdsProvider = Provider<Map<String, String>>((ref) {
  final subjects = (ref.exists(practiceSubjectsProvider) ? ref.watch(practiceSubjectsProvider).value : null) ?? const [];
  return {for (final s in subjects) s.internalId: s.id};
});

/// The range from the student's full mocks (each counted paper's average plus and minus its spread),
/// or null without a full mock in a language and three domain subjects.
final mockEstimateProvider = Provider<MockEstimate?>((ref) {
  final selection = ref.watch(rangeSelectionProvider);
  final attempts = ref.watch(compassAttemptsProvider);
  if (selection == null || attempts == null || attempts.isEmpty) return null;
  final publicOf = ref.watch(_publicIdsProvider);
  return mockEstimate(attempts, selection, publicIdOf: (internal) => publicOf[internal] ?? internal);
});

/// What the mocks still need before they make an estimate ("Full mocks in 2 of the 4 papers"),
/// or null when they already make one or there are none at all.
final mockPartialProvider = Provider<DuMockPartial?>((ref) {
  if (ref.watch(mockEstimateProvider) != null) return null;
  final selection = ref.watch(rangeSelectionProvider);
  final attempts = ref.watch(compassAttemptsProvider);
  if (selection == null || attempts == null || attempts.isEmpty) return null;
  final publicOf = ref.watch(_publicIdsProvider);
  return duMockPartial(attempts, selection, publicIdOf: (internal) => publicOf[internal] ?? internal);
});

/// The typed estimate alone (Compass's saved figure or range), or null.
final typedEstimateProvider = Provider<Estimate?>((ref) {
  final s = ref.watch(compassControllerProvider).value;
  final low = s?.score;
  if (s == null || low == null || low < 0 || low > 1000) return null;
  final high = (s.scoreHigh ?? low).clamp(0.0, 1000.0);
  return Estimate(source: EstimateSource.typed, low: low, high: high, at: s.scoreAt);
});

/// The estimate from the mocks alone, or null.
final mocksEstimateProvider = Provider<Estimate?>((ref) => ref.watch(mockEstimateProvider)?.estimate);

/// The Compass Pro projection's total range, only when it covers all four papers.
final projectionEstimateProvider = Provider<Estimate?>((ref) {
  if (ref.watch(compassProjectionScoreProvider) == null) return null;
  final total = ref.watch(compassProRepositoryProvider).value?.total;
  if (total == null) return null;
  return Estimate(source: EstimateSource.projection, low: total.low.toDouble(), high: total.high.toDouble());
});

final estimateProvider = Provider<Estimate?>((ref) => pickEstimate(
      typed: ref.watch(typedEstimateProvider),
      mocks: ref.watch(mocksEstimateProvider),
      projection: ref.watch(projectionEstimateProvider),
    ));

/// The student's category ("UR" until Compass knows it).
final estimateCategoryProvider = Provider<String>((ref) => ref.watch(compassControllerProvider.select((s) => s.value?.category)) ?? 'UR');

// ---------------------------------------------------------------------------------------------
// "I don't know my range yet" (D109).

/// The way to a range from the student's own subjects: one full mock in each. Null when the sheet
/// holds no paper. Never loads the DU catalogue.
final rangeProgressProvider = Provider<RangeProgress?>((ref) {
  final selection = ref.watch(ownRangeSelectionProvider);
  if (selection == null) return null;
  final attempts = ref.watch(compassAttemptsProvider) ?? const [];
  final publicOf = ref.watch(_publicIdsProvider);
  return rangeProgress(attempts, selection, publicIdOf: (internal) => publicOf[internal] ?? internal);
});

/// What Today's range card shows.
sealed class RangeCard {
  const RangeCard();
}

/// Nothing: the student has a range, took one, put the card to rest, or has no subjects yet.
class RangeCardHidden extends RangeCard {
  const RangeCardHidden();
}

/// One full mock in each subject still to go.
class RangeCardSteps extends RangeCard {
  const RangeCardSteps(this.progress);

  final RangeProgress progress;
}

/// Every subject has a full mock: the estimated range, to take or to keep improving.
class RangeCardReady extends RangeCard {
  const RangeCardReady(this.progress, this.estimate);

  final RangeProgress progress;
  final MockEstimate estimate;
}

/// Today's card (owner, 19 Oct, D109). Shown while the student has no range of their own: by
/// default on a fresh account, and after "I don't know my range yet". It goes when they type a
/// range or take the estimate, and rests after "Sit more mocks first" until a newer full mock.
final rangeCardProvider = Provider<RangeCard>((ref) {
  final progress = ref.watch(rangeProgressProvider);
  if (progress == null || progress.total == 0) return const RangeCardHidden();
  final memory = ref.watch(rangeChoiceProvider).value;
  if (memory == null) return const RangeCardHidden();
  switch (memory.choice) {
    case RangeChoice.accepted || RangeChoice.typed:
      return const RangeCardHidden();
    case RangeChoice.none:
      // A range typed in Compass's own score field (which says no choice): read only when Compass is
      // already up, so Today never loads the DU catalogue for it.
      if (ref.exists(compassControllerProvider) && ref.watch(typedEstimateProvider) != null) return const RangeCardHidden();
    case RangeChoice.unknown:
      break;
  }
  final rested = memory.restedAt;
  if (rested != null && !(progress.newest?.isAfter(rested) ?? false)) return const RangeCardHidden();
  final estimate = progress.estimate;
  if (progress.complete && estimate != null) return RangeCardReady(progress, estimate);
  return RangeCardSteps(progress);
});

/// The typed estimate as saved on this phone, read without starting Compass (and so without the DU
/// catalogue). Read again whenever the range choice changes.
final savedTypedEstimateProvider = FutureProvider<Estimate?>((ref) async {
  ref.watch(rangeChoiceProvider);
  final saved = await ref.read(toolsStoreProvider).compass();
  final low = duParseScore(saved?.score ?? '');
  if (saved == null || low == null) return null;
  final high = duParseScore(saved.scoreHigh) ?? low;
  return Estimate(source: EstimateSource.typed, low: low < high ? low : high, high: low < high ? high : low, at: saved.scoreAt);
});

/// The note on Your plan's "Score range" row: the range and where it came from, else how far the
/// mocks have got, else "Not set". It reads what the app has already loaded (Today loads the
/// attempts, Colleges starts Compass), so opening Your plan never starts the attempts database or
/// the DU catalogue itself; the typed range comes from this phone until Compass is up.
final rangePlanNoteProvider = Provider<String>((ref) {
  final compassUp = ref.exists(compassControllerProvider);
  final attemptsUp = ref.exists(attemptsRepositoryProvider) || ref.exists(compassAttemptsProvider);
  final progress = attemptsUp ? ref.watch(rangeProgressProvider) : null;
  final e = compassUp && attemptsUp
      ? ref.watch(estimateProvider)
      : pickEstimate(
          typed: compassUp ? ref.watch(typedEstimateProvider) : ref.watch(savedTypedEstimateProvider).value,
          mocks: progress?.estimate?.estimate,
        );
  if (e != null) return EstimateCopy.planNote(e);
  if (progress != null && progress.total > 0) return EstimateCopy.planFinding(progress.done, progress.total);
  return EstimateCopy.planNotSet;
});
