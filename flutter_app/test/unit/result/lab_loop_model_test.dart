import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';

/// The website's slice 3 contracts, copied byte for byte from `data/tests/fixtures/mistake_lab/`.
Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// Every string anywhere in [v].
Iterable<String> strings(Object? v) sync* {
  if (v is String) yield v;
  if (v is Map) {
    for (final e in v.values) {
      yield* strings(e);
    }
  }
  if (v is List) {
    for (final e in v) {
      yield* strings(e);
    }
  }
}

/// Mistake Lab v4 slice 3 models: Across your mocks, the Rule book, the rule check, the start
/// sheet's lines and the repair order, read from the website's own contracts.
void main() {
  group('the contracts parse', () {
    test('Across your mocks: 3 lines ranked by marks, 2 behind Show all, the basis', () {
      final a = AcrossMocks.tryParse(contract('across'))!;
      expect(a.state, AcrossMocks.ready);
      expect(a.isReady, isTrue);
      expect(a.title, 'Across your mocks');
      expect(a.mocks, 4);
      expect([for (final l in a.lines) l.id], [AcrossLine.neverOpened, AcrossLine.secondThoughts, AcrossLine.changesHelp]);
      expect([for (final l in a.more) l.id], [AcrossLine.lastTen, AcrossLine.longStays]);
      expect(a.lines.first.subject, 'accountancy');
      expect(a.lines.first.marks, 85);
      expect(a.lines.first.text, 'Never opened, last 3 Accountancy mocks, oldest first: 7, 6 and 4 of 50.');
      expect(a.showAll, 'Show all 5');
      expect(a.showFewer, 'Show fewer');
      expect(a.basis, startsWith("From your device's record of 4 timed mocks"));
      // The marks a change from right to wrong lost carry the minus sign, not a hyphen.
      expect(a.lines[1].text, contains('(−48)'));
    });

    test('the Rule book: repairs by chapter, the four habits, the rule in force', () {
      final book = RuleBook.tryParse(contract('rules')['book'])!;
      expect(book.title, 'Your rules');
      expect(book.count, 7);
      expect(book.countLabel, 'Your rules, 7');
      expect(book.labels.use, 'Use in my next mock');
      expect(book.labels.inUse, 'Your rule for your next mock');
      expect(book.active!.id, 'habit:never_opened');
      expect(book.active!.since, DateTime.utc(2026, 10, 15, 6, 30));
      expect([for (final c in book.repairs.chapters) c.chapter], ['Accounting Ratios', 'Share Capital', 'Cash Flow Statement']);
      expect(book.repairs.empty, isNull);
      final share = book.repairs.chapters[1].rules.single;
      expect(share.text, 'Calls in arrears are deducted from called-up capital, never added.');
      expect(share.hook, 'Arrears are owed to you, not paid.');
      expect(share.number, 11);
      expect(book.repairs.chapters.first.rules.single.hook, isNull);
      expect(book.habits.isReady, isTrue);
      expect([for (final h in book.habits.rules) h.id], ['habit:changes', 'habit:long_stay', 'habit:never_opened', 'habit:marked']);
      final marked = book.habits.rules.last;
      expect(marked.gated, isTrue);
      expect(marked.interval, isNull);
      expect(marked.evidence, 'This evidence opens at 15 marked answers. You have 4.');
      final changes = book.habits.rules.first.interval!;
      expect((changes.k, changes.n, changes.pct, changes.low, changes.high), (8, 23, 35, 19, 55));
      expect([for (final r in book.all) if (r.active) r.id], ['habit:never_opened']);
      // Seven rules: three from repairs and four habits.
      expect(book.all, hasLength(book.count));
    });

    test('the Lab summary and the playbook read', () {
      final rules = LabRules.tryParse(contract('rules')['summary'])!;
      expect(rules.countLabel, 'Your rules, 7');
      expect(rules.active!.text, 'Open every question once before you go deep on any.');
      final playbook = PlaybookRead.fromJson(contract('rules')['playbook']);
      expect(playbook.active!.id, 'habit:never_opened');
      expect(playbook.startSheet!.rule, 'Your rule for this mock: open every question once before you go deep on any.');
      expect(playbook.startSheet!.last, 'Last mock: 4 of 50 questions never opened.');
    });

    test('the rule check, one case per state', () {
      final cases = contract('rulecheck');
      final checks = {for (final e in cases.entries) e.key: RuleCheck.tryParse(e.value)!};
      expect(checks['not_kept']!.state, RuleCheck.notKept);
      expect(checks['not_kept']!.result, 'Not kept: 4 of 50 questions never opened (last mock: 4 of 50).');
      expect(checks['not_kept']!.numbers!.now, 4);
      expect(checks['not_kept']!.numbers!.lastTotal, 50);
      expect(checks['kept']!.state, RuleCheck.kept);
      expect(checks['kept']!.result, startsWith('Kept: every question opened'));
      expect(checks['counted']!.rule.kind, RuleRef.repair);
      expect(checks['counted']!.line, 'Your rule: Calls in arrears are deducted from called-up capital, never added.');
      expect(checks['not_checked']!.numbers, isNull);
      expect(checks['not_checked']!.fine, isNull);
      for (final c in checks.values) {
        expect(c.title, 'Your rule');
      }
    });

    test('the repair order: led items carry their key and evidence, the rest are paper order', () {
      final order = RepairOrder.tryParse(contract('repair_order'))!;
      expect(order.isCohort, isTrue);
      expect(order.qids, contract('repair_order')['qids']);
      final first = order.items.first;
      expect((first.qid, first.number, first.reason), ('q42', 42, RepairOrderItem.mostRight));
      expect(first.key, 'Repair Q42 first');
      expect(first.line, '18 of 22 other students got it right.');
      expect(order.items[3].reason, RepairOrderItem.commonTrap);
      expect(order.items[3].line, '8 of the 12 who got it wrong chose B, as you did.');
      expect([for (final i in order.items) if (!i.isLed) i.number], [3, 5, 19, 26, 31, 33, 38]);
    });

    test('GET /api/me/rules reads the book and the block together', () {
      final read = RulesRead.parse({'book': contract('rules')['book'], 'acrossMocks': contract('across')});
      expect(read.book!.count, 7);
      expect(read.acrossMocks!.lines, hasLength(3));
    });
  });

  group('copy rules hold in every sentence the app shows', () {
    for (final name in ['across', 'rules', 'rulecheck', 'repair_order']) {
      test(name, () {
        for (final s in strings(contract(name))) {
          expect(s.contains('!'), isFalse, reason: s);
          expect(s.contains('—'), isFalse, reason: 'em dash in "$s"');
          expect(s.contains('·'), isFalse, reason: 'middle dot in "$s"');
          expect(RegExp(r'\(-\d').hasMatch(s), isFalse, reason: 'a hyphen for minus in "$s"');
          // Never what a rule "gained": arithmetic only.
          expect(s.toLowerCase().contains('gained'), isFalse, reason: s);
        }
      });
    }
  });

  group('a part that cannot be read honestly is absent', () {
    test('Across your mocks', () {
      expect(AcrossMocks.tryParse(null), isNull);
      expect(AcrossMocks.tryParse({...contract('across'), 'state': 'soon'}), isNull);
      expect(AcrossMocks.tryParse({...contract('across'), 'lines': []}), isNull);
      // Below the gate it needs its sentence.
      expect(AcrossMocks.tryParse({...contract('across'), 'state': 'below_gate', 'message': null}), isNull);
      final below = AcrossMocks.tryParse({
        ...contract('across'),
        'state': 'below_gate',
        'message': 'Across your mocks opens at 2 timed mocks with a device record. You have 1.',
      })!;
      expect(below.lines, isEmpty);
      expect(below.more, isEmpty);
      expect(below.message, endsWith('You have 1.'));
      // A line without its sentence is left out; the rest stay.
      final lines = [...(contract('across')['lines'] as List)];
      lines[1] = {...lines[1] as Map, 'text': ''};
      expect(AcrossMocks.tryParse({...contract('across'), 'lines': lines})!.lines, hasLength(2));
    });

    test('the rule check', () {
      final kept = contract('rulecheck')['kept'] as Map<String, dynamic>;
      expect(RuleCheck.tryParse({...kept, 'state': 'improved'}), isNull);
      expect(RuleCheck.tryParse({...kept, 'rule': null}), isNull);
      expect(RuleCheck.tryParse({...kept, 'result': ''}), isNull);
    });

    test('the repair order: a key without its evidence is not a lead', () {
      final raw = contract('repair_order');
      final items = [...(raw['items'] as List)];
      items[0] = {...items[0] as Map, 'line': null};
      final order = RepairOrder.tryParse({...raw, 'items': items})!;
      expect(order.items.first.isLed, isFalse);
      expect(order.items.first.key, isNull);
      expect(RepairOrder.tryParse({...raw, 'state': 'trap'}), isNull);
      expect(RepairOrder.tryParse({...raw, 'items': []}), isNull);
    });

    test('a Wilson interval that does not hold together is dropped', () {
      expect(RuleInterval.tryParse({'k': 8, 'n': 23, 'pct': 35, 'low': 40, 'high': 55}), isNull);
      expect(RuleInterval.tryParse({'k': 30, 'n': 23, 'pct': 35, 'low': 19, 'high': 55}), isNull);
    });

    test('GET /api/me/rules with nothing readable is a failed read, not an empty one', () {
      expect(() => RulesRead.parse({'book': null, 'acrossMocks': null}), throwsFormatException);
      expect(() => RulesRead.parse([]), throwsFormatException);
    });
  });

  group('the Lab carries slice 3 beside slices 1 and 2', () {
    Map<String, dynamic> labWith(Map<String, dynamic> parts) => {
          ...jsonDecode(File('test/fixtures/mistake_lab/contract_ready_v1.json').readAsStringSync()) as Map<String, dynamic>,
          ...parts,
        };

    test('every part, from the result read', () {
      final lab = MistakeLab.tryParse(labWith({
        'acrossMocks': contract('across'),
        'repairOrder': contract('repair_order'),
        'rules': contract('rules')['summary'],
        'prove': {'ruleCheck': contract('rulecheck')['not_kept']},
      }))!;
      expect(lab.acrossMocks!.lines, hasLength(3));
      expect(lab.repairOrder!.items.first.key, 'Repair Q42 first');
      expect(lab.rules!.countLabel, 'Your rules, 7');
      expect(lab.ruleCheck!.state, RuleCheck.notKept);
      // The ledger is untouched.
      expect(lab.gap, 112);
    });

    test('an older server, or a part that failed on the server, leaves the rest of the Lab as it was', () {
      final old = MistakeLab.tryParse(labWith({}))!;
      expect((old.acrossMocks, old.repairOrder, old.rules, old.ruleCheck), (null, null, null, null));
      final failed = MistakeLab.tryParse(labWith({'acrossMocks': null, 'repairOrder': 'x', 'rules': null, 'prove': {'ruleCheck': null}}))!;
      expect((failed.acrossMocks, failed.repairOrder, failed.rules, failed.ruleCheck), (null, null, null, null));
      expect(failed.showsLedger, isTrue);
    });
  });

  test('a confirmed rule moves the in-force mark in the book', () {
    final book = RuleBook.tryParse(contract('rules')['book'])!;
    final next = book.withActive(const RuleRef(id: 'repair:6864871273367fbf6b15b814', kind: RuleRef.repair, text: 'Calls in arrears are deducted from called-up capital, never added.'));
    expect(next.active!.id, 'repair:6864871273367fbf6b15b814');
    expect([for (final r in next.all) if (r.active) r.id], ['repair:6864871273367fbf6b15b814']);
    expect(next.count, book.count);
  });
}
