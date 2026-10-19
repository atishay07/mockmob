// The student's pick among the lead card's choices (TODAY-1018 6.2), and the lead card Today shows
// with it. One place, so Today's own card, its week readout, the bar's capsule and the Start
// sheet's hero all read the same lead (final walk, H14: Start led with "Start Revise, 10 min"
// while Today's lead was the student's own pick, "Practise weakest chapter, 20 min").
//
// The pick belongs to one day (the header's date line) and lives for the run: nothing is written
// to the server, and a back navigation or a tab switch keeps it.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../copy_glance.dart';
import '../logic/today_model.dart';
import 'today_providers.dart' show todayViewProvider;

/// The picks made in the Suggested stack, per day. A plain store (not a provider) so a pick
/// outlives a rebuilt screen, as it always has; [todayPicksProvider] lets providers follow it.
class TodayPicks extends ChangeNotifier {
  final Map<String, String> _byDay = {};

  /// The choice key picked for [dateLine], or null (the recommended move leads).
  String? of(String dateLine) => _byDay[dateLine];

  /// Picks [key] for [dateLine]; null puts the recommended move back.
  void set(String dateLine, String? key) {
    if (key == null) {
      if (_byDay.remove(dateLine) == null) return;
    } else {
      if (_byDay[dateLine] == key) return;
      _byDay[dateLine] = key;
    }
    notifyListeners();
  }

  void clear() {
    if (_byDay.isEmpty) return;
    _byDay.clear();
    notifyListeners();
  }

  Map<String, String> snapshot() => Map.unmodifiable(Map<String, String>.of(_byDay));
}

/// The app's one store of picks.
final TodayPicks todayPicks = TodayPicks();

class _TodayPicksNotifier extends Notifier<Map<String, String>> {
  @override
  Map<String, String> build() {
    void changed() => state = todayPicks.snapshot();
    todayPicks.addListener(changed);
    ref.onDispose(() => todayPicks.removeListener(changed));
    return todayPicks.snapshot();
  }
}

/// The picks, by date line, kept live.
final todayPicksProvider = NotifierProvider<_TodayPicksNotifier, Map<String, String>>(_TodayPicksNotifier.new);

/// What the lead card shows: [view]'s own hero, or, when the student picked another move from
/// the stack ([pickKey], a [MoveChoice.key]) and that move is a whole card, that card marked as
/// the student's pick. A paper's reel in the lead card ([SealedHero]) gives way to a pick too: the
/// paper waits in a row under it (19 Oct, the deck under the reel).
TodayHero? shownHeroFor(TodayView view, String? pickKey) {
  final hero = view.hero;
  if ((hero is! MoveHero && hero is! SealedHero) || pickKey == null) return hero;
  for (final c in view.choices) {
    if (c.key == pickKey && c.hero != null) return c.hero!.copyWith(overline: GlanceCopy.upNextPick(c.hero!.subjectLine));
  }
  return hero;
}

/// The lead card's move as it stands on Today now, the student's pick included, or null while the
/// lead is not a move (loading, a paper to resume, a sealed result, a read that failed).
final todayLeadMoveProvider = Provider<MoveHero?>((ref) {
  final view = ref.watch(todayViewProvider);
  final picks = ref.watch(todayPicksProvider);
  final shown = shownHeroFor(view, picks[view.header.dateLine]);
  return shown is MoveHero ? shown : null;
});

/// Whether the lead card is the student's own pick rather than the recommended move.
final todayLeadIsPickProvider = Provider<bool>((ref) {
  final view = ref.watch(todayViewProvider);
  final key = ref.watch(todayPicksProvider)[view.header.dateLine];
  if (key == null || (view.hero is! MoveHero && view.hero is! SealedHero)) return false;
  return view.choices.any((c) => c.key == key && c.hero != null);
});
