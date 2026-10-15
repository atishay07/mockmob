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
import 'package:mockmob/features/practice/model/session_analysis.dart' show dwellByQuestion;

import '../../helpers/fonts.dart';
import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

Future<void> _flush(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.pump(const Duration(milliseconds: 1));
  }
}

/// The last question's time stops when the student opens the submit page (Mistake Lab v4 slice 2,
/// the website's rule 6 in data/paper_trace.js): the page opening is a visit with via `sheet`, and
/// coming back without a submit is a plain visit to the question in focus. Data only: nothing on
/// screen changes.
void main() {
  setUpAll(loadAppFonts);

  group('the runner tells the session', () {
    testWidgets('opening the page, then keeping working', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(3), currentIndex: 2);
      await pumpRunner(tester, session: s);
      await tester.tap(find.text('Review and submit'));
      await settle(tester);
      expect(s.submitPage, ['opened']);
      await tester.tap(find.text('Keep working'));
      await settle(tester);
      expect(s.submitPage, ['opened', 'closed']);
    });

    testWidgets('a page opened because time ran out records nothing', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5))..nextOutcome = null;
      await pumpRunner(tester, session: s);
      await s.submit(timedOut: true);
      await settle(tester);
      expect(find.text('Time is up.'), findsOneWidget);
      expect(s.submitPage, isEmpty);
    });

    testWidgets('NTA: Submit Test on the last question opens the summary as before and tells the session', (tester) async {
      final s = FakeRunnerSession(mode: 'nta', currentIndex: 49);
      await pumpRunner(tester, session: s);
      await _flush(tester);
      await tester.tap(find.text('Submit Test'));
      await settle(tester);
      expect(find.text('Submit test?'), findsOneWidget);
      expect(s.submitPage, ['opened']);
    });
  });

  group('the engine records it', () {
    late AppDatabase db;
    late FakeSessionApi api;
    late SessionEngineServices services;
    late int mono;

    setUp(() {
      db = newTestDb();
      api = FakeSessionApi();
      mono = 0;
      const wall = 1000000;
      DateTime now() => DateTime.fromMillisecondsSinceEpoch(wall);
      final scope = LocalScope(db, () => 'u1', now);
      final drafts = SessionDraftRepository(scope);
      services = SessionEngineServices(
        db: db,
        userId: 'u1',
        api: api,
        drafts: drafts,
        submitter: SessionSubmitter(api: api, drafts: drafts, pendingResults: PendingResultRepository(scope), cacheAttempt: (_) async {}, now: now),
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
          mode: 'full',
          count: 3,
          generationKey: 'gen-1',
          mockNumber: 7,
        );

    Future<List<SessionEvent>> journal() => SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1').then((j) => j.events);

    test('open, back to the paper, open again and submit: the last question runs only to the page', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 10000;
      await engine.goTo(2, via: SessionVia.next);
      mono = 40000;
      await engine.selectAnswer('q3', 1);
      mono = 50000;
      engine.submitPageOpened();
      engine.submitPageOpened(); // a second open while it is open is the same page
      mono = 80000;
      engine.submitPageClosed();
      mono = 90000;
      engine.submitPageOpened();
      await engine.flushAnswers();
      final events = await journal();
      expect([for (final e in events) (e.type, e.qid, e.at, e.via)], [
        ('visit', 'q1', 0, null),
        ('visit', 'q3', 10000, 'next'),
        ('answer', 'q3', 40000, null),
        ('visit', 'q3', 50000, 'sheet'),
        ('visit', 'q3', 80000, null),
        ('visit', 'q3', 90000, 'sheet'),
      ]);
      mono = 130000;
      await engine.submit();
      final sent = (api.submits.last['events'] as List).cast<SessionEvent>();
      expect(sent.last.toJson(), {'seq': 7, 'qid': 'q3', 'type': 'end', 'at': 130000, 'reason': 'submit'});
      // The one time rule on this record: the 30 s on the page are nobody's, the 10 s back on the paper
      // are q3's, and the 40 s on the page before the submit are nobody's again.
      final record = {
        'timeline': [for (final e in sent) if (e.type != SessionEvent.end) e.toJson()],
        'end': sent.last.toJson(),
      };
      expect(dwellByQuestion(record), {'q1': 10000, 'q3': 50000});
    });

    test('a jump from the page is the visit that brings the paper back; closing then adds nothing', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      mono = 5000;
      engine.submitPageOpened();
      mono = 9000;
      await engine.goTo(1, via: SessionVia.palette);
      engine.submitPageClosed();
      await engine.flushAnswers();
      final events = await journal();
      expect([for (final e in events) (e.qid, e.via)], [('q1', null), ('q1', 'sheet'), ('q2', 'palette')]);
    });

    test('nothing is recorded once a submit has started', () async {
      final engine = await start();
      addTearDown(engine.dispose);
      // Still owed, so the paper's journal stays on the phone to look at.
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      mono = 5000;
      await engine.submit();
      engine.submitPageOpened();
      engine.submitPageClosed();
      await engine.flushAnswers();
      final events = await journal();
      expect([for (final e in events) e.type], ['visit', 'end']);
    });

    test('the sheet via survives the phone\'s journal', () {
      const e = SessionEvent(seq: 4, qid: 'q3', type: 'visit', at: 50000, via: 'sheet');
      final stored = SessionJournal.encodeStored(e);
      expect(SessionJournal.decodeRow(seq: 4, qid: 'q3', type: 'visit', atMs: 50000, stored: stored), e);
      // The values written before it keep their stored numbers.
      expect([for (final v in SessionVia.first) SessionVia.all.indexOf(v)], [0, 1, 2, 3, 4]);
      expect(SessionEvent.fromJson({'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 0, 'via': 'set'}).via, 'set');
    });
  });
}
