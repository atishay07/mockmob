import 'package:flutter/foundation.dart';

/// Which of the two screens a message belongs to.
enum SignInStep { email, code }

/// What is in flight. Only one thing at a time.
enum SignInBusy { none, sending, verifying, google }

/// Failures the screens have copy for. Never carries server text.
enum SignInProblem {
  invalidCode,
  rateLimited,
  offline,
  invalidEmail,
  notAvailable,
  googleUnavailable,
  accountNotLoaded,
  unknown,
}

@immutable
class SignInState {
  const SignInState({
    this.email = '',
    this.busy = SignInBusy.none,
    this.problem,
    this.problemStep,
    this.problemSerial = 0,
    this.codeSentTo,
    this.resendAvailableAt,
    this.codeResentNotice = false,
    this.googleInBrowser = false,
  });

  /// What the student typed. Kept when they go back from the code screen.
  final String email;
  final SignInBusy busy;
  final SignInProblem? problem;
  final SignInStep? problemStep;

  /// Increases with every new problem so a repeated one still replays the nudge.
  final int problemSerial;

  /// The address a code was sent to in this run, if any.
  final String? codeSentTo;

  /// When the next code may be requested (60 s after the last request).
  final DateTime? resendAvailableAt;

  /// True right after "Resend code" worked.
  final bool codeResentNotice;

  /// Google was opened in the browser and the student has not come back yet. Not a cancel: the
  /// session arrives through the callback link.
  final bool googleInBrowser;

  bool get isBusy => busy != SignInBusy.none;

  SignInProblem? problemFor(SignInStep step) =>
      problemStep == step ? problem : null;

  /// A code was already sent to [address] in this run.
  bool hasCodeFor(String address) =>
      codeSentTo != null && codeSentTo == address;

  SignInState copyWith({
    String? email,
    SignInBusy? busy,
    SignInProblem? problem,
    SignInStep? problemStep,
    bool clearProblem = false,
    String? codeSentTo,
    DateTime? resendAvailableAt,
    bool? codeResentNotice,
    bool? googleInBrowser,
  }) {
    return SignInState(
      email: email ?? this.email,
      busy: busy ?? this.busy,
      problem: clearProblem ? null : (problem ?? this.problem),
      problemStep: clearProblem ? null : (problemStep ?? this.problemStep),
      problemSerial: problem != null ? problemSerial + 1 : problemSerial,
      codeSentTo: codeSentTo ?? this.codeSentTo,
      resendAvailableAt: resendAvailableAt ?? this.resendAvailableAt,
      codeResentNotice: codeResentNotice ?? this.codeResentNotice,
      googleInBrowser: googleInBrowser ?? this.googleInBrowser,
    );
  }
}
