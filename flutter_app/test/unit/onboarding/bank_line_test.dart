import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/college_match.dart';
import 'package:mockmob/features/tools/my_colleges/college_search.dart';

void main() {
  group('the quiet line about the question bank (L28)', () {
    test('quotes the live count once it was read', () {
      expect(
        OnboardingCopy.bankLine(8197),
        'Practice is not a fixed set of mocks: every paper is built fresh from the live question bank of 8,197 questions.',
      );
    });

    test('leaves the number out when the count could not be read, and never shows zero', () {
      final line = OnboardingCopy.bankLine(null);
      expect(line, 'Practice is not a fixed set of mocks: every paper is built fresh from the live question bank.');
      expect(line, isNot(contains('0')));
    });

    test('claims nothing the selector does not guarantee and names no one', () {
      for (final line in [OnboardingCopy.bankLine(null), OnboardingCopy.bankLine(12)]) {
        expect(line.toLowerCase(), isNot(contains('never repeat')));
        expect(line.toLowerCase(), isNot(contains('unlimited')));
        expect(line.toLowerCase(), isNot(contains('!')));
      }
    });

    test('thousands are grouped', () {
      expect(OnboardingCopy.groupThousands(0), '0');
      expect(OnboardingCopy.groupThousands(999), '999');
      expect(OnboardingCopy.groupThousands(1000), '1,000');
      expect(OnboardingCopy.groupThousands(8197), '8,197');
      expect(OnboardingCopy.groupThousands(1234567), '1,234,567');
    });
  });

  group('the ladder shares the Colleges area search (L30)', () {
    test('the same ranks come out of both', () {
      for (final q in ['bcom', 'B.Com', 'b com hons', 'hansrj', 'srcc', 'kmc']) {
        for (final name in ['B.Com. (Hons.)', 'Hansraj College', 'Shri Ram College of Commerce', 'Kirori Mal College']) {
          expect(CollegeMatch.rank(q, name), duMatchRank(q, name), reason: '"$q" against "$name"');
        }
      }
    });

    test('bcom in any spelling means B.Com. (Hons.)', () {
      for (final q in ['bcom', 'B.Com', 'b com', 'bcom hons', 'B.Com (Hons)']) {
        expect(CollegeMatch.rank(q, 'B.Com. (Hons.)'), isNotNull, reason: q);
      }
      expect(CollegeMatch.rank('bcom', 'B.A. (Hons.) Economics'), isNull);
    });
  });
}
