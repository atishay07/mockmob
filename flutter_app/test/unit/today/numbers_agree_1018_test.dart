// The final walk's numbers (18 Oct 2026, H4 to H8): one record, one computation, and a label that
// names its scope wherever two figures could look like the same thing. Each group builds every screen's
// figure from ONE fixture and asserts they agree.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/copy/formatters.dart' show formatTime12;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/readout.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/model/review_chapters.dart';
import 'package:mockmob/features/review/model/review_record_adapter.dart';
import 'package:mockmob/features/today/copy_ahead.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/logic/glance_builder.dart';
import 'package:mockmob/features/today/logic/glance_model.dart';
import 'package:mockmob/features/today/logic/marks_trend.dart';
import 'package:mockmob/features/today/logic/move_builder.dart' show weakestMoveFor;
import 'package:mockmob/features/today/logic/road_board.dart';
import 'package:mockmob/features/today/logic/road_builder.dart' show expectedWindowStart;
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/you/copy.dart';

import 'support/today_fixtures.dart';

/// Every "X of Y" in [text] with X greater than Y (never allowed: X must count toward Y).
List<String> overCounts(String text) => [
      for (final m in RegExp(r'(\d+) of (\d+)').allMatches(text))
        if (int.parse(m.group(1)!) > int.parse(m.group(2)!)) m.group(0)!,
    ];

RoadLayers roadFor(TodayInputs i, {required int target}) {
  final board = buildRoadBoard(
    today: i.date(),
    windowStart: expectedWindowStart,
    plan: RoadPlan(mockTarget: target),
    attempts: i.attempts,
    dateOf: (at) => i.date(at),
    goal: i.week?.goal,
  );
  return buildRoadLayers(i, board: board);
}

Attempt quick(String id, DateTime at, {String subject = 'accountancy'}) => paper(
      id: id,
      completedAt: at,
      subject: subject,
      mode: 'quick',
      runs: const [('Partnership fundamentals', V.right, 6), ('Partnership fundamentals', V.wrong, 2), ('Company accounts', V.blank, 2)],
    );

void main() {
  final now = tuesdayEvening;

  group('H6: one chapter, one figure on Review, Today and Ask Mobi', () {
    final attempts = ashaRecord(now);
    final index = buildReviewIndex(attempts, const []);
    final rows = chapterRows(reviewRecordOf(index, now: now));
    final top = rows.first;

    test('Today\'s Weak chapters are Review\'s rows, in Review\'s order, with Review\'s marks lost', () {
      for (final inputs in [ashaInputs(now: now, reviewChapters: rows), ashaInputs(now: now)]) {
        final weak = buildWeakChapters(inputs);
        expect(weak.rows.map((w) => w.chapter), rows.take(3).map((r) => r.name));
        for (var k = 0; k < weak.rows.length; k++) {
          final w = weak.rows[k], r = rows[k];
          expect(w.marks, r.lost, reason: '${r.name}: Today prints Review\'s marks lost (6 a wrong answer, 5 a blank)');
          expect(w.offer, r.offer);
          expect(w.asked, r.questions);
          expect(w.wrong, r.wrong);
          expect(w.blank, r.blank);
          expect(w.missed, r.wrong + r.blank);
          expect(w.papers, r.papers.length);
        }
        // The scope Review reads too: every opened paper.
        expect(weak.papers, attempts.length);
        expect(GlanceCopy.weakSub(weak.papers), 'Where your marks go, across your ${attempts.length} papers');
      }
    });

    test('the weakest-chapter card says Review\'s sentence: lost X of the Y marks on offer, wrong and blank', () {
      final w = buildWeakChapters(ashaInputs(now: now, reviewChapters: rows)).rows.first;
      final move = weakestMoveFor(ashaInputs(now: now), chapter: w);
      expect(top.line.lead, '${top.lost} of the ${top.offer} marks');
      expect(move.meaning, contains('${top.lost} of the ${top.offer} marks on offer slipped'));
      expect(move.meaning, contains('${top.wrong} wrong'));
      expect(GlanceCopy.stakeLost(w.marks, w.papers), '${top.lost} marks slipped there, over ${top.papers.length} papers');
    });

    test('Ask Mobi names the chapter, never its subject, and prints the same marks lost and on offer', () {
      // The server's chapter line for the same papers: right, wrong, blank and questions asked of the chapter.
      var right = 0, wrong = 0, skip = 0, n = 0;
      final sessions = <String>{};
      for (final a in attempts) {
        for (final q in a.questions) {
          if ('${a.subject}|${chapterOf(q.chapter)}' != top.id) continue;
          n++;
          sessions.add(a.id);
          final d = a.detailFor(q.id);
          if (d?.isCorrect == true) {
            right++;
          } else if (d?.isCorrect == false) {
            wrong++;
          } else {
            skip++;
          }
        }
      }
      final line = ChapterLine(subject: 'accountancy', subjectName: 'Accountancy', chapter: top.name, right: right, wrong: wrong, skip: skip, n: n, sessions: sessions.length);
      expect(line.lost, top.lost);
      expect(line.offer, top.offer);
      final f = readout(PrepInsights(state: 'ready', sessions: attempts.length, questions: 400, ranked: [line])).first;
      expect(f.headline, 'The most marks slip in ${top.name}');
      expect(f.detail, startsWith('${top.name}: '));
      expect(f.detail, isNot(startsWith('Accountancy:')));
      expect(f.detail, contains('${top.lost} of the ${top.offer} marks on offer slipped.'));
    });
  });

  group('H7: the open chapter\'s header names it', () {
    test('"19 to repair in Share Capital", never a bare "19 mistakes to repair" beside 139 open', () {
      expect(ReviewCopy.chapterMistakes(19, 'Share Capital'), '19 to repair in Share Capital');
      expect(ReviewCopy.chapterNothingToRepair('Share Capital'), 'Nothing left to repair in Share Capital');
    });
  });

  group('H8: one definition of a full mock', () {
    final attempts = [
      ...ashaRecord(now),
      paper(id: 'e1', completedAt: daysBefore(now, 3), subject: 'economics', runs: const [('Money and banking', V.right, 40), ('Money and banking', V.wrong, 10)]),
    ];
    final inputs = ashaInputs(now: now, attempts: attempts);

    test('Road counts every full mock (the isMock set); Your marks counts one subject and says which', () {
      final road = roadFor(inputs, target: 27);
      final mocks = attempts.where((a) => a.isMock).length;
      expect(road.mocksTaken, mocks);
      expect(GlanceCopy.mocksOf(road.mocksTaken, 27), '$mocks of 27 full mocks');
      final trend = buildMarksTrend(inputs, subject: 'accountancy')!;
      expect(trend.ofSubject, attempts.where((a) => a.isMock && a.subject == 'accountancy').length);
      expect(AheadCopy.marksSub(6, trend.ofSubject, trend.subject), 'Newest 6 of your ${trend.ofSubject} Accountancy full mocks');
    });

    test('You says a badge is a badge, so "5 full mocks" never reads as a count', () {
      expect(YouCopy.badgeLandedLine('5 full mocks'), 'Badge earned: 5 full mocks.');
    });
  });

  group('H5: Road to CUET never prints X of Y where X counts something else', () {
    test('three full mocks this week against a pace of one: "3 done, 1 planned", and the figure counts planned items', () {
      final attempts = [
        accountancyMock('w3', now.subtract(const Duration(hours: 1))),
        accountancyMock('w2', now.subtract(const Duration(hours: 2))),
        accountancyMock('w1', now.subtract(const Duration(days: 1))),
        ...ashaRecord(now),
      ];
      final road = roadFor(ashaInputs(now: now, attempts: attempts), target: 27);
      final mockItem = road.weekItems.firstWhere((d) => d.label.startsWith('Full mocks this week'));
      expect(road.weekMocksPlanned, 1);
      expect(mockItem.label, 'Full mocks this week: 3 done, 1 planned');
      expect(mockItem.done, isTrue);
      expect(road.plannedDone, lessThanOrEqualTo(road.planned));
      for (final d in [...road.today, ...road.weekItems, ...road.goalItems]) {
        expect(overCounts(d.label), isEmpty, reason: d.label);
      }
      expect(overCounts(GlanceCopy.weekFigure(road.plannedDone, road.planned)), isEmpty);
    });

    test('under the plan it is "X of Y done"', () {
      final road = roadFor(ashaInputs(now: now), target: 60);
      final mockItem = road.weekItems.firstWhere((d) => d.label.startsWith('Full mocks this week'));
      expect(mockItem.label, matches(RegExp(r'^Full mocks this week: 0 of \d+ done$')));
      expect(mockItem.done, isFalse);
    });

    test('the copy: past the target or the goal both are said as what they are', () {
      expect(GlanceCopy.itemMockWeek(1, 2), 'Full mocks this week: 1 of 2 done');
      expect(GlanceCopy.itemMockWeek(16, 2), 'Full mocks this week: 16 done, 2 planned');
      expect(GlanceCopy.itemStudyWeek(5, 4), 'Study days: 5 done, 4 planned');
      expect(GlanceCopy.mocksOf(13, 27), '13 of 27 full mocks');
      expect(GlanceCopy.mocksOf(30, 27), '30 full mocks, target 27');
      expect(GlanceCopy.itemMocksTaken(30, 27, suggested: false), 'Full mocks: 30 taken, target 27');
    });
  });

  group('H4: a busy day reads as its count and the latest paper', () {
    test('nine papers today: "3 full mocks and 6 quick sets saved." then the newest paper; Up next leads on screen', () {
      final today = <Attempt>[
        accountancyMock('d9', now.subtract(const Duration(minutes: 5)), wrongAt: {1, 2}),
        for (var k = 0; k < 6; k++) quick('dq$k', now.subtract(Duration(minutes: 20 + k * 10))),
        accountancyMock('d2', now.subtract(const Duration(minutes: 100))),
        accountancyMock('d1', now.subtract(const Duration(minutes: 110))),
      ];
      final attempts = [...today, ...ashaRecord(now)];
      final i = ashaInputs(now: now, attempts: attempts);
      final readouts = buildReadouts(i)!;
      final day = readouts.firstWhere((r) => r.isToday);
      final newest = today.first;
      final mockNo = attempts.where((a) => a.isMock).length;
      expect(day.lines, [
        '3 full mocks and 6 quick sets saved.',
        'Latest: Mock $mockNo, Accountancy, 50 questions, ${newest.marks} of 250, ${formatTime12(i.clock(newest.completedAt))}',
      ]);
    });

    test('two papers on a day still list both', () {
      final attempts = [quick('a', now.subtract(const Duration(minutes: 5))), quick('b', now.subtract(const Duration(minutes: 30))), ...ashaRecord(now)];
      final day = buildReadouts(ashaInputs(now: now, attempts: attempts))!.firstWhere((r) => r.isToday);
      expect(day.lines, hasLength(2));
      expect(day.lines.every((l) => l.startsWith('Quick 10, Accountancy, 10 questions')), isTrue);
    });
  });
}
