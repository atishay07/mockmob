// The 8 Nov device walk of the R8 batch: what it found on Your papers and the repair's ending, held here.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../practice/support/harness.dart' show creditsQuote, dailyFree;

Future<void> _pumpPapers(WidgetTester tester, {required bool free}) => pumpMockmob(
  tester,
  const ReviewScreen(),
  size: const Size(384, 2400),
  disableAnimations: true,
  wrapInScaffold: false,
  overrides: reviewOverrides(setQuote: free ? dailyFree() : creditsQuote()),
);

void main() {
  setUpAll(loadAppFonts);

  group('the chapter set says what the Start sheet says (R8 APP-04)', () {
    test('free today, waiting on the quote, priced', () {
      expect(
        ReviewCopy.practiseLine(size: 10, cost: 10, allRepaired: false, credits: 43, freeToday: true),
        '10 new questions, about 10 minutes. Free today.',
      );
      expect(ReviewCopy.practiseLine(size: 10, cost: 10, allRepaired: false, credits: 43, quotePending: true), '10 new questions, about 10 minutes.');
      expect(ReviewCopy.practiseLine(size: 10, cost: 10, allRepaired: false, credits: 43), '10 new questions, about 10 minutes. Uses 10 of your 43 credits.');
      expect(ReviewCopy.practiseLine(size: 10, cost: 10, allRepaired: false, isPro: true, freeToday: true), '10 new questions, about 10 minutes. Pro covers this set.');
    });

    testWidgets('Your papers: a free set never reads as a spend', (tester) async {
      await _pumpPapers(tester, free: true);
      expect(find.textContaining('Free today.'), findsWidgets);
      expect(find.textContaining('Uses 10'), findsNothing);
    });

    testWidgets('Your papers: a priced set keeps its price', (tester) async {
      await _pumpPapers(tester, free: false);
      expect(find.textContaining('Uses 10'), findsWidgets);
      expect(find.textContaining('Free today.'), findsNothing);
    });
  });

  test('the ending names the paper of the next run when it is another one', () {
    expect(ReviewCopy.repairMoreLine('Admission of a partner', 10, from: 'Mock 7'), 'Admission of a partner in Mock 7, about 10 minutes');
    expect(ReviewCopy.repairMoreLine('Goodwill', 5), 'Goodwill, about 5 minutes');
    expect(ReviewCopy.repairMoreLine('Goodwill', null, from: 'Quick practice'), 'Goodwill in Quick practice');
  });
}
