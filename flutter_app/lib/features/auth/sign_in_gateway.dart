import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';

/// The calls the sign-in screens make, so tests can replace the network and Supabase side.
abstract interface class SignInGateway {
  /// `POST /api/auth/email-login`. Throws [SignInException].
  Future<void> sendCode(String email);

  /// Supabase `verifyOTP` (type `email`, then `magiclink`), then the profile load. Throws
  /// [SignInException].
  Future<void> verifyCode(String email, String code);

  /// Native Google sign-in. False when the student cancelled.
  Future<bool> signInWithGoogle();

  /// True once the profile loaded and the session is usable.
  bool get isSignedIn;
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
  Future<bool> signInWithGoogle() => _auth.signInWithGoogle();

  @override
  bool get isSignedIn => _ref.read(authSnapshotProvider).isSignedIn;
}

final signInGatewayProvider = Provider<SignInGateway>(CoreSignInGateway.new);
