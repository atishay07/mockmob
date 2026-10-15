import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/lab_loop.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/rules/screens/rule_book_screen.dart';

import 'review_golden_support.dart';

Map<String, dynamic> _contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

RemoteState<RulesRead> _rules({Map<String, dynamic>? book}) => RemoteState(
      value: RulesRead.parse({'book': book ?? _contract('rules')['book'], 'acrossMocks': _contract('across')}),
      fetchedAt: DateTime.utc(2026, 10, 15, 9),
    );

/// The Rule book (Mistake Lab v4 slice 3, spec 4.10) at 360 dp, Night and Day: the whole book on
/// the website's contract (the rule in force lit at the top, repairs by chapter, the four habits
/// with their evidence and one gated), the first screen with a repair rule's actions open, and a
/// new student's book (no repairs, the habits' gate).
void main() {
  reviewGolden(
    'rule_book',
    () => const RuleBookScreen(),
    overrides: () => reviewOverrides(rules: _rules()),
    size: const Size(360, 1840),
  );

  reviewGolden(
    'rule_book_open',
    () => const RuleBookScreen(),
    overrides: () => reviewOverrides(rules: _rules()),
    size: const Size(360, 780),
    after: (tester) async {
      await tester.tap(find.text('Calls in arrears are deducted from called-up capital, never added.'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    },
  );

  reviewGolden(
    'rule_book_new',
    () => const RuleBookScreen(),
    overrides: () => reviewOverrides(
      rules: _rules(book: {
        ..._contract('rules')['book'] as Map<String, dynamic>,
        'count': 0,
        'countLabel': 'Your rules, 0',
        'active': null,
        'repairs': {'empty': 'Your first repair adds a rule here.', 'chapters': []},
        'habits': {'state': 'below_gate', 'gateLine': 'Rules from how you take papers need 3 timed mocks. You have 1 of 3.', 'rules': []},
        'basis': "From your device's record of 1 timed mock, marked as it was scored.",
      }),
    ),
    size: const Size(360, 780),
  );
}
