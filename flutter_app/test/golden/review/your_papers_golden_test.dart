// Your papers (19 Oct, D106 and G20) at 360 and 412 dp, Night and Day, and at 1.3x text: a fresh account with no papers,
// a fresh account after one paper, a heavy account, and the heavy account filtered to one subject.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../unit/review/support/review_fixtures.dart';
import 'review_golden_support.dart';

final _english = Attempt.fromJson(mockJson(id: 'e1', completedAt: DateTime.utc(2026, 10, 13, 5, 0), subject: 'english', wrong: {2, 7}));
final _quick2 = Attempt.fromJson(
  mockJson(id: 'q2', completedAt: DateTime.utc(2026, 10, 10, 14, 30), mode: 'quick', count: 10, subject: 'economics', chapter: 'Money and banking'),
);
List<Attempt> get _heavy => [mock7, quick, _quick2, mock6, _english];

const _p360 = Size(360, 800);
const _p412 = Size(412, 915);

void main() {
  reviewGolden('papers_fresh_360', () => const ReviewScreen(), size: _p360, overrides: () => reviewOverrides(attempts: const []));
  reviewGolden('papers_one_360', () => const ReviewScreen(), size: _p360, overrides: () => reviewOverrides(attempts: [quick]));
  reviewGolden('papers_one_412', () => const ReviewScreen(), size: _p412, overrides: () => reviewOverrides(attempts: [quick]));
  reviewGolden('papers_heavy_360', () => const ReviewScreen(), size: _p360, overrides: () => reviewOverrides(attempts: _heavy, records: [repairedRecord]));
  reviewGolden('papers_heavy_412', () => const ReviewScreen(), size: _p412, overrides: () => reviewOverrides(attempts: _heavy, records: [repairedRecord]));
  reviewGolden(
    'papers_heavy_full_360',
    () => const ReviewScreen(),
    size: const Size(360, 2600),
    overrides: () => reviewOverrides(attempts: _heavy, records: [repairedRecord]),
  );
  reviewGolden(
    'papers_heavy_text130_360',
    () => const ReviewScreen(),
    size: _p360,
    textScale: 1.3,
    overrides: () => reviewOverrides(attempts: _heavy, records: [repairedRecord]),
  );
  reviewGolden(
    'papers_heavy_economics_360',
    () => const ReviewScreen(),
    size: const Size(360, 1400),
    overrides: () => reviewOverrides(attempts: _heavy, records: [repairedRecord]),
    after: (tester) async {
      await tester.tap(find.text('Economics').first);
      await tester.pumpAndSettle();
    },
  );
}
