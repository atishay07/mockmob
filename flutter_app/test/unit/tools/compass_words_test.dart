// Compass says categories in words, never portal codes, and dates its cutoffs.

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/domain/du_eligibility.dart';

void main() {
  test('category summaries and notes use the words a student says', () {
    expect(ToolsCopy.categorySummary('UR', '640'), 'Unreserved. Score 640');
    expect(ToolsCopy.categorySummary('OBC-NCL', null), 'OBC. No score yet');
    expect(ToolsCopy.categorySummary('SC', '500'), 'SC. Score 500');
    expect(ToolsCopy.categoryNow('UR'), 'Category: unreserved');
    expect(ToolsCopy.roundOneRange('UR', '483', '869'), 'Round I, unreserved: 483 to 869');
    expect(categoryLabel('SGC'), 'Single girl child');
  });

  test('the Unreserved label carries no portal code', () {
    expect(duCategoryLabels['UR'], isNot(contains('UR')));
  });
}
