// Compass's choices (subjects, category, score) and everything derived from them. Starts from,
// in order: the choices saved on this phone, then the subjects on the student's sheet, then
// nothing. Every change is saved straight away.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../data/du_repository.dart';
import '../data/tools_store.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';

class CompassState {
  CompassState({
    required this.catalog,
    required this.selection,
    this.category = 'UR',
    this.scoreText = '',
    this.seededFromSheet = false,
  });

  final DuCatalog catalog;
  final DuSelection selection;
  final String category;
  final String scoreText;

  /// The subjects were taken from the student's sheet (shown once, as a note).
  final bool seededFromSheet;

  double? get score => duParseScore(scoreText);
  bool get scoreInvalid => scoreText.trim().isNotEmpty && score == null;
  int get categoryIndex => catalog.categoryIndex(category);
  int get total => catalog.groups.length;

  late final List<DuVerdict> verdicts = duEvaluateAll(catalog.groups, selection);
  late final List<DuVerdict> eligible = [for (final v in verdicts) if (v.eligible) v];
  late final List<DuVerdict> ineligible = [for (final v in verdicts) if (!v.eligible) v];
  late final List<DuUnlock> unlocks = selection.isEmpty ? const [] : duSuggestUnlocks(catalog, selection);

  DuVerdict? verdictFor(String groupId) {
    for (final v in verdicts) {
      if (v.group.id == groupId) return v;
    }
    return null;
  }

  /// The website's `couldClear`: the score meets the lowest effective cutoff of any round.
  bool couldClear(DuGroup group) {
    final s = score;
    if (s == null) return true;
    final lows = [
      for (final r in const ['round-1', 'round-2', 'round-3'])
        if (group.summary[r]?[category]?.low case final double v) v,
    ];
    if (lows.isEmpty) return false;
    return s >= lows.reduce((a, b) => a < b ? a : b);
  }

  CompassState copyWith({DuSelection? selection, String? category, String? scoreText, bool? seededFromSheet}) => CompassState(
        catalog: catalog,
        selection: selection ?? this.selection,
        category: category ?? this.category,
        scoreText: scoreText ?? this.scoreText,
        seededFromSheet: seededFromSheet ?? this.seededFromSheet,
      );
}

class CompassController extends AsyncNotifier<CompassState> {
  @override
  Future<CompassState> build() async {
    final catalog = await ref.watch(duCatalogProvider.future);
    final saved = await ref.read(toolsStoreProvider).compass();
    if (saved != null) {
      final category = catalog.meta.categories.contains(saved.category) ? saved.category : 'UR';
      return CompassState(
        catalog: catalog,
        selection: DuSelection.decode(saved.subjects, catalog),
        category: category,
        scoreText: saved.score,
      );
    }
    final sheet = ref.read(authSnapshotProvider).subjects;
    final seeded = DuSelection.fromIds(sheet, catalog);
    return CompassState(catalog: catalog, selection: seeded, seededFromSheet: !seeded.isEmpty);
  }

  void _set(CompassState next) {
    state = AsyncData(next);
    unawaited(ref.read(toolsStoreProvider).saveCompass(
          SavedCompass(subjects: next.selection.encode(), category: next.category, score: next.scoreText),
        ));
  }

  CompassState? get _now => state.value;

  void toggle(DuPick pick) {
    final s = _now;
    if (s != null) _set(s.copyWith(selection: s.selection.toggle(pick), seededFromSheet: false));
  }

  void setSelection(DuSelection selection) {
    final s = _now;
    if (s != null) _set(s.copyWith(selection: selection, seededFromSheet: false));
  }

  void applyPreset(DuPreset preset) => setSelection(preset.selection);

  void clear() => setSelection(DuSelection.empty);

  void setCategory(String category) {
    final s = _now;
    if (s != null && s.catalog.meta.categories.contains(category)) _set(s.copyWith(category: category));
  }

  void setScore(String text) {
    final s = _now;
    if (s == null) return;
    final clean = text.replaceAll(RegExp('[^0-9.]'), '');
    _set(s.copyWith(scoreText: clean.length > 7 ? clean.substring(0, 7) : clean));
  }
}

final compassControllerProvider = AsyncNotifierProvider<CompassController, CompassState>(
  CompassController.new,
  retry: (count, error) => null,
);
