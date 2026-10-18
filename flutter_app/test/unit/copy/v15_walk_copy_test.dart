// M10 of the v15 emulator walk (D29): the screen a slow result load ends on still said "Your sheet is back. Marked on the
// server.", the marking-wait vocabulary the owner rejected ("no marking results, and it is instantaneous"). It now says
// what is true: the result has loaded, and it is saved to the account.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/copy.dart';

void main() {
  test('the sealed entry after a slow load says the result loaded and is saved, never that marking happened', () {
    expect(ResultCopy.sheetBack, 'Your result has loaded.');
    expect(ResultCopy.openWhenReady, 'It is saved to your account.');
    for (final line in [ResultCopy.sheetBack, ResultCopy.openWhenReady, ResultCopy.receiptLine(null)]) {
      final words = line.toLowerCase();
      expect(words, isNot(contains('marked')), reason: line);
      expect(words, isNot(contains('marking')), reason: line);
      expect(words, isNot(contains('is back')), reason: line);
      expect(words, isNot(contains('on the server')), reason: line);
    }
  });

  test('without an acknowledgement time the receipt is the plain fact and invents no time', () {
    expect(ResultCopy.receiptLine(null), 'Saved to your account.');
    expect(ResultCopy.receiptLine(DateTime(2026, 10, 18, 7, 4)), 'Saved to your record at 7:04 AM.');
  });
}
