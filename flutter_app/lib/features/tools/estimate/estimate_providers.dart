// One estimate for every screen of the Colleges area (the tab, Compass, the chooser, Check a
// score and Today's card): what the student typed, else their latest full mocks, else the Compass
// Pro projection. Nothing when none exists, and nothing is ever asked for.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../compass/compass_controller.dart';
import '../compass/score_sources.dart';
import '../pro/compass_pro_repository.dart';
import 'estimate.dart';

final estimateProvider = Provider<Estimate?>((ref) {
  final typed = ref.watch(compassControllerProvider.select((s) => s.value?.score));
  if (typed != null && typed >= 0 && typed <= 1000) {
    return Estimate(source: EstimateSource.typed, low: typed, high: typed);
  }
  final mocks = ref.watch(compassMockScoreProvider);
  if (mocks != null) {
    final t = mocks.total.toDouble();
    return Estimate(source: EstimateSource.mocks, low: t, high: t);
  }
  if (ref.watch(compassProjectionScoreProvider) != null) {
    final total = ref.watch(compassProRepositoryProvider).value?.total;
    if (total != null) return Estimate(source: EstimateSource.projection, low: total.low.toDouble(), high: total.high.toDouble());
  }
  return null;
});

/// The student's category ("UR" until Compass knows it).
final estimateCategoryProvider = Provider<String>((ref) => ref.watch(compassControllerProvider.select((s) => s.value?.category)) ?? 'UR');
