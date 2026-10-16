import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/data/college_match.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';

List<String> _found(String query, {String course = 'b-com-hons'}) {
  final rows = DuCatalog.course(course)!.ladder('UR');
  return [for (final o in CollegeMatch.filter(rows, query)) o.college];
}

void main() {
  group('CollegeMatch normalising', () {
    test('punctuation, case and spacing do not matter', () {
      expect(CollegeMatch.normalise('  B.Com. (Hons.) '), 'b com hons');
      expect(CollegeMatch.compact('B.Com. (Hons.)'), 'bcomhons');
      expect(CollegeMatch.normalise('Jesus & Mary'), 'jesus and mary');
    });

    test('aliases expand whole words only', () {
      expect(CollegeMatch.queryTokens('srcc'), ['shri', 'ram', 'college', 'of', 'commerce']);
      expect(CollegeMatch.queryTokens('Hons'), ['hons']);
      expect(CollegeMatch.queryTokens('hansraj'), ['hansraj'], reason: 'a word that is not an alias stays as typed');
    });
  });

  group('CollegeMatch finds the college the student means', () {
    test('an empty query finds every college, in the ladder order', () {
      final rows = DuCatalog.course('b-com-hons')!.ladder('UR');
      expect(CollegeMatch.filter(rows, ''), rows);
      expect(CollegeMatch.filter(rows, '  '), rows);
    });

    test('a few letters of the name', () {
      expect(_found('hans'), ['Hansraj College']);
      expect(_found('HANSRAJ'), ['Hansraj College']);
      expect(_found('hans raj'), ['Hansraj College'], reason: 'spaces are ignored, so two words find one name');
    });

    test('one slip still finds it', () {
      expect(_found('hansrj'), ['Hansraj College'], reason: 'a missing letter');
      expect(_found('hansarj'), ['Hansraj College'], reason: 'two letters swapped');
    });

    test('a word that is not close to anything finds nothing', () {
      expect(_found('zzz'), isEmpty);
      expect(_found('xylophone'), isEmpty);
    });

    test('the short names students say', () {
      expect(_found('srcc'), ['Shri Ram College of Commerce']);
      expect(_found('lsr').single, startsWith('Lady Shri Ram'));
      expect(_found('kmc'), ['Kirori Mal College']);
      expect(_found('hrc'), ['Hansraj College']);
    });

    test('a word of the name finds every college that has it', () {
      final ram = _found('ram');
      expect(ram, contains('Shri Ram College of Commerce'));
      expect(ram.any((c) => c.startsWith('Lady Shri Ram')), isTrue);
    });

    test('the order is the ladder order, highest figure first', () {
      final rows = DuCatalog.course('b-com-hons')!.ladder('UR');
      final all = [for (final o in rows) o.college];
      final found = _found('college');
      expect(found, [for (final c in all) if (found.contains(c)) c]);
    });

    test('rank: the start of a name beats a match inside it, and a typo ranks last', () {
      expect(CollegeMatch.rank('hans', 'Hansraj College'), 0);
      expect(CollegeMatch.rank('raj', 'Hansraj College'), 1);
      expect(CollegeMatch.rank('college hans', 'Hansraj College'), 2);
      expect(CollegeMatch.rank('hansrj', 'Hansraj College'), 3);
      expect(CollegeMatch.rank('zzz', 'Hansraj College'), isNull);
    });

    test('short words must start a word: a typo is only forgiven from five letters', () {
      expect(CollegeMatch.rank('hnas', 'Hansraj College'), isNull);
      expect(CollegeMatch.rank('hindu', 'Hindu College'), 0);
    });
  });
}
