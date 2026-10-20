// Owner I14 (19 Oct): "costliest chapter" ranking with ties. Chapters that lost the same marks share one rank (standard
// competition ranking), the next distinct value is ranked after the whole group, and no screen calls a tied chapter
// "second costliest" or names one of two equal chapters as the only cost.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/competition_rank.dart';
import 'package:mockmob/features/paper_reel/copy.dart' show ReelCopy;
import 'package:mockmob/features/result/model/next_move.dart';
import 'package:mockmob/features/result/widgets/result_head.dart' show CostliestBlock;
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/model/review_chapters.dart';
import 'package:mockmob/features/review/widgets/chapter_hero.dart';
import 'package:mockmob/features/review/widgets/weak_chapters_lead.dart';
import 'package:mockmob/features/today/copy_glance.dart' show GlanceCopy;

import '../../golden/review/review_golden_support.dart' show reviewOverrides;
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// A paper whose chapters each lost the given marks: 6 a wrong answer, so the given count of wrong answers per chapter.
MoveAnalysis _paper(Map<String, int> wrongs, {int rightFiller = 4}) {
  final rows = <MoveRow>[];
  var n = 0;
  wrongs.forEach((chapter, w) {
    for (var i = 0; i < w; i++) {
      n++;
      rows.add(MoveRow(qid: 'q$n', number: n, verdict: RowVerdict.wrong, chapter: chapter, givenIndex: 1));
    }
  });
  for (var i = 0; i < rightFiller; i++) {
    n++;
    rows.add(MoveRow(qid: 'q$n', number: n, verdict: RowVerdict.correct, chapter: 'Filler'));
  }
  return MoveAnalysis(rows);
}

ReviewRecord _record(Map<String, int> wrongs) {
  final names = wrongs.keys.toList();
  var q = 0;
  return ReviewRecord.fromJson({
    'now': '2026-10-17T21:00:00+05:30',
    'papers': [
      {'id': 'p1', 'name': 'Mock 1', 'at': '2026-10-17T20:00:00+05:30'},
    ],
    'chapters': [
      for (var i = 0; i < names.length; i++) {'id': 'c$i', 'name': names[i]},
    ],
    'items': [
      for (var i = 0; i < names.length; i++)
        for (var k = 0; k < wrongs[names[i]]!; k++) {'paper': 'p1', 'q': ++q, 'ch': 'c$i', 'state': 'open'},
    ],
  });
}

Future<void> _pumpLead(WidgetTester tester, Map<String, int> wrongs) => pumpMockmob(
  tester,
  SingleChildScrollView(padding: const EdgeInsets.all(16), child: WeakChaptersLead(body: chaptersBody(_record(wrongs)), onRepair: (_) {}, showSummary: false)),
  size: const Size(384, 2400),
  disableAnimations: true,
  wrapInScaffold: false,
  overrides: reviewOverrides(),
);

void main() {
  setUpAll(loadAppFonts);

  group('competition rank', () {
    test('no ties: 1, 2, 3', () {
      expect(competitionRanks([18, 12, 6]), const [RankPlace(rank: 1, tied: 1), RankPlace(rank: 2, tied: 1), RankPlace(rank: 3, tied: 1)]);
    });

    test('one tie of two: 6 and 6 share the first place, the next is third', () {
      final r = competitionRanks([6, 6, 5]);
      expect(r.map((p) => p.rank), [1, 1, 3]);
      expect(r.map((p) => p.tied), [2, 2, 1]);
    });

    test('four tied at 12: all first, the next distinct value is fifth', () {
      final r = competitionRanks([12, 12, 12, 12, 6]);
      expect(r.map((p) => p.rank), [1, 1, 1, 1, 5]);
      expect(r.map((p) => p.tied), [4, 4, 4, 4, 1]);
      expect(r.first.isTied && r.first.isFirst, isTrue);
    });

    test('a tie below the top: 12, 6, 6 is 1, 2, 2', () {
      expect(competitionRanks([12, 6, 6]).map((p) => p.rank), [1, 2, 2]);
    });

    test('a single value stands alone and an empty list asks nothing', () {
      expect(rankOf(7, [7]), const RankPlace(rank: 1, tied: 1));
      expect(competitionRanks(const []), isEmpty);
    });
  });

  group('the result line', () {
    test('no ties: one chapter named, as before', () {
      final c = costliestLine(_paper({'Share Capital': 3, 'Ray Optics': 1}));
      expect(c.line, 'Share Capital cost 18 of the 24 marks you missed.');
      expect(c.tied, isEmpty);
      expect(c.chapter, 'Share Capital');
    });

    test('two chapters tied at 6: both named, neither is the only cost', () {
      final c = costliestLine(_paper({'Electromagnetic Induction': 1, 'Ray Optics': 1}));
      expect(c.line, 'Electromagnetic Induction and Ray Optics each cost you 6 marks.');
      expect(c.detail, 'Together they cost 12 of the 12 marks you missed.');
      expect(c.tied, ['Electromagnetic Induction', 'Ray Optics']);
      expect(c.chapter, 'Electromagnetic Induction');
      expect(c.line, isNot(contains('most')));
    });

    test('two tied at the top with a lower third: the third is not part of the tie', () {
      final c = costliestLine(_paper({'Ray Optics': 2, 'Electromagnetic Induction': 2, 'Optics lab': 1}));
      expect(c.line, 'Ray Optics and Electromagnetic Induction each cost you 12 marks.');
      expect(c.detail, 'Together they cost 24 of the 30 marks you missed.');
    });

    test('three tied: all listed', () {
      final c = costliestLine(_paper({'A': 2, 'B': 2, 'C': 2}));
      expect(c.line, '3 chapters each cost you 12 marks: A, B and C.');
    });

    test('four tied at 12: the first two and a count', () {
      final c = costliestLine(_paper({'Electromagnetic Induction': 2, 'Ray Optics': 2, 'Waves': 2, 'Atoms': 2, 'Heat': 1}));
      expect(c.line, '4 chapters each cost you 12 marks: Electromagnetic Induction, Ray Optics and 2 more.');
      expect(c.tied, hasLength(4));
      expect(c.tied, isNot(contains('Heat')));
    });

    test('ranked costs keep every chapter, tied ones together', () {
      final ranked = rankedChapterCosts(_paper({'A': 2, 'B': 2, 'C': 1}));
      expect(ranked.map((c) => c.marks), [12, 12, 6]);
      expect(tiedAtTop(ranked).map((c) => c.chapter), ['A', 'B']);
      expect(tiedAtTop(const <ChapterCost>[]), isEmpty);
    });

    testWidgets('the result shows the tie line, never "most" or "second"', (tester) async {
      final c = costliestLine(_paper({'Electromagnetic Induction': 1, 'Ray Optics': 1}, rightFiller: 6));
      await pumpMockmob(tester, Padding(padding: const EdgeInsets.all(16), child: CostliestBlock(costliest: c)), size: const Size(360, 400), disableAnimations: true);
      expect(find.text('Electromagnetic Induction and Ray Optics each cost you 6 marks.'), findsOneWidget);
      expect(find.text('Together they cost 12 of the 12 marks you missed.'), findsOneWidget);
      expect(find.textContaining('second'), findsNothing);
      expect(find.textContaining('lost the most'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('four tied: the line fits at 360 dp and names the count', (tester) async {
      final c = costliestLine(_paper({'Electromagnetic Induction': 2, 'Ray Optics': 2, 'Waves': 2, 'Atoms': 2}));
      await pumpMockmob(tester, Padding(padding: const EdgeInsets.all(16), child: CostliestBlock(costliest: c)), size: const Size(360, 400), disableAnimations: true);
      expect(find.text('4 chapters each cost you 12 marks: Electromagnetic Induction, Ray Optics and 2 more.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('Your papers, the chapter hero', () {
    test('the lead-in copy: alone, tied first, tied later', () {
      expect(ReviewCopy.chapterLead(1), ReviewCopy.loseMost);
      expect(ReviewCopy.chapterLead(2), 'Your 2nd costliest chapter');
      expect(ReviewCopy.chapterLead(1, tied: 2), 'Tied for the most marks slipped, with 1 other chapter');
      expect(ReviewCopy.chapterLead(1, tied: 4), 'Tied for the most marks slipped, with 3 other chapters');
      expect(ReviewCopy.chapterLead(5, tied: 2), 'Tied for 5th, with 1 other chapter');
      expect(ReviewCopy.chapterLead(2, tied: 2), isNot(contains('costliest')));
    });

    testWidgets('a tied first chapter says it is tied, with the others counted', (tester) async {
      await _pumpLead(tester, {'Electromagnetic Induction': 2, 'Ray Optics': 2, 'Waves': 2, 'Atoms': 2, 'Heat': 1});
      expect(find.text('Tied for the most marks slipped, with 3 other chapters'), findsOneWidget);
      expect(find.text(ReviewCopy.loseMost), findsNothing);
      expect(find.textContaining('2nd costliest'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the next distinct value is ranked after the tied group (5th, not 2nd)', (tester) async {
      await _pumpLead(tester, {'Electromagnetic Induction': 2, 'Ray Optics': 2, 'Waves': 2, 'Atoms': 2, 'Heat': 1});
      await tester.ensureVisible(find.text('Heat').first);
      await tester.tap(find.text('Heat').first);
      await tester.pumpAndSettle();
      expect(find.text('Your 5th costliest chapter'), findsOneWidget);
      expect(find.textContaining('2nd'), findsNothing);
    });

    testWidgets('no ties: the first is "the most", the second is the 2nd', (tester) async {
      await _pumpLead(tester, {'Electromagnetic Induction': 3, 'Ray Optics': 1});
      expect(find.text(ReviewCopy.loseMost), findsOneWidget);
      await tester.ensureVisible(find.text('Ray Optics').first);
      await tester.tap(find.text('Ray Optics').first);
      await tester.pumpAndSettle();
      expect(find.text('Your 2nd costliest chapter'), findsOneWidget);
    });

    testWidgets('a second place that is tied is not called "2nd costliest"', (tester) async {
      await _pumpLead(tester, {'Electromagnetic Induction': 3, 'Ray Optics': 1, 'Waves': 1});
      await tester.ensureVisible(find.text('Waves').first);
      await tester.tap(find.text('Waves').first);
      await tester.pumpAndSettle();
      expect(find.text('Tied for 2nd, with 1 other chapter'), findsOneWidget);
      expect(find.textContaining('2nd costliest'), findsNothing);
    });

    testWidgets('the hero used on its own keeps the tied lead-in at 360 dp', (tester) async {
      final row = chapterRows(_record({'Electromagnetic Induction': 2, 'Ray Optics': 2})).first;
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ChapterHero(row: row, rank: 1, tied: 2, practiseLabel: 'Practise 10 on this chapter', practiseLine: '10 new questions.', onPractise: () {}),
        ),
        size: const Size(360, 900),
        disableAnimations: true,
      );
      expect(find.text('Tied for the most marks slipped, with 1 other chapter'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('Today and the paper reel', () {
    test('the biggest leak says it is tied, with the others counted', () {
      expect(GlanceCopy.leak('Ray Optics', 6, 12, 1, 0), 'Biggest leak: Ray Optics, 6 of the 12 marks you missed: 1 wrong.');
      expect(GlanceCopy.leak('Ray Optics', 6, 12, 1, 0, tiedWith: 1), 'Biggest leak: Ray Optics, tied with 1 other chapter, 6 of the 12 marks you missed: 1 wrong.');
      expect(GlanceCopy.leak('Ray Optics', 12, 48, 2, 0, tiedWith: 3), 'Biggest leak: Ray Optics, tied with 3 other chapters, 12 of the 48 marks you missed: 2 wrong.');
    });

    test('the reel kicker and its spoken line say one of N when tied', () {
      expect(ReelCopy.chapterKickerFor(1), ReelCopy.chapterKicker);
      expect(ReelCopy.chapterKickerFor(2), 'One of 2 chapters where the most marks slipped');
      expect(ReelCopy.semantics(100, 150, 'Ray Optics', tied: 2), 'Paper played back. 100 of 150 marks. Ray Optics is one of 2 chapters where the most marks slipped.');
      expect(ReelCopy.semantics(100, 150, 'Ray Optics'), 'Paper played back. 100 of 150 marks. Most marks went in Ray Optics.');
    });
  });
}
