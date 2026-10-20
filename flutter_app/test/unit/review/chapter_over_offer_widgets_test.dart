// v15 final walk, HIGH: Review's More chapters printed "Lost 316 of the 310 marks on offer". A wrong answer loses 6 marks and a
// question offers 5, so a chapter of mostly wrong answers can lose more than it had on offer. Every surface of the chapter row
// and the hero says the marks lost alone then, and keeps "of N" when it can be true.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/review/model/review_chapters.dart';
import 'package:mockmob/features/review/widgets/chapter_hero.dart';
import 'package:mockmob/features/review/widgets/more_chapters.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

ChapterRow _row({required int wrong, required int blank, required int questions}) {
  final rec = ReviewRecord.fromJson({
    'now': '2026-10-17T21:00:00+05:30',
    'papers': [
      {'id': 'p1', 'name': 'Mock 1', 'at': '2026-10-17T20:00:00+05:30'},
    ],
    'chapters': [
      {'id': 'c1', 'name': 'Financial Markets'},
    ],
    'chapterQuestions': {
      'p1': {'c1': questions},
    },
    'items': [
      for (var q = 1; q <= wrong; q++) {'paper': 'p1', 'q': q, 'ch': 'c1', 'state': 'open'},
      for (var q = wrong + 1; q <= wrong + blank; q++) {'paper': 'p1', 'q': q, 'ch': 'c1', 'state': 'blank'},
    ],
  });
  return chapterRows(rec).single;
}

Future<void> _pumpBoth(WidgetTester tester, ChapterRow row) => pumpMockmob(
  tester,
  SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(
      children: [
        ChapterHero(row: row, rank: 1, practiseLabel: 'Practise 10 on this chapter', practiseLine: '10 new questions.', onPractise: () {}),
        MoreChapters(rows: [row], total: 2, across: 'Each chapter in Mock 1.', onOpen: (_) {}),
      ],
    ),
  ),
  size: const Size(360, 1400),
  disableAnimations: true,
);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('over the offer (316 lost, 310 on offer): no "of 310" anywhere, the marks lost stand alone, no overflow', (tester) async {
    final row = _row(wrong: 6, blank: 56, questions: 62);
    expect((row.lost, row.offer), (316, 310));
    await _pumpBoth(tester, row);
    expect(find.text('of 310'), findsNothing, reason: 'the hero unit');
    expect(find.textContaining('of the 310'), findsNothing, reason: 'the row line');
    expect(find.textContaining('316'), findsWidgets);
    expect(find.text('marks slipped'), findsOneWidget);
    expect(find.text('316 marks slipped, 62 questions in Mock 1. 6 wrong, 56 left blank.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    // The spoken words say the same: nothing of the "X of Y" kind.
    final spoken = tester.widgetList<Semantics>(find.byType(Semantics)).map((s) => s.properties.label ?? '').join('|');
    expect(spoken, isNot(contains('316 of')));
  });

  testWidgets('under the offer the hero keeps its "of N" and the row says it', (tester) async {
    final row = _row(wrong: 2, blank: 1, questions: 10);
    await _pumpBoth(tester, row);
    expect(find.text('of 50'), findsOneWidget);
    expect(find.textContaining('17 of the 50 marks on offer slipped'), findsOneWidget);
  });

  testWidgets('exactly the offer keeps its "of N": 25 of 25 is true', (tester) async {
    final row = _row(wrong: 0, blank: 5, questions: 5);
    await _pumpBoth(tester, row);
    expect(find.text('of 25'), findsOneWidget);
    expect(find.textContaining('25 of the 25 marks on offer slipped'), findsOneWidget);
  });
}
