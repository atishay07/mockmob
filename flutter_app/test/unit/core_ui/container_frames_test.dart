// AP1-01 (M03): the container transform never shows text in a half-grown window, and pop
// decelerates into the card (MOTION.md C4 and C8).
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/transitions.dart';

void main() {
  test('forward: no content while the window is under 80%, then full at the end', () {
    for (var i = 0; i <= 100; i++) {
      final f = MmContainerTransform.frameAt(i / 100, reverse: false);
      if (f.t < 0.8) expect(f.content, 0, reason: 'raw ${i / 100}: t ${f.t}');
    }
    expect(MmContainerTransform.frameAt(0.29, reverse: false).content, 0, reason: 'the raised fill alone carries 0 to 30%');
    expect(MmContainerTransform.frameAt(1, reverse: false).content, 1);
  });

  test('pop: content leaves before the window drops under 80%', () {
    for (var i = 0; i <= 100; i++) {
      final f = MmContainerTransform.frameAt(i / 100, reverse: true);
      if (f.t < 0.8) expect(f.content, 0, reason: 'raw ${i / 100}: t ${f.t}');
    }
  });

  test('pop decelerates into the card: the window moves most at the start, least at the end', () {
    final early = 1 - MmContainerTransform.frameAt(0.9, reverse: true).t;
    final late = MmContainerTransform.frameAt(0.1, reverse: true).t;
    expect(early, greaterThan(late * 2), reason: 'early drop $early vs last stretch $late');
  });
}
