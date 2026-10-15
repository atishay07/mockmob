import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart' show LabOthers;
import 'package:mockmob/features/result/full/answer_row.dart';
import 'package:mockmob/features/result/model/answer_items.dart' show AnswerItem;

import '../../helpers/fonts.dart';
import 'support/lab_fixtures.dart';

Future<void> pumpRow(WidgetTester tester, {LabOthers? others, bool keysOff = false, bool reduced = true, AnswerItem? item}) =>
    pumpLabHost(
      tester,
      AnswerRow(
        item: item ?? q17Item(),
        expanded: true,
        onToggle: () {},
        keysOff: keysOff,
        onRepair: () {},
        others: others,
        othersTitle: 'How others answered',
      ),
      reduced: reduced,
      size: const Size(360, 900),
    );

void main() {
  setUpAll(loadAppFonts);

  final others = labOf('ready').othersFor('q17')!;

  testWidgets('the label and the line above the options, and each option its count in served order', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpRow(tester, others: others);
    await tester.pump();
    expect(find.text('How others answered'), findsOneWidget);
    expect(find.text(others.line), findsOneWidget);
    // The line sits above the options.
    expect(tester.getTopLeft(find.text(others.line)).dy < tester.getTopLeft(find.text('A. 300 rupees')).dy, isTrue);
    // Counts follow the options' order on this paper: A 3, B 8, C 1, D 19.
    final counts = ['3', '8', '1', '19'];
    final letters = ['A. 300 rupees', 'B. 800 rupees', 'C. 1,000 rupees', 'D. 500 rupees'];
    for (var i = 0; i < 4; i++) {
      final row = find.ancestor(of: find.text(letters[i]), matching: find.byType(Row)).first;
      expect(find.descendant(of: row, matching: find.text(counts[i])), findsOneWidget, reason: letters[i]);
    }
    // What a screen reader hears for each option ends with how many others chose it.
    expect(find.bySemanticsLabel('B. 800 rupees. Your answer. Option B: chosen by 8 of 31 other students'), findsOneWidget);
    expect(find.bySemanticsLabel('D. 500 rupees. Correct answer. Option D: chosen by 19 of 31 other students'), findsOneWidget);
    expect(find.bySemanticsLabel('A. 300 rupees. Option A: chosen by 3 of 31 other students'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('nothing when others is null, and nothing while keys are off', (tester) async {
    await pumpRow(tester);
    await tester.pump();
    expect(find.text('How others answered'), findsNothing);
    expect(find.text('19'), findsNothing);

    await pumpRow(tester, others: others, keysOff: true);
    await tester.pump();
    expect(find.text('How others answered'), findsNothing);
    expect(find.text(others.line), findsNothing);
    expect(find.text('19'), findsNothing);
  });

  testWidgets('counts that do not line up with the options: the line stays, the counts do not', (tester) async {
    final three = LabOthers(n: 10, right: 6, counts: const [2, 6, 2], line: '10 other students answered this. 6 got it right. A small group so far.');
    await pumpRow(tester, others: three);
    await tester.pump();
    expect(find.text(three.line), findsOneWidget);
    expect(find.text('6'), findsNothing);
  });

  testWidgets('the bars grow from zero when the answer opens, and settle', (tester) async {
    await pumpRow(tester, others: others, reduced: false);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('19'), findsOneWidget);
  });
}
