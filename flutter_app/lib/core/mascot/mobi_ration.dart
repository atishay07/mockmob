import 'package:flutter/widgets.dart';

import 'mobi_acts.dart';
import 'mobi_moments.dart';

/// How much celebrating the student wants (the Celebrations setting: Full, Quiet, Off). Mobi
/// reads it from the nearest [MobiCelebrations]; without one he celebrates in full.
enum MobiCelebrationLevel {
  /// Every act as authored.
  full,

  /// T1 plus the words: no hop, no confetti, no glints. A big act becomes a small nod, and a
  /// big act that is held (a result hero's seat) becomes his rest stance.
  quiet,

  /// Words only: a big act plays nothing; Mobi keeps his stance.
  off;

  /// The level named [name] ("full", "quiet", "off"); [full] for anything else.
  static MobiCelebrationLevel fromName(String? name) => values.asNameMap()[name] ?? MobiCelebrationLevel.full;
}

/// The Celebrations setting as Mobi's level, the one mapping the app, onboarding and the You
/// screens share. [mode] is the setting's enum (`CelebrationMode`: full, quiet, off), matched by
/// name so the mascot does not depend on the feature that owns the setting.
MobiCelebrationLevel celebrationLevelFor(Enum mode) => MobiCelebrationLevel.fromName(mode.name);

/// Puts the Celebrations setting where every Mobi below can read it. The app maps its own
/// setting onto [level] once, above the screens.
class MobiCelebrations extends InheritedWidget {
  const MobiCelebrations({super.key, required this.level, required super.child});

  final MobiCelebrationLevel level;

  /// The level in force at [context]; [MobiCelebrationLevel.full] when nothing sets it.
  static MobiCelebrationLevel of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<MobiCelebrations>()?.level ?? MobiCelebrationLevel.full;

  @override
  bool updateShouldNotify(MobiCelebrations old) => old.level != level;
}

/// Mobi's discipline (MOTION.md 1.3): he is a presence, not a show. How often he may glance at
/// taps, how long a screen waits before he points, and the once-a-day and once-a-run gates for
/// his greeting, his nudge, his line and his shrug.
///
/// The gates live for the app run. A screen names itself with a short stable key ("today",
/// "you", "ask") and asks once, in `initState`, never in `build`: asking consumes the gate.
abstract final class MobiRation {
  /// At most one glance at a tap elsewhere on screen in this time.
  static const Duration glanceGap = Duration(milliseconds: 2500);

  /// A screen's Mobi points at its one action only after this long with no touch and no scroll.
  static const Duration nudgeAfter = Duration(seconds: 4);

  /// The acts that celebrate (ladder T2 and T3, and the small hop). The Celebrations setting gates
  /// them.
  static const Set<MobiAct> celebrations = {MobiAct.cheer, MobiAct.celebrate, MobiAct.proud, MobiAct.hop};

  /// The clock the gates and the glance gap read. Tests replace it; [reset] restores it.
  static DateTime Function() now = DateTime.now;

  static final Map<String, DateTime> _days = {};
  static final Set<String> _runs = {};
  static final Set<String> _failing = {};

  static bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  static bool _oncePerDay(String key) {
    final today = now();
    final last = _days[key];
    if (last != null && _sameDay(last, today)) return false;
    _days[key] = today;
    return true;
  }

  /// True the first time [screen] asks today: Mobi waves hello once a day per screen; after that
  /// he is simply there.
  static bool helloToday(String screen) => _oncePerDay('hello:$screen');

  /// True the first time [screen] asks today: he points at the action once per screen per day.
  static bool nudgeToday(String screen) => _oncePerDay('nudge:$screen');

  /// True the first time [screen] asks in this app run: he speaks at most once per screen per run.
  static bool speakOnce(String screen) => _runs.add('say:$screen');

  /// True for the first failure of a run on [screen]: Mobi shrugs once, and stays calm on every
  /// retry that fails again, until [recovered] ends the run.
  static bool oops(String screen) => _failing.add(screen);

  static final Map<String, DateTime> _lastFailure = {};

  static final Map<String, DateTime> _lastReaction = {};

  /// True when a reaction keyed [key] may play now: at most one per [gap] for each key, so a
  /// screen that reacts to every save or every tap reads as a presence, not a twitch. Asking
  /// with a true answer starts the gap.
  static bool reactNow(String key, {Duration gap = glanceGap}) {
    final at = now();
    final last = _lastReaction[key];
    if (last != null && at.difference(last) < gap) return false;
    _lastReaction[key] = at;
    return true;
  }

  /// How far apart two failures on one screen can be and still be the same run.
  static const Duration failureRun = Duration(seconds: 90);

  /// For a screen that cannot tell when its load recovered (a shared error state): true for the
  /// first failure, and again only once [failureRun] has passed since the last failure was seen,
  /// so a retry loop that keeps failing (even through a fresh error view each time) shrugs once.
  static bool oopsRun(String screen) {
    final at = now();
    final last = _lastFailure[screen];
    _lastFailure[screen] = at;
    return last == null || at.difference(last) > failureRun;
  }

  /// The load on [screen] succeeded: the next failure is a new run and may shrug again.
  static void recovered(String screen) => _failing.remove(screen);

  /// The entrance for [screen]'s Mobi: sleepy or asleep late at night, a wave the first time
  /// today, otherwise [otherwise]. Consumes the hello gate.
  static MobiAct greeting(String screen, {MobiAct otherwise = MobiAct.idle}) {
    final at = now();
    if (MobiMoments.isLate(at)) return MobiMoments.entranceAt(at);
    return helloToday(screen) ? MobiAct.hello : otherwise;
  }

  /// The act Mobi actually plays for [act] under the Celebrations [level], or null when he
  /// plays nothing and keeps his stance. Quiet turns a celebration into a small nod; for a
  /// [held] one (a result hero that stays on screen) it becomes his rest stance instead.
  static MobiAct? underLevel(MobiAct act, MobiCelebrationLevel level, {bool held = false}) {
    if (!celebrations.contains(act)) return act;
    return switch (level) {
      MobiCelebrationLevel.full => act,
      MobiCelebrationLevel.quiet => held ? MobiAct.rest : MobiAct.nod,
      MobiCelebrationLevel.off => null,
    };
  }

  /// Forgets every gate (tests).
  @visibleForTesting
  static void reset() {
    _days.clear();
    _runs.clear();
    _failing.clear();
    _lastFailure.clear();
    _lastReaction.clear();
    now = DateTime.now;
  }
}
