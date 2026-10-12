// Shared auth contract between the UI shell (router) and the data layer.
// Module 0b owns the implementation and keeps these public names stable:
// AuthStatus, AuthSnapshot, authSnapshotProvider.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';

export 'auth_controller.dart' show AuthController;

enum AuthStatus { unknown, signedOut, signedIn }

/// What the router and screens need to know about the session. `userId` is the MockMob
/// user id from GET /api/auth/me (not the Supabase uuid).
class AuthSnapshot {
  const AuthSnapshot({
    required this.status,
    this.userId,
    this.email,
    this.isPro = false,
    this.premiumUntil,
    this.name,
    this.subjects = const [],
    this.needsOnboarding = false,
    this.creditBalance,
    this.sessionExpired = false,
    this.loadFailed = false,
  });

  final AuthStatus status;
  final String? userId;
  final String? email;
  final bool isPro;
  final DateTime? premiumUntil;

  /// Display name from the profile, when the student has one.
  final String? name;

  /// Chosen subject ids (public ids).
  final List<String> subjects;

  /// True while the profile has no subjects yet.
  final bool needsOnboarding;

  /// Practice credits (not the explanation wallet). Null when unknown.
  final int? creditBalance;

  /// Signed out because the session could not be refreshed (not because the student chose to).
  /// Show "Please sign in again. Your work is still on this phone."
  final bool sessionExpired;

  /// A session exists but the profile could not be loaded and none was cached. The status stays
  /// [AuthStatus.unknown]; offer a retry through `AuthController.reload`.
  final bool loadFailed;

  bool get isSignedIn => status == AuthStatus.signedIn;

  static const unknown = AuthSnapshot(status: AuthStatus.unknown);
  static const signedOut = AuthSnapshot(status: AuthStatus.signedOut);

  @override
  bool operator ==(Object other) =>
      other is AuthSnapshot &&
      other.status == status &&
      other.userId == userId &&
      other.email == email &&
      other.isPro == isPro &&
      other.premiumUntil == premiumUntil &&
      other.name == name &&
      listEquals(other.subjects, subjects) &&
      other.needsOnboarding == needsOnboarding &&
      other.creditBalance == creditBalance &&
      other.sessionExpired == sessionExpired &&
      other.loadFailed == loadFailed;

  @override
  int get hashCode => Object.hash(status, userId, email, isPro, premiumUntil, name, Object.hashAll(subjects), needsOnboarding, creditBalance, sessionExpired, loadFailed);
}

/// The live session. Starts as [AuthSnapshot.unknown], then settles to signed in (with the
/// profile loaded) or signed out. Sign-in and sign-out actions are methods on the notifier.
final authSnapshotProvider = NotifierProvider<AuthController, AuthSnapshot>(AuthController.new);
