// The reference student of REVIEW-RESULT-1018 as the app holds it: attempts, the phone's repair records and the Check it held
// outcomes, built from the same fixture the website's tests read (`test/fixtures/review/student-1018.json`). Running the app's
// own index and adapter on it must give the website's numbers: 220 marks lost over three papers, the lead chapter at 35 of the
// 80 marks on offer, nine saved repairs.
//
// Mock numbers are per subject and counted from the first mock, so the fixture's Mock 2 and Mock 3 need a Mock 1 before them:
// [firstMock] is a perfect Accountancy paper from 5 October. It lost nothing, so it changes no figure (a paper with no miss puts
// no questions on offer), only the paper count: "Your 4 papers".
import 'dart:convert';
import 'dart:io';

import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/model/review_record_adapter.dart' show CheckOutcome, mistakeKeyOf;

const _subjects = {'Accountancy': 'accountancy', 'Business Studies': 'business_studies'};

class Student1018 {
  const Student1018({required this.json, required this.attempts, required this.records, required this.checks, required this.now});

  final Map<String, dynamic> json;

  /// Newest first.
  final List<Attempt> attempts;
  final List<RepairLocalRecord> records;
  final Map<String, CheckOutcome> checks;

  /// Saturday 17 October 2026, 9:41 PM in India.
  final DateTime now;

  /// The fixture's papers by id: `m3`, `bq`, `m2`.
  Attempt paper(String id) => attempts.firstWhere((a) => a.id == id);
}

Student1018 student1018({bool firstMock = true}) {
  final json = jsonDecode(File('test/fixtures/review/student-1018.json').readAsStringSync()) as Map<String, dynamic>;
  final chapterNames = {for (final c in json['chapters'] as List) (c as Map)['id'] as String: c['name'] as String};
  final asked = (json['chapterQuestions'] as Map).map((p, v) => MapEntry(p as String, (v as Map).map((c, n) => MapEntry(c as String, n as int))));
  final items = [for (final i in json['items'] as List) Map<String, dynamic>.from(i as Map)];

  final attempts = <Attempt>[];
  final records = <RepairLocalRecord>[];
  final checks = <String, CheckOutcome>{};

  for (final p in json['papers'] as List) {
    final paper = p as Map<String, dynamic>;
    final id = paper['id'] as String;
    final subject = _subjects[paper['subject']]!;
    final mine = [for (final i in items) if (i['paper'] == id) i];
    final byNumber = {for (final i in mine) i['q'] as int: i};
    // The questions the fixture does not name are right answers, spread over what each chapter still has to give.
    final left = {...asked[id]!};
    for (final i in mine) {
      left[i['ch'] as String] = left[i['ch']]! - 1;
    }
    final fillers = [for (final e in left.entries) for (var n = 0; n < e.value; n++) e.key];
    var next = 0;
    final total = paper['questions'] as int;
    final questions = <Map<String, dynamic>>[];
    final details = <Map<String, dynamic>>[];
    for (var q = 1; q <= total; q++) {
      final item = byNumber[q];
      final ch = item == null ? fillers[next++] : item['ch'] as String;
      final qid = '$id-q$q';
      final pick = item?['pick'] as String?;
      final given = pick == null ? null : 'ABCD'.indexOf(pick);
      questions.add({
        'id': qid,
        'subject': subject,
        'internalSubject': subject,
        'chapter': chapterNames[ch],
        'question': item?['stem'] ?? 'A question of ${chapterNames[ch]}, number $q.',
        'options': const ['First option', 'Second option', 'Third option', 'Fourth option'],
        'correctIndex': given == 1 ? 2 : 1,
        'explanation': 'The key explanation.',
      });
      details.add({
        'qid': qid,
        'givenIndex': given,
        'isCorrect': item == null ? true : (item['state'] == 'blank' ? null : false),
      });
      final state = item?['state'] as String?;
      if (state == 'repaired' || state == 'held' || state == 'slipped') {
        records.add(
          RepairLocalRecord(
            attemptId: id,
            questionId: qid,
            requestId: 'req-$qid-000000000000',
            status: RepairLocalStatus.stored,
            ackedAt: DateTime.parse(item!['repairedAt'] as String),
          ),
        );
        if (state == 'held') checks[mistakeKeyOf(id, qid)] = const CheckOutcome(right: true);
        if (state == 'slipped') checks[mistakeKeyOf(id, qid)] = CheckOutcome(right: false, at: DateTime.parse(item['checkedAt'] as String));
      }
    }
    final blank = mine.where((i) => i['state'] == 'blank').length;
    final wrong = mine.length - blank;
    attempts.add(
      Attempt.fromJson({
        'id': id,
        'userId': 'u1',
        'subject': subject,
        'score': 0,
        'correct': total - wrong - blank,
        'wrong': wrong,
        'unattempted': blank,
        'total': total,
        'details': details,
        'questionsSnapshot': questions,
        'selectionMeta': {'mode': paper['kind'] == 'full mock' ? 'full' : 'quick', 'scoringVersion': 'server_snapshot_v1'},
        'mode': paper['kind'] == 'full mock' ? 'full' : 'quick',
        'completedAt': DateTime.parse(paper['at'] as String).millisecondsSinceEpoch,
      }),
    );
  }

  if (firstMock) {
    attempts.add(
      Attempt.fromJson({
        'id': 'm1',
        'userId': 'u1',
        'subject': 'accountancy',
        'score': 100,
        'correct': 10,
        'wrong': 0,
        'unattempted': 0,
        'total': 10,
        'details': [for (var q = 1; q <= 10; q++) {'qid': 'm1-q$q', 'givenIndex': 1, 'isCorrect': true}],
        'questionsSnapshot': [
          for (var q = 1; q <= 10; q++)
            {
              'id': 'm1-q$q',
              'subject': 'accountancy',
              'internalSubject': 'accountancy',
              'chapter': chapterNames['adm'],
              'question': 'A question of ${chapterNames['adm']}, number $q.',
              'options': const ['First option', 'Second option', 'Third option', 'Fourth option'],
              'correctIndex': 1,
            },
        ],
        'selectionMeta': {'mode': 'full', 'scoringVersion': 'server_snapshot_v1'},
        'mode': 'full',
        'completedAt': DateTime.utc(2026, 10, 5, 15).millisecondsSinceEpoch,
      }),
    );
  }
  attempts.sort((a, b) => b.completedAt.compareTo(a.completedAt));

  return Student1018(json: json, attempts: attempts, records: records, checks: checks, now: DateTime.parse(json['now'] as String));
}
