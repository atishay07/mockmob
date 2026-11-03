// The kind's colour family (the web's `kindFamily` in src/components/keycards/kinds.js, R6 Web D and R8): every kind a card
// can have is one of four families, an unknown kind is a fact, and case does not matter. The same cases as the web's
// coverModel.test.mjs.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/keycards/data/keycards_lines.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';

void main() {
  const kinds = [
    'definition', 'term', 'key_line', 'list', 'difference', 'steps', 'types', 'formula', 'fact', 'example', 'entry', 'quote', //
    'word', 'idiom', 'one_word', 'usage', 'rule',
  ];

  test('every kind has a label and one of the four families', () {
    for (final k in kinds) {
      expect(KeyCardsCopy.kindLabel(k), isNot('Card'), reason: k);
      expect(KcFamily.values, contains(kindFamily(k)), reason: k);
    }
  });

  test('the four families, by what the card is for', () {
    for (final k in ['definition', 'term', 'word', 'one_word', 'idiom', 'usage']) {
      expect(kindFamily(k), KcFamily.meaning, reason: k);
    }
    for (final k in ['formula', 'rule', 'entry']) {
      expect(kindFamily(k), KcFamily.rule, reason: k);
    }
    for (final k in ['list', 'steps', 'types', 'difference']) {
      expect(kindFamily(k), KcFamily.parts, reason: k);
    }
    for (final k in ['fact', 'key_line', 'quote', 'example']) {
      expect(kindFamily(k), KcFamily.fact, reason: k);
    }
  });

  test('an unknown or missing kind is a fact; case does not matter', () {
    expect(kindFamily(null), KcFamily.fact);
    expect(kindFamily(''), KcFamily.fact);
    expect(kindFamily('poem'), KcFamily.fact);
    expect(kindFamily('Definition'), KcFamily.meaning);
    expect(kindFamily('KEY_LINE'), KcFamily.fact);
    expect(kindFamily('Formula'), KcFamily.rule);
  });
}
