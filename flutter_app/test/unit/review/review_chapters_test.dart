// Review led by weak chapters (REVIEW-RESULT-1018 4.2 to 4.4 and 7, packet P-RR0): the app's port of the website's
// `data/review_chapters.mjs`, run on the same student. `test/fixtures/review/student-1018.json` is a byte copy of the website's
// `data/tests/fixtures/review/student-1018.json`, and the expectations below are the website's own
// (`data/tests/review_chapters.test.mjs`), so the two platforms print the same numbers for one student.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/review/model/review_chapters.dart';

Map<String, dynamic> _load(String name) => jsonDecode(File('test/fixtures/review/$name.json').readAsStringSync()) as Map<String, dynamic>;

ReviewRecord _record() => ReviewRecord.fromJson(_load('student-1018'));

/// The marks one paper of the fixture lost: 6 a wrong answer, 5 a blank.
int _lostOfPaper(Map<String, dynamic> p) => (p['wrong'] as int) * 6 + (p['blank'] as int) * 5;

ReviewRecord _custom({
  required List<Map<String, dynamic>> papers,
  required List<Map<String, dynamic>> chapters,
  required Map<String, dynamic> chapterQuestions,
  required List<Map<String, dynamic>> items,
}) => ReviewRecord.fromJson({
  'now': '2026-10-17T21:00:00+05:30',
  'papers': papers,
  'chapters': chapters,
  'chapterQuestions': chapterQuestions,
  'items': items,
});

void main() {
  final fixture = _load('student-1018');

  test('the chapters add up to the marks the papers lost (220), and the head line says so', () {
    final rows = chapterRows(_record());
    final lost = rows.fold(0, (s, r) => s + r.lost);
    expect(lost, [for (final p in fixture['papers'] as List) _lostOfPaper(p as Map<String, dynamic>)].reduce((a, b) => a + b));
    expect(lost, 220);
    expect(reviewLine(_record()).text, 'Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired.');
    expect(acrossLine(_record()), 'Each chapter across Mock 3, Quick practice and Mock 2.');
  });

  test('every chapter: lost = on offer - scored, and wrong and blank equal its rows plus its foot', () {
    final rows = chapterRows(_record());
    expect(rows, hasLength(10));
    for (final r in rows) {
      final right = r.questions! - r.wrong - r.blank;
      expect(r.offer, r.questions! * 5, reason: r.name);
      expect(r.scored, right * 5 - r.wrong, reason: r.name);
      expect(r.lost, r.offer! - r.scored!, reason: r.name);
      expect(r.wrong, r.open.length + r.repaired.length, reason: r.name);
      expect(r.blank, r.blanks.length, reason: r.name);
    }
  });

  test('the lead chapter reads as the mock draws it', () {
    final rows = chapterRows(_record());
    final adm = rows[0];
    expect(adm.name, 'Admission of a partner');
    expect(adm.line.text, 'Lost 35 of the 80 marks on offer, 16 questions in Mock 3 and Mock 2. 5 wrong, 1 left blank.');
    expect(adm.line.lead, 'Lost 35 of the 80 marks');
    expect([for (final i in adm.open) i.number], [42, 38, 45, 11]);
    expect(adm.open.first.stamp, 'Mock 3, Fri 16 Oct, 9:40 PM');
    expect([for (final i in adm.repaired) (i.number, i.state)], [(17, 'slipped')]);
    expect([for (final i in adm.blanks) i.number], [47]);
    expect((adm.lost, adm.offer, adm.scored, adm.questions), (35, 80, 45, 16));
    expect(adm.share, closeTo(35 / 80, 1e-9));
    expect(rows[1].name, 'Dissolution of a firm');
  });

  test('ranking: marks lost, then more wrong answers, then the newest paper', () {
    final rec = _custom(
      papers: [
        {'id': 'new', 'name': 'Mock 2', 'at': '2026-10-16T20:00:00+05:30'},
        {'id': 'old', 'name': 'Mock 1', 'at': '2026-10-10T20:00:00+05:30'},
      ],
      chapters: [
        {'id': 'a', 'name': 'A'},
        {'id': 'b', 'name': 'B'},
        {'id': 'c', 'name': 'C'},
      ],
      chapterQuestions: {
        'new': {'b': 5},
        'old': {'a': 5, 'c': 5},
      },
      items: [
        for (final (q, ch, state) in const [
          (1, 'a', 'blank'),
          (2, 'a', 'blank'),
          (3, 'a', 'open'),
          (4, 'a', 'open'),
          (5, 'a', 'blank'),
          (6, 'c', 'open'),
          (7, 'c', 'open'),
          (8, 'c', 'open'),
          (9, 'c', 'open'),
          (10, 'c', 'open'),
        ])
          {'paper': 'old', 'q': q, 'ch': ch, 'state': state},
        for (var q = 1; q <= 5; q++) {'paper': 'new', 'q': q, 'ch': 'b', 'state': 'open'},
      ],
    );
    // A = 2*6 + 3*5 = 27; B = 30 (5 wrong, newest paper); C = 30 (5 wrong, older paper).
    expect([for (final r in chapterRows(rec)) (r.name, r.lost)], [('B', 30), ('C', 30), ('A', 27)]);
  });

  test('a tie of everything is settled by the name, the same on every run', () {
    final rec = _custom(
      papers: [
        {'id': 'p', 'name': 'Mock 1', 'at': '2026-10-10T20:00:00+05:30'},
      ],
      chapters: [
        {'id': 'z', 'name': 'zeta'},
        {'id': 'b', 'name': 'Beta'},
        {'id': 'a', 'name': 'alpha'},
      ],
      chapterQuestions: {
        'p': {'z': 3, 'b': 3, 'a': 3},
      },
      items: [
        {'paper': 'p', 'q': 1, 'ch': 'z', 'state': 'open'},
        {'paper': 'p', 'q': 2, 'ch': 'b', 'state': 'open'},
        {'paper': 'p', 'q': 3, 'ch': 'a', 'state': 'open'},
      ],
    );
    expect([for (final r in chapterRows(rec)) r.name], ['alpha', 'Beta', 'zeta']);
  });

  test('a held key leaves the chapter: out of the marks lost and out of the marks on offer', () {
    final json = _load('student-1018');
    final items = [for (final i in json['items'] as List) Map<String, dynamic>.from(i as Map)];
    items.firstWhere((i) => i['paper'] == 'm3' && i['q'] == 42)['keyState'] = 'under_review';
    final rec = ReviewRecord.fromJson({...json, 'items': items});
    final adm = chapterRows(rec).firstWhere((r) => r.id == 'adm');
    expect(adm.lost, 29);
    expect(adm.offer, 75);
    expect(adm.keyHeld, 1);
    // The question is in no row either.
    expect([for (final i in adm.open) i.number], [38, 45, 11]);
  });

  test('a chapter of mostly wrong answers never prints more marks lost than it had on offer (v15 final walk)', () {
    // 10 questions: 9 wrong and 1 blank lose 59 marks, 5 a question is 50 on offer. "Lost 59 of the 50" cannot be true.
    final rec = _custom(
      papers: [
        {'id': 'p1', 'name': 'Mock 1', 'at': '2026-10-17T20:00:00+05:30'},
      ],
      chapters: [
        {'id': 'c1', 'name': 'Financial Markets'},
      ],
      chapterQuestions: {
        'p1': {'c1': 10},
      },
      items: [
        for (var q = 1; q <= 9; q++) {'paper': 'p1', 'q': q, 'ch': 'c1', 'state': 'open'},
        {'paper': 'p1', 'q': 10, 'ch': 'c1', 'state': 'blank'},
      ],
    );
    final row = chapterRows(rec).single;
    expect((row.lost, row.offer, row.scored), (59, 50, -9));
    expect(row.overOffer, isTrue);
    expect(row.line.text, 'Lost 59 marks, 10 questions in Mock 1. 9 wrong, 1 left blank.');
    expect(row.line.text, isNot(contains(' of the ')));
    expect(row.share, 1);
    // Under the line the sentence keeps its "of N".
    expect(chapterRows(_record())[0].overOffer, isFalse);
  });

  group('a figure never says "lost X of Y" with X over Y (v15 final walk)', () {
    // One chapter with [wrong] wrong answers and [blank] blanks out of [questions] asked, in one paper.
    ChapterRow oneChapter(int wrong, int blank, int? questions) {
      final rec = ReviewRecord.fromJson({
        'now': '2026-10-17T21:00:00+05:30',
        'papers': [
          {'id': 'p1', 'name': 'Mock 1', 'at': '2026-10-17T20:00:00+05:30'},
        ],
        'chapters': [
          {'id': 'c1', 'name': 'Financial Markets'},
        ],
        if (questions != null)
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

    test('lost under the offer keeps its "of N"', () {
      final row = oneChapter(2, 1, 10); // 12 + 5 = 17 lost of 50.
      expect((row.lost, row.offer), (17, 50));
      expect(row.overOffer, isFalse);
      expect(row.line.text, 'Lost 17 of the 50 marks on offer, 10 questions in Mock 1. 2 wrong, 1 left blank.');
      expect(row.share, closeTo(17 / 50, 1e-9));
    });

    test('lost exactly the offer still says "of N" (every mark gone, none over)', () {
      final row = oneChapter(0, 5, 5); // five blanks lose 25 of the 25 on offer.
      expect((row.lost, row.offer), (25, 25));
      expect(row.overOffer, isFalse);
      expect(row.line.text, 'Lost 25 of the 25 marks on offer, 5 questions in Mock 1. 5 left blank.');
      expect(row.share, 1);
    });

    test('lost over the offer (the walk 316 of 310) drops the "of N" and the bar stays inside the rail', () {
      final row = oneChapter(6, 56, 62); // 36 + 280 = 316 lost, 62 questions is 310 on offer.
      expect((row.lost, row.offer), (316, 310));
      expect(row.overOffer, isTrue);
      expect(row.line.text, 'Lost 316 marks, 62 questions in Mock 1. 6 wrong, 56 left blank.');
      expect(row.line.text, isNot(contains(' of the ')));
      expect(row.share, 1, reason: 'clamped: a bar can never run past its rail');
    });

    test('an offer that is not known never prints a denominator, and is not "over" anything', () {
      final row = oneChapter(3, 1, null);
      expect(row.offer, isNull);
      expect(row.overOffer, isFalse);
      expect(row.line.text, 'Lost 23 marks in Mock 1. 3 wrong, 1 left blank.');
      expect(row.line.text, isNot(contains(' of the ')));
    });

    test('over every mix of wrong and blank answers, no row says more lost than on offer, and share stays 0 to 1', () {
      final said = RegExp(r'Lost (\d+) of the (\d+) marks');
      for (var questions = 1; questions <= 24; questions++) {
        for (var wrong = 0; wrong <= questions; wrong++) {
          for (var blank = 0; blank <= questions - wrong; blank++) {
            if (wrong + blank == 0) continue;
            final row = oneChapter(wrong, blank, questions);
            final m = said.firstMatch(row.line.text);
            if (m != null) expect(int.parse(m[1]!) <= int.parse(m[2]!), isTrue, reason: row.line.text);
            expect(row.overOffer, row.lost > row.offer!, reason: '$wrong wrong, $blank blank of $questions');
            expect(m == null, row.overOffer, reason: 'the "of N" is printed exactly when it can be true: ${row.line.text}');
            expect(row.share, inInclusiveRange(0, 1));
          }
        }
      }
    });
  });

  test('without chapterQuestions (an older server) the line states the marks lost alone, and no denominator is invented', () {
    final adm = chapterRows(_record().withoutChapterQuestions())[0];
    expect(adm.offer, isNull);
    expect(adm.scored, isNull);
    expect(adm.questions, isNull);
    expect(adm.line.text, 'Lost 35 marks in Mock 3 and Mock 2. 5 wrong, 1 left blank.');
  });

  test('Saved repairs: slipped, then waiting, then held; each opens free with one action', () {
    final saved = savedRepairs(_record());
    expect(saved, hasLength(9));
    expect([for (final s in saved.take(4)) (s.number, s.state, s.action)], [
      (17, 'slipped', 'See repair'),
      (29, 'repaired', 'Check it held'),
      (27, 'repaired', 'Check it held'),
      (14, 'held', 'See repair'),
    ]);
    expect(saved[0].line, 'Slipped on a new question tonight, 8:55 PM. Back in Revise tomorrow.');
    expect(saved[1].line, 'Repaired tonight, 8:30 PM. One new question shows whether it held.');
    expect(saved[3].line, 'Held on a new question. Repaired Wed 14 Oct, 9:20 PM.');
    expect(savedLine(saved), '6 held on a new question, 1 slipped, 2 waiting for Check it held.');
    // Every one of them has an action and none of them is a paid "Repair".
    expect(saved.every((s) => s.action == 'Check it held' || s.action == 'See repair'), isTrue);
  });

  test('one label per state, never "Repair first" (section 7)', () {
    expect(actionLabel('open'), 'Repair');
    expect(actionLabel('repaired'), 'Check it held');
    expect(actionLabel('held'), 'See repair');
    expect(actionLabel('slipped'), 'See repair');
    expect(actionLabel('blank'), 'Try it again');
    expect(actionLabel('open', keyHeld: true), isNull);
    expect(actionLabel('blank', keyHeld: true), isNull);
    const open = RecordItem(paper: 'p', q: 1, ch: 'c', state: 'open');
    expect(actionFor(open), 'Repair');
    expect(actionFor(const RecordItem(paper: 'p', q: 1, ch: 'c', state: 'open', keyState: 'under_review')), isNull);

    // Nothing the page can say carries the retired wording.
    final body = chaptersBody(_record());
    final words = [
      body.line.text,
      body.across,
      body.savedLine,
      for (final r in body.rows) ...[r.line.text, r.name, for (final i in [...r.open, ...r.blanks, ...r.repaired]) '${i.stamp} ${i.stem}'],
      for (final s in body.saved) ...[s.line, s.action ?? '', s.chapter],
    ].join('\n');
    expect(RegExp(r'Repair first|Repair in \d|Check it here').hasMatch(words), isFalse);
  });

  test('stamps carry the real weekday and a 12-hour clock', () {
    expect(dayStamp(DateTime.parse('2026-10-16T21:40:00+05:30')), 'Fri 16 Oct, 9:40 PM');
    expect(dayStamp(DateTime.parse('2026-10-12T22:42:00+05:30')), 'Mon 12 Oct, 10:42 PM');
    expect(dayStamp(DateTime.parse('2026-10-18T00:05:00+05:30')), 'Sun 18 Oct, 12:05 AM');
    expect(dayStamp(DateTime.parse('2026-10-17T12:00:00+05:30')), 'Sat 17 Oct, 12:00 PM');
    expect(dayStamp(null), '');
  });

  test('a stamp reads in the zone the caller gives, not always in India', () {
    // 9:40 PM in India is 4:10 PM UTC: a clock that is UTC reads it so, on the same day.
    final at = DateTime.parse('2026-10-16T21:40:00+05:30');
    expect(dayStamp(at, local: (t) => t.toUtc()), 'Fri 16 Oct, 4:10 PM');
    // A clock far enough ahead rolls the weekday over.
    expect(dayStamp(DateTime.parse('2026-10-16T21:40:00+05:30'), local: (t) => t.toUtc().add(const Duration(hours: 9))), 'Sat 17 Oct, 1:10 AM');
  });

  test('whenSaid says tonight or today on the record\'s day, and a stamp on any other', () {
    final now = DateTime.parse('2026-10-17T21:41:00+05:30');
    expect(whenSaid(DateTime.parse('2026-10-17T20:30:00+05:30'), now), 'tonight, 8:30 PM');
    expect(whenSaid(DateTime.parse('2026-10-17T11:05:00+05:30'), now), 'today, 11:05 AM');
    expect(whenSaid(DateTime.parse('2026-10-13T22:40:00+05:30'), now), 'Tue 13 Oct, 10:40 PM');
    expect(whenSaid(null, now), '');
  });

  test('one paper only: the line names the paper', () {
    final json = _load('student-1018');
    final m3 = [for (final p in json['papers'] as List) if ((p as Map)['id'] == 'm3') Map<String, dynamic>.from(p)];
    final rec = ReviewRecord.fromJson({
      ...json,
      'papers': m3,
      'items': [for (final i in json['items'] as List) if ((i as Map)['paper'] == 'm3') i],
      'chapterQuestions': {'m3': (json['chapterQuestions'] as Map)['m3']},
    });
    final line = reviewLine(rec);
    expect(line.lost, _lostOfPaper(m3.single));
    expect(line.text, startsWith('Mock 3 lost 92 marks: 12 wrong answers and 4 left blank.'));
    expect(acrossLine(rec), 'Each chapter in Mock 3.');
    expect(chapterRows(rec).first.line.rest, contains('in Mock 3.'));
  });

  test('no marks lost says so, and one repaired mistake is singular', () {
    final none = ReviewRecord.fromJson({
      'now': '2026-10-17T21:00:00+05:30',
      'papers': [
        {'id': 'p', 'name': 'Mock 1', 'at': '2026-10-10T20:00:00+05:30'},
      ],
      'chapters': const [],
      'items': const [],
    });
    expect(reviewLine(none).text, 'Mock 1 lost no marks.');
    expect(chapterRows(none), isEmpty);

    final one = _custom(
      papers: [
        {'id': 'p', 'name': 'Mock 1', 'at': '2026-10-10T20:00:00+05:30'},
      ],
      chapters: [
        {'id': 'a', 'name': 'A'},
      ],
      chapterQuestions: {
        'p': {'a': 4},
      },
      items: [
        {'paper': 'p', 'q': 1, 'ch': 'a', 'state': 'repaired', 'repairedAt': '2026-10-11T20:00:00+05:30'},
      ],
    );
    expect(reviewLine(one).text, 'Mock 1 lost 6 marks: 1 wrong answer. 1 is repaired.');
  });

  test('long records stay readable: duplicate names are counted and a long list is not printed', () {
    expect(namePapers(['Mock 3', 'Mock 2']), 'Mock 3 and Mock 2');
    expect(namePapers(['Mock 3', 'Quick practice', 'Mock 2']), 'Mock 3, Quick practice and Mock 2');
    expect(namePapers(['Quick practice', 'Quick practice', 'Mock 1']), '2 quick practices and Mock 1');
    expect(namePapers(['Mock 2', 'Mock 2']), 'Mock 2 (2 papers)');
    expect(namePapers(['Mock 4', 'Mock 3', 'Mock 2', 'Mock 1']), 'Mock 4, Mock 3 and 2 more papers');

    final many = ReviewRecord.fromJson({
      'now': '2026-10-17T21:00:00+05:30',
      'papers': [
        for (var i = 0; i < 6; i++) {'id': 'p$i', 'name': 'Mock ${6 - i}', 'at': '2026-10-1${i}T20:00:00+05:30'},
      ],
      'chapters': const [],
      'items': const [],
    });
    expect(acrossLine(many), 'Each chapter across your 6 papers.');
    expect(reviewLine(many).who, 'Your 6 papers');
  });

  test('a stem is the first line of the question, folded and cut at a word', () {
    expect(stemLine('  \n  Interest on drawings\n  made evenly.  \nMore'), 'Interest on drawings');
    expect(stemLine('A   long\tline with   spaces'), 'A long line with spaces');
    final long = List.filled(40, 'word').join(' ');
    final cut = stemLine(long);
    expect(cut.length, lessThan(145));
    expect(cut, endsWith('…'));
    expect(cut, isNot(contains('wor…')));
    expect(stemLine(null), '');
    // What a row prints: a stem that stops mid-sentence ends in an ellipsis; none reads "Question 42".
    expect(stemShown('Which partners share it?', 38), 'Which partners share it?');
    expect(stemShown('New partner brings premium in cash; the sacrificing ratio is not given.', 42), endsWith('given.'));
    expect(stemShown('Premium for goodwill credited in the', 17), 'Premium for goodwill credited in the…');
    expect(stemShown('', 42), 'Question 42');
  });

  test('the marks are +5 and -1: 5 a question on offer, 6 lost a wrong answer, 5 a blank', () {
    final rows = chapterRows(_record());
    // Admission of a partner: 16 questions, 5 wrong and 1 blank, so 80 on offer, 35 lost and 45 scored.
    final adm = rows[0];
    expect(adm.wrong * 6 + adm.blank * 5, adm.lost);
    expect(adm.questions! * 5, adm.offer);
    // The 10 right answers earn 5 each and each of the 5 wrong takes 1 off: 50 - 5 = 45.
    final right = adm.questions! - adm.wrong - adm.blank;
    expect(right * 5 - adm.wrong, adm.scored);
  });
}
