import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';

/// The calls the sign-in screens make, so tests can replace the network and Supabase side.
abstract interface class SignInGateway {
  /// `POST /api/auth/email-login`. Throws [SignInException].
  Future<void> sendCode(String email);

  /// Supabase `verifyOTP` (type `email`, then `magiclink`), then the profile load. Throws
  /// [SignInException].
  Future<void> verifyCode(String email, String code);

  /// Google sign-in: the native sheet when it works, else the browser. [GoogleOutcome.browserOpened]
  /// is not a cancel; the result comes back through [oauthReturns].
  Future<GoogleOutcome> signInWithGoogle();

  /// Browser sign-in results as the callback link arrives.
  Stream<OAuthReturn> oauthReturns();

  /// True once the profile loaded and the session is usable.
  bool get isSignedIn;

  /// Waits for the account to load after a sign-in (a browser return arrives before it does).
  /// True once signed in; false when the load failed or took too long.
  Future<bool> whenSignedIn();

  /// The signed-in account, or null.
  String? get userId;
}

/// The real thing: the core [AuthController].
class CoreSignInGateway implements SignInGateway {
  CoreSignInGateway(this._ref);

  final Ref _ref;

  AuthController get _auth => _ref.read(authSnapshotProvider.notifier);

  @override
  Future<void> sendCode(String email) => _auth.sendEmailCode(email);

  @override
  Future<void> verifyCode(String email, String code) =>
      _auth.verifyEmailCode(email, code);

  @override
  Future<GoogleOutcome> signInWithGoogle() => _auth.signInWithGoogle();

  @override
  Stream<OAuthReturn> oauthReturns() => _auth.oauthReturns();

  @override
  bool get isSignedIn => _ref.read(authSnapshotProvider).isSignedIn;

  @override
  String? get userId => _ref.read(authSnapshotProvider).userId;

  /// About as long as the profile read can take on a stalled connection.
  static const _accountWait = Duration(minutes: 3);

  @override
  Future<bool> whenSignedIn() async {
    if (isSignedIn) return true;
    final done = Completer<bool>();
    final watch = _ref.listen<AuthSnapshot>(authSnapshotProvider, (_, next) {
      if (done.isCompleted) return;
      if (next.isSignedIn) {
        done.complete(true);
      } else if (next.loadFailed && !next.retrying) {
        done.complete(false);
      }
    });
    try {
      return await done.future.timeout(_accountWait, onTimeout: () => false);
    } finally {
      watch.close();
    }
  }
}

final signInGatewayProvider = Provider<SignInGateway>(CoreSignInGateway.new);
