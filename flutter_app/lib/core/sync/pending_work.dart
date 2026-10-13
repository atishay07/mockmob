import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../repositories/session_draft_repository.dart';
import '../storage/prefs_store.dart';
import 'outbox_repository.dart';

/// Keys of work that the network has to carry (a session with unacknowledged answers or an
/// unsent submit). The outbox and the session draft are counted separately.
class PendingWorkRegistry extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  void set(String key, {required bool pending}) {
    if (pending == state.contains(key)) return;
    state = pending ? {...state, key} : ({...state}..remove(key));
  }
}

final pendingWorkRegistryProvider = NotifierProvider<PendingWorkRegistry, Set<String>>(PendingWorkRegistry.new);

/// True while anything is waiting to be sent: outbox writes, an unsent submit, or answers the
/// server has not acknowledged. Connectivity pings only while this is true.
final pendingWorkProvider = Provider<bool>((ref) {
  final outbox = ref.watch(outboxPendingCountProvider).value ?? 0;
  final submitOwed = ref.watch(latestSessionDraftProvider).value?.pendingSubmission ?? false;
  final live = ref.watch(pendingWorkRegistryProvider).isNotEmpty;
  return outbox > 0 || submitOwed || live;
});

/// What is only on this phone and has not reached the server: answers of unfinished sessions
/// and queued study writes. The sign-out and delete sheets warn from it.
@immutable
class PendingWorkCount {
  const PendingWorkCount({this.unsentAnswers = 0, this.queuedWrites = 0});

  /// Answers the server has not acknowledged (every answer in a ticket-mode session).
  final int unsentAnswers;

  /// Rows in the outbox, each one a write waiting for the network.
  final int queuedWrites;

  int get total => unsentAnswers + queuedWrites;
  bool get isEmpty => total == 0;

  static const none = PendingWorkCount();

  @override
  bool operator ==(Object other) => other is PendingWorkCount && other.unsentAnswers == unsentAnswers && other.queuedWrites == queuedWrites;

  @override
  int get hashCode => Object.hash(unsentAnswers, queuedWrites);
}

/// The unsent session answers plus the outbox rows of the signed-in student, read once. A part
/// that cannot be read (signed out, database not ready) counts as zero.
final pendingWorkCountProvider = FutureProvider.autoDispose<PendingWorkCount>((ref) async {
  var answers = 0;
  var writes = 0;
  try {
    answers = await ref.read(sessionDraftRepositoryProvider).unsentAnswerCount();
  } on Object {
    answers = 0;
  }
  try {
    writes = (await ref.read(outboxRepositoryProvider).pending()).length;
  } on Object {
    writes = 0;
  }
  return PendingWorkCount(unsentAnswers: answers, queuedWrites: writes);
});

/// Writes the outbox gave up on because they sat unsent for longer than
/// [OutboxRepository.maxAge]. Kept in shared preferences (the WorkManager isolate flushes too)
/// until the student has seen the notice on You.
class ExpiredWorkNotice {
  ExpiredWorkNotice(this._store);

  /// The notice kept in the real preferences, for the flusher when nothing else was given.
  factory ExpiredWorkNotice.shared() => ExpiredWorkNotice(SharedPrefsStore());

  final PrefsStore _store;

  static const _countKey = 'sync.expired_writes';

  Future<int> count() async => await _store.getInt(_countKey) ?? 0;

  Future<void> add(int dropped) async {
    if (dropped <= 0) return;
    await _store.setInt(_countKey, await count() + dropped);
  }

  Future<void> clear() => _store.remove(_countKey);
}

final expiredWorkNoticeProvider = Provider<ExpiredWorkNotice>((ref) => ExpiredWorkNotice.shared());

/// How many writes were dropped for age and not yet acknowledged by the student. Refresh it with
/// `ref.invalidate` after [ExpiredWorkNotice.clear].
final expiredWorkCountProvider = FutureProvider<int>((ref) async {
  try {
    return await ref.watch(expiredWorkNoticeProvider).count();
  } on Object {
    return 0;
  }
});
