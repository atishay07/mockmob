import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/question.dart';
import 'package:mockmob/features/review/widgets/try_first.dart';

void main() {
  final options = [
    for (final k in ['A', 'B', 'C', 'D']) QuestionOption(key: k, text: 'Option $k'),
  ];

  test('no pick or no key means nothing to judge', () {
    expect(TryFirst.isRight(null, 1), isNull);
    expect(TryFirst.isRight(1, null), isNull);
    expect(TryFirst.verdictLine(null, 1, options), isNull);
    expect(TryFirst.verdictLine(1, null, options), isNull);
  });

  test('a right pick says the try held', () {
    expect(TryFirst.isRight(2, 2), isTrue);
    expect(TryFirst.verdictLine(2, 2, options), 'Right. This one held.');
  });

  test('a wrong pick names the key letter', () {
    expect(TryFirst.isRight(0, 2), isFalse);
    expect(TryFirst.verdictLine(0, 2, options), 'Not yet. The key is C.');
  });

  test('a key outside the options is never judged', () {
    expect(TryFirst.verdictLine(0, 9, options), isNull);
  });
}
