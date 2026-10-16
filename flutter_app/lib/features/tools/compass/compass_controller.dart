// Compass's choices (subjects, category, score) and everything derived from them. Starts from,
// in order: the choices saved on this phone, then the subjects on the student's sheet, then
// nothing. Every change is saved, except while a combination from Combo is only being looked
// at: the student's own subjects stay what is saved until they change something.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
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
    this.scoreHighText = '',
    this.scoreAt,
    this.seededFromSheet = false,
    this.held,
  }) : _derived = _Derived(catalog, selection);

  CompassState._reuse(
    this._derived, {
    required this.category,
    required this.scoreText,
    required this.scoreHighText,
    required this.scoreAt,
    required this.seededFromSheet,
    required this.held,
  });

  final _Derived _derived;
  DuCatalog get catalog => _derived.catalog;
  DuSelection get selection => _derived.selection;
  final String category;
  final String scoreText;

  /// The high end of a typed range ('' for one figure) and when the estimate was typed (null when
  /// nothing is typed). A newer full mock takes over from a typed estimate (estimate_providers).
  final String scoreHighText;
  final DateTime? scoreAt;

  /// The subjects were taken from the student's sheet (shown once, as a note).
  final bool seededFromSheet;

  /// Set while a combination from Combo is on show: the student's own subjects, which stay
  /// what is saved on this phone until they change something or keep the combination.
  final DuSelection? held;
  bool get previewing => held != null;

  double? get score => duParseScore(scoreText);

  /// The typed range's high end: [score] for a single figure, never below it.
  double? get scoreHigh {
    final lo = score;
    final hi = duParseScore(scoreHighText);
    if (lo == null) return null;
    return hi == null || hi < lo ? lo : hi;
  }
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

  /// The website's `couldClear`: the score (or [value], the top of the student's estimate) meets
  /// the lowest effective cutoff of any round.
  bool couldClear(DuGroup group, [double? value]) {
    final s = value ?? score;
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
    String? scoreHighText,
    DateTime? scoreAt,
    bool clearScoreAt = false,
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
        scoreHighText: scoreHighText ?? this.scoreHighText,
        scoreAt: clearScoreAt ? null : (scoreAt ?? this.scoreAt),
        seededFromSheet: seededFromSheet ?? this.seededFromSheet,
        held: nextHeld,
      );
    }
    return CompassState(
      catalog: catalog,
      selection: selection,
      category: category ?? this.category,
      scoreText: scoreText ?? this.scoreText,
      scoreHighText: scoreHighText ?? this.scoreHighText,
      scoreAt: clearScoreAt ? null : (scoreAt ?? this.scoreAt),
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
      // A score saved before estimates had a time counts as typed now (once), so it still wins
      // over mocks taken before today and gives way to the next new one.
      final migrate = saved.score.trim().isNotEmpty && saved.scoreAt == null;
      base = CompassState(
        catalog: catalog,
        selection: DuSelection.decode(saved.subjects, catalog),
        category: category,
        scoreText: saved.score,
        scoreHighText: saved.scoreHigh,
        scoreAt: saved.score.trim().isEmpty ? null : (saved.scoreAt ?? ref.read(nowProvider)()),
      );
      if (migrate) {
        unawaited(ref.read(toolsStoreProvider).saveCompass(
              SavedCompass(subjects: saved.subjects, category: category, score: saved.score, scoreHigh: saved.scoreHigh, scoreAt: base.scoreAt),
            ));
      }
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
              SavedCompass(
                subjects: (next.held ?? next.selection).encode(),
                category: next.category,
                score: next.scoreText,
                scoreHigh: next.scoreHighText,
                scoreAt: next.scoreAt,
              ),
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
    final kept = clean.length > 7 ? clean.substring(0, 7) : clean;
    _set(kept.isEmpty
        ? s.copyWith(scoreText: '', scoreHighText: '', clearScoreAt: true)
        : s.copyWith(scoreText: kept, scoreHighText: '', scoreAt: ref.read(nowProvider)()));
  }

  /// The student's own estimate, a range or one figure ([high] null or equal), typed now.
  void setEstimate(double low, double? high) {
    final s = _now;
    if (s == null) return;
    final lo = high != null && high < low ? high : low;
    final hi = high == null ? null : (high < low ? low : high);
    _set(s.copyWith(
      scoreText: duFormatScore(lo),
      scoreHighText: hi == null || (hi - lo).abs() < 0.05 ? '' : duFormatScore(hi),
      scoreAt: ref.read(nowProvider)(),
    ));
  }

  /// Drops the typed estimate (mocks or the projection take over when there are any).
  void clearEstimate() {
    final s = _now;
    if (s != null) _set(s.copyWith(scoreText: '', scoreHighText: '', clearScoreAt: true));
  }
}

final compassControllerProvider = AsyncNotifierProvider<CompassController, CompassState>(
  CompassController.new,
  retry: (count, error) => null,
);
