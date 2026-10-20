// M10 of the v15 emulator walk (D29): the screen a slow result load ends on still said "Your sheet is back. Marked on the
// server.", the marking-wait vocabulary the owner rejected ("no marking results, and it is instantaneous"). It now says
// what is true. 20 Oct (owner K7: "Your paper is saved," then the score): the head says the paper is saved, and the line
// under it that the marks are inside, ready to open.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/copy.dart';

void main() {
  test('the sealed entry says the paper is saved and its marks are inside, never that marking happened', () {
    expect(ResultCopy.sheetBack, 'Your paper is saved.');
    expect(ResultCopy.openWhenReady, 'Your marks are inside. Open it when you are ready.');
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
