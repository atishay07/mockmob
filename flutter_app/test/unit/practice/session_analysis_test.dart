// The port of the website's `analyseSession` (data/session_recovery.js): the same attempt must
// produce the same observations, timings and answer changes in the app as on the site.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/practice/model/finish_reaction.dart';
import 'package:mockmob/features/practice/model/session_analysis.dart';

import '../core_data/support/fixtures.dart';

Attempt _attempt(List<(String, V)> qs, {Map<String, dynamic>? recovery}) =>
    Attempt.fromJson(attemptJson(id: 'p', mode: 'quick', questions: qs, extraMeta: {'recovery': ?recovery}));

void main() {
  test('7 right, 2 wrong, 1 blank: 33 of 50, and the 2 wrong cost 12 of the 17 missed (the site’s numbers)', () {
    const m = FinishMarks(correct: 7, wrong: 2, blank: 1, total: 10);
    expect(m.scored, 33);
    expect(m.max, 50);
    expect(m.missed, 17);
    expect(m.lostToWrong, 12);
    expect(m.leftOnBlanks, 5);
  });

  test('one weak chapter needs 2+ wrong there, 3+ wrong overall and 40% of them', () {
    final a = _attempt([
      ...chapterOf('Goodwill', right: 2, wrong: 3),
      ...chapterOf('Retirement', right: 3, wrong: 1),
      ...chapterOf('Shares', blank: 1),
    ]);
    final obs = SessionAnalysis.of(a).observations;
    final chapter = obs.singleWhere((o) => o.kind == ObservationKind.chapter);
    expect(chapter.headline, '3 of your 4 mistakes were in Goodwill');
    expect(chapter.questions, [3, 4, 5]);
    final blank = obs.singleWhere((o) => o.kind == ObservationKind.blank);
    expect(blank.headline, 'One question not attempted');
    expect(blank.questions, [10]);
  });

  test('no timeline and no telemetry: no timing, no changes, nothing invented', () {
    final a = _attempt(chapterOf('Goodwill', right: 4, wrong: 1));
    final s = SessionAnalysis.of(a);
    expect(s.dwellMs, isEmpty);
    expect(s.changes, isEmpty);
    expect(s.observations, isEmpty);
    expect(s.telemetry, 'none');
  });

  test('self-reported events give time per question, and fast wrong answers are named', () {
    final a = _attempt(chapterOf('Goodwill', right: 1, wrong: 2), recovery: {
      'telemetry': 'self_reported',
      'timeline': [
        {'qid': 'p-q1', 'at': 0, 'seq': 1},
        {'qid': 'p-q2', 'at': 65000, 'seq': 2},
        {'qid': 'p-q3', 'at': 75000, 'seq': 3},
        {'qid': 'p-q3', 'at': 87000, 'seq': 4},
      ],
      'observed': {
        'answerChanges': [
          {'qid': 'p-q2', 'before': 0, 'after': 1, 'markEffect': -6},
        ],
      },
    });
    final s = SessionAnalysis.of(a);
    expect(s.dwellMs, {'p-q1': 65000, 'p-q2': 10000, 'p-q3': 12000});
    expect(formatDwell(65000), '1m 05s');
    expect(formatDwell(10000), '10s');
    expect(s.changed('p-q2'), isTrue);
    expect(s.hurt, 6);
    final kinds = s.observations.map((o) => o.kind).toList();
    expect(kinds, [ObservationKind.changes, ObservationKind.quick]);
    expect(s.observations.first.headline, 'You changed a right answer to wrong');
    expect(s.observations[1].headline, '2 of your 2 wrong answers took under 20 seconds');
  });

  test('inconsistent telemetry hides timings and changes', () {
    final a = _attempt(chapterOf('Goodwill', wrong: 2), recovery: {
      'telemetry': 'inconsistent',
      'timeline': [
        {'qid': 'p-q1', 'at': 0},
        {'qid': 'p-q2', 'at': 5000},
      ],
    });
    final s = SessionAnalysis.of(a);
    expect(s.dwellMs, isEmpty);
    expect(s.telemetry, 'inconsistent');
  });

  test('a break over 30 minutes on a record without away data is never time on a question; the rest still counts', () {
    final a = _attempt(chapterOf('Goodwill', right: 1, wrong: 2), recovery: {
      'telemetry': 'self_reported',
      'timeline': [
        {'qid': 'p-q1', 'at': 0, 'seq': 1},
        {'qid': 'p-q2', 'at': 30000, 'seq': 2},
        // An hour later: the student left and came back.
        {'qid': 'p-q3', 'at': 30000 + 3600000, 'seq': 3},
        {'qid': 'p-q3', 'at': 30000 + 3600000 + 9000, 'seq': 4},
      ],
    });
    final s = SessionAnalysis.of(a);
    // The same numbers as the website's paper_trace.js on this record.
    expect(s.dwellMs, {'p-q1': 30000, 'p-q3': 9000});
    // One timed wrong answer is not enough to name fast picks.
    expect(s.observations.where((o) => o.kind == ObservationKind.quick), isEmpty);
  });

  test('gaps up to the break still count in full', () {
    final events = [
      {'qid': 'a', 'at': 0},
      {'qid': 'b', 'at': maxDwellGapMs},
      {'qid': 'b', 'at': maxDwellGapMs + 4000},
    ];
    expect(maxDwellGapMs, 30 * 60 * 1000);
    expect(dwellByQuestion(events), {'a': maxDwellGapMs, 'b': 4000});
  });

  group('the one time rule (data/paper_trace.js), case by case', () {
    // Each expectation is what the website's readTrace gives for the same record (node, 15 Oct 2026).
    test('a 6-minute gap is time on the question: only a break over 30 minutes is skipped', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 2, 'qid': 'b', 'type': 'visit', 'at': 360000},
            {'seq': 3, 'qid': 'b', 'type': 'answer', 'at': 364000, 'answer': 0},
          ],
        }),
        {'a': 360000, 'b': 4000},
      );
    });

    test('time away is left out, and the last question runs to the end', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 4, 'qid': 'b', 'type': 'visit', 'at': 80000},
          ],
          'presence': [
            {'seq': 2, 'qid': 'a', 'type': 'away', 'at': 10000},
            {'seq': 3, 'qid': 'a', 'type': 'back', 'at': 70000},
          ],
          'end': {'seq': 5, 'qid': 'b', 'at': 90000, 'reason': 'submit'},
        }),
        {'a': 20000, 'b': 10000},
      );
    });

    test('with away data a long gap is counted: the device said when the student left', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 4, 'qid': 'b', 'type': 'visit', 'at': 2000 + 2400000},
          ],
          'presence': [
            {'seq': 2, 'qid': 'a', 'type': 'away', 'at': 1000},
            {'seq': 3, 'qid': 'a', 'type': 'back', 'at': 2000},
          ],
        }),
        {'a': 2401000},
      );
    });

    test('a mark or a strike-out on another question never moves time off the one on screen', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 4, 'qid': 'b', 'type': 'visit', 'at': 30000},
          ],
          'marks': [
            {'seq': 2, 'qid': 'z', 'at': 10000, 'marked': true},
          ],
          'strikes': [
            {'seq': 3, 'qid': 'z', 'at': 20000, 'option': 1, 'on': true},
          ],
          'end': {'seq': 5, 'qid': 'b', 'at': 45000, 'reason': 'time_up'},
        }),
        {'a': 30000, 'b': 15000},
      );
    });

    test('an away never closed stays away to the end; a second away or a stray back changes nothing', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
          ],
          'presence': [
            {'seq': 2, 'qid': 'a', 'type': 'away', 'at': 5000},
          ],
          'end': {'seq': 3, 'qid': 'a', 'at': 65000, 'reason': 'time_up'},
        }),
        {'a': 5000},
      );
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 6, 'qid': 'b', 'type': 'visit', 'at': 50000},
          ],
          'presence': [
            {'seq': 2, 'qid': 'a', 'type': 'away', 'at': 5000},
            {'seq': 3, 'qid': 'a', 'type': 'away', 'at': 8000},
            {'seq': 4, 'qid': 'a', 'type': 'back', 'at': 20000},
            {'seq': 5, 'qid': 'a', 'type': 'back', 'at': 30000},
          ],
        }),
        {'a': 35000},
      );
    });

    test('an end clocked before the last event is clamped to it; one event alone says nothing', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 2, 'qid': 'b', 'type': 'visit', 'at': 5000},
          ],
          'end': {'seq': 3, 'qid': 'b', 'at': 1000, 'reason': 'submit'},
        }),
        {'a': 5000},
      );
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
          ],
        }),
        isNull,
      );
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
          ],
          'end': {'seq': 2, 'qid': 'a', 'at': 7000, 'reason': 'submit'},
        }),
        {'a': 7000},
      );
    });

    test('the submit page (via sheet) is time on no question, until the paper is back', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 2, 'qid': 'b', 'type': 'visit', 'at': 10000, 'via': 'next'},
            {'seq': 3, 'qid': 'b', 'type': 'answer', 'at': 40000, 'answer': 1},
            {'seq': 4, 'qid': 'b', 'type': 'visit', 'at': 50000, 'via': 'sheet'},
            {'seq': 5, 'qid': 'b', 'type': 'visit', 'at': 80000},
            {'seq': 6, 'qid': 'b', 'type': 'visit', 'at': 90000, 'via': 'sheet'},
          ],
          'end': {'seq': 7, 'qid': 'b', 'at': 130000, 'reason': 'submit'},
        }),
        {'a': 10000, 'b': 50000},
      );
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 2, 'qid': 'a', 'type': 'visit', 'at': 5000, 'via': 'sheet'},
            {'seq': 3, 'qid': 'b', 'type': 'visit', 'at': 9000, 'via': 'palette'},
          ],
          'end': {'seq': 4, 'qid': 'b', 'at': 20000, 'reason': 'submit'},
        }),
        {'a': 5000, 'b': 11000},
      );
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 'a', 'type': 'visit', 'at': 0},
            {'seq': 2, 'qid': 'a', 'type': 'visit', 'at': 5000, 'via': 'sheet'},
            {'seq': 5, 'qid': 'a', 'type': 'visit', 'at': 30000},
          ],
          'presence': [
            {'seq': 3, 'qid': 'a', 'type': 'away', 'at': 10000},
            {'seq': 4, 'qid': 'a', 'type': 'back', 'at': 20000},
          ],
          'end': {'seq': 6, 'qid': 'a', 'at': 40000, 'reason': 'submit'},
        }),
        {'a': 15000},
      );
    });

    test('a question shown with its passage set (via set) is never time; the one in focus keeps it', () {
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 's2', 'type': 'visit', 'at': 0, 'via': 'set'},
            {'seq': 2, 'qid': 's3', 'type': 'visit', 'at': 0, 'via': 'set'},
            {'seq': 3, 'qid': 's1', 'type': 'visit', 'at': 0},
            {'seq': 4, 'qid': 's2', 'type': 'answer', 'at': 20000, 'answer': 1},
            {'seq': 5, 'qid': 'x', 'type': 'visit', 'at': 50000, 'via': 'next'},
          ],
          'end': {'seq': 6, 'qid': 'x', 'at': 60000, 'reason': 'submit'},
        }),
        {'s1': 20000, 's2': 30000, 'x': 10000},
      );
      expect(
        dwellByQuestion({
          'timeline': [
            {'seq': 1, 'qid': 's2', 'type': 'visit', 'at': 0, 'via': 'set'},
            {'seq': 2, 'qid': 's1', 'type': 'visit', 'at': 3000},
          ],
          'end': {'seq': 3, 'qid': 's1', 'at': 10000, 'reason': 'submit'},
        }),
        {'s1': 7000},
      );
    });

    for (final (name, contract) in [
      ('full', 'contract_replay_v1.json'),
      ('time_up', 'contract_replay_time_up_v1.json'),
      ('nta', 'contract_replay_nta_v1.json'),
      // Passage sets shown whole on the website (via set) and the submit sheet (via sheet).
      ('bst', 'contract_replay_bst_v1.json'),
      ('english', 'contract_replay_english_v1.json'),
    ]) {
      test('every question of the $name replay record gets the server\'s own time (lab.time)', () {
        final input = asJson(jsonDecode(File('test/fixtures/mistake_lab/replay_${name}_input.json').readAsStringSync()));
        final recovery = asJson(asJson(asJson(input['attempt'])['selectionMeta'])['recovery']);
        final rows = asJsonList(asJson(asJson(jsonDecode(File('test/fixtures/mistake_lab/$contract').readAsStringSync()))['time'])['rows']);
        final dwell = dwellByQuestion(recovery)!;
        expect(rows, hasLength(50));
        for (final r in rows) {
          final ms = asInt(r['ms']);
          expect(dwell[r['qid']], ms == null || ms == 0 ? isNull : ms, reason: '${r['qid']}');
        }
      });
    }
  });

  group('the server\'s read comes first', () {
    final recovery = {
      'telemetry': 'self_reported',
      'timeline': [
        {'qid': 'p-q1', 'at': 0, 'seq': 1, 'type': 'visit'},
        {'qid': 'p-q2', 'at': 60000, 'seq': 2, 'type': 'visit'},
        {'qid': 'p-q3', 'at': 61500, 'seq': 3, 'type': 'visit'},
        {'qid': 'p-q3', 'at': 90000, 'seq': 4, 'type': 'answer', 'answer': 1},
      ],
    };
    Map<String, dynamic> row(String qid, int number, int? ms) =>
        {'qid': qid, 'number': number, 'verdict': 'wrong', 'opened': ms != null, 'ms': ms, 'visits': 1, 'steps': [], 'lines': []};

    test('lab.time rows give the times, under 2 s left out as on the website, worded as the website words them', () {
      final a = _attempt(chapterOf('Goodwill', right: 1, wrong: 2), recovery: recovery);
      final s = SessionAnalysis.of(a, serverTime: {
        'state': 'ready',
        'rows': [row('p-q1', 1, 60000), row('p-q2', 2, 1500), row('p-q3', 3, 125000)],
      });
      expect(s.fromServer, isTrue);
      expect(s.dwellMs, {'p-q1': 60000, 'p-q3': 125000});
      expect(s.timeLabel('p-q1'), '1m');
      expect(s.timeLabel('p-q3'), '2m 05s');
      expect(s.timeLabel('p-q2'), isNull);
    });

    test('without lab.time (or with one that cannot be read) the same rule runs here', () {
      final a = _attempt(chapterOf('Goodwill', right: 1, wrong: 2), recovery: recovery);
      for (final serverTime in <Object?>[null, 'nonsense', {'state': 'ready'}]) {
        final s = SessionAnalysis.of(a, serverTime: serverTime);
        expect(s.fromServer, isFalse);
        expect(s.dwellMs, {'p-q1': 60000, 'p-q2': 1500, 'p-q3': 28500});
        expect(s.timeLabel('p-q1'), '1m 00s');
      }
    });
  });
}
