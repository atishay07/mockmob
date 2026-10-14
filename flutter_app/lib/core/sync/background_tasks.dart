import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:workmanager/workmanager.dart';

import '../api/api_client.dart';
import '../auth/auth_providers.dart';
import '../auth/background_token_refresher.dart';
import '../config/app_config.dart';
import '../domain/session_rules.dart';
import '../models/json_helpers.dart';
import '../models/notification_prefs.dart';
import '../notifications/notification_gateway.dart';
import '../notifications/notification_ids.dart';
import '../notifications/notification_service.dart';
import '../repositories/local_scope.dart';
import '../repositories/pending_result_repository.dart';
import '../repositories/session_draft_repository.dart';
import '../storage/app_database.dart';
import '../storage/app_prefs.dart';
import '../storage/prefs_store.dart';
import '../storage/secure_store.dart';
import 'outbox_repository.dart';
import 'session/session_api.dart';
import 'session/session_clock.dart';
import 'session/session_heartbeat.dart';
import 'session/session_journal.dart';
import 'session/session_notifications.dart';
import 'session/session_submitter.dart';
import 'session/session_work_scheduler.dart';

/// WorkManager task names.
abstract final class BackgroundTaskNames {
  /// Flushes a session's events and submits it, about 90 seconds before `endsAt`.
  static const submitSession = 'mm.submit_session';

  /// Sends the outbox when the network is back.
  static const flushOutbox = 'mm.flush_outbox';
}

abstract final class _InputKeys {
  static const userId = 'userId';
  static const sessionId = 'sessionId';
  static const draftKey = 'draftKey';
}

/// What a background run needs, built fresh in the headless isolate (and faked in tests).
class BackgroundEnvironment {
  BackgroundEnvironment({
    required this.db,
    required this.api,
    required this.notifications,
    DateTime Function()? now,
    this.closeDatabase = true,
  }) : now = now ?? DateTime.now;

  final AppDatabase db;
  final ApiClient api;
  final NotificationService? notifications;
  final DateTime Function() now;
  final bool closeDatabase;

  /// Real wiring: its own database connection (shared across isolates), the stored Supabase
  /// session and the lock-guarded headless token refresh.
  static Future<BackgroundEnvironment> open() async {
    const config = AppConfig.fromEnvironment();
    final store = const FlutterSecureStore();
    final prefs = AppPrefs(SharedPrefsStore());
    // Names the account of the stored token, so a paper or a queued write is sent only with its
    // owner's token.
    final tokens = BackgroundTokenRefresher(config: config, store: store, lock: await openSessionLock(), accountFor: prefs.accountForSession);
    final db = AppDatabase.open();
    final cached = await (db.select(db.cacheEntries)..where((t) => t.cacheKey.equals('notification-prefs'))).get();
    NotificationPrefs notificationPrefs = NotificationPrefs.defaults;
    if (cached.isNotEmpty) {
      try {
        notificationPrefs = NotificationPrefs.fromJson(asJson(jsonDecode(cached.first.json)));
      } on Object {
        notificationPrefs = NotificationPrefs.defaults;
      }
    }
    final notifications = NotificationService(
      gateway: FlutterLocalNotificationsGateway(),
      ledger: PrefsNotificationLedgerStore(prefs),
      prefs: () => notificationPrefs,
      weeklyCap: prefs.weeklyCap,
      createdChannels: prefs.createdNotificationChannels,
      saveCreatedChannels: prefs.setCreatedNotificationChannels,
    );
    return BackgroundEnvironment(db: db, api: ApiClient(config: config, tokens: tokens), notifications: notifications);
  }

  Future<void> close() async {
    if (closeDatabase) await db.close();
  }
}

/// Flushes and submits one session from the background (design spec 5.5.1). Returns true when
/// the job is finished (nothing to do, recorded, or the window closed) and false when WorkManager
/// should try again (the network failed while the window is still open).
Future<bool> runSubmitSessionTask(BackgroundEnvironment env, Map<String, dynamic>? input) async {
  final userId = asString(input?[_InputKeys.userId]);
  final sessionId = asString(input?[_InputKeys.sessionId]);
  if (userId == null || sessionId == null) return true;

  final scope = LocalScope(env.db, () => userId, env.now);
  final drafts = SessionDraftRepository(scope);
  final draft = await drafts.bySessionId(sessionId);
  // No draft means it was submitted already (or the student signed out): nothing to do, and
  // whoever removed it cleared the status.
  if (draft == null) return true;
  // Already settled: nothing is being sent, so a "Sending" status left up would be false.
  if (draft.windowClosed || draft.rejected) {
    await _settleStatus(env, userId: userId, sessionId: sessionId, (n) => n.cancel(mockInProgressTaskId));
    return true;
  }

  // A foreground engine that is still running owns the session: submitting now would send the
  // journal as it stands and delete the draft while the student is answering. Try again later.
  final nowMs = env.now().millisecondsSinceEpoch;
  if (nowMs < draft.endsAtWallMs && await SessionHeartbeat(env.db, userId: userId, now: env.now).isLive(sessionId)) {
    return false;
  }

  final journal = await SessionJournal.open(env.db, userId: userId, sessionId: sessionId, now: env.now);
  final clock = SessionClock()..restore(startedRefWallMs: draft.startedRefWallMs, endsAtWallMs: draft.endsAtWallMs);

  final submitter = SessionSubmitter(
    api: ApiSessionApi(env.api, userId: userId),
    drafts: drafts,
    pendingResults: PendingResultRepository(scope),
    cacheAttempt: (attempt) => _cacheAttempt(env, userId, attempt),
    now: env.now,
  );
  final outcome = await submitter.submit(draft: draft, journal: journal, durationMs: clock.durationMs);

  switch (outcome) {
    case SubmitReceived():
      // Acknowledged here, not in the foreground: this is the one case that posts the
      // result-ready notification.
      final notifications = env.notifications;
      if (notifications != null) {
        try {
          await postResultReady(notifications, draft: draft, attemptId: outcome.attemptId);
        } on Object {
          // A notification problem must not turn a recorded result into a retry.
        }
      }
      return true;
    case SubmitWindowClosed():
      await _settleStatus(env, userId: userId, sessionId: sessionId, (n) => postSendEnded(n, draft: draft, end: UnrecordedEnd.windowClosed));
      return true;
    case SubmitRejected():
      await _settleStatus(env, userId: userId, sessionId: sessionId, (n) => postSendEnded(n, draft: draft, end: UnrecordedEnd.rejected));
      return true;
    case SubmitPending():
      // Ask WorkManager for another run only while the server would still accept the submit.
      if (submissionWindowOpen(endsAtMs: draft.endsAtWallMs, nowMs: env.now().millisecondsSinceEpoch)) return false;
      await _settleStatus(env, userId: userId, sessionId: sessionId, (n) => postSendEnded(n, draft: draft, end: UnrecordedEnd.notSent));
      return true;
  }
}

/// Changes the shared mock status notification once this job stops sending. It is left alone
/// while another paper is open on screen, since the status then describes that paper.
Future<void> _settleStatus(BackgroundEnvironment env, Future<void> Function(NotificationService n) change, {required String userId, required String sessionId}) async {
  final notifications = env.notifications;
  if (notifications == null) return;
  try {
    if (await SessionHeartbeat(env.db, userId: userId, now: env.now).anotherIsLive(sessionId)) return;
    await change(notifications);
  } on Object {
    // A notification problem never changes the job's outcome.
  }
}

Future<void> _cacheAttempt(BackgroundEnvironment env, String userId, Map<String, dynamic> attempt) async {
  final at = env.now().millisecondsSinceEpoch;
  // A new attempt is new evidence: it ends every "Not today" dismissal.
  await (env.db.delete(env.db.dismissals)..where((t) => t.userId.equals(userId))).go();
  final id = asString(attempt['id']);
  if (id == null) return;
  await env.db.into(env.db.cachedAttempts).insertOnConflictUpdate(
        CachedAttemptsCompanion.insert(
          userId: userId,
          attemptId: id,
          subject: asStringOr(attempt['subject'], ''),
          completedAtMs: asInt(attempt['completedAt']) ?? at,
          json: jsonEncode(attempt),
          fetchedAtMs: at,
        ),
      );
}

/// Sends the signed-in user's due outbox items. True when done, false to retry.
Future<bool> runFlushOutboxTask(BackgroundEnvironment env, Map<String, dynamic>? input) async {
  final userId = asString(input?[_InputKeys.userId]);
  if (userId == null) return true;
  final scope = LocalScope(env.db, () => userId, env.now);
  final repository = OutboxRepository(scope);
  final results = await OutboxFlusher(repository: repository, api: env.api, now: env.now).flush();
  // Anything that should be retried later asks WorkManager for another run.
  return !results.any((r) => r.kind == OutboxResultKind.retryLater);
}

/// Dispatches a WorkManager task by name.
Future<bool> runBackgroundTask(String task, Map<String, dynamic>? input, BackgroundEnvironment env) {
  switch (task) {
    case BackgroundTaskNames.submitSession:
      return runSubmitSessionTask(env, input);
    case BackgroundTaskNames.flushOutbox:
      return runFlushOutboxTask(env, input);
    default:
      return Future.value(true);
  }
}

/// WorkManager entry point. Registered by [initializeBackgroundWork].
@pragma('vm:entry-point')
void backgroundCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    BackgroundEnvironment? env;
    try {
      env = await BackgroundEnvironment.open();
      return await runBackgroundTask(task, inputData, env);
    } on Object catch (error) {
      debugPrint('Background task $task failed: ${error.runtimeType}');
      return false;
    } finally {
      await env?.close();
    }
  });
}

/// Call once after the first frame.
Future<void> initializeBackgroundWork() => Workmanager().initialize(backgroundCallbackDispatcher);

/// [SessionWorkScheduler] and the outbox trigger on WorkManager.
class WorkmanagerScheduler implements SessionWorkScheduler {
  WorkmanagerScheduler({Workmanager? workmanager, DateTime Function()? now})
      : _wm = workmanager ?? Workmanager(),
        _now = now ?? DateTime.now;

  final Workmanager _wm;
  final DateTime Function() _now;

  static String _submitName(String sessionId) => 'mm.submit.$sessionId';
  static String outboxName(String userId) => 'mm.outbox.$userId';

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) {
    final delay = runAt.difference(_now());
    return _wm.registerOneOffTask(
      _submitName(sessionId),
      BackgroundTaskNames.submitSession,
      inputData: {_InputKeys.userId: userId, _InputKeys.sessionId: sessionId, _InputKeys.draftKey: draftKey},
      initialDelay: delay.isNegative ? Duration.zero : delay,
      // The job is only useful with a network; WorkManager holds it until there is one, which
      // also covers "re-queue on reconnect until expiresAt + 120 s".
      constraints: Constraints(networkType: NetworkType.connected),
      existingWorkPolicy: ExistingWorkPolicy.replace,
      backoffPolicy: BackoffPolicy.exponential,
      backoffPolicyDelay: const Duration(seconds: 15),
      tag: 'mm.submit',
    );
  }

  @override
  Future<void> cancelSubmit(String sessionId) => _wm.cancelByUniqueName(_submitName(sessionId));

  /// Registers a flush of the outbox for [userId] to run once the network is available.
  Future<void> scheduleOutboxFlush(String userId) => _wm.registerOneOffTask(
        outboxName(userId),
        BackgroundTaskNames.flushOutbox,
        inputData: {_InputKeys.userId: userId},
        constraints: Constraints(networkType: NetworkType.connected),
        existingWorkPolicy: ExistingWorkPolicy.keep,
        backoffPolicy: BackoffPolicy.exponential,
        backoffPolicyDelay: const Duration(seconds: 30),
        tag: 'mm.outbox',
      );
}
