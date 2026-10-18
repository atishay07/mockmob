// The weak-chapter port runs on the record the app builds from its own attempts, repair records and Review's index. For the
// reference student that record must give the website's numbers, row for row (REVIEW-RESULT-1018 acceptance 2: the counts
// agree), because it is the same arithmetic on the same facts.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/model/review_chapters.dart';
import 'package:mockmob/features/review/model/review_record_adapter.dart';

import 'support/student_1018.dart';

ChaptersBody _body(Student1018 s, {List<RepairLocalRecord>? records, Set<String> unopened = const {}, Map<String, CheckOutcome>? checks}) {
  final index = buildReviewIndex(s.attempts, records ?? s.records, unopened: unopened);
  return chaptersBody(reviewRecordOf(index, now: s.now, unopened: unopened, checks: checks ?? s.checks));
}

void main() {
  final s = student1018();
  // The website's own answer for the same student, from the fixture's JSON.
  final web = chaptersBody(ReviewRecord.fromJson(s.json));

  test('the app\'s record gives the website\'s numbers, chapter by chapter', () {
    final app = _body(s);
    expect(app.rows, hasLength(web.rows.length));
    for (var i = 0; i < web.rows.length; i++) {
      final a = app.rows[i], w = web.rows[i];
      expect(a.name, w.name, reason: 'row $i');
      expect([a.lost, a.offer, a.scored, a.questions, a.wrong, a.blank], [w.lost, w.offer, w.scored, w.questions, w.wrong, w.blank], reason: w.name);
      expect(a.line.text, w.line.text, reason: w.name);
      // The fixture lists a paper's questions in repair order; the app reads them in paper order. The same questions, the same papers.
      List<(String, int)> papered(List<RowItem> rows) => [for (final m in rows) (m.paper, m.number)]..sort((x, y) => x.$1 == y.$1 ? x.$2.compareTo(y.$2) : 0);
      expect(papered(a.open), papered(w.open), reason: w.name);
      expect(papered(a.blanks), papered(w.blanks), reason: w.name);
      expect(papered(a.repaired), papered(w.repaired), reason: w.name);
      expect({for (final m in a.repaired) m.number: m.state}, {for (final m in w.repaired) m.number: m.state}, reason: w.name);
      // Newest paper first, in both.
      expect([for (final m in a.open) m.paper], [for (final m in w.open) m.paper], reason: w.name);
      expect((a.held, a.slipped, a.pending), (w.held, w.slipped, w.pending), reason: w.name);
    }
    expect([for (final r in app.saved) (r.number, r.state, r.action, r.line)], [for (final r in web.saved) (r.number, r.state, r.action, r.line)]);
    expect(app.savedLine, '6 held on a new question, 1 slipped, 2 waiting for Check it held.');
  });

  test('220 marks over the papers, 30 wrong, 8 blank, 9 repaired: one more paper only because Mock 1 was perfect', () {
    final app = _body(s);
    expect(app.line.lost, 220);
    expect((app.line.wrong, app.line.blank), (30, 8));
    expect(app.saved, hasLength(9));
    expect(app.line.text, 'Your 4 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired.');
    expect(app.rows.first.line.text, 'Lost 35 of the 80 marks on offer, 16 questions in Mock 3 and Mock 2. 5 wrong, 1 left blank.');
    expect(app.rows.first.open.first.stamp, 'Mock 3, Fri 16 Oct, 9:40 PM');
    expect(app.across, 'Each chapter across Mock 3, Quick practice, Mock 2 and Mock 1.');
  });

  test('without the perfect first paper the same three papers read as the website reads them', () {
    final three = student1018(firstMock: false);
    final app = _body(three);
    expect(app.line.text, 'Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired.');
    // Mock numbers are counted from the first mock the app holds, so the two mocks are Mock 2 and Mock 1.
    expect(app.rows.first.line.text, 'Lost 35 of the 80 marks on offer, 16 questions in Mock 2 and Mock 1. 5 wrong, 1 left blank.');
    expect(app.rows.first.lost, web.rows.first.lost);
    expect(app.rows.first.offer, web.rows.first.offer);
  });

  test('the counts agree with Review\'s own index: open, repaired and every blank', () {
    final index = buildReviewIndex(s.attempts, s.records);
    final app = _body(s);
    expect(app.rows.fold(0, (n, r) => n + r.open.length), index.openCount);
    expect(app.rows.fold(0, (n, r) => n + r.repaired.length), index.repairedCount);
    expect(app.rows.fold(0, (n, r) => n + r.wrong), index.foundCount - index.setAsideCount);
    // The index's blank group is the newest paper's alone; the chapters count the blanks of every paper.
    final blanks = s.attempts.fold(0, (n, a) => n + a.unattempted);
    expect(blanks, 8);
    expect(app.rows.fold(0, (n, r) => n + r.blank), blanks);
    // Each chapter's wrong answers are its rows plus its foot.
    for (final r in app.rows) {
      expect(r.wrong, r.open.length + r.repaired.length, reason: r.name);
      expect(r.blank, r.blanks.length, reason: r.name);
    }
  });

  test('a paper whose result is sealed is left out whole, marks and all', () {
    final app = _body(s, unopened: {'m3'});
    // Mock 3 lost 12 x 6 + 4 x 5 = 92 of the 220.
    expect(app.line.lost, 220 - 92);
    expect(app.line.text, startsWith('Your 3 papers lost 128 marks'));
    expect(app.rows.expand((r) => [...r.open, ...r.blanks, ...r.repaired]).every((m) => m.paper != 'm3'), isTrue);
    expect(app.across, isNot(contains('Mock 3')));
  });

  test('a paper with nothing missed puts no questions on offer', () {
    final index = buildReviewIndex(s.attempts, s.records);
    final record = reviewRecordOf(index, now: s.now, checks: s.checks);
    expect(record.chapterQuestions!.keys, unorderedEquals(['m3', 'bq', 'm2']));
    expect(record.papers.map((p) => p.id), containsAll(['m1', 'm2', 'm3', 'bq']));
    // The paper's questions, right answers included, by chapter: the website's "asked" counts.
    expect(record.chapterQuestions!['m3']!.values.fold(0, (a, b) => a + b), 50);
    expect(record.chapterQuestions!['bq']!.values.fold(0, (a, b) => a + b), 10);
  });

  test('a key that is set aside leaves the chapter, out of the marks lost and the marks on offer', () {
    final held = [
      ...s.records,
      const RepairLocalRecord(attemptId: 'm3', questionId: 'm3-q42', requestId: 'req-m3-q42-0000000000', status: RepairLocalStatus.heldForRecheck),
    ];
    final adm = _body(s, records: held).rows.firstWhere((r) => r.name == 'Admission of a partner');
    expect(adm.lost, 29);
    expect(adm.offer, 75);
    expect(adm.keyHeld, 1);
    expect([for (final m in adm.open) m.number], [38, 45, 11]);
  });

  test('a mistake the server called not a mistake is left out the same way', () {
    final gone = [
      ...s.records,
      const RepairLocalRecord(attemptId: 'm3', questionId: 'm3-q38', requestId: 'req-m3-q38-0000000000', status: RepairLocalStatus.notAMistake),
    ];
    final adm = _body(s, records: gone).rows.firstWhere((r) => r.name == 'Admission of a partner');
    expect((adm.lost, adm.offer, adm.keyHeld), (29, 75, 1));
    expect([for (final m in adm.open) m.number], [42, 45, 11]);
  });

  test('without a Check it held outcome a saved repair is waiting for it; the outcome makes it held or slipped', () {
    final none = _body(s, checks: const {});
    expect(none.saved.every((r) => r.state == RecordState.repaired), isTrue);
    expect(none.savedLine, '9 waiting for Check it held.');
    expect(none.saved.every((r) => r.action == 'Check it held'), isTrue);

    // One held and one slipped, as the check controller reports them.
    final checks = {
      mistakeKeyOf('m2', 'm2-q17'): CheckOutcome(right: false, at: DateTime.parse('2026-10-17T20:55:00+05:30')),
      mistakeKeyOf('m2', 'm2-q40'): const CheckOutcome(right: true),
    };
    final some = _body(s, checks: checks);
    expect(some.savedLine, '1 held on a new question, 1 slipped, 7 waiting for Check it held.');
    expect(some.saved.first.number, 17);
    expect(some.saved.first.action, 'See repair');
    expect(some.saved.first.line, 'Slipped on a new question tonight, 8:55 PM. Back in Revise tomorrow.');
  });

  test('every question of a paper counts, a stem is its first line and a pick is its letter', () {
    final body = _body(s);
    final q42 = body.rows.first.open.firstWhere((m) => m.number == 42);
    expect(q42.number, 42);
    expect(q42.pick, 'D');
    expect(q42.stem, 'New partner brings premium in cash; the sacrificing ratio is not given.');
    expect(q42.paper, 'm3');
    expect(q42.qid, 'm3-q42');
  });
}
