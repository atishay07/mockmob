// The app's port of the result's next-move rules (RESULT-1017 4.2 to 4.4) against the same papers as the website's
// `data/tests/result_next_move.test.mjs`: weak, average, strong, perfect, all blank, a key under re-check, no AI
// credits, every mistake repaired, late at night and a 5-question practice.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/model/next_move.dart';

Map<String, dynamic> _load(String name) =>
    jsonDecode(File('test/fixtures/result_next_move/$name.json').readAsStringSync()) as Map<String, dynamic>;

MoveOrder? _order(Object? v) {
  if (v is! Map) return null;
  final items = [
    for (final i in (v['items'] as List? ?? const []))
      MoveOrderItem(qid: i['qid'] as String, reason: (i['reason'] as String?) ?? 'paper', line: i['line'] as String?),
  ];
  return MoveOrder(cohort: v['state'] == 'cohort', items: items);
}

String _kind(MoveKind k) => k.name;

void main() {
  const papers = ['weak', 'avg', 'strong', 'perfect', 'blank', 'held', 'zero_credits', 'all_repaired', 'late_night', 'practice5'];

  for (final name in papers) {
    test('$name: the costliest line and the next move match the shared fixture', () {
      final f = _load(name);
      final input = f['input'] as Map<String, dynamic>;
      final expected = f['expected'] as Map<String, dynamic>;
      final analysis = MoveAnalysis([for (final r in input['rows'] as List) MoveRow.fromJson(r as Map<String, dynamic>)]);
      final reviews = {
        for (final e in (input['answerReviews'] as Map<String, dynamic>).entries) e.key: (e.value as Map)['state'] as String,
      };
      final checks = {for (final e in (input['checks'] as Map<String, dynamic>).entries) e.key: e.value == 'right'};

      final c = costliestLine(analysis, reviews: reviews);
      final ec = expected['costliest'] as Map<String, dynamic>;
      expect(c.line, ec['line']);
      expect(c.detail, ec['detail']);

      final move = nextMove(
        analysis: analysis,
        reviews: reviews,
        order: _order(input['repairOrder']),
        repaired: {for (final q in input['repaired'] as List) q as String},
        checks: checks,
        aiCredits: input['aiCredits'] as int?,
        practiceCredits: input['practiceCredits'] as int?,
        isPremium: input['isPremium'] as bool? ?? false,
        mode: input['mode'] as String?,
        subjectName: input['subjectName'] as String? ?? '',
        labReady: input['labReady'] as bool? ?? true,
        hour: input['hour'] as int?,
      );
      final em = expected['move'] as Map<String, dynamic>;
      expect(_kind(move.kind), em['kind']);
      expect(move.rule, em['rule']);
      expect(move.label, em['label']);
      expect(move.why, em['why']);
      expect(move.value, em['value']);
      expect(move.cost, em['cost']);
      expect(move.late, em['late']);
      expect(move.note, em['note']);
      final alt = em['alt'] as Map<String, dynamic>?;
      if (alt == null) {
        expect(move.alt, isNull);
      } else {
        expect(move.alt?.kind.name, alt['kind']);
        expect(move.alt?.label, alt['label']);
      }
      final target = em['target'] as Map<String, dynamic>?;
      if (target != null && target.containsKey('qid')) {
        expect(move.qid, target['qid']);
        expect(move.number, target['number']);
      }
      if (target != null && target.containsKey('chapter') && !target.containsKey('qid')) {
        expect(move.chapter, target['chapter']);
      }
    });
  }

  group('receipt', () {
    final now = DateTime(2026, 10, 17, 22);

    test('one line: subject, kind, the 12-hour time and the duration', () {
      expect(
        receiptLine(subjectName: 'Accountancy', mode: 'full', at: DateTime(2026, 10, 17, 21, 41), duration: const Duration(minutes: 46, seconds: 36), now: now),
        'Accountancy full mock. Recorded 9:41 PM, 46m 36s.',
      );
      expect(
        receiptLine(subjectName: 'Business Studies', mode: 'quick', at: DateTime(2026, 10, 17, 0, 22), duration: const Duration(minutes: 2, seconds: 36), now: now),
        'Business Studies practice. Recorded 12:22 AM, 2m 36s.',
      );
    });

    test('another day names the day; no duration when there is none', () {
      expect(receiptLine(subjectName: 'Accountancy', mode: 'nta', at: DateTime(2026, 10, 14, 21, 41), now: now), 'Accountancy NTA paper. Recorded 14 Oct, 9:41 PM.');
    });

    test('never says submitted, saved, session complete or practice finished', () {
      final line = receiptLine(subjectName: 'Accountancy', mode: 'quick', at: DateTime(2026, 10, 17, 21), now: now).toLowerCase();
      for (final word in ['submitted', 'submission', 'saved', 'session complete', 'practice finished']) {
        expect(line.contains(word), isFalse, reason: word);
      }
    });
  });

  group('lines', () {
    test('the value line drops the check when none is ready', () {
      expect(repairValueLine('B', checkReady: false), 'A repair gives you why B looked right, the trap, and one rule to keep.');
    });

    test('an unknown balance shows no number, never zero', () {
      expect(repairCostLine(null), '1 credit. No charge if the repair cannot be written.');
      expect(practiceCostLine(), 'This set uses 10 credits.');
      expect(practiceCostLine(isPremium: true), 'Pro covers this set.');
    });

    test('the mistakes head prices the mistakes, then counts the repairs', () {
      expect(mistakesHead(count: 12), (title: 'Your 12 mistakes', side: '−72 marks'));
      expect(mistakesHead(count: 12, repairedCount: 3), (title: 'Your 12 mistakes', side: '3 of 12 repaired'));
      expect(mistakesHead(count: 0).title, 'No mistakes to repair');
    });

    test('the late line runs from 11 PM to 5 AM only', () {
      expect(lateLine(23), isNotNull);
      expect(lateLine(4), isNotNull);
      expect(lateLine(5), isNull);
      expect(lateLine(15), isNull);
    });
  });
}
