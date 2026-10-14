import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';

import 'support/fakes.dart';
import 'support/test_db.dart';

void main() {
  late AppDatabase db;
  late DateTime now;
  late String? user;
  late OutboxRepository repo;
  late FakeHttpAdapter http;
  late OutboxFlusher flusher;
  var n = 0;

  setUp(() {
    db = newTestDb();
    now = DateTime.utc(2026, 10, 12, 12);
    user = 'u1';
    n = 0;
    final scope = LocalScope(db, () => user, () => now);
    repo = OutboxRepository(scope, newKey: () => 'generated-key-${++n}-0000');
    http = FakeHttpAdapter();
    flusher = OutboxFlusher(repository: repo, api: newApiClient(http, now: () => now), now: () => now);
  });

  tearDown(() => db.close());

  Future<OutboxItem> add({String kind = 'study_event', String? key, Map<String, dynamic>? body}) =>
      repo.enqueue(kind: kind, method: 'POST', path: '/api/study/runs/r1/events', body: body ?? {'requestKey': 'rk-000000000001'}, idempotencyKey: key);

  test('an item gets an idempotency key that is reused', () async {
    final a = await add();
    expect(a.idempotencyKey, 'generated-key-1-0000');
    final again = await add(key: a.idempotencyKey);
    expect(again.id, a.id);
    expect((await repo.pending()).length, 1);
  });

  test('a flush sends the item with its idempotency key and removes it', () async {
    final item = await add(key: 'my-own-key-123456');
    http.replies.add(const FakeReply(200, {'ok': true}));
    final results = await flusher.flush();
    expect(results.single.kind, OutboxResultKind.sent);
    expect(http.requests.single.headers['Idempotency-Key'], 'my-own-key-123456');
    expect(http.requests.single.path, item.path);
    expect(await repo.pending(), isEmpty);
  });

  test('items go out oldest first', () async {
    await add(key: 'first-key-000001', body: {'n': 1});
    now = now.add(const Duration(seconds: 1));
    await add(key: 'second-key-00002', body: {'n': 2});
    await flusher.flush();
    expect([for (final r in http.requests) (r.body as Map)['n']], [1, 2]);
  });

  test('a 4xx the server will never accept is dropped', () async {
    await add();
    http.replies.add(const FakeReply(422, {'error': 'invalid_request'}));
    final results = await flusher.flush();
    expect(results.single.kind, OutboxResultKind.dropped);
    expect(await repo.pending(), isEmpty);
  });

  test('a 5xx keeps the item with a back-off, and it is not due until then', () async {
    await add();
    http.replies.add(const FakeReply(503, {'error': 'unavailable'}));
    final results = await flusher.flush();
    expect(results.single.kind, OutboxResultKind.retryLater);
    final item = (await repo.pending()).single;
    expect(item.attempts, 1);
    expect(item.lastErrorCode, 'unavailable');
    expect(await repo.due(), isEmpty);
    now = now.add(const Duration(minutes: 2));
    expect((await repo.due()).length, 1);
  });

  test('back-off doubles from 30 seconds up to an hour', () {
    expect(OutboxRepository.backoffFor(0), const Duration(seconds: 30));
    expect(OutboxRepository.backoffFor(1), const Duration(seconds: 60));
    expect(OutboxRepository.backoffFor(3), const Duration(seconds: 240));
    expect(OutboxRepository.backoffFor(20), const Duration(hours: 1));
  });

  test('offline stops the flush and leaves later items for the next run', () async {
    await add(key: 'first-key-000001');
    now = now.add(const Duration(seconds: 1));
    await add(key: 'second-key-00002');
    http.replies.add(const FakeReply.network());
    final results = await flusher.flush();
    expect(results.length, 1);
    expect(http.requests.length, 1);
    expect((await repo.pending()).length, 2);
  });

  test('a conflict is flagged for the owning module and kept', () async {
    await add();
    http.replies.add(const FakeReply(409, {'error': 'REVISION_CONFLICT'}));
    final results = await flusher.flush();
    expect(results.single.kind, OutboxResultKind.conflict);
    expect((await repo.pending()).length, 1);
  });

  test('a write older than seven days is dropped unsent', () async {
    await add();
    now = now.add(const Duration(days: 8));
    final results = await flusher.flush();
    expect(results.single.kind, OutboxResultKind.dropped);
    expect(http.requests, isEmpty);
  });

  test('only the signed-in user items are sent', () async {
    await add(key: 'mine-key-0000001');
    user = 'u2';
    await add(key: 'theirs-key-00001');
    user = 'u1';
    await flusher.flush();
    expect(http.requests.length, 1);
    user = 'u2';
    expect((await repo.pending()).length, 1);
  });

  test('the pending count stream follows the table', () async {
    final seen = <int>[];
    final sub = repo.watchPendingCount().listen(seen.add);
    await Future<void>.delayed(Duration.zero);
    await add();
    await Future<void>.delayed(Duration.zero);
    http.replies.add(const FakeReply(200, {}));
    await flusher.flush();
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();
    expect(seen, containsAllInOrder([0, 1, 0]));
  });
}
