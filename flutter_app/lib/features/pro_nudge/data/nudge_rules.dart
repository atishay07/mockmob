/// The rules of the Pro nudges, pure and with no Flutter, so a unit test can state each of them.
///
/// Two kinds of nudge, two sets of rules:
/// * the first-session pop-up ([PopupRules]): once ever, in the first app session after onboarding,
///   after the student's first real action;
/// * the inline rows ([InlineRules]): quiet, one per screen, and a dismissed one stays quiet for
///   [InlineRules.quietFor].
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

  /// This is not the first app session after onboarding: it is the onboarding session itself, or a later one.
  notFirstSession,

  /// The student has not yet done a real action in this session.
  noAction,
}

class PopupInputs {
  const PopupInputs({
    required this.enabled,
    required this.loaded,
    required this.shown,
    required this.inOnboarding,
    required this.launchId,
    required this.firstSessionLaunch,
    required this.actions,
  });

  /// The nudges are on for this student: the flag is on, signed in, and not Pro.
  final bool enabled;
  final bool loaded;

  /// The pop-up has already been shown (saved on the phone).
  final bool shown;
  final bool inOnboarding;

  /// This run of the app.
  final String launchId;

  /// The run that was marked, on the phone, as the first after onboarding. Null until one is.
  final String? firstSessionLaunch;

  /// Real actions in this run: sets and mocks submitted.
  final int actions;
}

abstract final class PopupRules {
  static PopupVerdict verdict(PopupInputs i) {
    if (!i.enabled) return PopupVerdict.off;
    if (!i.loaded) return PopupVerdict.notLoaded;
    if (i.shown) return PopupVerdict.alreadyShown;
    if (i.inOnboarding) return PopupVerdict.onboarding;
    if (i.firstSessionLaunch != i.launchId) return PopupVerdict.notFirstSession;
    if (i.actions < 1) return PopupVerdict.noAction;
    return PopupVerdict.due;
  }

  /// Which run is the first after onboarding, decided once and then saved.
  ///
  /// * the run in which the student was seen in onboarding is the onboarding session and is not it
  ///   ([sawOnboarding]): the pop-up never follows onboarding at once;
  /// * the next run is the first session, whatever the student does or does not do in it;
  /// * a student who was never seen in onboarding on this phone (an account that was set up before
  ///   this build) has this run as the first session.
  ///
  /// Returns the new `(onboardedLaunch, firstSessionLaunch)` to save, or null when nothing changes.
  static ({String? onboardedLaunch, String? firstSessionLaunch})? classify({
    required String launchId,
    required bool sawOnboarding,
    required String? onboardedLaunch,
    required String? firstSessionLaunch,
  }) {
    if (firstSessionLaunch != null) return null;
    if (sawOnboarding) {
      if (onboardedLaunch == launchId) return null;
      return (onboardedLaunch: launchId, firstSessionLaunch: null);
    }
    // The run that follows the onboarding run, or the first run of an already set-up account.
    return (onboardedLaunch: onboardedLaunch, firstSessionLaunch: launchId);
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
