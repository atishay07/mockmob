import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/full_sections.dart';
import 'package:mockmob/features/result/model/recap_model.dart' show RecapModel;
import 'package:mockmob/features/result/full/lab_ledger_section.dart' show LabLedgerSection;
import 'package:mockmob/features/rules/copy.dart' show RulesCopy;
import 'package:mockmob/features/rules/widgets/across_mocks_view.dart';
import 'package:mockmob/features/rules/widgets/rule_check_view.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';
import 'support/lab_fixtures.dart' show labContract, pumpLabHost;

Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// The page's own scroll.
Finder get _page => find.byType(Scrollable).first;

/// Mistake Lab v4 slice 3 on the full result: the repair order leads the Repair step's key, the
/// Rule book is a row under it, the rule check is Prove, and Across your mocks ends the Lab.
void main() {
  setUpAll(loadAppFonts);
  setUp(() {
    LabLedgerSection.debugResetSeen();
    AcrossMocksView.debugResetSeen();
  });

  group('Across your mocks', () {
    testWidgets('three lines, the rest behind Show all, then Show fewer', (tester) async {
      final across = AcrossMocks.tryParse(contract('across'))!;
      await pumpLabHost(tester, AcrossMocksView(across: across, seenKey: 't1'), size: const Size(360, 1200));
      await tester.pumpAndSettle();
      expect(find.text('Across your mocks'), findsOneWidget);
      for (final l in across.lines) {
        // "Never opened" is said as a finding (RulesCopy.neverOpenedLine); every other line as sent.
        expect(find.text(RulesCopy.neverOpenedLine(l.text)), findsOneWidget);
      }
      for (final l in across.more) {
        expect(find.text(RulesCopy.neverOpenedLine(l.text)), findsNothing);
      }
      expect(find.text(across.basis!), findsOneWidget);
      await tester.tap(find.text('Show all 5'));
      await tester.pumpAndSettle();
      for (final l in across.more) {
        expect(find.text(RulesCopy.neverOpenedLine(l.text)), findsOneWidget);
      }
      expect(find.text('Show fewer'), findsOneWidget);
      await tester.tap(find.text('Show fewer'));
      await tester.pumpAndSettle();
      expect(find.text(RulesCopy.neverOpenedLine(across.more.first.text)), findsNothing);
    });

    testWidgets('below the gate: the gate in words, no lines', (tester) async {
      const message = 'Across your mocks opens at 2 timed mocks with a device record. You have 1.';
      final across = AcrossMocks.tryParse({...contract('across'), 'state': 'below_gate', 'message': message})!;
      await pumpLabHost(tester, AcrossMocksView(across: across, seenKey: 't2'));
      await tester.pumpAndSettle();
      expect(find.text(message), findsOneWidget);
      expect(find.text(contract('across')['lines'][0]['text'] as String), findsNothing);
      expect(find.textContaining('Show all'), findsNothing);
    });

    testWidgets('a gated line reads as its gate, with nothing measured', (tester) async {
      final raw = contract('across');
      const gate = 'Changes on a later visit against changes without leaving the question: this comparison opens at 8 of each. You have 5 and 3.';
      final lines = [...(raw['lines'] as List)];
      lines[2] = {...lines[2] as Map, 'gated': true, 'marks': 0, 'text': gate};
      final across = AcrossMocks.tryParse({...raw, 'lines': lines})!;
      await pumpLabHost(tester, AcrossMocksView(across: across, seenKey: 't3'));
      await tester.pumpAndSettle();
      expect(find.text(gate), findsOneWidget);
    });

    testWidgets('the lines rise in once when first seen, and are at rest under reduced motion', (tester) async {
      final across = AcrossMocks.tryParse(contract('across'))!;
      await pumpLabHost(tester, AcrossMocksView(across: across, seenKey: 't4'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 20));
      final early = tester.widgetList<Opacity>(find.ancestor(of: find.text(RulesCopy.neverOpenedLine(across.lines.last.text)), matching: find.byType(Opacity)));
      expect(early.any((o) => o.opacity < 1), isTrue, reason: 'the last line is still arriving');
      await tester.pumpAndSettle();

      AcrossMocksView.debugResetSeen();
      await pumpLabHost(tester, AcrossMocksView(key: const ValueKey('r'), across: across, seenKey: 't5'), reduced: true);
      await tester.pump();
      final rest = tester.widgetList<Opacity>(find.ancestor(of: find.text(RulesCopy.neverOpenedLine(across.lines.last.text)), matching: find.byType(Opacity)));
      expect(rest.every((o) => o.opacity == 1), isTrue);
    });
  });

  group('the rule check', () {
    for (final state in ['kept', 'not_kept', 'counted', 'not_checked']) {
      testWidgets('$state: the rule and the arithmetic, in the server\'s words', (tester) async {
        final check = RuleCheck.tryParse(contract('rulecheck')[state])!;
        await pumpLabHost(tester, RuleCheckView(check: check));
        await tester.pumpAndSettle();
        expect(find.text('Your rule'), findsOneWidget);
        expect(find.text(check.line), findsOneWidget);
        expect(find.text(check.result), findsOneWidget);
        if (check.fine != null) expect(find.text(check.fine!), findsOneWidget);
        // Read as one sentence group by a screen reader.
        expect(find.bySemanticsLabel(RegExp(RegExp.escape(check.result))), findsOneWidget);
      });
    }
  });

  group('the Repair step', () {
    /// A repair order led by the paper's first open mistake (most others got it right).
    Map<String, dynamic> orderFor(RecapModel m) {
      final c = m.candidates[1];
      return {
        'version': 1,
        'state': 'cohort',
        'items': [
          {'qid': c.questionId, 'number': c.number, 'reason': 'most_right', 'key': 'Repair Q${c.number} first', 'line': '26 of 31 other students got it right.'},
          for (final o in m.candidates)
            if (o.questionId != c.questionId) {'qid': o.questionId, 'number': o.number, 'reason': 'paper', 'key': null, 'line': null},
        ],
      };
    }

    testWidgets('a cohort order: the key names the question, the evidence sits under it, and it opens that repair', (tester) async {
      final m = mock7();
      final lab = MistakeLab.tryParse({...labContract('ready'), 'repairOrder': orderFor(m), 'rules': contract('rules')['summary']})!;
      final c = m.candidates[1];
      final scope = RepairCandidates.scopeOf(m.candidates, startQuestionId: c.questionId)!;
      final (item, _) = cohortLead(m, lab.repairOrder)!;
      expect(item.qid, c.questionId);
      await pumpLabHost(tester, Builder(builder: (context) => firstFixSection(context, m, lab: lab)!), size: const Size(360, 900));
      await tester.pumpAndSettle();
      expect(find.text('Repair Q${c.number} first'), findsOneWidget);
      expect(find.text('26 of 31 other students got it right.'), findsOneWidget);
      expect(find.text(RepairCandidates.describe(scope)), findsOneWidget);
      // The Rule book's row under the key.
      expect(find.text('Your rules, 7'), findsOneWidget);
      expect(find.text('Next mock: Open every question once before you go deep on any.'), findsOneWidget);
    });

    testWidgets('paper order (or no order): today\'s key and words stay', (tester) async {
      final m = mock7();
      final paper = {
        'version': 1,
        'state': 'paper',
        'items': [for (final o in m.candidates) {'qid': o.questionId, 'number': o.number, 'reason': 'paper', 'key': null, 'line': null}],
      };
      for (final lab in [MistakeLab.tryParse({...labContract('ready'), 'repairOrder': paper})!, MistakeLab.tryParse(labContract('ready'))!, null]) {
        await pumpLabHost(tester, Builder(builder: (context) => firstFixSection(context, m, lab: lab)!), size: const Size(360, 900));
        await tester.pumpAndSettle();
        final scope = RepairCandidates.scopeOf(m.candidates)!;
        expect(find.text(RepairCandidates.keyLabel(scope)), findsOneWidget);
        expect(find.textContaining('Repair Q'), findsNothing);
        expect(find.textContaining('Your rules'), findsNothing);
      }
    });

    test('a led question already repaired gives way to the next led one, or to today\'s key', () {
      final m = mock7();
      final order = RepairOrder.tryParse({
        'state': 'cohort',
        'items': [
          {'qid': 'gone', 'number': 99, 'reason': 'most_right', 'key': 'Repair Q99 first', 'line': '20 of 22 other students got it right.'},
          {'qid': m.candidates[2].questionId, 'number': m.candidates[2].number, 'reason': 'common_trap', 'key': 'Repair Q${m.candidates[2].number} first', 'line': '8 of the 12 who got it wrong chose B, as you did.'},
        ],
      });
      expect(cohortLead(m, order)!.$1.qid, m.candidates[2].questionId);
      final none = RepairOrder.tryParse({
        'state': 'cohort',
        'items': [
          {'qid': 'gone', 'number': 99, 'reason': 'most_right', 'key': 'Repair Q99 first', 'line': '20 of 22 other students got it right.'},
        ],
      });
      expect(cohortLead(m, none), isNull);
    });
  });

  group('on the full result', () {
    Future<void> pump(WidgetTester tester, Map<String, dynamic> lab) async {
      final d = detail(attemptBody: {...attemptJson(), 'lab': lab});
      await pumpResultRoute(
        tester,
        openFolds: true,
        location: '/result/a7',
        overrides: resultOverrides(attemptId: 'a7', data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d), log: ResultLog()),
      );
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pumpAndSettle();
    }

    testWidgets('the Lab in order: Repair, then Prove\'s rule check, then Across your mocks, then After this mock', (tester) async {
      final check = RuleCheck.tryParse(contract('rulecheck')['not_kept'])!;
      await pump(tester, {
        ...labContract('ready'),
        'acrossMocks': contract('across'),
        'rules': contract('rules')['summary'],
        'prove': {'ruleCheck': contract('rulecheck')['not_kept']},
      });
      await tester.scrollUntilVisible(find.text('Across your mocks'), 300, scrollable: _page);
      double top(Finder f) => tester.getTopLeft(f.first).dy;
      expect(top(find.text('Your rules, 7')) < top(find.text(check.result)), isTrue);
      expect(top(find.text(check.result)) < top(find.text('Across your mocks')), isTrue);
      expect(find.text(RulesCopy.neverOpenedLine(AcrossMocks.tryParse(contract('across'))!.lines.first.text)), findsOneWidget);
    });

    testWidgets('an older server: none of it, and the page as before', (tester) async {
      await pump(tester, labContract('ready'));
      await tester.scrollUntilVisible(find.text('Take another fresh paper'), 400, scrollable: _page);
      expect(find.byType(AcrossMocksView), findsNothing);
      expect(find.byType(RuleCheckView), findsNothing);
      expect(find.textContaining('Your rules'), findsNothing);
    });
  });
}
