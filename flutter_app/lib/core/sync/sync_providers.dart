import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../connectivity/connectivity_monitor.dart';
import '../connectivity/connectivity_providers.dart';
import '../models/json_helpers.dart';
import '../models/session.dart';
import '../models/session_draft.dart';
import '../notifications/notification_service.dart';
import '../repositories/attempts_repository.dart';
import '../repositories/dismissal_repository.dart';
import '../repositories/local_scope.dart';
import '../repositories/pending_result_repository.dart';
import '../repositories/session_draft_repository.dart';
import '../storage/storage_providers.dart';
import 'background_tasks.dart';
import 'outbox_repository.dart';
import 'pending_work.dart';
import 'session/session_api.dart';
import 'session/session_engine.dart';
import 'session/session_notifications.dart';
import 'session/session_submitter.dart';

/// WorkManager-backed scheduler. Initialise WorkManager once with [initializeBackgroundWork]
/// after the first frame.
final workmanagerSchedulerProvider = Provider<WorkmanagerScheduler>((ref) => WorkmanagerScheduler(now: ref.watch(nowProvider)));

/// Sends outbox writes: at once when online, and through WorkManager when the network is back.
class SyncCoordinator {
  SyncCoordinator({required this.repository, required this.flusher, required this.scheduler, required this.userId, required this.isOnline});

  final OutboxRepository repository;
  final OutboxFlusher flusher;
  final WorkmanagerScheduler scheduler;
  final String? Function() userId;
  final bool Function() isOnline;

  /// Stores a write with an idempotency key (reused on every retry) and tries to send it.
  /// Returns the stored item whether or not the send succeeded.
  Future<OutboxItem> enqueue({required String kind, required String method, required String path, Json? body, String? idempotencyKey}) async {
    final item = await repository.enqueue(kind: kind, method: method, path: path, body: body, idempotencyKey: idempotencyKey);
    unawaited(flushQuietly());
    return item;
  }

  Future<List<OutboxResult>>? _running;
  bool _again = false;

  /// Sends due items now when online. If any must wait, a WorkManager job is registered to run
  /// when the network is available. One flush runs at a time: a call made while one is running
  /// joins it, and the running flush goes round once more so items added meanwhile are sent.
  /// No item is ever sent twice at once from this isolate.
  Future<List<OutboxResult>> flushNow() {
    final running = _running;
    if (running != null) {
      _again = true;
      return running;
    }
    return _running = _drain();
  }

  /// [flushNow] for fire-and-forget callers: a failure (signed out mid-flush, a database
  /// error) is left for the next flush instead of becoming an unhandled error.
  Future<void> flushQuietly() async {
    try {
      await flushNow();
    } on Object {
      // The items stay in the outbox; the next enqueue, reconnect or backup job sends them.
    }
  }

  Future<List<OutboxResult>> _drain() async {
    final all = <OutboxResult>[];
    try {
      do {
        _again = false;
        all.addAll(await _flushOnce());
      } while (_again);
    } finally {
      _running = null;
    }
    return all;
  }

  Future<List<OutboxResult>> _flushOnce() async {
    final id = userId();
    if (id == null) return const [];
    var results = const <OutboxResult>[];
    if (isOnline()) results = await flusher.flush();
    final stillWaiting = !isOnline() || results.any((r) => r.kind == OutboxResultKind.retryLater);
    if (stillWaiting && (await repository.pending()).isNotEmpty) {
      try {
        await scheduler.scheduleOutboxFlush(id);
      } on Object {
        // WorkManager is initialised after the first frame; the next flush registers it.
      }
    }
    return results;
  }
}

final syncCoordinatorProvider = Provider<SyncCoordinator>((ref) {
  final monitor = ref.watch(connectivityMonitorProvider);
  final coordinator = SyncCoordinator(
    repository: ref.watch(outboxRepositoryProvider),
    flusher: OutboxFlusher(repository: ref.watch(outboxRepositoryProvider), api: ref.watch(apiClientProvider), now: ref.watch(nowProvider)),
    scheduler: ref.watch(workmanagerSchedulerProvider),
    userId: () => ref.read(userIdProvider),
    isOnline: () => monitor.status.value != NetworkStatus.offline,
  );
  // Back online: send what is waiting.
  final sub = monitor.restored.listen((_) => unawaited(coordinator.flushQuietly()));
  ref.onDispose(sub.cancel);
  return coordinator;
});

/// Builds the services the runner hands to [SessionEngine]. Core wires the API, drafts, the
/// attempts cache, the backup WorkManager job, the silent status and pending-work tracking.
final sessionEngineServicesProvider = Provider<SessionEngineServices>((ref) {
  final userId = ref.watch(userIdProvider);
  if (userId == null) throw const SignedOutException();
  final api = ApiSessionApi(ref.watch(apiClientProvider));
  final drafts = ref.watch(sessionDraftRepositoryProvider);
  final registry = ref.read(pendingWorkRegistryProvider.notifier);
  return SessionEngineServices(
    db: ref.watch(appDatabaseProvider),
    userId: userId,
    api: api,
    drafts: drafts,
    submitter: SessionSubmitter(
      api: api,
      drafts: drafts,
      pendingResults: ref.watch(pendingResultRepositoryProvider),
      cacheAttempt: (attempt) async {
        await ref.read(attemptsRepositoryProvider.notifier).upsertSubmitted(attempt);
        // New evidence: "Not today" no longer applies.
        await ref.read(dismissalRepositoryProvider).clearForNewAttempt();
      },
      now: ref.watch(nowProvider),
    ),
    scheduler: ref.watch(workmanagerSchedulerProvider),
    status: NotificationSessionStatusNotifier(ref.watch(notificationServiceProvider)),
    onPendingWork: (key, pending) => registry.set(key, pending: pending),
    now: ref.watch(nowProvider),
  );
});

/// What the runner knows when a session has just been started.
class StartSessionArgs {
  const StartSessionArgs({
    required this.view,
    required this.subject,
    required this.mode,
    required this.count,
    required this.generationKey,
    this.chapter,
    this.difficulty,
    this.mockNumber,
  });

  final SessionView view;
  final String subject;
  final String mode;
  final int count;
  final String generationKey;
  final String? chapter;
  final String? difficulty;
  final int? mockNumber;
}

/// Starts a session engine from a session view the server returned. A thin wrapper so the
/// runner does not import the engine's wiring.
final sessionEngineStarterProvider = Provider<Future<SessionEngine> Function(StartSessionArgs)>((ref) {
  return (args) => SessionEngine.start(
        services: ref.read(sessionEngineServicesProvider),
        view: args.view,
        subject: args.subject,
        mode: args.mode,
        count: args.count,
        generationKey: args.generationKey,
        chapter: args.chapter,
        difficulty: args.difficulty,
        mockNumber: args.mockNumber,
      );
});

/// Restores a session from its draft (Today's Continue key, or after a process kill).
final sessionEngineRestorerProvider = Provider<Future<SessionEngine?> Function(SessionDraft)>((ref) {
  return (draft) => SessionEngine.restore(services: ref.read(sessionEngineServicesProvider), draft: draft);
});
