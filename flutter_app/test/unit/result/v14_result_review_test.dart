import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/question.dart';
import 'package:mockmob/features/result/model/next_move.dart';

void main() {
  group('the explanation balance reads the count the server sends', () {
    test('spendable is a yes or no and the count is total', () {
      final c = AiCredits.fromJson({
        'state': 'available',
        'wallet': {'state': 'available', 'known': true, 'spendable': true, 'total': 9},
      });
      expect(c.explanationBalance, 9);
    });

    test('an older payload carries the count in spendable', () {
      final c = AiCredits.fromJson({
        'state': 'available',
        'wallet': {'known': true, 'spendable': 7},
      });
      expect(c.explanationBalance, 7);
    });

    test('an unknown balance is null, never zero', () {
      final c = AiCredits.fromJson({
        'state': 'error',
        'wallet': {'known': false, 'spendable': false, 'total': null},
      });
      expect(c.explanationBalance, isNull);
    });

    test('a known zero is zero', () {
      final c = AiCredits.fromJson({
        'state': 'empty',
        'wallet': {'known': true, 'spendable': false, 'total': 0},
      });
      expect(c.explanationBalance, 0);
    });
  });

  group('distinctBody', () {
    test('a body that repeats the stem is dropped', () {
      expect(distinctBody('Which entry is made?', 'Which entry is made?'), isNull);
      expect(distinctBody('Which  entry is MADE?', ' which entry is made? '), isNull);
      expect(distinctBody('Which entry is made when shares are issued?', 'which entry is made'), isNull);
    });

    test('a real body stays', () {
      expect(distinctBody('Which entry is made?', 'Assume a 10 rupee share.'), 'Assume a 10 rupee share.');
    });

    test('nothing is nothing', () {
      expect(distinctBody('Q', null), isNull);
      expect(distinctBody('Q', '   '), isNull);
    });
  });

  group('the repair offered beside a chapter set says what it gives', () {
    test('with the balance', () {
      expect(repairAltDetail('C', 9), 'It gives you why C looked right, the trap and one rule to keep. You have 9.');
    });

    test('with no balance it never says zero', () {
      expect(repairAltDetail(null, null), 'It gives you why your answer looked right, the trap and one rule to keep.');
    });
  });
}
