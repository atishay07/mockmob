// When the welcome-credits sheet opens (owner, 20 Oct 11:20 pm: "as soon as I sign up and the first screen opens in the
// app ... at least a pop-up should show after signing up"). Pure rules, no Flutter: the trigger
// (welcome_credits_trigger.dart) feeds them what the app knows at each moment.
//
// Once per account, and only in a new account's first minutes: it is owed only to the account whose after-sign-in sheet
// (`/before-you-start`) was offered in this run, after that sheet has closed, and only on Today with nothing over it
// (never over onboarding, never over another sheet or dialog). A returning account, whose sheet is not offered, never
// sees it.

import '../../core/router/routes.dart';

/// Where the phone remembers that [userId] has seen the sheet (through the after-sign-in PrefsStore).
String welcomeCreditsShownKey(String userId) => 'welcome.credits.v1.shown.$userId';

/// How long Today has to be on top, with nothing over it, before the sheet rises.
const Duration welcomeCreditsDelay = Duration(milliseconds: 600);

/// How long after the after-sign-in sheet closes the sheet is still owed: past this the moment has gone.
const Duration welcomeCreditsWindow = Duration(minutes: 10);

enum WelcomeCreditsDecision {
  /// Open it now.
  show,

  /// Not yet: keep watching (the sheet is still up, Today is not on top, or something is over it).
  wait,

  /// Never in this run.
  notOwed,
}

/// What the app knows at one moment.
class WelcomeCreditsMoment {
  const WelcomeCreditsMoment({
    required this.armedFor,
    required this.signedInAs,
    required this.sheetClosed,
    required this.location,
    required this.modalOnTop,
    this.shownThisRun = false,
    this.shownForAccount = false,
    this.sinceClosed = Duration.zero,
  });

  /// The account whose after-sign-in sheet was offered in this run (null: none was).
  final String? armedFor;

  /// The account signed in now.
  final String? signedInAs;

  /// That sheet has closed.
  final bool sheetClosed;

  /// The router's path on top.
  final String location;

  /// A sheet, dialog or other modal route is over the page.
  final bool modalOnTop;

  final bool shownThisRun;

  /// The phone's flag for this account.
  final bool shownForAccount;

  /// How long ago the after-sign-in sheet closed.
  final Duration sinceClosed;
}

/// Onboarding, sign-in and the after-sign-in sheet all have their own paths: only Today itself qualifies.
bool welcomeCreditsPlace(String location) => location == AppRoutes.today;

WelcomeCreditsDecision decideWelcomeCredits(WelcomeCreditsMoment m) {
  final armed = m.armedFor;
  if (armed == null || m.signedInAs != armed) return WelcomeCreditsDecision.notOwed;
  if (m.shownThisRun || m.shownForAccount) return WelcomeCreditsDecision.notOwed;
  if (!m.sheetClosed) return WelcomeCreditsDecision.wait;
  if (m.sinceClosed > welcomeCreditsWindow) return WelcomeCreditsDecision.notOwed;
  if (!welcomeCreditsPlace(m.location) || m.modalOnTop) return WelcomeCreditsDecision.wait;
  return WelcomeCreditsDecision.show;
}
