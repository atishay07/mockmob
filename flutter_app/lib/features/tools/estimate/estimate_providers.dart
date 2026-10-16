// One estimate for every screen of the Colleges area (the tab, Compass, the chooser, Check a
// score and Today's card): what the student typed after their newest full mock, else the range
// of their latest full mocks, else the Compass Pro projection. Nothing when none exists, and
// nothing is ever asked for.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../practice/data/practice_catalog.dart';
import '../compass/compass_controller.dart';
import '../compass/score_sources.dart';
import '../domain/du_mock_score.dart';
import '../pro/compass_pro_repository.dart';
import 'estimate.dart';

/// The range from the student's full mocks in the subjects ticked in Compass, or null.
final mockRangeProvider = Provider<DuMockRange?>((ref) {
  final selection = ref.watch(compassControllerProvider.select((s) => s.value?.selection));
  final attempts = ref.watch(compassAttemptsProvider);
  if (selection == null || attempts == null || attempts.isEmpty) return null;
  final subjects = ref.watch(practiceSubjectsProvider).value ?? const [];
  final publicOf = {for (final s in subjects) s.internalId: s.id};
  return duMockRange(attempts, selection, publicIdOf: (internal) => publicOf[internal] ?? internal);
});

/// What the mocks still need before they make an estimate ("Full mocks in 2 of the 4 papers"),
/// or null when they already make one or there are none at all.
final mockPartialProvider = Provider<DuMockPartial?>((ref) {
  if (ref.watch(mockRangeProvider) != null) return null;
  final selection = ref.watch(compassControllerProvider.select((s) => s.value?.selection));
  final attempts = ref.watch(compassAttemptsProvider);
  if (selection == null || attempts == null || attempts.isEmpty) return null;
  final subjects = ref.watch(practiceSubjectsProvider).value ?? const [];
  final publicOf = {for (final s in subjects) s.internalId: s.id};
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
final mocksEstimateProvider = Provider<Estimate?>((ref) {
  final r = ref.watch(mockRangeProvider);
  if (r == null) return null;
  return Estimate(
    source: EstimateSource.mocks,
    low: r.low.toDouble(),
    high: r.high.toDouble(),
    at: r.at,
    papers: [for (final p in r.papers) (id: p.id, marks: p.marks.first)],
  );
});

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
