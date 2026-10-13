// The Dart port of the website's DU tools must give the website's answers on the same data.
// The oracle (fixtures/du_oracle_2026.json) is produced by the site's own src/lib/du code.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/domain/du_combos.dart';
import 'package:mockmob/features/tools/domain/du_eligibility.dart';
import 'package:mockmob/features/tools/domain/du_helpers.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';

Map<String, dynamic> _json(String path) => (jsonDecode(File(path).readAsStringSync()) as Map).cast<String, dynamic>();

void main() {
  final catalog = DuCatalog.fromJson(_json('assets/du/2026/index.json'));
  final oracle = _json('test/unit/tools/fixtures/du_oracle_2026.json');

  DuSelection sel(List<String> l, List<String> d, {bool gat = false}) => DuSelection(languages: l, domains: d, gat: gat);
  final cases = {
    'commerce': sel(['english'], ['accountancy', 'business_studies', 'economics']),
    'commerceMaths': sel(['english'], ['accountancy', 'business_studies', 'economics', 'mathematics'], gat: true),
    'pcm': sel(['english'], ['physics', 'chemistry', 'mathematics']),
    'noAcc': sel(['english'], ['business_studies', 'economics']),
    'humanities': sel(['english', 'hindi'], ['history', 'political_science', 'economics']),
  };

  test('the catalogue is the full 2026 index', () {
    expect(catalog.groups, hasLength(73));
    expect(catalog.languages, hasLength(14));
    expect(catalog.domains, hasLength(22));
    expect(catalog.meta.categories, hasLength(11));
    expect(catalog.meta.sources, hasLength(4));
  });

  for (final entry in cases.entries) {
    test('eligibility and unlocks match the website: ${entry.key}', () {
      final expected = oracle[entry.key] as Map<String, dynamic>;
      final eligible = [for (final v in duEvaluateAll(catalog.groups, entry.value)) if (v.eligible) v.group.id]..sort();
      expect(eligible, (expected['eligible'] as List).cast<String>());
      final unlocks = [for (final u in duSuggestUnlocks(catalog, entry.value)) [u.pick.id, u.unlocks]];
      expect(unlocks, expected['unlocks']);
    });
  }

  test('B.Com. (Hons.) without Accountancy and Mathematics names the exact missing rules', () {
    final bcom = catalog.group('b-com-hons')!;
    final rules = duExplainCombinations(bcom, cases['noAcc']!, catalog);
    expect([for (final r in rules) [r.label, r.ok, r.missing]], oracle['bcomNoAcc']);
    expect(duEvaluateGroup(bcom, cases['commerce']!).eligible, isTrue);
  });

  test('a score of 650 gets the website seat status at every B.Com. (Hons.) college, UR and OBC-NCL', () {
    final off = DuOfferings.fromJson(_json('test/unit/tools/fixtures/b-com-hons.json'));
    for (final (key, cat) in [('bcomSeats650', 0), ('bcomSeats650OBC', 1)]) {
      final got = [for (final s in off.seats) [s.college, duSeatStatus(650, s, cat).id.name]];
      expect(got, oracle[key], reason: key);
    }
  });

  List<Object> comboShape(DuComboPlan plan, {bool gaps = false}) => [
        for (final r in plan.ranked)
          [
            [for (final i in r.items) '${i.kind == DuPickKind.gat ? 'gat' : i.kind.name}:${i.id}'],
            r.unlocked,
            r.met.length,
            gaps
                ? [
                    for (final m in r.missed)
                      [
                        m.id,
                        [
                          for (final g in m.nearest!.gaps)
                            '${switch (g.kind) {
                              DuGapKind.language => 'language',
                              DuGapKind.anyLanguage => 'any-language',
                              DuGapKind.domain => 'domain',
                              DuGapKind.anyDomain => 'any-domain',
                              DuGapKind.gat => 'gat',
                            }}:${g.id ?? g.count}',
                        ],
                      ],
                  ]
                : [for (final m in r.missed) m.id],
          ],
      ];

  const pool = [
    DuPick.language('english'),
    DuPick.domain('accountancy'),
    DuPick.domain('business_studies'),
    DuPick.domain('economics'),
    DuPick.domain('mathematics'),
    DuPick.gat(),
  ];

  test('the Combo planner ranks exactly as the website (5 papers)', () {
    final plan = duPlanCombos(groups: catalog.groups, pool: pool, targets: ['b-com-hons', 'b-a-hons-economics']);
    final expected = oracle['combo'] as Map<String, dynamic>;
    expect(comboShape(plan), expected['ranked']);
    expect([for (final k in plan.keep) '${k.kind.name}:${k.id}'], expected['keep']);
  });

  test('the Combo planner ranks exactly as the website (3 papers, with gaps)', () {
    final plan = duPlanCombos(groups: catalog.groups, pool: pool, targets: ['b-com-hons', 'b-a-hons-economics'], maxPapers: 3);
    final expected = oracle['combo3'] as Map<String, dynamic>;
    expect(comboShape(plan, gaps: true), expected['ranked']);
    expect(plan.keep, isEmpty);
  });

  group('helpers', () {
    test('the finder maps the names students use to one CUET subject', () {
      final ip = duSearchSubjects('IP', catalog);
      expect(ip.domains, contains('computer_science'));
      expect(duSearchSubjects('accounts', catalog).domains, ['accountancy']);
      expect(duSearchSubjects('a', catalog).domains, isEmpty);
    });

    test('selections round-trip through the website form and read the profile ids', () {
      final s = DuSelection.fromIds(['english', 'accountancy', 'general_test', 'nonsense'], catalog);
      expect(s.languages, ['english']);
      expect(s.domains, ['accountancy']);
      expect(s.gat, isTrue);
      expect(DuSelection.decode(s.encode(), catalog), s);
    });

    test('scores parse from 0 to 1000 only and format with one decimal', () {
      expect(duParseScore('650'), 650);
      expect(duParseScore('1001'), isNull);
      expect(duParseScore(''), isNull);
      expect(duFormatScore(732.2243), '732.2');
      expect(duFormatScore(null), '–');
    });

    test('the effective cutoff is the lower of UR and the category, flagged when UR', () {
      expect(duEffectiveCutoff([700, 600], 1), 600);
      expect(duEffectiveCutoff([500, 600], 1), 500);
      expect(duViaUr([500, 600], 1), isTrue);
      expect(duViaUr([700, 600], 1), isFalse);
      expect(duEffectiveCutoff([null, null], 1), isNull);
    });
  });
}
