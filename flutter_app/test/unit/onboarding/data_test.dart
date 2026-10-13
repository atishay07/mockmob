import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/data/calendar.dart';
import 'package:mockmob/features/onboarding/data/chapter_order.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/data/eligibility.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/data/warmup_pool.dart';

/// The repo's own DU files, beside the Flutter app.
Map<String, dynamic> _source(String path) =>
    jsonDecode(File('../public/du/2026/$path').readAsStringSync()) as Map<String, dynamic>;

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
      for (final course in DuCatalog.courses) {
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

    test('BMS needs Maths and General Test; the suggested set has both and stays within five', () {
      final bms = DuCatalog.course('bachelor-of-management-studies-bms')!;
      expect(bms.requires('mathematics'), isTrue);
      expect(bms.requiresGeneralTest, isTrue);
      final suggested = suggestedSubjects(bms);
      expect(suggested.length, lessThanOrEqualTo(kMaxSubjects));
      expect(EligibilityCheck.of(bms, suggested.toSet()).eligible, isTrue);
    });

    test('every course is reachable from its own suggested set', () {
      for (final course in DuCatalog.courses) {
        expect(EligibilityCheck.of(course, suggestedSubjects(course).toSet()).eligible, isTrue, reason: course.id);
      }
    });

    test('without a language the line asks for one', () {
      final check = EligibilityCheck.of(DuCatalog.course('b-com')!, {SheetSubject.accountancy, SheetSubject.economics, SheetSubject.businessStudies});
      expect(check.missing, contains('a language such as English'));
    });
  });

  group('warm-up pool', () {
    test('two questions per subject, four distinct options, one answer, a fix', () {
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
      expect(warmupFor(SheetSubject.mathematics), isNull);
    });

    test('the student seed picks the question, the same one every time', () {
      for (final s in warmupSubjects) {
        final ids = {for (var seed = 0; seed < 8; seed++) warmupFor(s, seed: seed)!.id};
        expect(ids.length, 2, reason: '${s.id}: different students see both questions');
        expect(warmupFor(s, seed: 12345)!.id, warmupFor(s, seed: 12345)!.id);
      }
    });

    test('the right answer is not always in the same place', () {
      final shown = [for (final q in kWarmupPool) q.shownAnswer];
      expect(shown.toSet().length, greaterThan(2), reason: 'shown positions $shown');
      for (final q in kWarmupPool) {
        expect(q.order.toSet(), {0, 1, 2, 3}, reason: '${q.id}: every option shows once');
        expect(q.order, q.order, reason: 'stable');
        expect(q.options[q.order[q.shownAnswer]], q.options[q.answer], reason: q.id);
      }
      // Both accountancy answers were written at A; at least one now shows elsewhere.
      final acc = kWarmupPool.where((q) => q.subject == SheetSubject.accountancy);
      expect(acc.map((q) => q.shownAnswer).toSet(), isNot({0}));
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
