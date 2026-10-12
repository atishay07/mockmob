import 'dart:convert';

import 'package:drift/drift.dart';

import '../models/json_helpers.dart';
import '../storage/app_database.dart';

/// One usage event waiting to be sent, tagged with the user it was created under.
class QueuedEvent {
  const QueuedEvent({
    required this.eventId,
    required this.userId,
    required this.name,
    required this.props,
    required this.occurredAt,
    this.appVersion,
  });

  final String eventId;
  final String userId;
  final String name;
  final Map<String, Object> props;
  final DateTime occurredAt;
  final String? appVersion;

  /// The wire shape of `POST /api/events` (platform is always android).
  Map<String, Object?> toWire() => {
        'event_id': eventId,
        'name': name,
        'platform': 'android',
        if (appVersion != null && appVersion!.isNotEmpty) 'app_version': appVersion,
        'occurred_at': occurredAt.toUtc().toIso8601String(),
        'props': props,
      };
}

abstract class AnalyticsQueueStore {
  Future<void> add(QueuedEvent event);

  /// Oldest first, only events whose user id equals [userId].
  Future<List<QueuedEvent>> forUser(String userId, {int limit = 50});

  Future<void> remove(Iterable<String> eventIds);

  /// Deletes every queued event, whichever user it belongs to.
  Future<void> clearAll();

  Future<int> count();
}

class DriftAnalyticsQueueStore implements AnalyticsQueueStore {
  DriftAnalyticsQueueStore(this._db);

  final AppDatabase _db;

  @override
  Future<void> add(QueuedEvent e) => _db.into(_db.analyticsQueue).insert(
        AnalyticsQueueCompanion.insert(
          eventId: e.eventId,
          userId: e.userId,
          name: e.name,
          propsJson: jsonEncode(e.props),
          appVersion: Value(e.appVersion),
          occurredAtMs: e.occurredAt.millisecondsSinceEpoch,
        ),
        mode: InsertMode.insertOrIgnore,
      );

  @override
  Future<List<QueuedEvent>> forUser(String userId, {int limit = 50}) async {
    final rows = await (_db.select(_db.analyticsQueue)
          ..where((t) => t.userId.equals(userId))
          ..orderBy([(t) => OrderingTerm.asc(t.occurredAtMs)])
          ..limit(limit))
        .get();
    return [
      for (final r in rows)
        QueuedEvent(
          eventId: r.eventId,
          userId: r.userId,
          name: r.name,
          props: {for (final e in asJson(jsonDecode(r.propsJson)).entries) if (e.value != null) e.key: e.value as Object},
          occurredAt: DateTime.fromMillisecondsSinceEpoch(r.occurredAtMs),
          appVersion: r.appVersion,
        ),
    ];
  }

  @override
  Future<void> remove(Iterable<String> eventIds) => (_db.delete(_db.analyticsQueue)..where((t) => t.eventId.isIn(eventIds.toList()))).go();

  @override
  Future<void> clearAll() => _db.delete(_db.analyticsQueue).go();

  @override
  Future<int> count() async => (await _db.select(_db.analyticsQueue).get()).length;
}

/// In-memory store for tests.
class MemoryAnalyticsQueueStore implements AnalyticsQueueStore {
  final List<QueuedEvent> events = [];

  @override
  Future<void> add(QueuedEvent event) async => events.add(event);

  @override
  Future<List<QueuedEvent>> forUser(String userId, {int limit = 50}) async =>
      (events.where((e) => e.userId == userId).toList()..sort((a, b) => a.occurredAt.compareTo(b.occurredAt))).take(limit).toList();

  @override
  Future<void> remove(Iterable<String> eventIds) async {
    final ids = eventIds.toSet();
    events.removeWhere((e) => ids.contains(e.eventId));
  }

  @override
  Future<void> clearAll() async => events.clear();

  @override
  Future<int> count() async => events.length;
}
