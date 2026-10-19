// Fix it for good (MOBI-CONTRACT 4, 20 Oct): the Repair as Mobi's job for Q1 of Mock 7, in its order (your option, why
// it looked right with the trap history, why the key is right, one rule, 2 fresh checks), then held when both are
// right. 360 and 412 dp, Night and Day.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/models/repair_check.dart';
import 'package:mockmob/features/review/data/fix_api.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/screens/fix_screen.dart';

import 'review_golden_support.dart';

final fixResponse = RepairResponse.fromJson({
  'status': 'explained',
  'charged': 1,
  'chosenIndex': 0,
  'keyIndex': 1,
  'repair': {
    'trap_type': 'reversed',
    'trap': 'Option A swaps who gives up the share.',
    'why_wrong':
        'A looked right because it keeps the old 3:2 between A and B and simply adds C. That is what happens when C brings in a share from outside, but here C takes it from the partners.',
    'why_right': 'B is right because each partner gives up 1/10, so A keeps 5/10 and B keeps 3/10 before C joins with 2/10.',
    'rule': 'When a share is taken from the partners, cut each old share first.',
    'key_idea': 'When a share is taken from the partners, cut each old share first.',
  },
  'mobi': {
    'job': 'fix',
    'price': 1,
    'checks': 2,
    'yourPick': {'index': 0, 'text': '3:2:1'},
    'key': {'index': 1, 'text': '13:7:5'},
    'trap': {'type': 'reversed', 'phrase': 'the relation turned around'},
    'history': {'caught': 4, 'chances': 6, 'line': 'This trap has caught you 4 times in 6 chances.'},
    'crowd': null,
    'steps': ['trap', 'why_your_option', 'why_key', 'rule', 'check_1', 'check_2'],
  },
});

class FakeRepairApi implements RepairApi {
  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId, int? retryPick}) async => fixResponse;
}

CheckQuestion _q(String id, String stem, List<String> o) => CheckQuestion(
      checkQuestionId: id,
      question: stem,
      chapter: 'Partnership Fundamentals',
      options: [for (var i = 0; i < o.length; i++) CheckOption(index: i, text: o[i])],
    );

final _checks = [
  _q('k1', 'X and Y share profits 2:1. Z joins for a 1/4 share taken from X and Y equally. What is the new ratio?', ['2:1:1', '13:5:6', '5:3:4', '7:5:6']),
  _q('k2', 'P and Q share 5:3. R is admitted for 1/8, taken entirely from P. What is P’s new share?', ['4/8', '5/8', '3/8', '1/2 of 5/8']),
];

class FakeFixChecks implements FixCheckApi {
  @override
  Future<FixCheckLoad> load({required String attemptId, required String questionId, int slot = 1}) async => FixCheckLoad(CheckReady(_checks[slot - 1]));

  @override
  Future<FixCheckAnswer> submit({
    required String attemptId,
    required String questionId,
    required String checkQuestionId,
    required int pick,
    required String requestId,
    int slot = 1,
  }) async {
    final keyIndex = slot == 1 ? 1 : 0;
    return FixCheckAnswer(
      result: CheckResult(
        right: pick == keyIndex,
        line: pick == keyIndex ? 'Right on a new question on the same idea.' : 'Not this time.',
        keyIndex: keyIndex,
        pick: pick,
        options: _checks[slot - 1].options,
        explanation: slot == 1 ? 'X gives 1/8 and Y gives 1/8: X keeps 13/24, Y keeps 5/24 and Z takes 6/24.' : 'P gives the whole 1/8: 5/8 minus 1/8 is 4/8.',
      ),
      held: slot == 2 ? true : null,
      heldLine: slot == 2 ? 'Both checks right. This fix is held. Revise brings it back in 3 days.' : null,
    );
  }
}

Future<void> _answer(WidgetTester t, String option) async {
  final row = find.text(option);
  await t.ensureVisible(row);
  await t.tap(row);
  await t.pump();
  final key = find.text('Check my answer');
  await t.ensureVisible(key.first);
  await t.tap(key.first);
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
}

void main() {
  for (final w in [360.0, 412.0]) {
    final dp = w.toInt();
    List<Override> overrides() => [
          ...reviewOverrides(),
          repairApiProvider.overrideWithValue(FakeRepairApi()),
          fixCheckApiProvider.overrideWithValue(FakeFixChecks()),
        ];
    reviewGolden(
      'fix_steps_$dp',
      () => const FixScreen(attemptId: 'm7', questionId: 'm7-q0', number: 1),
      size: Size(w, 2300),
      overrides: overrides,
      after: (t) async {
        await t.pump();
        await t.pump(const Duration(milliseconds: 50));
      },
    );
    reviewGolden(
      'fix_held_$dp',
      () => const FixScreen(attemptId: 'm7', questionId: 'm7-q0', number: 1),
      size: Size(w, 3400),
      overrides: overrides,
      after: (t) async {
        await t.pump();
        await t.pump(const Duration(milliseconds: 50));
        await _answer(t, '13:5:6');
        await _answer(t, '4/8');
        await t.pump(const Duration(milliseconds: 400));
      },
    );
  }
}
