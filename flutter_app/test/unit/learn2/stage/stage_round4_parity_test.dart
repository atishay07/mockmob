// The app's round 4 stage rules against the website's own: `test/fixtures/learn2/parity/stage_text.json` (sections `sci`, `end`,
// `pager`, written by tool/learn2_parity/stage_round4.mjs from the web's sciText.mjs, endModel.mjs and pagerModel.mjs) holds what
// the web returns for every Chemistry card's words, a grid of end screens, and the two new pager rules. Every case is checked
// on every output, so a rule that drifts on one real card or one end fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/learn2/stage/pager_model.dart';
import 'package:mockmob/features/learn2/stage/sci_text.dart';
import 'package:mockmob/features/learn2/stage/stage_end_model.dart';

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/stage_text.json').readAsStringSync()) as Map<String, dynamic>;
  final sci = data['sci'] as Map<String, dynamic>;
  final end = data['end'] as Map<String, dynamic>;
  final pager = data['pager'] as Map<String, dynamic>;
  List<Map<String, dynamic>> rows(Map<String, dynamic> from, String key) => (from[key] as List).cast<Map<String, dynamic>>();

  group('science notation (sciText.mjs)', () {
    test('the fixture holds real Chemistry words and every kind of notation', () {
      final cases = rows(sci, 'cases');
      expect(cases.length, greaterThan(500));
      final kinds = <String>{};
      for (final c in cases) {
        for (final p in (c['segments'] as List?) ?? const []) {
          kinds.add((p as List)[0] as String);
        }
      }
      expect(kinds, containsAll(['plain', 'sub', 'sup']));
    });

    test('every text splits as the web splits it', () {
      for (final c in rows(sci, 'cases')) {
        final text = c['text'] as String;
        final got = SciText.parse(text);
        final want = c['segments'] as List?;
        if (want == null) {
          // Plain: no notation at all, and the words come back whole (a lone hyphen is not a charge here).
          expect(SciText.hasSci(got), isFalse, reason: 'plain: "$text"');
          expect(got.map((p) => p.text).join(), text, reason: 'plain: "$text"');
        } else {
          expect(
            [for (final p in got) [p.kind.name, p.text]],
            want,
            reason: 'sciText of "$text"',
          );
        }
      }
    });

    test('the words the web holds in its own tests', () {
      String t(String x) => SciText.plain(SciText.parse(x));
      expect(t('SO42− and NH4+ ions'), 'SO₄²⁻ and NH₄⁺ ions');
      expect(t('Cl- and SO42- ions'), 'Cl⁻ and SO₄²⁻ ions');
      expect(t('CH3OH, (CH3)2NH, PbO2, H2SO4, C6H5OH'), 'CH₃OH, (CH₃)₂NH, PbO₂, H₂SO₄, C₆H₅OH');
      expect(t('2H2O and CuSO4·5H2O'), '2H₂O and CuSO₄·5H₂O');
      expect(t('[A]0 and [R]0'), '[A]₀ and [R]₀');
      expect(t('The half-life t1/2 is constant.'), 'The half-life t₁/₂ is constant.');
      expect(t('[Co(NH3)6]3+ is octahedral'), '[Co(NH₃)₆]³⁺ is octahedral');
      expect(t('[PtCl4]2– is square planar'), '[PtCl₄]²⁻ is square planar');
      expect(t('configuration 3d8.'), 'configuration 3d⁸.');
      expect(t('1s2 2s2 2p6'), '1s² 2s² 2p⁶');
      expect(t('for d4 (Cr2+, Mn3+), d6 (Fe2+, Co3+)'), 'for d⁴ (Cr²⁺, Mn³⁺), d⁶ (Fe²⁺, Co³⁺)');
      for (final plain in ['Table 2.4', 'Unit 4', 'p. 52', 'step 1', '373 K', 'SN1 and SN2, E1, E2', 'Vitamin B12', 'Class 12', 'pH 7', 'I- and F-', 'Part I-A']) {
        expect(SciText.hasSci(SciText.parse(plain)), isFalse, reason: plain);
        expect(SciText.parse(plain).map((p) => p.text).join(), plain);
      }
      expect(SciText.parse(''), isEmpty);
      expect(SciText.parse('SO42−'), [const SciSegment(SciKind.plain, 'SO'), const SciSegment(SciKind.sub, '4'), const SciSegment(SciKind.sup, '2−')]);
    });

    test('chemistry only: the card, else its chapter key, else the key given', () {
      for (final c in rows(sci, 'isChemistry')) {
        final card = c['card'] as Map<String, dynamic>?;
        final key = c['chapterKey'] as String?;
        final keyCard = card == null
            ? null
            : KeyCard(
                id: 'x',
                kind: 'definition',
                front: 'f',
                back: 'b',
                subject: card['subject'] as String? ?? '',
                chapterKey: card['chapterKey'] as String? ?? '',
              );
        expect(SciText.isChemistry(card: keyCard, chapterKey: key), c['out'], reason: 'isChemistry $c');
      }
    });
  });

  group('the end screen (endModel.mjs)', () {
    test('headline', () {
      for (final c in rows(end, 'headlines')) {
        expect(
          StageEndModel.endHeadline(reached: c['reached'], of: c['of'], minutes: c['minutes'], stopped: c['stopped'] as bool),
          c['out'],
          reason: 'endHeadline $c',
        );
      }
    });

    test('the return label of the Revise pile', () {
      for (final c in rows(end, 'reviseLabels')) {
        expect(StageEndModel.reviseLabel(c['groups']), c['out'], reason: 'reviseLabel $c');
      }
    });

    test('the numbers row: up to 3, zeros dropped, never "0 of 2"', () {
      final cases = rows(end, 'numbers');
      expect(cases.length, greaterThan(300));
      for (final c in cases) {
        final got = StageEndModel.endNumbers(
          revise: c['revise'],
          reviseText: c['reviseText'] as String,
          answered: c['answered'],
          right: c['right'],
          mistakes: c['mistakes'],
          fixed: c['fixed'],
        );
        expect([for (final n in got) {'value': n.value, 'n': n.n, 'label': n.label}], c['out'], reason: 'endNumbers $c');
        expect(got.length, lessThanOrEqualTo(3));
        for (final n in got) {
          expect(n.n, greaterThan(0));
          expect(n.value.startsWith('0'), isFalse, reason: 'no zero lead in ${n.value}');
        }
      }
    });

    test('the chapter bar and its label', () {
      for (final c in rows(end, 'progress')) {
        final input = c['input'] as Map<String, dynamic>?;
        final got = StageEndModel.endProgress(input);
        final want = c['out'] as Map<String, dynamic>?;
        expect(got == null ? null : {'from': got.from, 'to': got.to, 'label': got.label}, want, reason: 'endProgress $input');
      }
    });

    test('a mini card front is cut at a whole word', () {
      for (final c in rows(end, 'minis')) {
        final text = c['text'] as String;
        final max = (c['max'] as num).toInt();
        expect(StageEndModel.miniFront(text, max: max), c['out'], reason: 'miniFront($max) of "$text"');
      }
    });

    test('the pile card front size', () {
      for (final c in rows(end, 'pileSizes')) {
        expect(StageEndModel.pileFrontSize(c['text'] as String), c['out'], reason: 'pileFrontSize of "${c['text']}"');
      }
    });

    test('the checkpoint headline and line', () {
      for (final c in rows(end, 'checkpoints')) {
        final got = StageEndModel.checkpointLines(
          answered: c['answered'],
          right: c['right'],
          seen: c['seen'],
          kept: c['kept'],
          done: c['done'],
          of: c['of'],
          left: c['left'] as String?,
        );
        expect({'big': got.big, 'line': got.line}, c['out'], reason: 'checkpointLines $c');
      }
    });

    test('the stop sheet line', () {
      for (final c in rows(end, 'stopLines')) {
        expect(StageEndModel.stopSheetLine(c['done'], c['of']), c['out'], reason: 'stopSheetLine $c');
      }
    });

    test('"done" is the place of the last item the server holds an event for', () {
      for (final c in rows(end, 'reached')) {
        final held = (c['held'] as List).cast<bool>();
        expect(StageEndModel.reachedPlace<bool>(held, (h, _) => h, c['base'] as int), c['out'], reason: 'reachedPlace $c');
      }
    });

    test('Free\'s Or rows, in order, at most two', () {
      for (final c in rows(end, 'freeRows')) {
        final got = StageEndModel.freeUsedRows(c['data'] as Map<String, dynamic>?);
        expect([for (final r in got) {'id': r.id, 'label': r.label}], c['out'], reason: 'freeUsedRows ${c['data']}');
        expect(got.length, lessThanOrEqualTo(2));
      }
    });
  });

  group('the pager\'s new rules (pagerModel.mjs)', () {
    test('verdictScrollTop', () {
      final cases = rows(pager, 'verdicts');
      expect(cases.length, greaterThan(200));
      for (final c in cases) {
        final got = PagerModel.verdictScrollTop(
          boxTop: (c['boxTop'] as num).toDouble(),
          boxBottom: (c['boxBottom'] as num).toDouble(),
          scrollTop: (c['scrollTop'] as num).toDouble(),
          headTop: (c['headTop'] as num?)?.toDouble(),
          targetTop: (c['targetTop'] as num).toDouble(),
          targetBottom: (c['targetBottom'] as num).toDouble(),
          fade: (c['fade'] as num).toDouble(),
        );
        expect(got, c['out'], reason: 'verdictScrollTop $c');
      }
    });

    test('optionsBelow', () {
      double n(Object? x) => x is num ? x.toDouble() : double.parse(x as String);
      for (final c in rows(pager, 'below')) {
        expect(PagerModel.optionsBelow(optionTop: n(c['optionTop']), edge: n(c['edge'])), c['out'], reason: 'optionsBelow $c');
      }
    });
  });
}
