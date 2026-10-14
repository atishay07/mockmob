// Every user-facing string of the auth feature (spec 5.2). Sentence case, no middle dots, no
// emoji, no exclamation successes, no arrows on keys.
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
  static const String alreadyHaveCode = 'I already have a code';
  static String codeSentTo(String email) => 'Code sent to $email.';
  static const String googleInBrowser =
      'Finish signing in with Google in your browser, then come back.';
  static const String sessionExpired =
      'Please sign in again. Your work is safe.';
  static const String offlineBanner = 'You are offline. Connect to sign in.';

  // The account could not be opened at launch (not a sign-out).
  static const String loadFailedTitle = 'We could not open your account';
  static const String loadFailedBody = 'Your work is still on this phone.';
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
  static const String differentEmail = 'Use a different email';
  static const String back = 'Back';

  /// "Resend code in 0:30". Minutes and seconds, tabular in the UI.
  static String resendIn(int seconds) => 'Resend code in ${clock(seconds)}';

  /// Screen-reader wording, which changes in coarse steps so it is not read every second.
  static String resendInSpoken(int seconds) {
    final rounded = ((seconds + 9) ~/ 10) * 10;
    return 'Resend code available in about $rounded seconds';
  }

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
