import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/full/answer_row.dart';
import 'package:mockmob/features/result/model/answer_items.dart';
import 'package:mockmob/features/result/widgets/trap_tag.dart';

import '../../helpers/fonts.dart';
import 'support/lab_fixtures.dart';

Map<String, dynamic> _traps() => jsonDecode(File('test/fixtures/mistake_lab/contract_traps_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// A tag on option B of question 17 (the student picked B, the key is D), in the website's words.
TrapTag tagOn({int index = 1, String letter = 'B', String key = 'p1-q2'}) {
  final raw = Map<String, dynamic>.from(((_traps()['paper'] as Map)['tags'] as Map)[key] as Map)
    ..['index'] = index
    ..['letter'] = letter;
  return TrapTag.tryParse('q17', raw)!;
}

AnswerItem itemOf(Verdict verdict, {int? given = 1}) {
  final q = q17Item();
  return AnswerItem(number: q.number, question: q.question, verdict: verdict, given: given, keyIndex: 3, repairable: false);
}

Future<void> pumpRow(WidgetTester tester, {TrapTag? trap, AnswerItem? item, bool keysOff = false}) => pumpLabHost(
      tester,
      AnswerRow(item: item ?? q17Item(), expanded: true, onToggle: () {}, keysOff: keysOff, trap: trap),
      reduced: true,
      size: const Size(360, 1000),
    );

/// The trap tag under a wrong option in an opened answer (Mistake Lab v4 slice 4, spec 4.7).
void main() {
  setUpAll(loadAppFonts);

  testWidgets('a format trap: the name, the one sentence and where the name comes from, under the student\'s own option', (tester) async {
    await pumpRow(tester, trap: tagOn());
    await tester.pump();
    expect(find.text('Trap: the assertion and reason link'), findsOneWidget);
    expect(find.text('This option and the key agree on both statements; only the link differs.'), findsOneWidget);
    expect(find.text('From the question format'), findsOneWidget);
    // It is one more row under the option's own words and never over them.
    final optionText = tester.getRect(find.text('B. 800 rupees'));
    final tag = tester.getRect(find.text('Trap: the assertion and reason link'));
    expect(tag.top, greaterThanOrEqualTo(optionText.bottom));
    // And inside the option, not under the next one: the next option starts below the source line.
    final source = tester.getRect(find.text('From the question format'));
    final next = tester.getRect(find.text('C. 1,000 rupees'));
    expect(source.bottom, lessThanOrEqualTo(next.top));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a trap Mistake Repair named: no detail line, "Named by Mistake Repair"', (tester) async {
    await pumpRow(tester, trap: tagOn(key: 'p1-q1'));
    await tester.pump();
    expect(find.text('Trap: a look-alike term'), findsOneWidget);
    expect(find.text('Named by Mistake Repair'), findsOneWidget);
    expect(find.textContaining('This option'), findsNothing);
  });

  testWidgets('the option\'s screen-reader label ends with the trap, its sentence and its source', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpRow(tester, trap: tagOn());
    await tester.pump();
    expect(
      find.bySemanticsLabel(
        'B. 800 rupees. Your answer. Trap: the assertion and reason link. This option and the key agree on both statements; only the link differs. From the question format',
      ),
      findsOneWidget,
    );
    handle.dispose();
  });

  testWidgets('no tag on a right, blank or held answer, and none while keys are off', (tester) async {
    for (final verdict in [Verdict.correct, Verdict.blank, Verdict.held]) {
      await pumpRow(tester, trap: tagOn(), item: itemOf(verdict, given: verdict == Verdict.blank ? null : 1));
      await tester.pump();
      expect(find.textContaining('Trap:'), findsNothing, reason: '$verdict');
    }
    await pumpRow(tester, trap: tagOn(), keysOff: true);
    await tester.pump();
    expect(find.textContaining('Trap:'), findsNothing);
  });

  testWidgets('no tag unless it names the option the student chose: another index or another letter shows nothing', (tester) async {
    await pumpRow(tester, trap: tagOn(index: 2, letter: 'C'));
    await tester.pump();
    expect(find.textContaining('Trap:'), findsNothing);
    await pumpRow(tester, trap: tagOn(index: 1, letter: 'C'));
    await tester.pump();
    expect(find.textContaining('Trap:'), findsNothing);
    // A tag with no letter is placed by its index alone.
    await pumpRow(tester, trap: tagOn(letter: ''));
    await tester.pump();
    expect(find.textContaining('Trap:'), findsOneWidget);
  });

  testWidgets('no trap: the answer reads as it did', (tester) async {
    await pumpRow(tester);
    await tester.pump();
    expect(find.textContaining('Trap:'), findsNothing);
    expect(find.text('B. 800 rupees'), findsOneWidget);
  });

  test('what a screen reader hears for a tag drops the closing full stops it would double', () {
    expect(TrapTagView.spokenOf(tagOn()), 'Trap: the assertion and reason link. This option and the key agree on both statements; only the link differs. From the question format');
  });

  testWidgets('the tag sits with the options under large text without overflowing', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.6;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await pumpRow(tester, trap: tagOn());
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.text('Trap: the assertion and reason link'), findsOneWidget);
  });
}
