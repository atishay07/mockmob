// Every user-facing string of the account-access screens. Sentence case, plain verbs, no
// exclamation marks, no arrows on keys, no build talk. Each error names what to do next.
import '../../core/auth/auth.dart';

abstract final class AccessCopy {
  // Shared.
  static const String or = 'or';
  static const String emailLabel = 'Email address';
  static const String emailHint = 'asha@example.com';
  static const String passwordLabel = 'Password';
  static const String newPasswordLabel = 'New password';
  static const String show = 'Show';
  static const String hide = 'Hide';
  static const String showPassword = 'Show password';
  static const String hidePassword = 'Hide password';
  static const String back = 'Back';
  static const String done = 'Done';
  static const String notNow = 'Not now';
  static const String offline = 'You are offline. Connect to continue.';

  // Method choice.
  static const String methodsLabel = 'How to sign in';
  static const String methodCode = 'Email code';
  static const String methodPassword = 'Password';
  static const String usePhone = 'Sign in with your phone number';

  // Google.
  static const String continueWithGoogle = 'Continue with Google';
  static const String openingGoogle = 'Opening Google';
  static const String signingIn = 'Signing in';
  static const String finishInBrowser = 'Finish signing in with Google in your browser.';
  static const String browserNotFinished = 'Google sign-in did not finish. Try again when you are ready.';
  static const String useBrowserInstead = 'Use the browser instead';
  static const String cancel = 'Cancel';
  static const String googleClosed = 'Google sign-in was closed. Nothing changed.';

  // Password sign-in.
  static const String passwordTitle = 'Sign in with a password';
  static const String passwordLead = 'Use the email and password you set in MockMob.';
  static const String signIn = 'Sign in';
  static const String forgotPassword = 'Forgot password?';
  static const String enterPassword = 'Enter your password.';
  static const String noPasswordYet = 'Never set a password? Sign in with an email code, then set one in a few seconds.';

  // Set password.
  static const String setPasswordTitle = 'Set a password';
  static const String resetPasswordTitle = 'Choose a new password';
  static const String setPasswordLead = 'Next time, sign in with your email and this password. No code to wait for.';
  static const String resetPasswordLead = 'You are signed in. Choose a new password for next time.';
  static const String passwordRule = 'At least 8 characters.';
  static const String savePassword = 'Save password';
  static const String savingPassword = 'Saving';
  static const String passwordSaved = 'Password saved';
  static String passwordSavedFor(String? email) => email == null || email.isEmpty
      ? 'Next time, sign in with your email and this password.'
      : 'Next time, sign in with $email and this password.';

  // Other devices (after "Forgot password", and under You, Account).
  static const String otherDevicesSignedOut = 'Your other phones and browsers are signed out.';
  static const String otherDevicesStillIn =
      'We could not sign out your other devices just now. Do it from You, Account, Sign out of other devices.';
  static const String signOutOthersTitle = 'Sign out of other devices';
  static const String signOutOthersBody =
      'Signed in on a shared or lost phone? This ends MockMob everywhere else, the website included. You stay signed in here.';
  static const String signOutOthersAction = 'Sign out other devices';
  static const String signingOutOthers = 'Signing out';
  static const String signOutOthersDone = 'Done. Your other devices need to sign in again.';

  // Nudge after an email-code sign-in.
  static const String nudgeTitle = 'Set a password for faster sign-in';
  static const String nudgeBody = 'Skip the email code next time. It takes a few seconds.';
  static const String nudgeAction = 'Set a password';

  // Forgot password.
  static const String forgotTitle = 'Reset your password';
  static const String forgotLead = 'We email you an 8-digit code. Enter it here, then choose a new password.';
  static const String emailMeCode = 'Email me a code';
  static const String sendingCode = 'Sending a code';
  static const String codeLabel = '8-digit code';
  static String codeSentTo(String email) => 'We sent a code to $email. Not there? Check your spam folder.';
  static const String continueLabel = 'Continue';
  static const String checking = 'Checking';
  static const String resendCode = 'Send a new code';
  static String resendIn(int seconds) => 'Send a new code in ${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
  static const String differentEmail = 'Use a different email';

  // Phone.
  static const String phoneTitle = 'Sign in with your phone';
  static const String phoneLead = 'For a number already added to your MockMob account. We text you a 6-digit code.';
  static const String addPhoneTitle = 'Add your phone number';
  static const String addPhoneLead = 'Then you can sign in with a code by text.';
  static const String phoneLabel = 'Mobile number';
  static const String phoneHint = '98123 45678';
  static const String phonePrefix = '+91';
  static const String textMeCode = 'Text me a code';
  static const String smsCodeLabel = '6-digit code';
  static String smsSentTo(String phone) => 'We texted a code to $phone.';
  static const String addNumber = 'Add number';
  static const String differentNumber = 'Use a different number';
  static const String numberAdded = 'Number added';
  static const String numberAddedBody = 'You can now sign in with a code by text.';

  /// The line under a form for a failure. Each names the next step.
  static String problem(AccessFailure failure) => switch (failure) {
        AccessFailure.offline => 'You are offline. Connect, then try again. Nothing was changed.',
        AccessFailure.unavailable => 'Sign-in is busy right now. Try again in a minute.',
        AccessFailure.rateLimited => 'Too many tries. Wait a minute, then try again.',
        AccessFailure.wrongPassword =>
          'That email and password do not match. Check them, or sign in with an email code and set a new password.',
        AccessFailure.weakPassword => 'Choose a longer password, at least 8 characters, that is not easy to guess.',
        AccessFailure.samePassword => 'That is already your password. Choose a different one, or tap Not now.',
        AccessFailure.reauthRequired => 'For safety, sign in with an email code again, then set your password.',
        AccessFailure.invalidEmail => 'That email address does not look right. Check it and try again.',
        AccessFailure.invalidCode => 'That code did not work. Check the latest message or ask for a new code.',
        AccessFailure.invalidPhone => 'Enter a 10-digit Indian mobile number.',
        AccessFailure.phoneNotLinked =>
          'This number is not on a MockMob account yet. Sign in another way, then add it under You, Account.',
        AccessFailure.phoneTaken => 'This number is already on another MockMob account.',
        AccessFailure.notConfigured => 'This sign-in method is not available yet. Use an email code instead.',
        AccessFailure.googleUnavailable => 'Google sign-in did not work. Try again, or use an email code.',
        AccessFailure.browserUnavailable => 'No browser could be opened on this phone. Use an email code instead.',
        AccessFailure.signedOut => 'You are signed out. Sign in again, then try this.',
        AccessFailure.unknown => 'Something went wrong on our side. Try again.',
      };
}
