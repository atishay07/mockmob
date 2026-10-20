/// The rules of the Pro nudges, pure and with no Flutter, so a unit test can state each of them.
/// They are the website's rules (`src/lib/proNudge.mjs`, 18 Oct 2026, D79 to D81), said for the app.
///
/// Two kinds of nudge, two sets of rules:
/// * the first-session upgrade sheet ([PopupRules]): once ever, only in the first usage session after
///   onboarding (the run of the app in which onboarding finished, and at most
///   [PopupRules.firstSessionWindow] after it), only after the student's first real action in it
///   (a scored set or mock), and only once it is armed (D181, owner 20 Oct): the student met a real
///   limit ([ArmRules.creditsLimit] credits or fewer) or came back to Today a second time since they
///   first viewed a result ([ArmRules.returnsToArm]). It never rides along with the first result. Never
///   on onboarding, never for Pro, never with `PLAY_BILLING` off;
/// * the inline rows ([InlineRules]): quiet, at most one per screen, and a dismissed one stays quiet for
///   [InlineRules.quietFor].
///
/// The Upgrade sheet a student opens by tapping a Pro feature has no cap: it is their own choice.
library;

/// Why the pop-up is not due, or [due].
enum PopupVerdict {
  due,

  /// `PLAY_BILLING` is off, the student is signed out, or the student is already Pro.
  off,

  /// What was saved on the phone has not been read yet.
  notLoaded,

  /// It was shown once already (once ever, across restarts).
  alreadyShown,

  /// The student is in onboarding now.
  onboarding,

  /// This is not the first usage session after onboarding: onboarding did not finish in this run, it
  /// finished in an earlier run, or more than [PopupRules.firstSessionWindow] ago.
  notFirstSession,

  /// The student has not yet done a real action since onboarding finished.
  noAction,

  /// No real limit met yet and not enough returns to Today since the first viewed result (D181).
  notArmed,
}

class PopupInputs {
  const PopupInputs({
    required this.enabled,
    required this.loaded,
    required this.shown,
    required this.inOnboarding,
    required this.launchId,
    required this.now,
    required this.onboardedAt,
    required this.onboardedLaunch,
    required this.actions,
    required this.actionsAtOnboarded,
    this.armed = true,
  });

  /// The nudges are on for this student: the flag is on, signed in, and not Pro.
  final bool enabled;
  final bool loaded;

  /// The pop-up has already been shown (saved on the phone).
  final bool shown;
  final bool inOnboarding;

  /// This run of the app.
  final String launchId;
  final DateTime now;

  /// When onboarding finished, saved on the phone. Null when it never finished on this phone (an
  /// account that signed straight in, or one set up before this build): such a student is never asked,
  /// as on the website.
  final DateTime? onboardedAt;

  /// The run of the app in which it finished.
  final String? onboardedLaunch;

  /// Real actions in this run: sets and mocks submitted and scored.
  final int actions;

  /// [actions] at the moment onboarding finished, so only an action after it counts.
  final int actionsAtOnboarded;

  /// A real limit was met, or the second return to Today since the first viewed result happened
  /// ([ArmRules]). Defaults to true so a caller that does not track it keeps the old rules.
  final bool armed;
}

/// Where the student is, as far as arming the first-session sheet is concerned (D181). Read from the router's
/// top location: a modal sheet the router knows of is [sheet], and a sheet or dialog opened over a screen
/// without the router never changes the location at all, so neither is ever a page.
enum ShellPlace {
  /// Today, its tab root.
  today,

  /// Another tab's root: Practice, the Mob or You.
  otherTabRoot,

  /// A page or a result over the shell (or a page inside a tab): a result, a run, a setup, a settings page.
  page,

  /// A modal sheet: it covers the screen for a moment and is never a page the student left.
  sheet,
}

/// When the first-session sheet may arm (D181, owner 20 Oct 2026: "wait for a real limit").
abstract final class ArmRules {
  /// A Free student with this many practice credits or fewer has met a real limit.
  static const int creditsLimit = 10;

  /// The sheet arms on the student's second return to Today since they first viewed a result.
  static const int returnsToArm = 2;

  /// Whether [credits] is a real limit. Null (not known, or a stale copy) is never one.
  static bool creditsMet(int? credits) => credits != null && credits <= creditsLimit;

  /// What the router's top location is: [today] and [roots] (the four tab roots, Today among them) are
  /// matched on the path alone, [sheet] says the top route is a modal sheet.
  static ShellPlace placeOf({required String path, required bool sheet, required String today, required List<String> roots}) {
    if (sheet) return ShellPlace.sheet;
    if (path == today) return ShellPlace.today;
    if (roots.contains(path)) return ShellPlace.otherTabRoot;
    return ShellPlace.page;
  }

  /// One move of the student. [away] is whether they have been on a page since they were last at a tab
  /// root. Coming to Today from a page (a result, a run, a settings page closed, or home from one) is a
  /// return; a sheet opened and closed changes nothing; reaching another tab's root ends the trip, so a
  /// switch of tab afterwards, from there to Today, is not a return.
  static ({bool away, bool returned}) step({required bool away, required ShellPlace to}) => switch (to) {
        ShellPlace.sheet => (away: away, returned: false),
        ShellPlace.page => (away: true, returned: false),
        ShellPlace.otherTabRoot => (away: false, returned: false),
        ShellPlace.today => (away: false, returned: away),
      };

  /// Whether the result for [attemptId] is the student's very first result, which carries no Pro ask
  /// (the inline "Go unlimited" row waits for the next one). Decided per attempt: once the first result has
  /// been seen its attempt is saved ([firstResultId]) and only that attempt stays free of the row, however
  /// often it is opened again. Before that, any result is the first one while none was viewed. A student who
  /// signed straight in (no onboarding mark on this phone) is not new, so this never holds for them.
  static bool firstResult({required DateTime? onboardedAt, required int resultsViewed, required String? firstResultId, required String? attemptId}) {
    if (onboardedAt == null) return false;
    if (firstResultId != null) return firstResultId == attemptId;
    return resultsViewed == 0;
  }
}

abstract final class PopupRules {
  /// The first usage session lasts at most this long after onboarding finished (the website's 6 hours).
  static const Duration firstSessionWindow = Duration(hours: 6);

  /// The pop-up waits this long once the student is back on a calm screen, so it never lands with the
  /// page (the website's 1.8 s after the result).
  static const Duration firstActionDelay = Duration(milliseconds: 1800);

  /// Whether this run is still the first usage session after onboarding.
  static bool inFirstSession({required String launchId, required DateTime now, required DateTime? onboardedAt, required String? onboardedLaunch}) {
    if (onboardedAt == null || onboardedLaunch != launchId) return false;
    final since = now.difference(onboardedAt);
    return !since.isNegative && since <= firstSessionWindow;
  }

  static PopupVerdict verdict(PopupInputs i) {
    if (!i.enabled) return PopupVerdict.off;
    if (!i.loaded) return PopupVerdict.notLoaded;
    if (i.shown) return PopupVerdict.alreadyShown;
    if (i.inOnboarding) return PopupVerdict.onboarding;
    if (!inFirstSession(launchId: i.launchId, now: i.now, onboardedAt: i.onboardedAt, onboardedLaunch: i.onboardedLaunch)) {
      return PopupVerdict.notFirstSession;
    }
    if (i.actions <= i.actionsAtOnboarded) return PopupVerdict.noAction;
    if (!i.armed) return PopupVerdict.notArmed;
    return PopupVerdict.due;
  }

  /// Onboarding finished in this run: the first usage session starts now. Returns what to save, or null
  /// when nothing changes: it is marked once, and a second onboarding (or one after the pop-up was shown)
  /// never resets it.
  static ({DateTime at, String launch, int actions})? noteOnboarded({
    required DateTime? onboardedAt,
    required bool shown,
    required DateTime now,
    required String launchId,
    required int actions,
  }) {
    if (onboardedAt != null || shown) return null;
    return (at: now, launch: launchId, actions: actions);
  }
}

abstract final class InlineRules {
  /// A dismissed nudge stays quiet this long.
  static const Duration quietFor = Duration(days: 7);

  /// Whether the nudge may show: on for this student, saved state read, and not dismissed inside
  /// [quietFor]. [dismissedAt] is when the student closed this surface's nudge, if ever.
  static bool visible({required bool enabled, required bool loaded, required DateTime now, DateTime? dismissedAt}) {
    if (!enabled || !loaded) return false;
    if (dismissedAt == null) return true;
    return now.difference(dismissedAt) >= quietFor;
  }
}
