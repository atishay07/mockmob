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
}

final signInGatewayProvider = Provider<SignInGateway>(CoreSignInGateway.new);
