// L03 (owner test 15 Oct: "when I come to Home again, it has added another section like last week
// ... 1 of 4"): the weekly ending card never joins a page the student is already reading.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/logic/visit_latch.dart';

void main() {
  test('a block known before the page settles shows, and stays', () {
    final latch = VisitLatch();
    expect(latch.decide(has: true), isTrue);
    latch.settle();
    expect(latch.decide(has: true), isTrue);
  });

  test('a block that lands after the page settled waits for the next visit', () {
    final latch = VisitLatch();
    expect(latch.decide(has: false), isFalse);
    latch.settle();
    // The rhythm read lands late: the page does not gain a section now.
    expect(latch.decide(has: true), isFalse);
    expect(latch.decide(has: true), isFalse);
    // The tab is shown again (or the app comes back to the front): now it opens.
    latch.newVisit();
    expect(latch.decide(has: true), isTrue);
  });

  test('closing the block applies at once, even after the page settled', () {
    final latch = VisitLatch();
    expect(latch.decide(has: true), isTrue);
    latch.settle();
    expect(latch.decide(has: false), isFalse);
    // A card closed in this visit does not come back in the same visit.
    expect(latch.decide(has: true), isFalse);
  });
}
