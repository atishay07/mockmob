// Start sheet: Mobi answers a row for about 160 ms before the sheet goes; "Ends at" only from a
// real end within 30 minutes.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiAct;
import 'package:mockmob/core/router/quick_start.dart';

void main() {
  test('each row has its own act, and NTA mode has none', () {
    expect(startActFor('resume'), MobiAct.nudge);
    expect(startActFor('quick'), MobiAct.cheer);
    expect(startActFor('mock'), MobiAct.read);
    expect(startActFor('repair'), MobiAct.encourage);
    expect(startReactionHold, const Duration(milliseconds: 160));
  });

  group('Ends at', () {
    final now = DateTime(2026, 10, 15, 21, 0);
    int at(Duration d) => now.add(d).millisecondsSinceEpoch;

    test('shown from the real end within 30 minutes', () {
      expect(startEndsLine(at(const Duration(minutes: 28)), now), 'Ends at 9:28 PM.');
      expect(startEndsLine(at(const Duration(minutes: 30)), now), 'Ends at 9:30 PM.');
    });

    test('not shown further out, or once it has passed', () {
      expect(startEndsLine(at(const Duration(minutes: 31)), now), isNull);
      expect(startEndsLine(at(const Duration(hours: 2)), now), isNull);
      expect(startEndsLine(at(const Duration(seconds: -1)), now), isNull);
    });
  });
}
