import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/lab_loop.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/copy.dart' show PracticeCopy;
import 'package:mockmob/features/practice/data/practice_quote.dart';
import 'package:mockmob/features/practice/widgets/composer_parts.dart' show MockLines;
import 'package:mockmob/features/rules/data/rules_data.dart';
import 'package:mockmob/features/runner/nta/nta_instructions_screen.dart';
import 'package:mockmob/features/runner/nta/nta_runner_screen.dart' show ntaCandidateNameProvider;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;
import 'support/harness.dart' show kRunnerSize;

final _playbook = PlaybookRead.fromJson(
  (jsonDecode(File('test/fixtures/mistake_lab/contract_rules_v1.json').readAsStringSync()) as Map<String, dynamic>)['playbook'],
);

final _quote = PracticeQuote.fromJson({
  'state': 'available',
  'launchable': true,
  'reasonCode': 'included',
  'count': 50,
  'durationSec': 3600,
  'creditCost': 1,
  'creditBalance': 10,
});

/// The start sheet line (Mistake Lab v4 slice 3, spec 4.12): the student's rule for this mock on
/// MockMob's own pages before the clock exists (the mock's confirm sheet and NTA mode's
/// instructions page), in the server's words, and nothing at all without a rule in force.
void main() {
  setUpAll(loadAppFonts);

  Future<List<String>> pumpNta(WidgetTester tester, {StartSheetLines? lines, String subject = 'general_test'}) async {
    tester.view.physicalSize = kRunnerSize * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final asked = <String>[];
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ntaCandidateNameProvider.overrideWithValue('Asha Verma'),
          practiceQuoteProvider.overrideWith((ref, query) async => _quote),
          startSheetProvider.overrideWith((ref, s) async {
            asked.add(s);
            return lines;
          }),
        ],
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp(theme: buildTheme(Brightness.light), home: NtaInstructionsScreen(subject: subject)),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    return asked;
  }

  testWidgets('NTA instructions: the rule and the last mock, before the exam\'s own instructions', (tester) async {
    final asked = await pumpNta(tester, lines: _playbook.startSheet);
    // The attempt-side id: General Test papers are `gat` on the record.
    expect(asked, ['gat']);
    expect(find.text('Your rule for this mock: open every question once before you go deep on any.'), findsOneWidget);
    expect(find.text('Last mock: 4 of 50 questions never opened.'), findsOneWidget);
    expect(find.bySemanticsLabel('Your rule for this mock: open every question once before you go deep on any. Last mock: 4 of 50 questions never opened.'), findsOneWidget);
  });

  testWidgets('NTA instructions without a rule in force: no line, no space', (tester) async {
    await pumpNta(tester);
    expect(find.textContaining('Your rule for this mock'), findsNothing);
  });

  testWidgets('a Full mock\'s confirm sheet leads its lines with the rule', (tester) async {
    tester.view.physicalSize = const Size(360, 600) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final asked = <String>[];
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          startSheetProvider.overrideWith((ref, s) async {
            asked.add(s);
            return _playbook.startSheet;
          }),
        ],
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          home: const Scaffold(body: MockLines(subject: 'accountancy')),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(asked, ['accountancy']);
    final rule = find.text('Your rule for this mock: open every question once before you go deep on any.');
    expect(rule, findsOneWidget);
    // Above the timer note (one row of three since critic 12: "Timer keeps running" leads it): the
    // rule is the first thing the sheet says about the mock.
    expect(tester.getTopLeft(rule).dy < tester.getTopLeft(find.text(PracticeCopy.ruleTimer)).dy, isTrue);
  });

  testWidgets('without a subject (an older caller), the lines are as before', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: Scaffold(body: MockLines()))));
    await tester.pump();
    expect(find.textContaining('Your rule for this mock'), findsNothing);
  });
}
