import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/review/again/review_again_copy.dart';
import 'package:mockmob/features/review/again/review_again_data.dart';

void main() {
  test('a set where every question held never says "most"', () {
    expect(ReviewAgainCopy.endTitleFor(AgainTone.proud, held: 8, total: 8), 'All of them held.');
    expect(ReviewAgainCopy.endTitleFor(AgainTone.proud, held: 1, total: 1), 'It held.');
  });

  test('a mixed set keeps its tone line', () {
    expect(ReviewAgainCopy.endTitleFor(AgainTone.proud, held: 6, total: 8), 'Most of them held.');
    expect(ReviewAgainCopy.endTitleFor(AgainTone.nod, held: 4, total: 8), 'Some held.');
    expect(ReviewAgainCopy.endTitleFor(AgainTone.encourage, held: 1, total: 8), 'These need another look.');
  });
}
