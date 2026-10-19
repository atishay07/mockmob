// The join code as the boxes read it (spec 5.3 J1): Crockford normalisation (uppercase, O to 0, I and L
// to 1), a pasted link or a whole message, six boxes growing to eight, and "K7P 2M9" as shown.
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/code_boxes.dart';

void main() {
  group('joinCodeFromInput', () {
    test('uppercases, and reads O as 0 and I and L as 1', () {
      expect(joinCodeFromInput('k7p2m9'), 'K7P2M9');
      expect(joinCodeFromInput('EXPIRE'), 'EXP1RE');
      expect(joinCodeFromInput('k7pllm'), 'K7P11M');
      expect(joinCodeFromInput('O0Il1L'), '001111');
    });

    test('drops spaces, hyphens and anything that is not a code character', () {
      expect(joinCodeFromInput('K7P 2M9'), 'K7P2M9');
      expect(joinCodeFromInput('k7p-2m9'), 'K7P2M9');
      expect(joinCodeFromInput(' K7P.2M9! '), 'K7P2M9');
      expect(joinCodeFromInput('UUU'), '');
    });

    test('takes the code out of a whole link', () {
      expect(joinCodeFromInput('https://www.mockmob.in/join/K7P2M9'), 'K7P2M9');
      expect(joinCodeFromInput('https://www.mockmob.in/join/k7p2m9?utm=wa'), 'K7P2M9');
      expect(joinCodeFromInput('mockmob.in/join/K7P2M9XY'), 'K7P2M9XY');
    });

    test('takes the code out of the message a friend sent', () {
      const msg = 'Aarav saved you a seat in Chai Circle, an Accountancy Mob on MockMob. Tap to join: https://www.mockmob.in/join/K7P2M9 (code K7P 2M9)';
      expect(joinCodeFromInput(msg), 'K7P2M9');
    });

    test('never more than 8 characters', () {
      expect(joinCodeFromInput('K7P2M9XYZZZ'), 'K7P2M9XY');
      expect(joinCodeFromInput('K7P2M9XY').length, 8);
    });

    test('agrees with the model\'s own rule on what a code is', () {
      for (final raw in ['K7P2M9', 'k7p 2m9', 'K7P2M9XY', 'EXP1RE']) {
        expect(isJoinCode(joinCodeFromInput(raw)), isTrue, reason: raw);
      }
      expect(isJoinCode(joinCodeFromInput('K7P2M')), isFalse);
      expect(isJoinCode(joinCodeFromInput('K7P2M9X')), isFalse);
    });
  });

  group('the boxes', () {
    test('six boxes up to six characters, eight after', () {
      expect(CodeBoxes.boxCount(0), 6);
      expect(CodeBoxes.boxCount(6), 6);
      expect(CodeBoxes.boxCount(7), 8);
      expect(CodeBoxes.boxCount(8), 8);
    });

    test('shown as K7P 2M9, and K7P2 M9XY for an old code', () {
      expect(CodeBoxes.shown('K7P2M9'), 'K7P 2M9');
      expect(CodeBoxes.shown('K7P'), 'K7P');
      expect(CodeBoxes.shown('K7P2M'), 'K7P 2M');
      expect(CodeBoxes.shown('K7P2M9X'), 'K7P2 M9X');
      expect(CodeBoxes.shown('K7P2M9XY'), 'K7P2 M9XY');
      expect(CodeBoxes.shown(''), '');
    });

    test('the formatter keeps a text field to code characters and puts the cursor at the end', () {
      const f = JoinCodeFormatter();
      final out = f.formatEditUpdate(TextEditingValue.empty, const TextEditingValue(text: 'https://www.mockmob.in/join/k7p2m9'));
      expect(out.text, 'K7P2M9');
      expect(out.selection, const TextSelection.collapsed(offset: 6));
      final plain = f.formatEditUpdate(TextEditingValue.empty, const TextEditingValue(text: 'K7P'));
      expect(plain.text, 'K7P');
    });
  });
}
