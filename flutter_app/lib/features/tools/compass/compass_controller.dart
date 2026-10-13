// Compass's choices (subjects, category, score) and everything derived from them. Starts from,
// in order: the choices saved on this phone, then the subjects on the student's sheet, then
// nothing. Every change is saved, except while a combination from Combo is only being looked
// at: the student's own subjects stay what is saved until they change something.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../data/du_repository.dart';
import '../data/tools_store.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';

/// Everything worked out from the subjects alone. Held apart from [CompassState] so a score
/// keystroke or a category tap, which leave the subjects as they were, reuse it instead of
/// evaluating every programme again.
class _Derived {
  _Derived(this.catalog, this.selection);

  final DuCatalog catalog;
  final DuSelection selection;

  late final List<DuVerdict> verdicts = duEvaluateAll(catalog.groups, selection);
  late final List<DuVerdict> eligible = [for (final v in verdicts) if (v.eligible) v];
  late final List<DuVerdict> ineligible = [for (final v in verdicts) if (!v.eligible) v];
  late final List<DuUnlock> unlocks = selection.isEmpty ? const [] : duSuggestUnlocks(catalog, selection);
}

class CompassState {
  CompassState({
    required DuCatalog catalog,
    required DuSelection selection,
    this.category = 'UR',
    this.scoreText = '',
    this.seededFromSheet = false,
    this.held,
  }) : _derived = _Derived(catalog, selection);

  CompassState._reuse(this._derived, {required this.category, required this.scoreText, required this.seededFromSheet, required this.held});

  final _Derived _derived;
  DuCatalog get catalog => _derived.catalog;
  DuSelection get selection => _derived.selection;
  final String category;
  final String scoreText;

  /// The subjects were taken from the student's sheet (shown once, as a note).
  final bool seededFromSheet;

  /// Set while a combination from Combo is on show: the student's own subjects, which stay
  /// what is saved on this phone until they change something or keep the combination.
  final DuSelection? held;
  bool get previewing => held != null;

  double? get score => duParseScore(scoreText);
  bool get scoreInvalid => scoreText.trim().isNotEmpty && score == null;
  int get categoryIndex => catalog.categoryIndex(category);
  int get total => catalog.groups.length;

  List<DuVerdict> get verdicts => _derived.verdicts;
  List<DuVerdict> get eligible => _derived.eligible;
  List<DuVerdict> get ineligible => _derived.ineligible;
  List<DuUnlock> get unlocks => _derived.unlocks;

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

  /// [held] sets the subjects to keep while a combination is shown; [clearHeld] drops them
  /// (the subjects on screen are now the student's own).
  CompassState copyWith({
    DuSelection? selection,
    String? category,
    String? scoreText,
    bool? seededFromSheet,
    DuSelection? held,
    bool clearHeld = false,
  }) {
    final nextHeld = clearHeld ? null : (held ?? this.held);
    if (selection == null || selection == this.selection) {
      return CompassState._reuse(
        _derived,
        category: category ?? this.category,
        scoreText: scoreText ?? this.scoreText,
        seededFromSheet: seededFromSheet ?? this.seededFromSheet,
        held: nextHeld,
      );
    }
    return CompassState(
      catalog: catalog,
      selection: selection,
      category: category ?? this.category,
      scoreText: scoreText ?? this.scoreText,
      seededFromSheet: seededFromSheet ?? this.seededFromSheet,
      held: nextHeld,
    );
  }
}

class CompassController extends AsyncNotifier<CompassState> {
  /// A combination asked for before Compass had loaded; shown as soon as it has.
  DuSelection? _pending;

  bool _saving = false;
  CompassState? _unsaved;

  @override
  Future<CompassState> build() async {
    final catalog = await ref.watch(duCatalogProvider.future);
    final saved = await ref.read(toolsStoreProvider).compass();
    final CompassState base;
    if (saved != null) {
      final category = catalog.meta.categories.contains(saved.category) ? saved.category : 'UR';
      base = CompassState(
        catalog: catalog,
        selection: DuSelection.decode(saved.subjects, catalog),
        category: category,
        scoreText: saved.score,
      );
    } else {
      final sheet = ref.read(authSnapshotProvider).subjects;
      final seeded = DuSelection.fromIds(sheet, catalog);
      base = CompassState(catalog: catalog, selection: seeded, seededFromSheet: !seeded.isEmpty);
    }
    final pending = _pending;
    if (pending == null) return base;
    _pending = null;
    return base.copyWith(selection: pending, held: base.selection, seededFromSheet: false);
  }

  /// Saves what is on screen, except that a combination on show is not the student's choice,
  /// so their own subjects are saved instead. A write that arrives while one is in flight is
  /// merged into a single follow-up, so typing a score does not write on every key.
  void _set(CompassState next) {
    state = AsyncData(next);
    _unsaved = next;
    if (!_saving) unawaited(_flush());
  }

  Future<void> _flush() async {
    _saving = true;
    try {
      for (var next = _unsaved; next != null; next = _unsaved) {
        _unsaved = null;
        await ref.read(toolsStoreProvider).saveCompass(
              SavedCompass(subjects: (next.held ?? next.selection).encode(), category: next.category, score: next.scoreText),
            );
      }
    } finally {
      _saving = false;
    }
  }

  CompassState? get _now => state.value;

  void toggle(DuPick pick) {
    final s = _now;
    if (s != null) _set(s.copyWith(selection: s.selection.toggle(pick), seededFromSheet: false, clearHeld: true));
  }

  void setSelection(DuSelection selection) {
    final s = _now;
    if (s != null) _set(s.copyWith(selection: selection, seededFromSheet: false, clearHeld: true));
  }

  /// Shows a combination's subjects without replacing the student's own. Nothing about the
  /// subjects is saved until they change something or [keepCombination].
  void showCombination(DuSelection selection) {
    final s = _now;
    if (s == null) {
      _pending = selection;
      return;
    }
    state = AsyncData(s.copyWith(selection: selection, held: s.held ?? s.selection, seededFromSheet: false));
  }

  /// Makes the combination on show the student's saved subjects.
  void keepCombination() {
    final s = _now;
    if (s != null && s.previewing) _set(s.copyWith(clearHeld: true));
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
