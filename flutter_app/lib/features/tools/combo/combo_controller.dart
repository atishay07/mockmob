// The Combo planner's choices (targets, the subject pool, the paper limit), saved on this phone,
// and the ranked plan, computed off the UI thread from the same evaluator as Compass.

import 'dart:async';
import 'dart:isolate';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../data/du_repository.dart';
import '../data/my_colleges_actions.dart';
import '../data/tools_store.dart';
import '../domain/du_combos.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';

class ComboState {
  const ComboState({
    required this.catalog,
    this.targets = const [],
    this.pool = const [],
    this.maxPapers = duDefaultMaxPapers,
    this.targetsFromColleges = false,
    this.poolFromSheet = false,
  });

  final DuCatalog catalog;
  final List<String> targets;
  final List<DuPick> pool;
  final int maxPapers;

  /// The targets were filled from My colleges on the first open (the screen says so).
  final bool targetsFromColleges;

  /// The subjects were filled from the student's sheet on the first open.
  final bool poolFromSheet;

  bool get targetsFull => targets.length >= duMaxTargets;
  bool get poolFull => pool.length >= duMaxPool;

  ComboState copyWith({List<String>? targets, List<DuPick>? pool, int? maxPapers}) => ComboState(
        catalog: catalog,
        targets: targets ?? this.targets,
        pool: pool ?? this.pool,
        maxPapers: maxPapers ?? this.maxPapers,
        targetsFromColleges: targets == null && targetsFromColleges,
        poolFromSheet: pool == null && poolFromSheet,
      );
}

class ComboController extends AsyncNotifier<ComboState> {
  @override
  Future<ComboState> build() async {
    final catalog = await ref.watch(duCatalogProvider.future);
    final saved = await ref.read(toolsStoreProvider).combo();
    if (saved == null) {
      // First open: honest defaults from what the student already told us, each labelled.
      final mine = ref.read(myCollegesProvider);
      final targets = <String>{
        if (mine.ready)
          for (final c in mine.colleges)
            if (catalog.group(c.programmeId) != null) c.programmeId,
      }.take(duMaxTargets).toList();
      final pool = DuSelection.fromIds(ref.read(authSnapshotProvider).subjects, catalog).picks.take(duMaxPool).toList();
      return ComboState(catalog: catalog, targets: targets, pool: pool, targetsFromColleges: targets.isNotEmpty, poolFromSheet: pool.isNotEmpty);
    }
    bool known(DuPick p) => switch (p.kind) {
          DuPickKind.language => catalog.isLanguage(p.id),
          DuPickKind.domain => catalog.isDomain(p.id),
          DuPickKind.gat => true,
        };
    return ComboState(
      catalog: catalog,
      targets: saved.targets.where((id) => catalog.group(id) != null).take(duMaxTargets).toList(),
      pool: [for (final k in saved.pool) ?DuPick.parse(k)].where(known).take(duMaxPool).toList(),
      maxPapers: saved.maxPapers,
    );
  }

  void _set(ComboState next) {
    state = AsyncData(next);
    unawaited(ref.read(toolsStoreProvider).saveCombo(
          SavedCombo(targets: next.targets, pool: [for (final p in next.pool) p.key], maxPapers: next.maxPapers),
        ));
  }

  void toggleTarget(String id) {
    final s = state.value;
    if (s == null) return;
    if (s.targets.contains(id)) {
      _set(s.copyWith(targets: [...s.targets.where((t) => t != id)]));
    } else if (!s.targetsFull) {
      _set(s.copyWith(targets: [...s.targets, id]));
    }
  }

  void togglePick(DuPick pick) {
    final s = state.value;
    if (s == null) return;
    if (s.pool.contains(pick)) {
      _set(s.copyWith(pool: [...s.pool.where((p) => p != pick)]));
    } else if (!s.poolFull) {
      _set(s.copyWith(pool: [...s.pool, pick]));
    }
  }

  void applyPreset(DuPreset preset) {
    final s = state.value;
    if (s != null) _set(s.copyWith(pool: preset.selection.picks.take(duMaxPool).toList()));
  }

  void clearPool() {
    final s = state.value;
    if (s != null) _set(s.copyWith(pool: const []));
  }

  void setMaxPapers(int n) {
    final s = state.value;
    if (s != null && n >= 3 && n <= 5) _set(s.copyWith(maxPapers: n));
  }
}

final comboControllerProvider = AsyncNotifierProvider<ComboController, ComboState>(
  ComboController.new,
  retry: (count, error) => null,
);

/// Runs the planner. The default moves anything but a tiny pool to a background isolate
/// (12 subjects and 5 papers is 1,585 combinations, each checked against 73 programmes).
typedef ComboRunner = Future<DuComboPlan> Function(List<DuGroup> groups, List<DuPick> pool, List<String> targets, int maxPapers);

final comboRunnerProvider = Provider<ComboRunner>((ref) => runComboPlan);

/// The runner for the keep reasons' extra plans (one per kept subject). Its own seam, so a test
/// that gates the main plan is not handed these too.
final comboKeepRunnerProvider = Provider<ComboRunner>((ref) => runComboPlan);

/// Top level, so the isolate's closure carries only the inputs.
Future<DuComboPlan> runComboPlan(List<DuGroup> groups, List<DuPick> pool, List<String> targets, int maxPapers) {
  DuComboPlan run() => duPlanCombos(groups: groups, pool: pool, targets: targets, maxPapers: maxPapers);
  return pool.length <= 5 ? Future.value(run()) : Isolate.run(run);
}

/// The ranked plan for the current choices. Keeps the previous plan visible while a new one is
/// being checked (`isLoading` with a value).
final comboPlanProvider = FutureProvider.autoDispose<DuComboPlan>(retry: (count, error) => null, (ref) async {
  final s = ref.watch(comboControllerProvider).value;
  if (s == null || s.pool.isEmpty) return DuComboPlan.empty;
  return ref.read(comboRunnerProvider)(s.catalog.groups, s.pool, s.targets, s.maxPapers);
});

/// Why each "keep" subject matters: the best plan re-run with that subject taken out. Runs after
/// the plan lands, through the same runner (off the UI thread for real pools).
final comboKeepReasonsProvider = FutureProvider.autoDispose<List<DuKeepReason>>(retry: (count, error) => null, (ref) async {
  final s = ref.watch(comboControllerProvider).value;
  final plan = await ref.watch(comboPlanProvider.future);
  if (s == null || plan.keep.isEmpty || plan.ranked.isEmpty) return const [];
  final run = ref.read(comboKeepRunnerProvider);
  final without = <DuPick, DuComboPlan>{
    for (final k in plan.keep) k: await run(s.catalog.groups, [for (final p in s.pool) if (p != k) p], s.targets, s.maxPapers),
  };
  return duKeepReasons(plan, without, (id) => s.catalog.group(id)?.name ?? id);
});
