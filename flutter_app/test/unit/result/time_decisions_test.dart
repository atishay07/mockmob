import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/model/time_decisions.dart';

// The website's data/tests/time_decisions.test.mjs checks the same fixture and the same sentences.

const _key = 0;
int _mark(int? a) => a == null ? 0 : (a == _key ? 5 : -1);

List<Map<String, dynamic>> _fixtureEvents() {
  final ev = <Map<String, dynamic>>[];
  var seq = 1;
  void push(String qid, int at, String type, [int? answer]) =>
      ev.add({'seq': seq++, 'qid': qid, 'at': at, 'type': type, if (type == 'answer') 'answer': answer});
  push('q1', 0, 'visit');
  push('q1', 42000, 'answer', 1);
  push('q1', 115000, 'answer', 2);
  push('q2', 130000, 'visit');
  push('q2', 150000, 'answer', 0);
  push('q2', 200000, 'answer', 3);
  push('q3', 210000, 'visit');
  push('q3', 215000, 'answer', 1);
  push('q4', 216000, 'visit');
  push('q4', 260000, 'answer', 0);
  for (var i = 5; i <= 11; i++) {
    final start = 270000 + (i - 5) * 50000;
    push('q$i', start, 'visit');
    push('q$i', start + 30000, 'answer', 0);
  }
  push('q12', 620000, 'visit');
  push('q12', 640000, 'answer', 2);
  push('q12', 650000, 'answer', null);
  push('q12', 700000, 'answer', 0);
  push('q1', 710000, 'visit');
  push('q3', 720000, 'visit');
  return ev;
}

const _answers = {'q1': 2, 'q2': 3, 'q3': 1, 'q4': 0, 'q5': 0, 'q6': 0, 'q7': 0, 'q8': 0, 'q9': 0, 'q10': 0, 'q11': 0, 'q12': 0};

/// The server's record, built the way data/recovery.js scoreSession builds it.
Attempt _attempt({
  String? mode = 'quick',
  String? scoring = 'server_practice_v1',
  String telemetry = 'self_reported',
  List<Map<String, dynamic>>? events,
  Map<String, int> answers = _answers,
}) {
  final timeline = events ?? _fixtureEvents();
  final changes = <Map<String, dynamic>>[];
  final previous = <String, int?>{};
  for (final e in timeline.where((e) => e['type'] == 'answer')) {
    final qid = e['qid'] as String;
    final a = e['answer'] as int?;
    if (previous.containsKey(qid) && previous[qid] != a) {
      changes.add({'qid': qid, 'at': e['at'], 'before': previous[qid], 'after': a, 'markEffect': _mark(a) - _mark(previous[qid])});
    }
    previous[qid] = a;
  }
  return Attempt.fromJson({
    'id': 'a1',
    'subject': 'accountancy',
    'total': 12,
    'questionsSnapshot': [
      for (var i = 0; i < 12; i++)
        {'id': 'q${i + 1}', 'chapter': i < 4 ? 'Goodwill' : 'Ratios', 'question': 'Question ${i + 1}', 'options': ['a', 'b', 'c', 'd'], 'correctIndex': _key},
    ],
    'details': [
      for (var i = 0; i < 12; i++)
        {'qid': 'q${i + 1}', 'givenIndex': answers['q${i + 1}'], 'isCorrect': answers['q${i + 1}'] == null ? null : answers['q${i + 1}'] == _key},
    ],
    'selectionMeta': {
      'mode': ?mode,
      'scoringVersion': ?scoring,
      'recovery': {
        'telemetry': telemetry,
        'timeline': timeline,
        'observed': {'answerChanges': changes},
      },
    },
  });
}

void main() {
  test('labels: seconds, whole minutes and the paper clock', () {
    expect(spentLabel(42), '42s');
    expect(spentLabel(60), '1m');
    expect(spentLabel(125), '2m 05s');
    expect(clockLabel(42), '0:42');
    expect(clockLabel(725), '12:05');
    expect(ratioLabel(2.25), '2.3');
    expect(ratioLabel(2.0), '2');
  });

  test('paper pace comes from the paper limit', () {
    expect(paperPace(_attempt())!.perQuestionMs, 60000);
    expect(paperPace(_attempt(mode: 'full'))!.perQuestionMs, 300000); // 60 minutes over this 12-question fixture
    expect(paperPace(_attempt(mode: null)), isNull);
  });

  test('each question: time against the paper pace and the median, revisits, every pick with its clock time and the marks effect', () {
    final td = buildTimeDecisions(_attempt());
    expect(td.state, 'ready');
    TimeRow row(int n) => td.rows[n - 1];
    expect(row(1).lines, [
      "2m 20s on this question. The paper gives 1m a question, and your median was 50s. That is 2.3 times the paper's pace. You opened it 2 times.",
      'Picked B at 0:42. Changed to C at 1:55, 1m 13s later.',
      'That change made no difference to your marks.',
    ]);
    expect(row(2).lines, [
      '1m 20s on this question. The paper gives 1m a question, and your median was 50s.',
      'Picked A at 2:30. Changed to D at 3:20, 50s later.',
      'That change cost 6 marks.',
    ]);
    expect(row(12).lines.sublist(1), [
      'Picked C at 10:40. Cleared it at 10:50, 10s later. Picked A at 11:40, 50s later.',
      'Together these 2 changes gained 6 marks.',
    ]);
    expect(row(5).lines.length, 2);
    expect(row(3).lines.first, 'At least 6s on this question. The paper gives 1m a question, and your median was 50s. You opened it 2 times.');
  });

  test('the whole paper: pace, median, time split, longest questions and every change with its net effect', () {
    final td = buildTimeDecisions(_attempt());
    expect(td.paceLine, 'This paper gives you 1m a question: 12 minutes for 12 questions.');
    expect(td.medianLine, 'Your median was 50s a question, over 12 timed questions.');
    expect(td.splitLine, 'You spent 8m 14s on 9 right answers and 3m 46s on 3 wrong answers.');
    expect([for (final l in td.longest) '${l.number} ${l.time} ${l.ratioText}'], [
      "1 2m 20s 2.3 times the paper's pace",
      "12 1m 30s 1.5 times the paper's pace",
      "2 1m 20s 1.3 times the paper's pace",
      '4 54s null',
      '5 50s null',
    ]);
    expect(td.changesLead, 'You changed answers 4 times across 3 questions. Net effect on your marks: 0.');
    expect([for (final p in td.changeParts) p.text], ['2 changes gained 6 marks', '1 change cost 6 marks', '1 change made no difference']);
    expect([for (final r in td.changeRows) '${r.number} ${r.net}'], ['1 0', '2 -6', '12 6']);
  });

  test('a question under re-check keeps its times but leaves the marks effect', () {
    final td = buildTimeDecisions(_attempt(), answerReviews: const {'q2': 'under_review'});
    expect(td.rows[1].lines.length, 2);
    expect(td.changesLead, 'You changed answers 3 times across 2 questions. Net effect on your marks: +6.');
    expect(td.changesHeld, '1 question under re-check or corrected is left out of the marks effect.');
    expect(td.changeRows.firstWhere((r) => r.number == 2).net, isNull);
  });

  test('no time read without a usable record: browser-scored, mismatched and missing records each say so', () {
    expect(buildTimeDecisions(_attempt(scoring: null)).message, TimeCopy.device);
    expect(buildTimeDecisions(_attempt(telemetry: 'inconsistent')).state, 'inconsistent');
    final none = buildTimeDecisions(_attempt(events: const []));
    expect(none.state, 'none');
    expect(none.message, 'Time and answer changes were not recorded for this paper. Your score is unaffected.');
  });

  test('one change, unopened questions and a gap over 30 minutes', () {
    final td = buildTimeDecisions(_attempt(mode: null, answers: const {'q1': 1}, events: [
      {'seq': 1, 'qid': 'q1', 'at': 0, 'type': 'visit'},
      {'seq': 2, 'qid': 'q1', 'at': 30000, 'type': 'answer', 'answer': 0},
      {'seq': 3, 'qid': 'q1', 'at': 45000, 'type': 'answer', 'answer': 1},
      {'seq': 4, 'qid': 'q2', 'at': 60000, 'type': 'visit'},
      {'seq': 5, 'qid': 'q3', 'at': 60000 + 31 * 60000, 'type': 'visit'},
    ]));
    expect(td.changesLead, 'You changed one answer. Net effect on your marks: −6.');
    expect(td.rows[0].lines.first, '1m on this question.');
    expect(td.rows[1].lines.first, 'A break of over 30 minutes on this question is not counted.');
    expect(td.rows[2].lines.first, 'The last question you opened. Time after your last tap is not recorded.');
    expect(td.rows[3].lines.first, 'You did not open this question.');
    expect(td.paceLine, isNull);
    expect(td.medianLine, isNull);
  });

  test('no answers changed says so plainly', () {
    final td = buildTimeDecisions(_attempt(answers: const {'q1': 0}, events: [
      {'seq': 1, 'qid': 'q1', 'at': 0, 'type': 'visit'},
      {'seq': 2, 'qid': 'q1', 'at': 9000, 'type': 'answer', 'answer': 0},
      {'seq': 3, 'qid': 'q2', 'at': 12000, 'type': 'visit'},
    ]));
    expect(td.changesLead, 'You did not change any answers in this paper.');
    expect(td.changeParts, isEmpty);
  });
}
