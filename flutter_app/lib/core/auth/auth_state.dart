// Shared auth contract between the UI shell (router) and the data layer.
// Module 0b owns the implementation and keeps these public names stable:
// AuthStatus, AuthSnapshot, authSnapshotProvider.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/auth_me.dart' show PlaySubscriptionInfo;
import 'auth_controller.dart';
import 'load_problem.dart';

export 'auth_controller.dart' show AuthController;
export 'load_problem.dart' show LoadProblem;

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
    this.retrying = false,
    this.loadProblem,
    this.profileFresh = false,
    this.playSubscription,
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
  /// Show "Sign in again. Your work is still on this phone."
  final bool sessionExpired;

  /// A session exists but the profile could not be loaded and none was cached. The status stays
  /// [AuthStatus.unknown]; offer a retry through `AuthController.reload`.
  final bool loadFailed;

  /// With [loadFailed]: a retry is running. The load-failed screen stays up and says so,
  /// instead of dropping back to the splash with nothing to press.
  final bool retrying;

  /// With [loadFailed]: what failed, so the load-failed screen can say it in plain words. Null
  /// when the cause is not known.
  final LoadProblem? loadProblem;

  /// The profile came from the server in this run, not from the copy kept on the phone. The cached
  /// copy can be older than the account (signed in on this phone while it had no subjects, then
  /// onboarded elsewhere), so anything that decides "is this account new" or writes the plan over
  /// the server's (the sealed-sheet sync) must wait for this to be true. False for a cached
  /// profile, for signed-out and for unknown.
  final bool profileFresh;

  /// Monthly Pro bought through Google Play, as the server last heard it from Google, or null.
  final PlaySubscriptionInfo? playSubscription;

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
      other.loadFailed == loadFailed &&
      other.retrying == retrying &&
      other.loadProblem == loadProblem &&
      other.profileFresh == profileFresh &&
      other.playSubscription == playSubscription;

  @override
  int get hashCode => Object.hash(status, userId, email, isPro, premiumUntil, name, Object.hashAll(subjects), needsOnboarding, creditBalance, sessionExpired, loadFailed, retrying, loadProblem, profileFresh, playSubscription);
}

/// The live session. Starts as [AuthSnapshot.unknown], then settles to signed in (with the
/// profile loaded) or signed out. Sign-in and sign-out actions are methods on the notifier.
final authSnapshotProvider = NotifierProvider<AuthController, AuthSnapshot>(AuthController.new);
