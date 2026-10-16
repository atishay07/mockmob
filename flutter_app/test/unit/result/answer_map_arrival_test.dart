import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/features/result/widgets/answer_map.dart';

// APP-PASS AP2-06 (M21): the answer map arrives in 800 ms or less, once, and never alarms.
void main() {
  test('the ripple takes the draw-in time and the single ring ends inside 800 ms', () {
    expect(AnswerMap.total.inMilliseconds, lessThanOrEqualTo(800));
    expect(AnswerMap.rippleSpan + AnswerMap.ringLife, 420);
    expect(AnswerMap.rippleSpan + AnswerMap.ringLife, lessThanOrEqualTo(Motion.drawIn.inMilliseconds));
    expect(AnswerMap.pulseStart, greaterThanOrEqualTo(AnswerMap.rippleSpan + AnswerMap.ringLife));
    expect(AnswerMap.pulseStart + AnswerMap.pulseLife, lessThanOrEqualTo(AnswerMap.total.inMilliseconds.toDouble()));
    expect(AnswerMap.pulseLife, 380);
  });

  test('the first wrong answer gets one ring, not a double pulse', () {
    expect(AnswerMap.pulseCount, 1);
  });
}
