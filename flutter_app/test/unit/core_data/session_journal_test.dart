import 'dart:convert';

import 'package:drift/drift.dart' show OrderingTerm;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';

import 'support/test_db.dart';

void main() {
  late AppDatabase db;
  late int mono;
  late SessionClock clock;

  setUp(() {
    db = newTestDb();
    mono = 0;
    clock = SessionClock(monotonicMs: () => mono, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 3600000);
  });

  tearDown(() => db.close());

  Future<SessionJournal> open([String session = 's1']) => SessionJournal.open(db, userId: 'u1', sessionId: session);

  test('seq starts at 1 and rises by 1 with no gaps', () async {
    final j = await open();
    await j.recordVisit('q1', clock);
    await j.recordAnswer('q1', 2, clock);
    await j.recordVisit('q2', clock);
    await j.recordAnswer('q2', null, clock);
    expect([for (final e in j.events) e.seq], [1, 2, 3, 4]);
  });

  test('at is integer milliseconds and never decreases', () async {
    final j = await open();
    mono = 1500;
    await j.recordVisit('q1', clock);
    mono = 1500; // same instant
    await j.recordAnswer('q1', 0, clock);
    mono = 4000;
    await j.recordAnswer('q1', 1, clock);
    final ats = [for (final e in j.events) e.at];
    expect(ats, [1500, 1500, 4000]);
    for (var i = 1; i < ats.length; i++) {
      expect(ats[i] >= ats[i - 1], isTrue);
    }
  });

  test('an event is in the database before the call returns', () async {
    final j = await open();
    final event = await j.recordAnswer('q1', 3, clock);
    final rows = await db.select(db.answerJournal).get();
    expect(rows.single.seq, event!.seq);
    expect(rows.single.answer, 3);
    expect(rows.single.type, 'answer');
  });

  test('a reopened journal continues the same sequence', () async {
    final j = await open();
    mono = 100;
    await j.recordVisit('q1', clock);
    await j.recordAnswer('q1', 1, clock);
    final again = await open();
    expect(again.lastSeq, 2);
    final next = await again.recordVisit('q2', clock);
    expect(next!.seq, 3);
    expect(again.events.length, 3);
  });

  test('visit events carry no answer, answer events carry one (or null when cleared)', () async {
    final j = await open();
    await j.recordVisit('q1', clock);
    await j.recordAnswer('q1', 2, clock);
    await j.recordAnswer('q1', null, clock);
    final json = [for (final e in j.events) e.toJson()];
    expect(json[0].containsKey('answer'), isFalse);
    expect(json[1]['answer'], 2);
    expect(json[2].containsKey('answer'), isTrue);
    expect(json[2]['answer'], isNull);
  });

  test('answers: latest per question, a cleared answer is removed', () async {
    final j = await open();
    await j.recordAnswer('q1', 0, clock);
    await j.recordAnswer('q2', 1, clock);
    await j.recordAnswer('q1', 3, clock);
    await j.recordAnswer('q2', null, clock);
    expect(j.answers, {'q1': 3});
  });

  test('every resend is a byte-identical prefix of the next one', () async {
    final j = await open();
    await j.recordVisit('q1', clock);
    await j.recordAnswer('q1', 1, clock);
    final first = jsonEncode([for (final e in j.events) e.toJson()]);
    mono = 9000;
    await j.recordAnswer('q2', 2, clock);
    final second = jsonEncode([for (final e in j.events) e.toJson()]);
    expect(second.startsWith(first.substring(0, first.length - 1)), isTrue);
    // Re-reading from disk gives the same bytes.
    final reopened = await open();
    expect(jsonEncode([for (final e in reopened.events) e.toJson()]), second);
  });

  test('rapid concurrent writes keep seq strictly ordered', () async {
    final j = await open();
    mono = 10;
    await Future.wait([
      for (var i = 0; i < 20; i++) j.recordAnswer('q${i % 3}', i % 4, clock),
    ]);
    expect([for (final e in j.events) e.seq], [for (var i = 1; i <= 20; i++) i]);
    final rows = await (db.select(db.answerJournal)..orderBy([(t) => OrderingTerm.asc(t.seq)])).get();
    expect(rows.length, 20);
  });

  test('visits stop at 4,500 events so answers always have room, and the log stops at 5,000', () async {
    final j = await open();
    for (var i = 0; i < SessionJournal.visitCutoff; i++) {
      await j.recordAnswer('q1', i % 2, clock);
    }
    expect(await j.recordVisit('q2', clock), isNull);
    // Answers still fit up to the hard limit.
    for (var i = SessionJournal.visitCutoff; i < SessionJournal.maxEvents; i++) {
      expect(await j.recordAnswer('q1', 1, clock), isNotNull);
    }
    expect(await j.recordAnswer('q1', 0, clock), isNull);
    expect(j.events.length, SessionJournal.maxEvents);
  });

  test('journals of different sessions and users are separate', () async {
    final a = await open('a');
    final b = await open('b');
    await a.recordAnswer('q1', 1, clock);
    await b.recordAnswer('q1', 2, clock);
    expect((await open('a')).answers, {'q1': 1});
    expect((await open('b')).answers, {'q1': 2});
    final other = await SessionJournal.open(db, userId: 'u2', sessionId: 'a');
    expect(other.events, isEmpty);
  });

  test('unsynced questions are those with answer events past the acknowledged seq', () async {
    final j = await open();
    await j.recordVisit('q1', clock); // 1
    await j.recordAnswer('q1', 1, clock); // 2
    await j.recordAnswer('q2', 0, clock); // 3
    await j.recordVisit('q3', clock); // 4 (a visit never counts)
    expect(j.unsyncedQuestionIds(0), {'q1', 'q2'});
    expect(j.unsyncedQuestionIds(2), {'q2'});
    expect(j.unsyncedQuestionIds(4), isEmpty);
  });

  test('answeredCountThrough counts questions answered as of a sequence', () async {
    final j = await open();
    await j.recordAnswer('q1', 1, clock); // 1
    await j.recordAnswer('q2', 1, clock); // 2
    await j.recordAnswer('q1', null, clock); // 3 cleared
    await j.recordAnswer('q3', 2, clock); // 4
    expect(j.answeredCountThrough(2), 2);
    expect(j.answeredCountThrough(3), 1);
    expect(j.answeredCountThrough(4), 2);
  });

  test('submit sends only events within the session length, as a prefix', () async {
    final j = await open();
    mono = 1000;
    await j.recordVisit('q1', clock);
    mono = 2000;
    await j.recordAnswer('q1', 1, clock);
    mono = 3000;
    await j.recordAnswer('q2', 1, clock);
    final within = j.eventsWithin(2000);
    expect([for (final e in within) e.seq], [1, 2]);
  });

  test('replaceWith swaps the log for the server events', () async {
    final j = await open();
    await j.recordAnswer('q1', 1, clock);
    await j.replaceWith(const [
      SessionEvent(seq: 1, qid: 'q9', type: 'visit', at: 5),
      SessionEvent(seq: 2, qid: 'q9', type: 'answer', at: 7, answer: 2),
    ]);
    expect(j.lastSeq, 2);
    expect((await open()).answers, {'q9': 2});
  });
}
