import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../auth/auth_state.dart';
import '../storage/app_database.dart';
import '../storage/storage_providers.dart';

/// Thrown by a local repository when it is used while signed out. Every row belongs to a
/// user, so there is nothing to read or write without one.
class SignedOutException implements Exception {
  const SignedOutException();

  @override
  String toString() => 'SignedOutException';
}

/// What local repositories need: the database, the current user and the clock.
class LocalScope {
  LocalScope(this.db, this._userId, this.now);

  final AppDatabase db;
  final String? Function() _userId;
  final DateTime Function() now;

  String? get userIdOrNull => _userId();

  /// The signed-in MockMob user id. Throws [SignedOutException] when there is none.
  String get userId => _userId() ?? (throw const SignedOutException());
}

/// The signed-in MockMob user id, or null. Providers that must reset on sign-out or account
/// switch watch this.
final userIdProvider = Provider<String?>((ref) => ref.watch(authSnapshotProvider.select((s) => s.userId)));

/// The scope for the signed-in user, read lazily so a repository kept across a sign-out
/// never writes under a stale id.
final localScopeProvider = Provider<LocalScope>(
  (ref) => LocalScope(ref.watch(appDatabaseProvider), () => ref.read(authSnapshotProvider).userId, ref.watch(nowProvider)),
);
