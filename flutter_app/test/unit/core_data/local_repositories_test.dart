import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/dismissal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';

import 'support/fixtures.dart';
import 'support/test_db.dart';

void main() {
  late AppDatabase db;
  late DateTime now;
  late String? user;
  late LocalScope scope;

  setUp(() {
    db = newTestDb();
    now = DateTime.utc(2026, 10, 12, 16); // 9:30 PM IST
    user = 'u1';
    scope = LocalScope(db, () => user, () => now);
  });

  tearDown(() => db.close());

  group('PendingResultRepository', () {
    test('records a received result once and keeps the first time', () async {
      final repo = PendingResultRepository(scope);
      await repo.recordReceived('att-1');
      now = now.add(const Duration(minutes: 5));
      await repo.recordReceived('att-1');
      final found = await repo.find('att-1');
      expect(found!.receivedAt, DateTime.utc(2026, 10, 12, 16).toLocal().toUtc().toLocal());
      expect((await repo.unopened()).length, 1);
    });

    test('opening clears it and a repeat does not reopen', () async {
      final repo = PendingResultRepository(scope);
      await repo.recordReceived('att-1');
      await repo.markOpened('att-1');
      expect(await repo.unopened(), isEmpty);
      final opened = (await repo.find('att-1'))!.openedAt;
      now = now.add(const Duration(hours: 1));
      await repo.markOpened('att-1');
      expect((await repo.find('att-1'))!.openedAt, opened);
      // Receiving the same result again does not make it unopened.
      await repo.recordReceived('att-1');
      expect(await repo.unopened(), isEmpty);
    });

    test('is per user', () async {
      final repo = PendingResultRepository(scope);
      await repo.recordReceived('att-1');
      user = 'u2';
      expect(await repo.unopened(), isEmpty);
    });

    test('the unopened list is what drives the tab dot', () async {
      final repo = PendingResultRepository(scope);
      final stream = repo.watchUnopened();
      final seen = <int>[];
      final sub = stream.listen((l) => seen.add(l.length));
      await Future<void>.delayed(Duration.zero);
      await repo.recordReceived('a');
      await Future<void>.delayed(Duration.zero);
      await repo.markOpened('a');
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();
      expect(seen, containsAllInOrder([0, 1, 0]));
    });

    test('signed out throws', () async {
      user = null;
      expect(() => PendingResultRepository(scope).recordReceived('a'), throwsA(isA<SignedOutException>()));
    });
  });

  group('DismissalRepository (Not today)', () {
    const key = DismissalKey(kind: 'repair', subject: 'accountancy', chapter: 'Goodwill', sourceAttemptId: 'att-1');
    DismissalRepository repo() => DismissalRepository(scope, () => 'Asia/Kolkata');

    test('hides only that suggestion until 4:00 AM the next local day', () async {
      await repo().dismiss(key);
      expect(await repo().isDismissed(key), isTrue);
      expect(await repo().isDismissed(const DismissalKey(kind: 'repair', subject: 'accountancy', chapter: 'Ratios', sourceAttemptId: 'att-1')), isFalse);

      // 9:30 PM IST dismissal expires at 4:00 AM IST = 22:30 UTC the same calendar day.
      now = DateTime.utc(2026, 10, 12, 22, 29);
      expect(await repo().isDismissed(key), isTrue);
      now = DateTime.utc(2026, 10, 12, 22, 30);
      expect(await repo().isDismissed(key), isFalse);
    });

    test('a dismissal made after midnight expires at 4:00 AM the same morning', () async {
      now = DateTime.utc(2026, 10, 12, 19, 30); // 1:00 AM IST on 13 October
      await repo().dismiss(key);
      now = DateTime.utc(2026, 10, 12, 22, 29);
      expect(await repo().isDismissed(key), isTrue);
      now = DateTime.utc(2026, 10, 12, 22, 31);
      expect(await repo().isDismissed(key), isFalse);
    });

    test('a new attempt ends every dismissal early', () async {
      await repo().dismiss(key);
      await repo().clearForNewAttempt();
      expect(await repo().isDismissed(key), isFalse);
    });

    test('a dismissal leaves attempts, repair records and caches untouched', () async {
      await db.into(db.cachedAttempts).insert(CachedAttemptsCompanion.insert(userId: 'u1', attemptId: 'att-1', subject: 'accountancy', completedAtMs: 1, json: '{}', fetchedAtMs: 1));
      await RepairLocalRepository(scope).recordOutcome(attemptId: 'att-1', questionId: 'q1', status: RepairLocalStatus.explained);
      await repo().dismiss(key);
      expect((await db.select(db.cachedAttempts).get()).length, 1);
      expect((await RepairLocalRepository(scope).all()).length, 1);
    });

    test('active lists only unexpired dismissals', () async {
      await repo().dismiss(key);
      expect((await repo().active()).contains(key), isTrue);
      now = DateTime.utc(2026, 10, 13, 6);
      expect(await repo().active(), isEmpty);
      await repo().purgeExpired();
      expect(await db.select(db.dismissals).get(), isEmpty);
    });
  });

  group('RepairLocalRepository', () {
    var counter = 0;
    RepairLocalRepository repo() => RepairLocalRepository(scope, newRequestId: () => 'request-id-${++counter}-padding');

    test('reuses the request id while the call is unacknowledged', () async {
      final r = repo();
      final first = await r.requestIdFor('att-1', 'q1');
      final again = await r.requestIdFor('att-1', 'q1');
      expect(again, first);
    });

    test('mints a new id after operation_released', () async {
      final r = repo();
      final first = await r.requestIdFor('att-1', 'q1');
      await r.release('att-1', 'q1');
      final next = await r.requestIdFor('att-1', 'q1');
      expect(next, isNot(first));
    });

    test('a held_for_recheck outcome is not a repair and the next try gets a new id', () async {
      final r = repo();
      final first = await r.requestIdFor('att-1', 'q1');
      await r.recordOutcome(attemptId: 'att-1', questionId: 'q1', status: RepairLocalStatus.heldForRecheck, requestId: first);
      expect(await r.repairedIds('att-1'), isEmpty);
      final next = await r.requestIdFor('att-1', 'q1');
      expect(next, isNot(first));
    });

    test('only explained and stored count as repaired, and the ack time is the latest', () async {
      final r = repo();
      now = DateTime.utc(2026, 10, 12, 17, 0);
      await r.recordOutcome(attemptId: 'att-1', questionId: 'q1', status: RepairLocalStatus.explained);
      now = DateTime.utc(2026, 10, 12, 17, 5);
      await r.recordOutcome(attemptId: 'att-1', questionId: 'q2', status: RepairLocalStatus.stored);
      now = DateTime.utc(2026, 10, 12, 17, 9);
      await r.recordOutcome(attemptId: 'att-1', questionId: 'q3', status: RepairLocalStatus.notExplained);
      await r.recordOutcome(attemptId: 'att-1', questionId: 'q4', status: RepairLocalStatus.notAMistake);
      expect(await r.repairedIds('att-1'), {'q1', 'q2'});
      expect(await r.notAMistakeIds('att-1'), {'q4'});
      expect((await r.lastAckedAt('att-1'))!.toUtc(), DateTime.utc(2026, 10, 12, 17, 5));
    });

    test('reopening a repaired mistake leaves its record untouched', () async {
      final r = repo();
      await r.recordOutcome(attemptId: 'att-1', questionId: 'q1', status: RepairLocalStatus.explained, requestId: 'original-request-id');
      final reopen = await r.requestIdFor('att-1', 'q1');
      expect(reopen, isNot('original-request-id'));
      final record = (await r.forAttempt('att-1')).single;
      expect(record.status, RepairLocalStatus.explained);
      expect(record.requestId, 'original-request-id');
    });

    test('ids match the server pattern', () async {
      final id = await RepairLocalRepository(scope).requestIdFor('att-1', 'q1');
      expect(RegExp(r'^[A-Za-z0-9_-]{16,64}$').hasMatch(id), isTrue);
    });

    test('no attempt has no ack time', () async {
      expect(await repo().lastAckedAt('none'), isNull);
    });
  });

  group('RhythmSeenRepository', () {
    test('saves the last seen week and reads it back', () async {
      final repo = RhythmSeenRepository(scope);
      expect((await repo.read()).lastSeenWeek, isNull);
      await repo.saveSeen(Rhythm.fromJson({'weekStart': '2026-10-12', 'studyDays': 2, 'daysGoal': 4, 'metThisWeek': false, 'weeksMetStreak': 3}));
      final week = (await repo.read()).lastSeenWeek!;
      expect((week.weekStart, week.studyDays, week.daysGoal, week.weeksMetStreak), ('2026-10-12', 2, 4, 3));
    });

    test('a celebration id fires once', () async {
      final repo = RhythmSeenRepository(scope);
      expect(await repo.markCelebrated('week:2026-10-05'), isTrue);
      expect(await repo.markCelebrated('week:2026-10-05'), isFalse);
      expect(await repo.markCelebrated('repair:att-1:req-1'), isTrue);
      expect(await repo.hasCelebrated('week:2026-10-05'), isTrue);
      expect((await repo.read()).celebratedIds.length, 2);
    });

    test('saving the week keeps the celebrated ids', () async {
      final repo = RhythmSeenRepository(scope);
      await repo.markCelebrated('first_repair');
      await repo.saveSeen(Rhythm.fromJson({'weekStart': '2026-10-12'}));
      await repo.setLastCelebratedWeekStart('2026-10-05');
      final s = await repo.read();
      expect(s.celebratedIds, {'first_repair'});
      expect(s.lastCelebratedWeekStart, '2026-10-05');
      expect(s.lastSeenWeek!.weekStart, '2026-10-12');
    });
  });

  group('SessionDraftRepository', () {
    test('the generation key is reused for 15 minutes and then renewed', () async {
      final repo = SessionDraftRepository(scope);
      final first = await repo.generationKeyFor('draft-a');
      expect(RegExp(r'^[a-zA-Z0-9_-]{12,100}$').hasMatch(first), isTrue);
      now = now.add(const Duration(minutes: 14));
      expect(await repo.generationKeyFor('draft-a'), first);
      now = now.add(const Duration(minutes: 2));
      expect(await repo.generationKeyFor('draft-a'), isNot(first));
    });

    test('a different selection gets its own key', () async {
      final repo = SessionDraftRepository(scope);
      expect(await repo.generationKeyFor('a'), isNot(await repo.generationKeyFor('b')));
    });

    test('latest returns the most recently written draft and a delete removes the journal too', () async {
      final repo = SessionDraftRepository(scope);
      await repo.save(draftOf(sessionId: 's1', endsAtWallMs: 5000000));
      now = now.add(const Duration(minutes: 1));
      await repo.save(draftOf(sessionId: 's2', endsAtWallMs: 5000000, count: 5));
      expect((await repo.latest())!.sessionId, 's2');
      await db.into(db.answerJournal).insert(AnswerJournalCompanion.insert(userId: 'u1', sessionId: 's2', seq: 1, qid: 'q1', type: 'visit', atMs: 0, createdAtMs: 0, answer: const Value(null)));
      await repo.deleteSession('s2');
      expect((await repo.latest())!.sessionId, 's1');
      expect(await db.select(db.answerJournal).get(), isEmpty);
    });

    Future<void> journal(String session, List<(String, int?)> answers) async {
      final j = await SessionJournal.open(db, userId: 'u1', sessionId: session);
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      for (final (qid, answer) in answers) {
        await j.recordAnswer(qid, answer, clock);
      }
    }

    test('summary counts answers now and as of the acknowledgement', () async {
      final repo = SessionDraftRepository(scope);
      await journal('s1', [('q1', 0), ('q2', 1), ('q3', 2)]);
      final draft = draftOf(sessionId: 's1', endsAtWallMs: 5000000, acknowledgedSequence: 2);
      await repo.save(draft);
      final summary = await repo.summaryOf(draft);
      expect(summary.answered, 3);
      expect(summary.acknowledgedAnswered, 2);
      expect(summary.total, 3);
    });

    test('unsent answers: unacknowledged ones for a durable session, all of them in ticket mode', () async {
      final repo = SessionDraftRepository(scope);
      await journal('s1', [('q1', 0), ('q2', 1), ('q3', 2)]);
      await repo.save(draftOf(sessionId: 's1', endsAtWallMs: 5000000, acknowledgedSequence: 1));
      await journal('s2', [('q1', 0), ('q2', 1)]);
      await repo.save(draftOf(sessionId: 's2', subject: 'economics', endsAtWallMs: 5000000, ticket: 'p2.a.b.c'));
      // s1: 2 answers past the acknowledged event. s2 (ticket): both answers.
      expect(await repo.unsentAnswerCount(), 4);
    });

    test('a fully acknowledged durable session has no unsent answers, and a closed window is ignored', () async {
      final repo = SessionDraftRepository(scope);
      await journal('s1', [('q1', 0), ('q2', 1)]);
      await repo.save(draftOf(sessionId: 's1', endsAtWallMs: 5000000, acknowledgedSequence: 2));
      expect(await repo.unsentAnswerCount(), 0);
      await journal('s2', [('q1', 0)]);
      await repo.save(draftOf(sessionId: 's2', subject: 'economics', endsAtWallMs: 5000000, ticket: 'p2.a.b.c', windowClosed: true));
      expect(await repo.unsentAnswerCount(), 0);
    });

    test('a cleared answer is not an unsent answer', () async {
      final repo = SessionDraftRepository(scope);
      await journal('s1', [('q1', 0), ('q1', null)]);
      await repo.save(draftOf(sessionId: 's1', endsAtWallMs: 5000000));
      expect(await repo.unsentAnswerCount(), 0);
    });

    test('drafts are per user', () async {
      final repo = SessionDraftRepository(scope);
      await repo.save(draftOf(endsAtWallMs: 5000000));
      user = 'u2';
      expect(await repo.latest(), isNull);
    });
  });

  group('clearUserData', () {
    test('removes only that user rows and keeps caches when asked', () async {
      await PendingResultRepository(scope).recordReceived('a');
      await SessionDraftRepository(scope).save(draftOf(endsAtWallMs: 5000000));
      await db.into(db.cachedAttempts).insert(CachedAttemptsCompanion.insert(userId: 'u1', attemptId: 'a', subject: 's', completedAtMs: 1, json: '{}', fetchedAtMs: 1));
      user = 'u2';
      await PendingResultRepository(scope).recordReceived('b');

      await db.clearUserData('u1', keepCaches: true);
      expect((await db.select(db.pendingResults).get()).map((r) => r.userId), ['u2']);
      expect(await db.select(db.sessionDrafts).get(), isEmpty);
      expect((await db.select(db.cachedAttempts).get()).length, 1);

      await db.clearUserData('u1');
      expect(await db.select(db.cachedAttempts).get(), isEmpty);
    });
  });
}
