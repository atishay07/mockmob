// The one place celebrations are decided (spec 6.2). Other modules call
// `ref.read(celebrationControllerProvider.notifier).celebrate(event)` after a server fact is
// acknowledged; a `CelebrationSlot` placed in the screen's layout shows the result.
//
// Rules held here: each id fires once (remembered in `rhythm_seen`), a scope gets at most one
// celebration, the suppressed moments never celebrate, nothing fires while rhythm is turned off,
// and the Celebrations setting decides how much is shown: Full (ring, Mobi hop, receipt, one success
// haptic), Quiet (plain text) or Off.
//
// Mark-first rule: an id is used up when `celebrate` accepts it, before any slot draws it, so a
// moment can never show twice (a crash after the frame, two screens, a second phone read). The
// cost is that a moment fired into a scope with no `CelebrationSlot` on screen is spent unseen,
// so every scope that is fired into has a slot: Today (`CelebrationScope.today`, under the week
// strip), the result screen (`CelebrationScope.result`), and the weekly ending card, which draws
// its own ring. While rhythm is off nothing is used up: the moment waits until it is back on.
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
    this.studyDays,
    this.goal,
    this.mobiHop = false,
    this.textOnly = false,
    this.linkLabel,
    this.link,
  });

  final String id;
  final String scope;
  final CelebrationLevel level;
  final CelebrationKind kind;
  final String? sentence;
  final String? receipt;

  /// The 500 ms ring sweep (a met week). Never in Quiet.
  final bool ring;

  /// The counts behind the ring (see `CelebrationEvent.studyDays`).
  final int? studyDays;
  final int? goal;

  /// One Mobi hop (L2 only). Never in Quiet.
  final bool mobiHop;

  /// Quiet: the same words with no ring, no Mobi and no haptic.
  final bool textOnly;

  /// A quiet key under the receipt and the in-app route it opens (the milestone receipt).
  final String? linkLabel;
  final String? link;

  /// L3 is a row in the milestone timeline, not a moment on the screen.
  bool get showsMoment => level != CelebrationLevel.l3 && (sentence != null || receipt != null);
}

class CelebrationState {
  const CelebrationState({this.byScope = const {}, this.freshRows = const {}});

  final Map<String, Celebration> byScope;

  /// Milestone ids that just arrived: the milestone screen plays their earned moment once.
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

    final prefs = ref.read(rhythmPrefsProvider.notifier);
    await prefs.ensureLoaded();
    // Rhythm turned off: hidden everywhere, and the moment is not used up.
    if (ref.read(rhythmPrefsProvider).hidden) return null;

    // Mark first (see the header): the id is spent here, before a slot draws it.
    final seen = ref.read(rhythmSeenRepositoryProvider);
    if (!await seen.markCelebrated(event.id)) return null;
    // The moment's own id is spent, so it must still show: the extra ids are best effort.
    for (final id in event.extraIds) {
      try {
        await seen.markCelebrated(id);
      } on Object {
        // The extra id can come round again as a receipt; the moment itself is not lost.
      }
    }

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
      studyDays: event.studyDays,
      goal: event.goal,
      mobiHop: event.level == CelebrationLevel.l2 && !quiet,
      textOnly: quiet,
      linkLabel: event.linkLabel,
      link: event.link,
    );

    if (isRow) {
      if (!quiet) state = state.copyWith(freshRows: {...state.freshRows, event.id, ...event.extraIds});
      return celebration;
    }
    _usedScopes.add(event.scope);
    state = state.copyWith(
      byScope: {...state.byScope, event.scope: celebration},
      // A milestone shown as a moment (or a receipt) also plays its earned moment once on the
      // milestones screen. Ids that are not milestones never match a step there.
      freshRows: quiet ? null : {...state.freshRows, event.id, ...event.extraIds},
    );
    // The server has already acknowledged the fact (the repair, the week, the milestone), so this is
    // the one place the success pattern is allowed (MOTION.md 1.6): one, never one per effect.
    if (!quiet) await ref.read(hapticsProvider).success();
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

  /// A fresh moment outranks the receipt for an older milestone, which then waits for a later
  /// visit (it is not used up while it waits).
  static int _rank(CelebrationEvent e) => switch (e.level) {
        _ when e.kind == CelebrationKind.milestoneReceipt => 1,
        CelebrationLevel.l2 => 4,
        CelebrationLevel.l1 => 3,
        CelebrationLevel.l3 => 0,
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
