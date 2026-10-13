import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/auth/copy.dart';
import 'package:mockmob/features/auth/sign_in_state.dart';

void main() {
  test('the spec 5.2 lines are exact', () {
    expect(AuthCopy.codeLeadPrefix, 'Enter the 8-digit code we emailed to ');
    expect(
      AuthCopy.problem(SignInProblem.invalidCode, SignInStep.code),
      'That code did not work. Check the latest email or send a new code.',
    );
    expect(
      AuthCopy.problem(SignInProblem.rateLimited, SignInStep.email),
      'Please wait a minute before asking for another code.',
    );
    expect(AuthCopy.offlineBanner, 'You are offline. Connect to sign in.');
    expect(
      AuthCopy.sessionExpired,
      'Please sign in again. Your work is safe.',
    );
    expect(AuthCopy.sendingCode, 'Sending a code');
  });

  test('the countdown reads as minutes and seconds', () {
    expect(AuthCopy.resendIn(60), 'Resend code in 1:00');
    expect(AuthCopy.resendIn(30), 'Resend code in 0:30');
    expect(AuthCopy.resendIn(5), 'Resend code in 0:05');
  });

  test('the spoken countdown moves in steps of ten seconds', () {
    expect(
      AuthCopy.resendInSpoken(60),
      'Resend code available in about 60 seconds',
    );
    expect(
      AuthCopy.resendInSpoken(51),
      'Resend code available in about 60 seconds',
    );
    expect(
      AuthCopy.resendInSpoken(50),
      'Resend code available in about 50 seconds',
    );
    expect(
      AuthCopy.resendInSpoken(1),
      'Resend code available in about 10 seconds',
    );
  });

  test('offline has no inline line because the banner carries it', () {
    expect(AuthCopy.problem(SignInProblem.offline, SignInStep.email), isNull);
  });

  test('no copy breaks the binding rules', () {
    final all = <String>[
      AuthCopy.signInTitle,
      AuthCopy.signInLead,
      AuthCopy.newHere,
      AuthCopy.emailLabel,
      AuthCopy.sendCode,
      AuthCopy.continueWithGoogle,
      AuthCopy.alreadyHaveCode,
      AuthCopy.codeTitle,
      AuthCopy.codeSpamHint,
      AuthCopy.verify,
      AuthCopy.resend,
      AuthCopy.codeResent,
      AuthCopy.differentEmail,
      for (final p in SignInProblem.values)
        for (final s in SignInStep.values) AuthCopy.problem(p, s) ?? '',
    ];
    final banned = RegExp(r'[·←-⇿\u{1F300}-\u{1FAFF}!]', unicode: true);
    for (final line in all) {
      expect(banned.hasMatch(line), isFalse, reason: line);
    }
  });
}
