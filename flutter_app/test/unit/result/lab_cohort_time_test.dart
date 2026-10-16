import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/full/answer_row.dart';
import 'package:mockmob/features/result/full/keep_numbers.dart';
import 'package:mockmob/features/result/full/lab_ledger_section.dart';

import '../../helpers/fonts.dart';
import 'support/cohort_time_fixtures.dart';
import 'support/lab_fixtures.dart';

/// Mistake Lab slice 5 (cohort time) in the app: `others.lines` under "How others answered" and
/// `cohort.slow` in the ledger. Both are the server's finished sentences, shown only when sent.
/// The no-break space the server joins a count to its word with.
final nb = String.fromCharCode(0xA0);

void main() {
  setUpAll(loadAppFonts);
  setUp(LabLedgerSection.debugResetSeen);

  group('model', () {
    // The server joins a count to its "of" with a no-break space so a phone does not strand the number; it is kept as sent.
    test('the time contract: the slow finding with its numbers, and three lines on a question', () {
      final lab = timeLab();
      final slow = lab.cohort!.slow!;
      expect(slow.line, 'On 7 questions you took over twice as long as the students who got them right. You got 5 of the 7 right.');
      expect(slow.numbers, [1, 2, 4, 5, 6, 7, 9]);
      expect(slow.questions, 7);
      expect(slow.right, 5);
      // The older cohort line and its numbers are read as before.
      expect(lab.cohort!.line, startsWith('7 questions you lost were ones most other students got right'));
      expect(lab.cohort!.numbers, [6, 12, 16, 17, 22, 40, 42]);
      // The fine line that states the 15-student basis comes with the other fine lines.
      expect(lab.cohort!.fine, contains('Each of the 7 has 15 or more students who got it right and were timed.'));
      final others = lab.othersFor('q1')!;
      expect(others.n, 45);
      expect(others.lines, [
        'Students who got this right took a median of 19s (30 students).',
        '6 of 27 timed students changed their answer here. 4${nb}of them moved off the key.',
        '9 of 30 students crossed out the key here.',
      ]);
      expect(lab.byQuestion.values.where((q) => q.others?.lines.isNotEmpty ?? false), hasLength(33));
    });

    test('one short of every gate: no slow finding and no lines, the picks line as before', () {
      final lab = gatedLab();
      expect(lab.cohort!.slow, isNull);
      expect(lab.cohort!.line, isNotNull);
      expect(lab.byQuestion.values.where((q) => q.others?.lines.isNotEmpty ?? false), isEmpty);
      expect(lab.othersFor('q1')!.line, '45 other students answered this. 36 got it right.');
    });

    test('a server from before slice 5 sends neither field, and the older contracts read as they did', () {
      expect(labOf('ready').cohort!.slow, isNull);
      expect(labOf('ready').othersFor('q17')!.lines, isEmpty);
      expect(labOf('replay').cohort?.slow, isNull);
    });

    test('lines are read additively: only text, a wrong type is nothing, the counts check still stands', () {
      Map<String, dynamic> others(Object? lines, {List<int> counts = const [3, 6, 0, 36]}) => {
            'n': 45,
            'right': 36,
            'counts': counts,
            'keyIndex': 3,
            'line': '45 other students answered this. 36 got it right.',
            'lines': lines,
          };
      expect(LabOthers.tryParse(others(['One.', 7, '', '  ', 'Two.']))!.lines, ['One.', 'Two.']);
      expect(LabOthers.tryParse(others('not a list'))!.lines, isEmpty);
      expect(LabOthers.tryParse(others(null))!.lines, isEmpty);
      expect(LabOthers.tryParse(others(['One.'], counts: const [3, 6, 0, 30])), isNull, reason: 'bars that do not add up still set the whole read aside');
    });

    test('cohort.slow: a line is all it needs; no line, or not a map, is nothing', () {
      expect(LabCohort.tryParse({'slow': {'line': 'Took longer.', 'numbers': [3, 'x', 0, 9]}})!.slow!.numbers, [3, 9]);
      expect(LabCohort.tryParse({'slow': {'line': 'Took longer.'}})!.slow!.numbers, isEmpty);
      expect(LabCohort.tryParse({'slow': {'numbers': [3]}}), isNull);
      expect(LabCohort.tryParse({'slow': 'Took longer.'}), isNull);
      // The cohort line may be absent while the slow finding is there (the server allows it).
      final only = LabCohort.tryParse({'slow': {'line': 'Took longer.', 'numbers': [3]}, 'fine': <String>[]})!;
      expect(only.line, isNull);
      expect(only.slow!.line, 'Took longer.');
    });
  });

  test('keepNumbersWithWords holds a number to the word after it and changes nothing else', () {
    expect(keepNumbersWithWords('took a median of 19s (30 students).'), 'took a median of 19s (30${nb}students).');
    expect(keepNumbersWithWords('6 of 27 timed students'), '6${nb}of 27${nb}timed students');
    expect(keepNumbersWithWords('You got 5 of the 7 right.'), 'You got 5${nb}of the 7${nb}right.');
    expect(keepNumbersWithWords('None of the 20 students.'), 'None of the 20${nb}students.');
    expect(keepNumbersWithWords('No numbers here.'), 'No numbers here.');
    expect(keepNumbersWithWords('3 2'), '3 2', reason: 'a number followed by a number is left');
  });

  group('the opened answer', () {
    Future<void> pumpRow(WidgetTester tester, LabOthers? others, {bool keysOff = false}) => pumpLabHost(
          tester,
          AnswerRow(item: q1Item(), expanded: true, onToggle: () {}, keysOff: keysOff, onRepair: () {}, others: others, othersTitle: 'How others answered'),
          reduced: true,
          size: const Size(360, 1000),
        );

    testWidgets('each line under the picks line, above the options, with its own denominator', (tester) async {
      final others = timeLab().othersFor('q1')!;
      await pumpRow(tester, others);
      await tester.pump();
      expect(find.text('How others answered'), findsOneWidget);
      expect(find.text(others.line), findsOneWidget);
      var above = tester.getTopLeft(find.text(others.line)).dy;
      for (final line in others.lines) {
        expect(find.text(keepNumbersWithWords(line)), findsOneWidget);
        final top = tester.getTopLeft(find.text(keepNumbersWithWords(line))).dy;
        expect(top > above, isTrue, reason: 'lines keep the server order');
        above = top;
      }
      expect(above < tester.getTopLeft(find.text('A. q1 statement one')).dy, isTrue);
    });

    testWidgets('the lines are in the second ink, the picks line keeps the first', (tester) async {
      final others = timeLab().othersFor('q1')!;
      await pumpRow(tester, others);
      await tester.pump();
      final picks = tester.widget<Text>(find.text(others.line)).style!;
      final time = tester.widget<Text>(find.text(keepNumbersWithWords(others.lines.first))).style!;
      expect(time.color, isNot(picks.color));
      expect(time.fontSize, picks.fontSize);
    });

    testWidgets('no lines from the server, nothing extra: only the picks line', (tester) async {
      final others = gatedLab().othersFor('q1')!;
      await pumpRow(tester, others);
      await tester.pump();
      expect(find.text(others.line), findsOneWidget);
      expect(find.textContaining('timed students'), findsNothing);
      expect(find.textContaining('crossed out'), findsNothing);
      expect(find.textContaining('took a median'), findsNothing);
    });

    testWidgets('keys off: neither the picks line nor the time lines', (tester) async {
      final others = timeLab().othersFor('q1')!;
      await pumpRow(tester, others, keysOff: true);
      await tester.pump();
      for (final line in others.lines) {
        expect(find.text(keepNumbersWithWords(line)), findsNothing);
      }
      expect(find.text(others.line), findsNothing);
    });
  });

  group('the ledger', () {
    Future<List<int>> pump(WidgetTester tester, MistakeLab lab) async {
      final opened = <int>[];
      await pumpLabHost(tester, LabLedgerSection(attemptId: 'a7', lab: lab, onOpenQuestion: opened.add), reduced: true, size: const Size(360, 1800));
      await tester.pumpAndSettle();
      return opened;
    }

    testWidgets('the finding sits in the cohort block below the cohort line, and its chips open that answer', (tester) async {
      final lab = timeLab();
      final opened = await pump(tester, lab);
      final slow = find.text(keepNumbersWithWords(lab.cohort!.slow!.line));
      expect(slow, findsOneWidget);
      expect(find.text(lab.cohort!.line!), findsOneWidget);
      expect(tester.getTopLeft(slow).dy > tester.getTopLeft(find.text(lab.cohort!.line!)).dy, isTrue);
      expect(find.text('Each of the 7 has 15 or more students who got it right and were timed.'), findsOneWidget);
      // Q9 and Q4 belong to the finding only; the chip under it opens that answer.
      await tester.ensureVisible(find.text('Q9').last);
      await tester.tap(find.text('Q9').last);
      expect(opened, [9]);
      await tester.ensureVisible(find.text('Q4').last);
      await tester.tap(find.text('Q4').last);
      expect(opened, [9, 4]);
    });

    testWidgets('one short of the gate: no finding, and no fine line about it', (tester) async {
      final lab = gatedLab();
      await pump(tester, lab);
      expect(find.textContaining('took over twice as long'), findsNothing);
      expect(find.textContaining('15 or more students'), findsNothing);
      expect(find.text(lab.cohort!.line!), findsOneWidget);
    });

    testWidgets('the finding alone, with no cohort line: it still shows, with its chips', (tester) async {
      final json = labContract('cohort_time');
      final cohort = Map<String, dynamic>.from(json['cohort'] as Map)
        ..['line'] = null
        ..['numbers'] = <int>[];
      final lab = MistakeLab.tryParse({...json, 'cohort': cohort})!;
      expect(lab.cohort!.line, isNull);
      await pump(tester, lab);
      expect(find.text(keepNumbersWithWords(lab.cohort!.slow!.line)), findsOneWidget);
      expect(find.text('Q9'), findsWidgets);
    });

    testWidgets('a finding without numbers shows its sentence and no chips', (tester) async {
      final json = labContract('cohort_time');
      final cohort = Map<String, dynamic>.from(json['cohort'] as Map);
      cohort['slow'] = {
        'line': 'On 7 questions you took over twice as long as the students who got them right. You got 5 of the 7 right.',
        'questions': 7,
        'right': 5,
      };
      final lab = MistakeLab.tryParse({...json, 'cohort': cohort})!;
      await pump(tester, lab);
      expect(find.text(keepNumbersWithWords(lab.cohort!.slow!.line)), findsOneWidget);
      expect(find.text('Q9'), findsNothing);
    });
  });
}
