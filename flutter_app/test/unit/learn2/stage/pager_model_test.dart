// The pager's pure rules, over the same cases as the website's pagerModel.test.mjs (release, velocity, rubber band,
// touch lock and the edge rule; the wheel and key tables are the web's own and are not ported).
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/pager_model.dart';

void main() {
  test('the values are the web\'s PAGER', () {
    expect(PagerModel.distance, 0.18);
    expect(PagerModel.velocity, 0.35);
    expect(PagerModel.window, 80);
    expect(PagerModel.resistance, 0.35);
    expect(PagerModel.slop, 8);
    expect(PagerModel.duration, const Duration(milliseconds: 320));
  });

  test('release: 18% of the area or 0.35 px/ms, never more than one item, a flick back springs back', () {
    int target(double dy, double v, int index) => PagerModel.releaseTarget(dy: dy, v: v, height: 844, index: index, count: 10);
    expect(target(-300, 0, 2), 3, reason: 'a slow third of the screen');
    expect(target(-100, 0, 2), 2);
    expect(target(-40, -0.5, 2), 3);
    expect(target(200, 0, 2), 1);
    expect(target(-800, -4, 2), 3);
    expect(target(-300, 0.6, 2), 1);
    expect(target(-300, 0, 9), 9);
    expect(target(300, 0, 0), 0);
    // The edges of the rule: 18% exactly stays, just past it moves; 0.35 px/ms exactly stays, just past it moves.
    expect(PagerModel.releaseTarget(dy: -0.18 * 600, height: 600, index: 1, count: 3), 1);
    expect(PagerModel.releaseTarget(dy: -0.181 * 600, height: 600, index: 1, count: 3), 2);
    expect(PagerModel.releaseTarget(dy: -10, v: -0.35, height: 600, index: 1, count: 3), 1);
    expect(PagerModel.releaseTarget(dy: -10, v: -0.351, height: 600, index: 1, count: 3), 2);
    expect(PagerModel.releaseTarget(dy: -500, count: 0), 0, reason: 'an empty pager stays at 0');
  });

  test('velocity over the last 80 ms; rubber band at the ends; tap and direction lock', () {
    expect(PagerModel.releaseVelocity(const [(t: 0, y: 0), (t: 100, y: -10), (t: 160, y: -50), (t: 180, y: -70)]), -60 / 80);
    expect(PagerModel.releaseVelocity(const [(t: 0, y: 0)]), 0);
    expect(PagerModel.releaseVelocity(const []), 0);
    expect(PagerModel.releaseVelocity(const [(t: 5, y: 0), (t: 5, y: 40)]), 0, reason: 'no time passed');
    expect(PagerModel.rubber(100, 0, 5), 35);
    expect(PagerModel.rubber(-100, 4, 5), -35);
    expect(PagerModel.rubber(-100, 2, 5), -100);
    expect(PagerModel.rubber(100, 2, 5), 100);
    expect(PagerModel.touchLock(3, 4), PagerTouch.tap);
    expect(PagerModel.touchLock(2, 20), PagerTouch.vertical);
    expect(PagerModel.touchLock(30, 10), PagerTouch.side);
  });

  test('the edge rule: a box that can still move in the drag\'s direction owns it', () {
    expect(PagerModel.canScroll(pixels: 0, min: 0, max: 400, dir: 1), isTrue);
    expect(PagerModel.canScroll(pixels: 0, min: 0, max: 400, dir: -1), isFalse);
    expect(PagerModel.canScroll(pixels: 400, min: 0, max: 400, dir: 1), isFalse);
    expect(PagerModel.canScroll(pixels: 0, min: 0, max: 0, dir: 1), isFalse);
    expect(PagerModel.canScroll(pixels: 10, min: 0, max: 500, dir: -1), isTrue);
    expect(PagerModel.canScroll(pixels: 500, min: 0, max: 500, dir: 1), isFalse);
    expect(PagerModel.canScroll(pixels: 0.5, min: 0, max: 0.8, dir: 1), isFalse, reason: 'under 1 px of overflow does not scroll');
  });
}
