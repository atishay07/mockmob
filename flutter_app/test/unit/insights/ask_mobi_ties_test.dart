// Owner I14 (19 Oct), the Ask Mobi remainder (20 Oct): chapters that lost the same marks are said as a tie in the
// record readout, the record door's lead, the card line, the stage prompts and the record chip; never one "most".
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/insights/data/ask_doors.dart';
import 'package:mockmob/features/insights/data/ask_suggestions.dart';
import 'package:mockmob/features/insights/data/chapter_ties.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/readout.dart';
import 'package:mockmob/features/insights/widgets/ask_prompts.dart';

// wrong * 6 + skip * 5 = lost.
ChapterLine _c(String chapter, {int wrong = 0, int skip = 0, int n = 6}) =>
    ChapterLine(subject: 'physics', subjectName: 'Physics', chapter: chapter, wrong: wrong, skip: skip, n: n, sessions: 1);

PrepInsights _record(List<ChapterLine> ranked) => PrepInsights(state: 'ready', sessions: 2, questions: 40, ranked: ranked);

void main() {
  final single = [_c('Ray Optics', wrong: 2), _c('Optics', wrong: 1)];
  // The server's order put Optics first, but both lost 6: a tie.
  final two = [_c('Optics', wrong: 1), _c('Ray Optics', wrong: 1), _c('Waves', skip: 1)];
  // Four chapters at 12 and one at 6 (his screenshot).
  final four = [_c('A', wrong: 2), _c('B', wrong: 2), _c('C', wrong: 2), _c('D', wrong: 2), _c('E', wrong: 1)];
  // The record lists a smaller loss first: the ranking is by marks lost.
  final unsorted = [_c('Small', skip: 1), _c('Big', wrong: 3)];

  group('chapter_ties', () {
    test('ranks by marks lost, keeps the record order within a tie', () {
      expect([for (final c in byMarksLost(unsorted)) c.chapter], ['Big', 'Small']);
      expect([for (final c in costliestChapters(two)) c.chapter], ['Optics', 'Ray Optics']);
      expect(costliestChapters(four), hasLength(4));
      expect(costliestChapters(single), hasLength(1));
      expect(costliestChapters(const []), isEmpty);
    });

    test('names together and the place', () {
      expect(namesTogether(['A', 'B']), 'A and B');
      expect(namesTogether(['A', 'B', 'C']), 'A, B and C');
      expect(namesTogether(['A', 'B', 'C', 'D']), 'A, B and 2 more');
      expect(costliestPlace(['A']), 'A');
      expect(costliestPlace(['A', 'B']), 'each of A and B');
      expect(costliestPlace(['A', 'B', 'C', 'D']), 'each of 4 chapters');
    });
  });

  group('readout', () {
    test('alone: "You lose the most marks in" the chapter', () {
      expect(readout(_record(single)).first.headline, 'The most marks slip in Ray Optics');
    });

    test('two tied: both named, never "the most" for one', () {
      final f = readout(_record(two)).first;
      expect(f.headline, 'Optics and Ray Optics tie for the most marks slipped, 6 each');
      expect(f.headline, isNot(contains('The most marks slip in')));
    });

    test('four tied: the count, the figure and the first names', () {
      expect(readout(_record(four)).first.headline, '4 chapters tie for the most marks slipped, 12 each: A, B and 2 more');
    });

    test('ranked by marks lost, not by the record order', () {
      expect(readout(_record(unsorted)).first.headline, 'The most marks slip in Big');
    });
  });

  group('Ask Mobi doors', () {
    test('the record lead names every tied chapter', () {
      final alone = recordLead(_record(single))!;
      expect(alone.tied, 1);
      expect(AskDoorCopy.leadLine(alone), 'marks slipped in Ray Optics, your biggest leak');
      final tied = recordLead(_record(two))!;
      expect(tied.tied, 2);
      expect(tied.lost, 6);
      expect(AskDoorCopy.leadLine(tied), 'marks slipped in each of Optics and Ray Optics, tied as your biggest leak');
      expect(AskDoorCopy.leadLine(recordLead(_record(four))!), 'marks slipped in each of 4 chapters, tied as your biggest leak');
    });

    test('the door preview, the card line and the stage prompt say the tie', () {
      final asks = recordDoorAsks(_record(two), pro: false, now: DateTime(2026, 10, 20, 21));
      expect(asks.first.preview, '6 marks slipped in each of Optics and Ray Optics');
      final lead = recordLead(_record(four))!;
      expect(AskDoorCopy.cardLineHeavy(lead.lost, lead.shortPlace), 'Stuck on a doubt? Ask now, or ask where 12 marks slipped in each of 4 chapters.');
      // Long tied names: the tight lines say the count; the answer names them.
      final long = recordLead(_record([_c('Partnership: admission of a partner', wrong: 1), _c('Money and banking', wrong: 1)]))!;
      expect(AskDoorCopy.leadLine(long), 'marks slipped in each of 2 chapters, tied as your biggest leak');
      expect(long.place, 'each of Partnership: admission of a partner and Money and banking');
      expect(recordPrompts(_record(two)).first.preview, '6 marks slipped in each of Optics and Ray Optics');
      expect(recordPrompts(_record(single)).first.preview, '12 marks slipped in Ray Optics');
    });

    test('the record chip says the tie as Today does', () {
      final lines = recordSummary(_record(two));
      expect(lines[1], 'Biggest leak: Optics, tied with 1 other chapter, 6 marks slipped, 1 wrong of 6');
      expect(recordSummary(_record(four))[1], contains('tied with 3 other chapters'));
      expect(recordSummary(_record(single))[1], 'Biggest leak: Ray Optics, 12 marks slipped, 2 wrong of 6');
    });
  });
}
