import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';
import 'package:mockmob/features/keycards/data/keycards_reviews.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';
import 'support/keycards_fakes.dart';

/// Ratings and reports go through the outbox (KEYCARDS-BUILD-SPEC 4, Offline): the device's own moment is
/// sent as `clientReviewedAt`, a replay is the same write with the same key, and a 402 PRO_REQUIRED is
/// Free's daily limit, never "saved".
void main() {
  late AppDatabase db;
  late DateTime now;
  late OutboxRepository repo;
  late FakeHttpAdapter http;
  late OutboxFlusher flusher;
  var online = true;
  late OutboxKeyCardReviews reviews;

  setUp(() {
    db = newTestDb();
    now = DateTime.utc(2026, 10, 31, 16, 10);
    online = true;
    final scope = LocalScope(db, () => 'u1', () => now);
    repo = OutboxRepository(scope);
    http = FakeHttpAdapter();
    flusher = OutboxFlusher(repository: repo, api: newApiClient(http, now: () => now), now: () => now, onExpired: (_) async {});
    // The coordinator's flush: nothing is sent while the phone is offline.
    reviews = OutboxKeyCardReviews(repository: repo, flush: () async => online ? flusher.flush() : const <OutboxResult>[]);
  });

  tearDown(() => db.close());

  test('online: the rating is sent at once with the device time, and the server\'s answer comes back', () async {
    http.replies.add(const FakeReply(200, {'ok': true, 'next': {'due_at': '2026-11-03T16:10:00.000Z', 'interval_days': 3}, 'today': {'due': 4}}));
    final at = DateTime.utc(2026, 10, 31, 16, 9, 30);
    final out = await reviews.review(cardId: 'c1', rating: 3, mode: 'revise', at: at);
    expect(out.kind, KcSendKind.sent);
    expect(out.result!.intervalDays, 3);
    final sent = http.requests.single;
    expect(sent.path, '/api/keycards/review');
    expect(sent.body, {'cardId': 'c1', 'rating': 3, 'mode': 'revise', 'clientReviewedAt': '2026-10-31T16:09:30.000Z'});
    expect(sent.headers['Idempotency-Key'], KeyCardsOutbox.reviewKey('c1', at));
    expect(await repo.pending(), isEmpty);
  });

  test('offline: the rating waits on the phone, and the replay later is the same write with the same key', () async {
    online = false;
    final at = DateTime.utc(2026, 10, 31, 16, 5);
    final out = await reviews.review(cardId: 'c2', rating: 1, mode: 'study', at: at);
    expect(out.kind, KcSendKind.waiting);
    expect(http.requests, isEmpty);
    final kept = (await repo.pending()).single;
    expect(kept.kind, KeyCardsOutbox.review);
    expect(kept.body!['clientReviewedAt'], '2026-10-31T16:05:00.000Z');

    // The same rating again (a double tap, a retry) is one row.
    await reviews.review(cardId: 'c2', rating: 1, mode: 'study', at: at);
    expect(await repo.pending(), hasLength(1));

    // An hour later the network is back: the replay carries the rating's own moment, not the replay's.
    now = now.add(const Duration(hours: 1));
    online = true;
    http.replies.add(const FakeReply(200, {'ok': true, 'next': {'due_at': '2026-11-01T17:10:00.000Z', 'interval_days': 1}}));
    final results = await flusher.flush();
    expect(results.single.kind, OutboxResultKind.sent);
    expect((http.requests.single.body as Map)['clientReviewedAt'], '2026-10-31T16:05:00.000Z');
    expect(http.requests.single.headers['Idempotency-Key'], kept.idempotencyKey);
    expect(await repo.pending(), isEmpty);
  });

  test('a slow server keeps the rating for later; a refusal for good drops it and says so', () async {
    http.replies.add(const FakeReply(503, {'error': 'unavailable'}));
    final slow = await reviews.review(cardId: 'c3', rating: 4, mode: 'revise', at: now);
    expect(slow.kind, KcSendKind.waiting);
    expect(await repo.pending(), hasLength(1));

    // Later, the kept one goes first (oldest first) and is accepted; the new one is refused for good.
    now = now.add(const Duration(hours: 2));
    http.replies
      ..add(const FakeReply(200, {'ok': true}))
      ..add(const FakeReply(422, {'error': 'invalid_request'}));
    final refused = await reviews.review(cardId: 'c4', rating: 3, mode: 'revise', at: now);
    expect(refused.kind, KcSendKind.failed);
    expect([for (final r in http.requests) (r.body as Map)['cardId']], ['c3', 'c3', 'c4']);
    expect(await repo.pending(), isEmpty);
  });

  test('Free over today\'s reviews: a 402 PRO_REQUIRED is the daily limit, and nothing stays queued', () async {
    http.replies.add(const FakeReply(402, {'error': 'PRO_REQUIRED', 'reason': 'keycard_reviews'}));
    final out = await reviews.review(cardId: 'c5', rating: 3, mode: 'study', at: now);
    expect(out.kind, KcSendKind.proRequired);
    expect(await repo.pending(), isEmpty);
  });

  test('a report goes the same way, once per card', () async {
    http.replies.add(const FakeReply(200, {'ok': true}));
    final out = await reviews.report(cardId: 'c6', reason: 'The answer is wrong or incomplete');
    expect(out.kind, KcSendKind.sent);
    expect(http.requests.single.path, '/api/keycards/report');
    expect(http.requests.single.body, {'cardId': 'c6', 'reason': 'The answer is wrong or incomplete'});
    expect(http.requests.single.headers['Idempotency-Key'], KeyCardsOutbox.reportKey('c6'));
  });

  test('a rating kept longer than the outbox keeps anything is dropped, not sent late', () async {
    online = false;
    await reviews.review(cardId: 'c7', rating: 3, mode: 'revise', at: now);
    now = now.add(OutboxRepository.maxAge + const Duration(minutes: 1));
    final results = await flusher.flush();
    expect(results.single.kind, OutboxResultKind.dropped);
    expect(OutboxKeyCardReviews.outcomeOf(results.single).kind, KcSendKind.failed);
    expect(http.requests, isEmpty);
    expect(kcNow.isBefore(now), isTrue);
  });
}
