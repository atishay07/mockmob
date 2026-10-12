// The one place celebrations are decided (spec 6.2). Other modules call
// `ref.read(celebrationControllerProvider.notifier).celebrate(event)` after a server fact is
// acknowledged; a `CelebrationSlot` placed in the screen's layout shows the result.
//
// Rules held here: each id fires once (remembered in `rhythm_seen`), a scope gets at most one
// celebration, the suppressed moments never celebrate, and the Celebrations setting decides
// how much is shown: Full (ring, Mobi hop, receipt, one open haptic), Quiet (plain text) or Off.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/repositories/rhythm_seen_repository.dart';
import '../data/rhythm_prefs.dart';
import 'celebration_event.dart';

/// What a `CelebrationSlot` draws.
class Celebration {
  const Celebration({
    required this.id,
    required this.scope,
    required this.level,
    required this.kind,
    this.sentence,
    this.receipt,
    this.ring = false,
    this.mobiHop = false,
    this.textOnly = false,
  });

  final String id;
  final String scope;
  final CelebrationLevel level;
  final CelebrationKind kind;
  final String? sentence;
  final String? receipt;

  /// The 500 ms ring sweep (a met week). Never in Quiet.
  final bool ring;

  /// One Mobi hop (L2 only). Never in Quiet.
  final bool mobiHop;

  /// Quiet: the same words with no ring, no Mobi and no haptic.
  final bool textOnly;

  /// L3 is a row in the milestone timeline, not a moment on the screen.
  bool get showsMoment => level != CelebrationLevel.l3 && (sentence != null || receipt != null);
}

class CelebrationState {
  const CelebrationState({this.byScope = const {}, this.freshRows = const {}});

  final Map<String, Celebration> byScope;

  /// Milestone ids that just arrived: the milestone screen fades their rows in once.
  final Set<String> freshRows;

  CelebrationState copyWith({Map<String, Celebration>? byScope, Set<String>? freshRows}) =>
      CelebrationState(byScope: byScope ?? this.byScope, freshRows: freshRows ?? this.freshRows);
}

class CelebrationController extends Notifier<CelebrationState> {
  final Set<String> _usedScopes = {};

  @override
  CelebrationState build() => const CelebrationState();

  /// Celebrates [event] when the rules allow it and returns what is shown, or null when nothing
  /// is (already fired, suppressed, scope taken, or the setting is Off).
  Future<Celebration?> celebrate(CelebrationEvent event) async {
    if (event.suppressedBy != null) return null;
    final isRow = event.level == CelebrationLevel.l3;
    if (!isRow && (_usedScopes.contains(event.scope) || state.byScope.containsKey(event.scope))) return null;

    final seen = ref.read(rhythmSeenRepositoryProvider);
    if (!await seen.markCelebrated(event.id)) return null;
    for (final id in event.extraIds) {
      await seen.markCelebrated(id);
    }

    final prefs = ref.read(rhythmPrefsProvider.notifier);
    await prefs.ensureLoaded();
    final mode = ref.read(rhythmPrefsProvider).mode;
    if (mode == CelebrationMode.off) return null;
    final quiet = mode == CelebrationMode.quiet;

    final celebration = Celebration(
      id: event.id,
      scope: event.scope,
      level: event.level,
      kind: event.kind,
      sentence: event.sentence,
      receipt: event.receipt,
      ring: event.ring && !quiet,
      mobiHop: event.level == CelebrationLevel.l2 && !quiet,
      textOnly: quiet,
    );

    if (isRow) {
      if (!quiet) state = state.copyWith(freshRows: {...state.freshRows, event.id, ...event.extraIds});
      return celebration;
    }
    _usedScopes.add(event.scope);
    state = state.copyWith(byScope: {...state.byScope, event.scope: celebration});
    if (!quiet) await ref.read(hapticsProvider).open();
    return celebration;
  }

  /// For a moment that carries several facts (a repair that is also the first repair): fires the
  /// highest level only, so a scope never gets two. The others are left for a later moment.
  Future<Celebration?> celebrateBest(List<CelebrationEvent> events) {
    final eligible = [for (final e in events) if (e.suppressedBy == null) e];
    if (eligible.isEmpty) return Future.value(null);
    eligible.sort((a, b) => _rank(b).compareTo(_rank(a)));
    return celebrate(eligible.first);
  }

  static int _rank(CelebrationEvent e) => switch (e.level) {
        CelebrationLevel.l2 => 3,
        CelebrationLevel.l1 => 2,
        CelebrationLevel.l3 => 1,
      };

  /// The host calls this when it leaves, so a returning visit to the same scope can celebrate
  /// again with a new id. Ids that already fired never fire again.
  void clearScope(String scope) {
    _usedScopes.remove(scope);
    if (!state.byScope.containsKey(scope)) return;
    final next = {...state.byScope}..remove(scope);
    state = state.copyWith(byScope: next);
  }

  /// The milestone screen calls this after it faded the fresh rows in.
  void clearFreshRows() {
    if (state.freshRows.isEmpty) return;
    state = state.copyWith(freshRows: const {});
  }
}

final celebrationControllerProvider = NotifierProvider<CelebrationController, CelebrationState>(CelebrationController.new);
