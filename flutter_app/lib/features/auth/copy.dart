// Every user-facing string of the auth feature (spec 5.2). Sentence case, no middle dots, no
// emoji, no exclamation successes, no arrows on keys.
import '../../core/auth/auth.dart' show LoadProblem;
import 'sign_in_state.dart';

abstract final class AuthCopy {
  // Sign-in screen.
  static const String signInTitle = 'Sign in';
  static const String signInLead = 'Pick how you want to sign in.';
  static const String newHere =
      'New to MockMob? The same code creates your free account.';
  static const String emailLabel = 'Email address';
  static const String emailHint = 'asha@example.com';
  static const String sendCode = 'Send code';
  static const String sendingCode = 'Sending a code';
  static const String continueWithGoogle = 'Continue with Google';
  static const String googleBusy = 'Signing in';
  static const String enterSentCode = 'Enter the code we sent';
  static const String googleInBrowser =
      'Finish signing in with Google in your browser, then come back.';
  static const String sessionExpired =
      'Sign in again. Your work is still on this phone.';
  static const String offlineBanner = 'You are offline. Connect to sign in.';

  // The account could not be opened at launch (not a sign-out).
  static const String loadFailedTitle = 'We could not open your account';
  static const String loadFailedBody = 'Your work is still on this phone.';

  /// What failed and what to do, then that nothing was lost. Without a known cause, only the
  /// reassurance.
  static String loadFailedMessage(LoadProblem? problem, {bool triedAgain = false}) {
    final lines = [
      if (triedAgain) 'We tried again. It still did not load.',
      if (problem != null) '${problem.sentence} ${problem.advice}',
      loadFailedBody,
    ];
    return lines.join('\n');
  }

  static const String tryAgain = 'Try again';
  static const String tryingAgain = 'Trying again';
  static const String signOut = 'Sign out';

  // Code screen.
  static const String codeTitle = 'Check your email';
  static const String codeLeadPrefix = 'Enter the 8-digit code we emailed to ';
  static const String codeSpamHint = 'Not there? Check your spam folder.';
  static const String codeFieldLabel = '8-digit code';
  static const String verify = 'Sign in';
  static const String verifying = 'Signing in';
  static const String resend = 'Resend code';
  static const String resending = 'Sending a code';
  static const String codeResent = 'A new code is on its way.';

  /// What a wait says once it has run past 12 seconds.
  static const String stillSending =
      'Still sending. This can take a moment on a slow connection.';
  static const String stillChecking =
      'Still checking. This can take a moment on a slow connection.';

  /// What a screen reader hears for the code screen's back arrow.
  static const String differentEmail = 'Use a different email';
  static const String back = 'Back';

  /// "Resend code in 0:30". Minutes and seconds, tabular in the UI.
  static String resendIn(int seconds) => 'Resend code in ${clock(seconds)}';

  /// Screen-reader wording, which changes in coarse steps so it is not read every second.
  static String resendInSpoken(int seconds) {
    final rounded = ((seconds + 9) ~/ 10) * 10;
    return 'Resend code available in about $rounded seconds';
  }

  /// The sign-in screen's wait while a code is already out: "Send a new code in 0:48".
  static String sendNewIn(int seconds) =>
      'Send a new code in ${clock(seconds)}';

  static String sendNewInSpoken(int seconds) {
    final rounded = ((seconds + 9) ~/ 10) * 10;
    return 'A new code can be sent in about $rounded seconds';
  }

  static const String sendNewCode = 'Send a new code';

  /// "0:30", "1:00".
  static String clock(int seconds) {
    final m = seconds ~/ 60;
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  /// The line under the field for a failed step. Null for offline, which the banner covers.
  static String? problem(
    SignInProblem problem,
    SignInStep step,
  ) => switch (problem) {
    SignInProblem.invalidCode =>
      'That code did not work. Check the latest email or send a new code.',
    SignInProblem.rateLimited =>
      step == SignInStep.code
          ? 'Too many tries. Wait a minute, then try the code again.'
          : 'Please wait a minute before asking for another code.',
    SignInProblem.offline => null,
    SignInProblem.invalidEmail =>
      'That email address does not look right. Check it and try again.',
    SignInProblem.notAvailable =>
      'Sign-in is not available right now. Try again in a little while.',
    SignInProblem.googleUnavailable =>
      'Google sign-in did not work. You can use an email code instead.',
    SignInProblem.accountNotLoaded =>
      'You are signed in, but your account did not load. Check your connection and try again.',
    SignInProblem.unknown => 'Something went wrong on our side. Try again.',
  };
}
