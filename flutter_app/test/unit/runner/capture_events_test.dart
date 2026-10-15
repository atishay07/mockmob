import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/features/runner/data/runner_session.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// Mistake Lab v4 slice 2 capture (spec 6, items 1 to 6): the session records how the paper went
/// as data only. Every event takes the exact shape the server's `scoreSession` accepts, survives the
/// phone's journal, and reaches the submit with the attempt meta. Nothing here changes an answer.
void main() {
  group('event shapes', () {
    test('each type writes exactly the fields the server accepts, in a fixed order', () {
      expect(const SessionEvent(seq: 1, qid: 'q1', type: 'visit', at: 0).toJson(), {'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 0});
      expect(const SessionEvent(seq: 2, qid: 'q2', type: 'visit', at: 5, via: 'palette').toJson(), {'seq': 2, 'qid': 'q2', 'type': 'visit', 'at': 5, 'via': 'palette'});
      expect(const SessionEvent(seq: 3, qid: 'q2', type: 'answer', at: 6, answer: null).toJson(), {'seq': 3, 'qid': 'q2', 'type': 'answer', 'at': 6, 'answer': null});
      expect(const SessionEvent(seq: 4, qid: 'q2', type: 'mark', at: 7, marked: true).toJson(), {'seq': 4, 'qid': 'q2', 'type': 'mark', 'at': 7, 'marked': true});
      expect(
        const SessionEvent(seq: 5, qid: 'q2', type: 'strike', at: 8, option: 3, on: false).toJson(),
        {'seq': 5, 'qid': 'q2', 'type': 'strike', 'at': 8, 'option': 3, 'on': false},
      );
      expect(const SessionEvent(seq: 6, qid: 'q2', type: 'away', at: 9).toJson(), {'seq': 6, 'qid': 'q2', 'type': 'away', 'at': 9});
      expect(const SessionEvent(seq: 7, qid: 'q2', type: 'back', at: 10).toJson(), {'seq': 7, 'qid': 'q2', 'type': 'back', 'at': 10});
      expect(
        const SessionEvent(seq: 8, qid: 'q2', type: 'end', at: 11, reason: 'time_up').toJson(),
        {'seq': 8, 'qid': 'q2', 'type': 'end', 'at': 11, 'reason': 'time_up'},
      );
      // The key order is fixed, so a resent prefix stays byte-identical.
      expect(const SessionEvent(seq: 5, qid: 'q2', type: 'strike', at: 8, option: 3, on: true).toJson().keys, ['seq', 'qid', 'type', 'at', 'option', 'on']);
    });

    test('the server log reads back with every field, and unknown values are dropped', () {
      final events = [
        {'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 0, 'via': 'swipe'},
        {'seq': 2, 'qid': 'q1', 'type': 'visit', 'at': 1, 'via': 'teleport'},
        {'seq': 3, 'qid': 'q1', 'type': 'strike', 'at': 2, 'option': 1, 'on': true},
        {'seq': 4, 'qid': 'q1', 'type': 'end', 'at': 3, 'reason': 'nta_strikes'},
      ].map(SessionEvent.fromJson).toList();
      expect(events[0].via, 'swipe');
      expect(events[1].via, isNull);
      expect(events[2].option, 1);
      expect(events[2].on, isTrue);
      expect(events[3].reason, 'nta_strikes');
      expect(events[3].toJson(), {'seq': 4, 'qid': 'q1', 'type': 'end', 'at': 3, 'reason': 'nta_strikes'});
    });
  });

  group('journal and engine', () {
    late AppDatabase db;
    late FakeSessionApi api;
    late SessionDraftRepository drafts;
    late SessionEngineServices services;
    late int mono;
    late int wall;

    setUp(() {
      db = newTestDb();
      api = FakeSessionApi();
      mono = 0;
      wall = 1000000;
      DateTime now() => DateTime.fromMillisecondsSinceEpoch(wall);
      final scope = LocalScope(db, () => 'u1', now);
      drafts = SessionDraftRepository(scope);
      services = SessionEngineServices(
        db: db,
        userId: 'u1',
        api: api,
        drafts: drafts,
        submitter: SessionSubmitter(
          api: api,
          drafts: drafts,
          pendingResults: PendingResultRepository(scope),
          cacheAttempt: (_) async {},
          appVersion: () => '1.0.0',
          now: now,
        ),
        clockFactory: () => SessionClock(monotonicMs: () => mono, wallMs: () => wall),
        timerFactory: ManualTimers().create,
        now: now,
      );
    });

    tearDown(() => db.close());

    Future<SessionEngine> start() => SessionEngine.start(
          services: services,
          view: sessionViewOf(count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000),
          subject: 'accountancy',
          mode: 'nta',
          count: 3,
          generationKey: 'gen-1',
          mockNumber: 7,
        );

    List<SessionEvent> sentEvents() => (api.submits.last['events'] as List).cast<SessionEvent>();

    test('visits say how they were reached; marks, strikes, time away and the end are recorded; answers are unchanged', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 5000;
      await engine.goTo(1, via: SessionVia.next);
      mono = 8000;
      expect(await engine.selectAnswer('q2', 1), isTrue);
      mono = 9000;
      engine.setMarked('q2', true);
      mono = 10000;
      engine.recordStrike('q2', 3, true);
      await engine.flushAnswers();
      mono = 12000;
      await engine.onPaused();
      mono = 20000;
      await engine.onResumed();
      mono = 21000;
      await engine.goTo(0, via: SessionVia.palette);
      // The phone's journal keeps every field: reopened, it reads back the same log.
      final reopened = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      mono = 30000;
      final outcome = await engine.submit();
      expect(outcome, isA<SubmitReceived>());

      final sent = sentEvents();
      expect([for (final e in sent) e.type], ['visit', 'visit', 'answer', 'mark', 'strike', 'away', 'back', 'visit', 'end']);
      expect([for (final e in sent) e.seq], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(sent[0].via, isNull, reason: 'the paper opens on question 1');
      expect(sent[1].via, 'next');
      expect(sent[3].toJson(), {'seq': 4, 'qid': 'q2', 'type': 'mark', 'at': 9000, 'marked': true});
      expect(sent[4].toJson(), {'seq': 5, 'qid': 'q2', 'type': 'strike', 'at': 10000, 'option': 3, 'on': true});
      expect(sent[5].toJson(), {'seq': 6, 'qid': 'q2', 'type': 'away', 'at': 12000});
      expect(sent[6].toJson(), {'seq': 7, 'qid': 'q2', 'type': 'back', 'at': 20000});
      expect(sent[7].via, 'palette');
      expect(sent.last.toJson(), {'seq': 9, 'qid': 'q1', 'type': 'end', 'at': 30000, 'reason': 'submit'});
      // Only answers make the answer.
      expect(api.submits.last['answers'], {'q2': 1});
      // The attempt meta: which runner, its version, the paper's start on this phone's clock, how it ended.
      expect(api.submits.last['meta'], {
        'client': {'platform': 'android', 'appVersion': '1.0.0', 'startedAt': 1000000},
        'endedBy': 'submit',
      });
      // The in-progress save carried the new types too.
      expect(api.puts.expand((p) => p).map((e) => e.type).toSet(), containsAll(['visit', 'answer', 'mark', 'strike', 'away']));
      expect(reopened.events, sent.take(8).toList());
    });

    test('time up ends on the paper\'s last moment, and a retried submit writes no second end', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 4000;
      await engine.selectAnswer('q1', 0);
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      mono = 600900; // past the 10-minute paper
      final first = await engine.submit(timedOut: true);
      expect(first, isA<SubmitPending>());
      api.submitFailure = null;
      mono = 601500;
      await engine.submit();
      final sent = sentEvents();
      final ends = sent.where((e) => e.type == SessionEvent.end).toList();
      expect(ends, hasLength(1));
      expect(ends.single.reason, 'time_up');
      expect(ends.single.at, 600000, reason: 'capped at the session length, so the submit keeps it');
      expect(api.submits.last['meta'], containsPair('endedBy', 'time_up'));
    });

    test('the NTA third warning names its own end', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 2000;
      await engine.submit(endReason: SessionEndReason.ntaStrikes);
      expect(sentEvents().last.reason, 'nta_strikes');
      expect(api.submits.last['meta'], containsPair('endedBy', 'nta_strikes'));
    });

    test('a resumed paper says so on its first visit', () async {
      final engine = await start();
      mono = 3000;
      await engine.goTo(2, via: SessionVia.swipe);
      await engine.flushDraft();
      engine.dispose();
      final draft = await drafts.bySessionId('sess-1');
      mono = 9000;
      final again = await SessionEngine.restore(services: services, draft: draft!);
      addTearDown(again!.dispose);
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      expect(journal.events.last.type, 'visit');
      expect(journal.events.last.qid, 'q3');
      expect(journal.events.last.via, 'resume');
    });

    test('crossing out and bringing back reach the record through the runner', () async {
      final engine = await start();
      final runner = EngineRunnerSession(engine);
      addTearDown(engine.dispose);
      mono = 1000;
      runner.strikes.toggle('q1', 2);
      mono = 2000;
      runner.strikes.restore('q1', 2);
      mono = 3000;
      runner.strikes.toggle('q1', 1);
      runner.strikes.toggle('q1', 1);
      await engine.flushAnswers();
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      final strikes = [for (final e in journal.events) if (e.type == 'strike') (e.option, e.on)];
      expect(strikes, [(2, true), (2, false), (1, true), (1, false)]);
      expect(engine.answers, isEmpty, reason: 'a strike is never an answer');
    });

    test('a journal row written before slice 2 reads back exactly as before', () async {
      await db.into(db.answerJournal).insert(
            AnswerJournalCompanion.insert(userId: 'u1', sessionId: 'old', seq: 1, qid: 'q1', type: 'visit', atMs: 0, createdAtMs: 0),
          );
      await db.into(db.answerJournal).insert(
            AnswerJournalCompanion.insert(userId: 'u1', sessionId: 'old', seq: 2, qid: 'q1', type: 'answer', atMs: 9, answer: const Value(2), createdAtMs: 0),
          );
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'old');
      expect(journal.events.map((e) => e.toJson()), [
        {'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 0},
        {'seq': 2, 'qid': 'q1', 'type': 'answer', 'at': 9, 'answer': 2},
      ]);
    });
  });

  group('NTA paper: data only', () {
    setUpAll(loadAppFonts);

    Future<void> flush(WidgetTester tester) async {
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 1));
      }
    }

    testWidgets('the exam keys say how each question was reached', (tester) async {
      final s = FakeRunnerSession(mode: 'nta');
      await pumpRunner(tester, session: s);
      await flush(tester);
      await tester.tap(find.text('Save & Next'));
      await flush(tester);
      await tester.tap(find.text('Mark for Review & Next'));
      await flush(tester);
      await tester.tap(find.text('Previous'));
      await flush(tester);
      await tester.tap(find.bySemanticsLabel('Question palette'));
      await settle(tester);
      await tester.tap(find.bySemanticsLabel(RegExp(r'^Question 7, ')));
      await settle(tester);
      expect(s.vias, ['next', 'next', 'previous', 'palette']);
      expect(s.currentIndex, 6);
    });

    testWidgets('the third warning ends the paper with its own reason', (tester) async {
      final s = FakeRunnerSession(mode: 'nta')..nextOutcome = null;
      await pumpRunner(tester, session: s);
      await flush(tester);
      for (var i = 0; i < 3; i++) {
        for (final state in const [
          AppLifecycleState.inactive,
          AppLifecycleState.hidden,
          AppLifecycleState.paused,
          AppLifecycleState.hidden,
          AppLifecycleState.inactive,
          AppLifecycleState.resumed,
        ]) {
          tester.binding.handleAppLifecycleStateChanged(state);
        }
        await flush(tester);
        if (i < 2) {
          await tester.tap(find.text('Return to the exam'));
          await flush(tester);
        }
      }
      expect(s.endReasons, ['nta_strikes']);
      await settle(tester);
    });
  });
}
