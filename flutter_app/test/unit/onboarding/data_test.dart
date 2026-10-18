import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/data/calendar.dart';
import 'package:mockmob/features/onboarding/data/chapter_order.dart';
import 'package:mockmob/features/onboarding/data/course_combos.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/data/eligibility.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/data/warmup_pool.dart';

/// The repo's own DU files, beside the Flutter app.
Map<String, dynamic> _source(String path) =>
    jsonDecode(File('../public/du/2026/$path').readAsStringSync()) as Map<String, dynamic>;

const _addedSubjects = [
  SheetSubject.physics,
  SheetSubject.chemistry,
  SheetSubject.mathematics,
  SheetSubject.biology,
  SheetSubject.computerScience,
  SheetSubject.geography,
  SheetSubject.history,
  SheetSubject.politicalScience,
  SheetSubject.psychology,
  SheetSubject.sociology,
];

void main() {
  group('DU CSAS 2026 data', () {
    test('six Commerce courses with the real college counts', () {
      expect(
        {for (final c in DuCatalog.courses) c.short: c.collegeCount},
        {
          'B.Com (Hons)': 55,
          'B.Com': 44,
          'B.A. (Hons) Economics': 40,
          'B.A. (Hons) Business Economics': 10,
          'BMS': 9,
          'BBA (FIA)': 2,
        },
      );
    });

    test('every Round 1 figure matches the source files exactly', () {
      final categories = (_source('index.json')['meta'] as Map)['categories'] as List;
      expect(DuCatalog.categories, categories);
      for (final course in DuCatalog.all) {
        final rows = _source('offerings/${course.id}.json')['rows'] as List;
        expect(course.offerings.length, rows.length, reason: course.id);
        for (var i = 0; i < rows.length; i++) {
          final row = rows[i] as List;
          expect(course.offerings[i].college, row[0]);
          final r1 = row[2] as List?;
          for (var k = 0; k < categories.length; k++) {
            final want = r1?[k] as num?;
            final got = course.offerings[i].round1[k];
            if (want == null) {
              expect(got, isNull);
            } else {
              expect(got, closeTo(want, 0.00006), reason: '${course.id} ${row[0]} ${categories[k]}');
            }
          }
        }
      }
    });

    test('the B.Com (Hons) ladder for UR starts SRCC 924.3, Hindu 919.9, LSR 912.5', () {
      final ladder = DuCatalog.course('b-com-hons')!.ladder('UR');
      expect([for (final o in ladder.take(3)) '${o.short} ${DuCatalog.format(o.scoreFor('UR')!)}'], [
        'SRCC 924.3',
        'Hindu 919.9',
        'LSR 912.5',
      ]);
      for (var i = 1; i < ladder.length; i++) {
        expect(ladder[i - 1].scoreFor('UR')!, greaterThanOrEqualTo(ladder[i].scoreFor('UR')!));
      }
    });

    test('a category with no Round 1 seat at a college leaves it off that ladder', () {
      final course = DuCatalog.course('b-com-hons')!;
      final sikh = course.ladder('SIKH');
      expect(sikh.every((o) => o.scoreFor('SIKH') != null), isTrue);
      expect(sikh.length, lessThan(course.collegeCount));
    });
  });

  group('eligibility (DU Bulletin 2026-27)', () {
    const commerce = {SheetSubject.english, SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics};

    test('the Commerce four keep B.Com (Hons) and B.Com open', () {
      expect(EligibilityCheck.of(DuCatalog.course('b-com-hons')!, commerce).eligible, isTrue);
      expect(EligibilityCheck.of(DuCatalog.course('b-com')!, commerce).eligible, isTrue);
    });

    test('Economics (Hons) without Maths says what is missing', () {
      final check = EligibilityCheck.of(DuCatalog.course('b-a-hons-economics')!, commerce);
      expect(check.eligible, isFalse);
      expect(check.missing, ['Maths or Applied Maths']);
    });

    test('BMS needs Maths and General Test: exactly those are pre-ticked (D42)', () {
      final bms = DuCatalog.course('bachelor-of-management-studies-bms')!;
      expect(bms.requires('mathematics'), isTrue);
      expect(bms.requiresGeneralTest, isTrue);
      expect(neededSubjects(bms), [SheetSubject.mathematics, SheetSubject.generalTest]);
    });

    test('no course: nothing is assumed; B.Com (Hons) takes Maths or Accountancy, so nothing is needed', () {
      expect(neededSubjects(null), isEmpty);
      expect(neededSubjects(DuCatalog.course('b-com-hons')), isEmpty);
      expect(neededSubjects(DuCatalog.course('b-com')), isEmpty);
      expect(neededSubjects(DuCatalog.course('b-a-hons-economics')), [SheetSubject.mathematics]);
      expect(neededFor(DuCatalog.course('b-a-hons-economics'), SheetSubject.mathematics), isTrue);
      expect(neededFor(DuCatalog.course('b-a-hons-economics'), SheetSubject.economics), isFalse);
    });

    test('every needed subject is one every Bulletin combination of that course names', () {
      for (final course in DuCatalog.all) {
        for (final s in neededSubjects(course)) {
          final named = s == SheetSubject.generalTest ? course.requiresGeneralTest : course.requires(s.id);
          expect(named, isTrue, reason: '${course.id} ${s.id}');
        }
        expect(neededSubjects(course).length, lessThanOrEqualTo(kMaxSubjects));
      }
    });

    test('a named language is asked for by name', () {
      final hindi = DuCatalog.course('b-a-hons-hindi')!;
      final check = EligibilityCheck.of(hindi, {SheetSubject.english, SheetSubject.history, SheetSubject.politicalScience, SheetSubject.sociology});
      expect(check.eligible, isFalse);
      expect(check.missing.first, 'Hindi');
    });

    test('without a language the line asks for one', () {
      final check = EligibilityCheck.of(DuCatalog.course('b-com')!, {SheetSubject.accountancy, SheetSubject.economics, SheetSubject.businessStudies});
      expect(check.missing, contains('a language such as English'));
    });
  });

  group('More courses (D41)', () {
    test('the tiles lead with the most chosen; "More courses" holds every other course with Round 1 rows', () {
      expect([for (final c in DuCatalog.courses) c.short].take(5), ['B.Com (Hons)', 'B.A. (Hons) Economics', 'B.Com', 'BBA (FIA)', 'BMS']);
      final rules = _source('rules.json');
      final withRows = {
        for (final g in rules['groups'] as List)
          if (((g as Map)['offerings'] as int) > 0 && File('../public/du/2026/offerings/${g['id']}.json').existsSync()) g['id'] as String,
      }..remove('b-a-programme');
      expect({for (final c in DuCatalog.all) c.id}, withRows);
      expect(DuCatalog.all.length, DuCatalog.courses.length + DuCatalog.more.length);
      expect(DuCatalog.course('b-a-programme'), isNull);
    });

    test('combinations come from the Bulletin rows (each course keeps its own)', () {
      final rules = {for (final g in _source('rules.json')['groups'] as List) (g as Map)['id']: g};
      for (final c in DuCatalog.all) {
        final want = [for (final x in (rules[c.id]!['eligibility'] as Map)['combinations'] as List) (x as Map)['text']];
        expect([for (final x in c.combos) x.text], want, reason: c.id);
      }
    });

    test('one short line per course', () {
      String line(String id) => CourseCombos.line(DuCatalog.course(id)!);
      expect(line('b-com-hons'), 'A language + Maths or Accountancy + any 2 subjects');
      expect(line('b-a-hons-economics'), 'A language + Maths + any 2 subjects');
      expect(line('b-com'), 'A language + any 3 subjects, or any 1 subject + General Test');
      expect(line('bachelor-of-management-studies-bms'), 'A language + Maths + any 1 subject + General Test');
      for (final c in DuCatalog.all) {
        expect(CourseCombos.line(c), isNotEmpty, reason: c.id);
        expect(CourseCombos.line(c), isNot(contains('_')), reason: c.id);
      }
    });
  });

  group('warm-up pool', () {
    test('two or three questions per subject, four distinct options, one answer, a fix', () {
      final ids = <String>{};
      for (final q in kWarmupPool) {
        expect(ids.add(q.id), isTrue, reason: 'duplicate id ${q.id}');
        expect(q.options.length, 4, reason: q.id);
        expect(q.options.toSet().length, 4, reason: q.id);
        expect(q.answer, inInclusiveRange(0, 3), reason: q.id);
        expect(q.fix.trim(), isNotEmpty, reason: q.id);
        expect(q.stem.contains('!'), isFalse, reason: q.id);
      }
      for (final s in [SheetSubject.english, SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics, SheetSubject.generalTest]) {
        expect(kWarmupPool.where((q) => q.subject == s).length, 2, reason: s.id);
      }
      for (final s in _addedSubjects) {
        expect(kWarmupPool.where((q) => q.subject == s).length, 3, reason: s.id);
      }
    });

    test('every added subject has a pool of three and every keyed answer is one of its options', () {
      expect(warmupSubjects, containsAll(_addedSubjects));
      for (final s in _addedSubjects) {
        final pool = kWarmupPool.where((q) => q.subject == s).toList();
        expect(pool.length, 3, reason: s.id);
        for (final q in pool) {
          expect(q.id, contains('-nta'), reason: q.id);
          expect(q.answer, inInclusiveRange(0, q.options.length - 1), reason: q.id);
          expect(q.options[q.answer].trim(), isNotEmpty, reason: q.id);
          expect(q.chapter.trim(), isNotEmpty, reason: q.id);
          // The shuffle still shows the keyed option exactly once.
          expect(q.order.where((i) => i == q.answer).length, 1, reason: q.id);
          expect(q.fix.contains('—'), isFalse, reason: q.id);
          expect(q.stem.contains('—'), isFalse, reason: q.id);
        }
      }
      expect(kWarmupPoolVersion, 2);
    });

    test('the arithmetic answers check out', () {
      // acc-1: 3/5 - 1/10 = 5/10, 2/5 - 1/10 = 3/10, C 2/10.
      expect(kWarmupPool.firstWhere((q) => q.id == 'acc-1').options[0], '5:3:2');
      // eco-1: 1 / 0.2 = 5.
      final eco = kWarmupPool.firstWhere((q) => q.id == 'eco-1');
      expect(eco.options[eco.answer], '${(1 / 0.2).round()}');
      // gt-1: 500 x 0.9 = 450 = cost x 1.125.
      final gt = kWarmupPool.firstWhere((q) => q.id == 'gt-1');
      expect(gt.options[gt.answer], 'Rs ${(500 * 0.9 / 1.125).round()}');
      // gt-2: each letter one step forward.
      final code = String.fromCharCodes('CLASS'.codeUnits.map((c) => c + 1));
      final gt2 = kWarmupPool.firstWhere((q) => q.id == 'gt-2');
      expect(gt2.options[gt2.answer], code);
    });

    test('a subject gets a question the student has not seen', () {
      expect(warmupFor(SheetSubject.accountancy, seen: {'acc-1'})!.id, 'acc-2');
      expect(warmupFor(SheetSubject.accountancy, seen: {'acc-1'}, seed: 7)!.id, 'acc-2');
      // Once every question was seen, the whole pool is open again.
      expect(warmupFor(SheetSubject.mathematics, seen: {'math-nta1', 'math-nta3', 'math-nta5'}), isNotNull);
      expect(warmupFor(SheetSubject.mathematics, seen: {'math-nta1', 'math-nta3'})!.id, 'math-nta5');
    });

    test('the student seed picks the question, the same one every time', () {
      for (final s in warmupSubjects) {
        final ids = {for (var seed = 0; seed < 8; seed++) warmupFor(s, seed: seed)!.id};
        final size = kWarmupPool.where((q) => q.subject == s).length;
        expect(ids.length, size, reason: '${s.id}: different students see every question');
        expect(warmupFor(s, seed: 12345)!.id, warmupFor(s, seed: 12345)!.id);
      }
    });

    test('the right answer is not always in the same place', () {
      final shown = [for (final q in kWarmupPool) q.order.indexOf(q.answer)];
      expect(shown.toSet().length, greaterThan(2), reason: 'shown positions $shown');
      for (final q in kWarmupPool) {
        expect(q.order.toSet(), {0, 1, 2, 3}, reason: '${q.id}: every option shows once');
        expect(q.order, q.order, reason: 'stable');
        expect(q.options[q.order[q.order.indexOf(q.answer)]], q.options[q.answer], reason: q.id);
      }
      // Both accountancy answers were written at A; at least one now shows elsewhere.
      final acc = kWarmupPool.where((q) => q.subject == SheetSubject.accountancy);
      expect(acc.map((q) => q.order.indexOf(q.answer)).toSet(), isNot({0}));
    });

    test('the shuffle is the same on every run (no String.hashCode)', () {
      expect(stableSeed('acc-1'), stableSeed('acc-1'));
      expect(stableOrder(4, stableSeed('acc-1')), stableOrder(4, stableSeed('acc-1')));
      expect(stableSeed('acc-1'), isNot(stableSeed('acc-2')));
      // Pinned: a change here moves options under students who already answered on screen.
      expect({for (final q in kWarmupPool) q.id: q.order}, {
        'acc-1': [2, 1, 3, 0],
        'acc-2': [2, 3, 0, 1],
        'bst-1': [0, 3, 1, 2],
        'bst-2': [2, 1, 3, 0],
        'eco-1': [2, 3, 0, 1],
        'eco-2': [1, 0, 2, 3],
        'eng-1': [2, 0, 3, 1],
        'eng-2': [3, 0, 2, 1],
        'gt-1': [2, 3, 1, 0],
        'gt-2': [3, 1, 2, 0],
        'phy-nta1': [2, 1, 3, 0],
        'phy-nta5': [1, 3, 2, 0],
        'phy-nta6': [0, 1, 2, 3],
        'chem-nta1': [3, 0, 1, 2],
        'chem-nta2': [1, 0, 3, 2],
        'chem-nta4': [1, 0, 3, 2],
        'math-nta1': [1, 2, 0, 3],
        'math-nta3': [1, 2, 0, 3],
        'math-nta5': [3, 2, 1, 0],
        'bio-nta1': [3, 0, 2, 1],
        'bio-nta3': [3, 2, 0, 1],
        'bio-nta4': [0, 1, 3, 2],
        'cs-nta1': [0, 2, 1, 3],
        'cs-nta2': [2, 1, 0, 3],
        'cs-nta3': [0, 1, 2, 3],
        'geo-nta1': [1, 0, 3, 2],
        'geo-nta2': [3, 2, 1, 0],
        'geo-nta3': [3, 1, 0, 2],
        'hist-nta1': [1, 2, 0, 3],
        'hist-nta2': [1, 2, 0, 3],
        'hist-nta3': [2, 1, 0, 3],
        'pol-nta1': [1, 3, 0, 2],
        'pol-nta2': [3, 1, 2, 0],
        'pol-nta5': [0, 3, 1, 2],
        'psy-nta1': [1, 0, 3, 2],
        'psy-nta2': [0, 3, 2, 1],
        'psy-nta3': [3, 0, 2, 1],
        'soc-nta1': [1, 2, 3, 0],
        'soc-nta2': [0, 1, 3, 2],
        'soc-nta4': [2, 1, 0, 3],
      });
    });
  });

  group('calendar', () {
    final now = DateTime(2026, 10, 13, 21, 40);

    test('weeks to the expected May window', () {
      expect(CuetCalendar.weeksTo(2027, now), 28);
      expect(CuetCalendar.weeksTo(2028, now), 80);
      expect(CuetCalendar.weeksTo(2027, DateTime(2027, 5, 2)), isNull);
    });

    test('board weeks count at two sessions for Class 12', () {
      final plain = CuetCalendar.sessionsBefore(2027, now, daysPerWeek: 4, boards: false);
      final boards = CuetCalendar.sessionsBefore(2027, now, daysPerWeek: 4, boards: true);
      expect(plain, 28 * 4);
      expect(boards, lessThan(plain));
      expect(boards, plain - 7 * 2);
    });

    test('about rounds to tens above twenty', () {
      expect(CuetCalendar.about(98), 'about 100');
      expect(CuetCalendar.about(12), '12');
    });
  });

  test('chapter order is the data file\'s', () {
    final raw = jsonDecode(File('../data/cuet_chapter_priorities.json').readAsStringSync()) as Map<String, dynamic>;
    for (final e in kChapterOrder.entries) {
      // Subjects the planner file does not rank keep the syllabus order of data/subjects.js.
      if (!raw.containsKey(e.key.id)) continue;
      expect(e.value, raw[e.key.id], reason: e.key.id);
    }
  });
}
