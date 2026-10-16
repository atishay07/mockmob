// AP1-12 (M17): one scroll-to-top for every tab reselect.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/scroll_effects.dart';

void main() {
  test('over 1.5 viewports: jump to one viewport, then glide 360 ms', () {
    final plan = MmScroll.planToTop(2000, 800);
    expect(plan.jumpTo, 800);
    expect(plan.glide, const Duration(milliseconds: 360));
  });

  test('within 1.5 viewports: glide 300 ms, no jump', () {
    expect(MmScroll.planToTop(1200, 800).jumpTo, isNull);
    expect(MmScroll.planToTop(1200, 800).glide, const Duration(milliseconds: 300));
    expect(MmScroll.planToTop(1201, 800).jumpTo, 800);
  });
}
