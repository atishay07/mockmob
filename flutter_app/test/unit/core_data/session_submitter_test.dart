import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';

import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

void main() {
  late AppDatabase db;
  late FakeSessionApi api;
  late SessionDraftRepository drafts;
  late PendingResultRepository pending;
  late SessionSubmitter submitter;
  late SessionJournal journal;
  late SessionClock clock;
  final cached = <Map<String, dynamic>>[];
  final fixedNow = DateTime.utc(2026, 10, 12, 17, 12);

  setUp(() async {
    db = newTestDb();
    api = FakeSessionApi();
    final scope = LocalScope(db, () => 'u1', () => fixedNow);
    drafts = SessionDraftRepository(scope);
    pending = PendingResultRepository(scope);
    cached.clear();
    submitter = SessionSubmitter(api: api, drafts: drafts, pendingResults: pending, cacheAttempt: (a) async => cached.add(a), now: () => fixedNow);
    clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
    journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
    await journal.recordVisit('q1', clock);
    await journal.recordAnswer('q1', 2, clock);
  });

  tearDown(() => db.close());

  test('a 200 is received: the attempt is cached, the result is pending, the draft is gone', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    final outcome = await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(outcome, isA<SubmitReceived>());
    expect((outcome as SubmitReceived).receivedAt, fixedNow);
    expect(cached.single['id'], 'sess-1');
    expect((await pending.unopened()).single.attemptId, 'sess-1');
    expect(await drafts.latest(), isNull);
    // The journal rows are deleted along with the draft.
    expect(await db.select(db.answerJournal).get(), isEmpty);
  });

  test('the submit sends the answers and the events within the session length', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    final sent = api.submits.single;
    expect(sent['answers'], {'q1': 2});
    expect((sent['events'] as List).length, 2);
    expect(sent['sessionTicket'], isNull);
  });

  test('ticket mode sends the ticket', () async {
    final draft = draftOf(endsAtWallMs: 600000, ticket: 'p2.t.i.c');
    await drafts.save(draft);
    await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(api.submits.single['sessionTicket'], 'p2.t.i.c');
  });

  test('persists pendingSubmission before the call so a process kill still owes the submit', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
    await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    final saved = await drafts.bySessionId('sess-1');
    expect(saved!.pendingSubmission, isTrue);
  });

  test('a network failure is pending and keeps the draft and the journal', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    api.submitFailure = const ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
    final outcome = await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(outcome, isA<SubmitPending>());
    expect(await pending.unopened(), isEmpty);
    expect(await db.select(db.answerJournal).get(), isNotEmpty);
    expect(cached, isEmpty);
  });

  test('a 401 is pending, not a loss: the answers stay on the phone', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    api.submitFailure = const ApiError.signedOut();
    expect(await submitter.submit(draft: draft, journal: journal, durationMs: 600000), isA<SubmitPending>());
  });

  test('SESSION_EXPIRED then a 200 read means the server finalised it: the result opens', () async {
    final draft = draftOf(endsAtWallMs: 600000, pending: true);
    await drafts.save(draft);
    api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: ApiCodes.sessionExpired);
    api.attemptOnFetch = {'id': 'sess-1', 'subject': 'accountancy', 'correct': 1, 'total': 1};
    final outcome = await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(outcome, isA<SubmitReceived>());
    expect((outcome as SubmitReceived).finalisedByServer, isTrue);
    expect(api.fetchCalls, 1);
    expect((await pending.unopened()).length, 1);
  });

  test('SESSION_EXPIRED then a 404 read means the window closed and nothing is recorded', () async {
    final draft = draftOf(endsAtWallMs: 600000, pending: true);
    await drafts.save(draft);
    api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: ApiCodes.sessionExpired);
    api.attemptOnFetch = null;
    final outcome = await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(outcome, isA<SubmitWindowClosed>());
    final saved = await drafts.bySessionId('sess-1');
    expect(saved!.windowClosed, isTrue);
    expect(saved.pendingSubmission, isFalse);
    expect(await pending.unopened(), isEmpty);
  });

  test('a rejection that retrying cannot fix is reported as rejected', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: 'invalid_answer');
    final outcome = await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(outcome, isA<SubmitRejected>());
  });

  test('a local failure after the server accepted still ends received', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    final flaky = SessionSubmitter(
      api: api,
      drafts: drafts,
      pendingResults: pending,
      cacheAttempt: (_) async => throw StateError('cache locked'),
      now: () => fixedNow,
    );
    final outcome = await flaky.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(outcome, isA<SubmitReceived>());
    expect(await drafts.latest(), isNull);
  });

  test('a failure that is not an ApiError is pending with the draft kept, never thrown', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    api.submitFailure = const FormatException('not json');
    final outcome = await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(outcome, isA<SubmitPending>());
    expect((outcome as SubmitPending).error.kind, ApiErrorKind.unknown);
    expect((await drafts.bySessionId('sess-1'))!.pendingSubmission, isTrue);
    expect(await db.select(db.answerJournal).get(), isNotEmpty);
  });

  test('a repeat submit is safe: the second 200 still ends received', () async {
    final draft = draftOf(endsAtWallMs: 600000);
    await drafts.save(draft);
    await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    await drafts.save(draft);
    final again = await submitter.submit(draft: draft, journal: journal, durationMs: 600000);
    expect(again, isA<SubmitReceived>());
    expect((await pending.unopened()).length, 1);
  });
}
