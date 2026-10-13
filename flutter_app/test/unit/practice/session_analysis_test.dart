// The port of the website's `analyseSession` (data/session_recovery.js): the same attempt must
// produce the same observations, timings and answer changes in the app as on the site.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
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
    expect(blank.headline, 'One question left blank');
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
}
