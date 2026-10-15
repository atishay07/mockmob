import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';

/// The website's lab contracts, copied byte for byte from `data/tests/fixtures/mistake_lab/`.
Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

void main() {
  group('the three contracts parse', () {
    test('ready: every group, the headline, the re-mark, the cohort and how others answered', () {
      final lab = MistakeLab.tryParse(contract('ready'))!;
      expect(lab.state, MistakeLab.ready);
      expect(lab.showsLedger, isTrue);
      expect(lab.labels.name, 'Mistake Lab');
      expect(lab.labels.othersTitle, 'How others answered');
      expect(lab.labels.showMoreFor(3), 'Show 3 more');
      expect(lab.heading, "You missed 112 marks. Here's where they went.");
      expect(lab.gap, 112);
      expect(lab.headline!.group, LabGroup.neverOpened);
      expect([for (final g in lab.groups) g.id], [
        LabGroup.changedFromRight,
        LabGroup.neverOpened,
        LabGroup.longStay,
        LabGroup.quickWrong,
        LabGroup.otherWrong,
        LabGroup.otherBlank,
        LabGroup.held,
      ]);
      expect([for (final g in lab.groups) if (g.open) g.id], [LabGroup.neverOpened]);
      expect(lab.groups.first.numbers, [17, 31]);
      expect(lab.remark!.first, 144);
      expect(lab.remark!.last, 139);
      expect(lab.remark!.questions, 5);
      expect(lab.cohort!.numbers, [12, 22, 42]);
      expect(lab.cohort!.fine, hasLength(2));
      final q17 = lab.othersFor('q17')!;
      expect(q17.n, 31);
      expect(q17.counts, [3, 8, 1, 19]);
      expect(q17.keyIndex, 3);
      expect(q17.labelFor(1), 'Option B: chosen by 8 of 31 other students.');
      expect(q17.shareOf(3), closeTo(19 / 31, 1e-9));
      // A question in a group but without enough other students has no counts.
      expect(lab.byQuestion['q45']!.group, LabGroup.neverOpened);
      expect(lab.othersFor('q45'), isNull);
      expect(lab.othersFor('q99'), isNull);
    });

    test('basic: wrong and blank only, with the time read fine line', () {
      final lab = MistakeLab.tryParse(contract('basic'))!;
      expect(lab.state, MistakeLab.basic);
      expect(lab.showsLedger, isTrue);
      expect([for (final g in lab.groups) g.id], [LabGroup.wrong, LabGroup.blank]);
      expect(lab.headline, isNull);
      expect(lab.remark, isNull);
      expect(lab.cohort, isNull);
      expect(lab.fine.single, endsWith('The split shows wrong and blank only.'));
    });

    test('none: the heading only, and no ledger', () {
      final lab = MistakeLab.tryParse(contract('none'))!;
      expect(lab.state, MistakeLab.none);
      expect(lab.showsLedger, isFalse);
      expect(lab.groups, isEmpty);
      expect(lab.heading, "You didn't miss a mark this session.");
    });

    for (final name in ['ready', 'basic', 'none']) {
      test('$name: the group marks add up to the marks missed, and every string is filled', () {
        final lab = MistakeLab.tryParse(contract(name))!;
        expect(lab.groups.fold<int>(0, (s, g) => s + g.marks), lab.gap);
        final strings = <String>[
          lab.heading,
          lab.labels.name,
          lab.labels.othersTitle,
          lab.labels.showMore,
          lab.labels.seeChanges,
          ?lab.headline?.text,
          ?lab.barLabel,
          ?lab.remark?.text,
          ?lab.remark?.fine,
          ?lab.cohort?.line,
          ...?lab.cohort?.fine,
          ...lab.fine,
          for (final g in lab.groups) ...[g.label, g.line, ?g.doLine],
          for (final q in lab.byQuestion.values) ...[?q.others?.line, ...?q.others?.optionLabels],
        ];
        for (final s in strings) {
          expect(s.trim(), isNotEmpty);
          // The copy rules: no exclamation mark, no em dash, no middle dot.
          expect(s.contains('!') || s.contains('—') || s.contains('·'), isFalse, reason: s);
        }
        for (final q in lab.byQuestion.values) {
          final o = q.others;
          if (o == null) continue;
          expect(o.counts.fold<int>(0, (s, c) => s + c), o.n);
          expect(o.optionLabels, hasLength(o.counts.length));
        }
      });
    }
  });

  group('a missing or bad lab is null, so the result keeps today\'s breakdown', () {
    test('missing, not an object, or an unknown state', () {
      expect(MistakeLab.tryParse(null), isNull);
      expect(MistakeLab.tryParse('ready'), isNull);
      expect(MistakeLab.tryParse(<String, dynamic>{}), isNull);
      expect(MistakeLab.tryParse({...contract('ready'), 'state': 'later'}), isNull);
      expect(MistakeLab.tryParse({...contract('ready'), 'heading': ' '}), isNull);
    });

    test('groups that do not add up to the marks missed', () {
      expect(MistakeLab.tryParse({...contract('ready'), 'gap': 113}), isNull);
      final groups = [for (final g in contract('ready')['groups'] as List) Map<String, dynamic>.from(g as Map)];
      groups[2]['marks'] = 'many';
      expect(MistakeLab.tryParse({...contract('ready'), 'groups': groups}), isNull);
      expect(MistakeLab.tryParse({...contract('basic'), 'groups': <Object>[]}), isNull);
    });

    test('an unreadable others block is dropped on its own', () {
      final j = contract('ready');
      final by = Map<String, dynamic>.from(j['byQuestion'] as Map);
      by['q17'] = {
        'group': 'changed_from_right',
        'others': {'n': 31, 'right': 19, 'counts': [3, 8, 1, 18], 'line': 'Counts that do not add up.'},
      };
      final lab = MistakeLab.tryParse({...j, 'byQuestion': by})!;
      expect(lab.othersFor('q17'), isNull);
      expect(lab.byQuestion['q17']!.group, LabGroup.changedFromRight);
      expect(lab.othersFor('q22'), isNotNull);
    });

    test('unknown fields are ignored', () {
      final lab = MistakeLab.tryParse({...contract('ready'), 'replay': {'rows': 6}, 'version': 1})!;
      expect(lab.gap, 112);
    });
  });

  test('AttemptDetail reads lab beside swot, and leaves it null when absent', () {
    final base = {
      'id': 'a1',
      'subject': 'accountancy',
      'details': <Object>[],
      'questionsSnapshot': <Object>[],
      'selectionMeta': <String, Object>{},
    };
    expect(AttemptDetail.fromJson(base).lab, isNull);
    expect(AttemptDetail.fromJson({...base, 'lab': contract('ready')}).lab!.gap, 112);
    expect(AttemptDetail.fromJson({...base, 'lab': 'broken'}).lab, isNull);
  });
}
