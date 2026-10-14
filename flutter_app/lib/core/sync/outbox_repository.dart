import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../api/api_error.dart';
import '../models/json_helpers.dart';
import '../repositories/local_scope.dart';
import '../storage/app_database.dart';
import 'pending_work.dart' show ExpiredWorkNotice;

/// A write waiting for the network.
class OutboxItem {
  const OutboxItem({
    required this.id,
    required this.kind,
    required this.idempotencyKey,
    required this.method,
    required this.path,
    required this.createdAt,
    required this.attempts,
    required this.nextAttemptAt,
    this.body,
    this.lastErrorCode,
    this.userId,
  });

  final int id;

  /// The account the write was queued for (the row's `user_id`, written at enqueue since the
  /// table was created, so every stored item has one). A replay names it to the API client and
  /// is never sent with another account's token. Null only for an item built by hand; it is
  /// then sent for whoever flushes it, which only ever reads its own rows.
  final String? userId;

  /// Caller-defined label (for example `study_event`) so the owning module can recognise it.
  final String kind;

  /// Reused on every retry, so the server applies the write once.
  final String idempotencyKey;
  final String method;
  final String path;
  final Json? body;
  final DateTime createdAt;
  final int attempts;
  final DateTime nextAttemptAt;
  final String? lastErrorCode;
}

/// How one item ended in a flush.
enum OutboxResultKind {
  /// Accepted by the server; removed.
  sent,

  /// Failed for good (a refusal the server will repeat, see [ApiError.isDefinitiveRefusal]) or
  /// older than [OutboxRepository.maxAge]; removed.
  dropped,

  /// Failed for a reason worth retrying later; kept with a back-off.
  retryLater,

  /// Needs the owning module to rebuild the request (a 409 conflict); kept, flagged.
  conflict,
}

class OutboxResult {
  const OutboxResult(this.item, this.kind, {this.response, this.error});

  final OutboxItem item;
  final OutboxResultKind kind;
  final ApiResponse? response;
  final ApiError? error;
}

/// Local `outbox`: writes made while offline or that failed in transit, each with an
/// idempotency key reused across retries. Rows carry the user id; a flush only sends the
/// signed-in user's rows.
class OutboxRepository {
  OutboxRepository(this._scope, {String Function()? newKey}) : _newKey = newKey ?? (() => const Uuid().v4());

  final LocalScope _scope;
  final String Function() _newKey;

  AppDatabase get _db => _scope.db;

  /// Items older than this are dropped without sending (the work is stale).
  static const maxAge = Duration(days: 7);

  /// Back-off between attempts of one item, doubling from 30 seconds up to an hour.
  static Duration backoffFor(int attempts) {
    final seconds = 30 * (1 << attempts.clamp(0, 7));
    return Duration(seconds: seconds > 3600 ? 3600 : seconds);
  }

  OutboxItem _from(OutboxRow r) => OutboxItem(
        id: r.id,
        kind: r.kind,
        idempotencyKey: r.idempotencyKey,
        method: r.method,
        path: r.path,
        body: r.bodyJson == null ? null : asJson(jsonDecode(r.bodyJson!)),
        createdAt: DateTime.fromMillisecondsSinceEpoch(r.createdAtMs),
        attempts: r.attempts,
        nextAttemptAt: DateTime.fromMillisecondsSinceEpoch(r.nextAttemptAtMs),
        lastErrorCode: r.lastErrorCode,
        userId: r.userId,
      );

  /// Adds a write. With the same [idempotencyKey] twice, the second call returns the first.
  Future<OutboxItem> enqueue({required String kind, required String method, required String path, Json? body, String? idempotencyKey}) async {
    final key = idempotencyKey ?? _newKey();
    await _db.into(_db.outbox).insert(
          OutboxCompanion.insert(
            userId: _scope.userId,
            kind: kind,
            idempotencyKey: key,
            method: method,
            path: path,
            bodyJson: Value(body == null ? null : jsonEncode(body)),
            createdAtMs: _scope.now().millisecondsSinceEpoch,
          ),
          mode: InsertMode.insertOrIgnore,
        );
    final row = await (_db.select(_db.outbox)..where((t) => t.idempotencyKey.equals(key))).getSingle();
    return _from(row);
  }

  Future<List<OutboxItem>> pending({String? kind}) async {
    final rows = await (_db.select(_db.outbox)
          ..where((t) => t.userId.equals(_scope.userId) & (kind == null ? const Constant(true) : t.kind.equals(kind)))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAtMs), (t) => OrderingTerm.asc(t.id)]))
        .get();
    return rows.map(_from).toList();
  }

  Future<List<OutboxItem>> due() async {
    final now = _scope.now().millisecondsSinceEpoch;
    final rows = await (_db.select(_db.outbox)
          ..where((t) => t.userId.equals(_scope.userId) & t.nextAttemptAtMs.isSmallerOrEqualValue(now))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAtMs), (t) => OrderingTerm.asc(t.id)]))
        .get();
    return rows.map(_from).toList();
  }

  Stream<int> watchPendingCount() {
    final id = _scope.userIdOrNull;
    if (id == null) return Stream.value(0);
    final count = _db.outbox.id.count();
    final query = _db.selectOnly(_db.outbox)
      ..addColumns([count])
      ..where(_db.outbox.userId.equals(id));
    return query.map((row) => row.read(count) ?? 0).watchSingle();
  }

  Future<void> remove(int id) => (_db.delete(_db.outbox)..where((t) => t.id.equals(id))).go();

  Future<void> markAttempt(OutboxItem item, {String? errorCode, required DateTime nextAt}) =>
      (_db.update(_db.outbox)..where((t) => t.id.equals(item.id))).write(
        OutboxCompanion(
          attempts: Value(item.attempts + 1),
          nextAttemptAtMs: Value(nextAt.millisecondsSinceEpoch),
          lastErrorCode: Value(errorCode),
        ),
      );
}

/// Sends the due items of the signed-in user. Run by WorkManager on reconnect and by the app
/// when it comes back online.
class OutboxFlusher {
  OutboxFlusher({required this.repository, required this.api, DateTime Function()? now, this.onExpired}) : _now = now ?? DateTime.now;

  final OutboxRepository repository;
  final ApiClient api;
  final DateTime Function() _now;

  /// Told how many items were dropped for age in one flush, so the student can be told. Defaults
  /// to the notice You shows ([ExpiredWorkNotice]).
  final Future<void> Function(int dropped)? onExpired;

  /// Sends every due item in order. Stops at the first sign-out (401) or when the server
  /// cannot be reached, leaving the rest for the next flush.
  Future<List<OutboxResult>> flush() async {
    final results = <OutboxResult>[];
    var expired = 0;
    for (final item in await repository.due()) {
      if (_now().difference(item.createdAt) > OutboxRepository.maxAge) {
        await repository.remove(item.id);
        results.add(OutboxResult(item, OutboxResultKind.dropped));
        expired++;
        continue;
      }
      try {
        final response = await api.request(
          item.method,
          item.path,
          body: item.body,
          options: ApiOptions(retries: 0, idempotencyKey: item.idempotencyKey),
          // Its owner's token only. After an account switch the refusal (accountChanged) is an
          // unauthorized error: the item is kept for its owner and the flush stops.
          expectUserId: item.userId,
        );
        await repository.remove(item.id);
        results.add(OutboxResult(item, OutboxResultKind.sent, response: response));
      } on ApiError catch (e) {
        if (e.isUnauthorized || e.isOffline) {
          // Not signed in or no network: nothing after this one can succeed either.
          await repository.markAttempt(item, errorCode: e.code, nextAt: _now().add(OutboxRepository.backoffFor(item.attempts)));
          results.add(OutboxResult(item, OutboxResultKind.retryLater, error: e));
          break;
        }
        if (e.kind == ApiErrorKind.conflict) {
          await repository.markAttempt(item, errorCode: e.code, nextAt: _now().add(OutboxRepository.backoffFor(item.attempts)));
          results.add(OutboxResult(item, OutboxResultKind.conflict, error: e));
        } else if (!e.isDefinitiveRefusal) {
          // Slow, busy, rate limited, or a failure the app cannot name: keep it and try later.
          // Only a clear refusal from the server may discard a student's write.
          await repository.markAttempt(item, errorCode: e.code, nextAt: _now().add(e.retryAfter ?? OutboxRepository.backoffFor(item.attempts)));
          results.add(OutboxResult(item, OutboxResultKind.retryLater, error: e));
        } else {
          await repository.remove(item.id);
          results.add(OutboxResult(item, OutboxResultKind.dropped, error: e));
        }
      }
    }
    if (expired > 0) await _reportExpired(expired);
    return results;
  }

  /// Items older than a week were removed without sending. The student is told on You, so the
  /// gap in their record is not a silent one. Never allowed to fail the flush.
  Future<void> _reportExpired(int count) async {
    try {
      await (onExpired ?? ExpiredWorkNotice.shared().add)(count);
    } on Object {
      // The notice is a courtesy; the flush result stands without it.
    }
  }
}

final outboxRepositoryProvider = Provider<OutboxRepository>((ref) => OutboxRepository(ref.watch(localScopeProvider)));

/// How many writes are waiting to be sent.
final outboxPendingCountProvider = StreamProvider<int>((ref) {
  ref.watch(userIdProvider);
  return ref.watch(outboxRepositoryProvider).watchPendingCount();
});
