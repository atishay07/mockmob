// Shared auth contract between the UI shell (router) and the data layer.
// Module 0b owns the implementation and must keep these public names stable:
// AuthStatus, AuthSnapshot, authSnapshotProvider.
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AuthStatus { unknown, signedOut, signedIn }

/// What the router and screens need to know about the session. `userId` is the MockMob
/// user id from GET /api/auth/me (not the Supabase uuid).
class AuthSnapshot {
  const AuthSnapshot({required this.status, this.userId, this.email, this.isPro = false, this.premiumUntil});

  final AuthStatus status;
  final String? userId;
  final String? email;
  final bool isPro;
  final DateTime? premiumUntil;

  static const unknown = AuthSnapshot(status: AuthStatus.unknown);
  static const signedOut = AuthSnapshot(status: AuthStatus.signedOut);
}

/// Placeholder until Module 0b replaces the body with the real Supabase-backed notifier.
final authSnapshotProvider = Provider<AuthSnapshot>((ref) => AuthSnapshot.unknown);
