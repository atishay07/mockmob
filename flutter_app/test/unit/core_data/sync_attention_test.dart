import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';
import 'package:mockmob/core/sync/sync_attention.dart';

import 'support/test_db.dart';

void main() {
  late AppDatabase db;
  late DateTime now;
  late OutboxRepository repo;

  setUp(() {
    db = newTestDb();
    now = DateTime.utc(2026, 10, 12, 12);
    repo = OutboxRepository(LocalScope(db, () => 'u1', () => now));
  });

  tearDown(() => db.close());

  Future<void> add(String key) => repo.enqueue(kind: 'study_event', method: 'POST', path: '/api/study/runs/r1/events', body: {'requestKey': key}, idempotencyKey: key);

  test('an empty queue and a fresh write are not stale', () async {
    expect(syncIsStale(await repo.pending(), now), isFalse);
    await add('fresh-key-000000001');
    now = now.add(const Duration(hours: 23));
    expect(syncIsStale(await repo.pending(), now), isFalse);
  });

  test('a write that has waited over 24 hours makes the You dot show', () async {
    await add('old-key-0000000001');
    now = now.add(const Duration(hours: 25));
    expect(syncIsStale(await repo.pending(), now), isTrue);
  });

  test('one old write among fresh ones is enough', () async {
    await add('old-key-0000000002');
    now = now.add(const Duration(hours: 30));
    await add('new-key-0000000002');
    expect(syncIsStale(await repo.pending(), now), isTrue);
  });
}
