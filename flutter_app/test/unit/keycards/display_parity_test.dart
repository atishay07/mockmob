// The app's display functions against the website's `kinds.js` over real cards: the file
// `support/display_parity.json` holds each card with what the web shows for it (reference, face, mid-sentence flag,
// and the back's lines, formula or entry rows), written by a node script that imports the web's own functions. Every
// card is checked on every output, so a rule that drifts on one real card fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/keycards/data/keycards_lines.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';

void main() {
  final data = jsonDecode(File('test/unit/keycards/support/display_parity.json').readAsStringSync()) as Map<String, dynamic>;
  final cases = (data['cards'] as List).cast<Map<String, dynamic>>();

  test('the fixture holds the cards the review asked for', () {
    expect(cases.length, greaterThan(300));
    final kinds = {for (final c in cases) (c['card'] as Map)['kind']};
    expect(kinds, containsAll(['entry', 'formula', 'list', 'steps', 'types', 'usage', 'word']));
  });

  group('per card', () {
    for (final c in cases) {
      final raw = c['card'] as Map<String, dynamic>;
      final want = c['expect'] as Map<String, dynamic>;
      test('${raw['id']}', () {
        final card = KeyCard.tryParse(raw)!;
        expect(sourceLine(card.source), want['ref'], reason: 'reference line');
        final face = cardFace(card);
        final wantFace = want['face'] as Map<String, dynamic>;
        expect((face.label, face.front), (wantFace['label'], wantFace['front']), reason: 'face');
        expect(startsMidSentence(card.back, card), want['mid'], reason: 'mid-sentence flag');
        expect(card.source.isNcert, want['ncert']);
        _backMatches(card, want['back'] as Map<String, dynamic>);
      });
    }
  });

  group('book names and chapter references', () {
    for (final (i, b) in (data['bookNames'] as List).cast<Map<String, dynamic>>().indexed) {
      test('bookName $i', () {
        final s = b['source'] as Map<String, dynamic>;
        expect(bookName(code: s['code'] as String?, book: s['book'] as String?), b['expect']);
      });
    }
    for (final (i, r) in (data['chapterRefs'] as List).cast<Map<String, dynamic>>().indexed) {
      test('chapterRef $i', () {
        final ncert = r['ncert'] as Map<String, dynamic>?;
        final opts = r['opts'] as Map<String, dynamic>;
        expect(
          chapterRef(ncert?['book'] as String?, (ncert?['chapter'] as num?)?.toInt(), title: opts['title'] as String?, unit: opts['unit'] as String?),
          r['expect'],
        );
      });
    }
  });
}

void _backMatches(KeyCard card, Map<String, dynamic> want) {
  final shape = backShape(card);
  switch (want['shape']) {
    case 'list':
      final s = shape as KcListBack;
      expect(s.bare, want['bare'], reason: 'bare list');
      expect(
        [for (final i in s.items) {'own': i.own, 'text': i.text}],
        [
          for (final i in want['items'] as List) {'own': (i as Map)['own'], 'text': i['text']},
        ],
        reason: 'list items',
      );
    case 'formula':
      final s = shape as KcFormulaBack;
      expect(
        [for (final l in s.lines) l.lhs != null ? {'lhs': l.lhs, 'rhs': l.rhs} : {'text': l.text}],
        [...(want['lines'] as List)],
        reason: 'formula lines',
      );
    case 'entry':
      final s = shape as KcEntryBack;
      const kinds = {
        KcEntryRowKind.debit: 'dr',
        KcEntryRowKind.credit: 'cr',
        KcEntryRowKind.narration: 'note',
        KcEntryRowKind.plain: 'text',
      };
      expect(
        [for (final r in s.rows) {'kind': kinds[r.kind], 'text': r.text, 'amount': r.amount}],
        [...(want['rows'] as List)],
        reason: 'entry rows',
      );
    case 'paras':
      expect((shape as KcParasBack).texts, (want['paras'] as List).cast<String>(), reason: 'paragraphs');
    default:
      fail('unknown shape ${want['shape']}');
  }
}
