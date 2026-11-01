// The app's cards_shared.dart held to the website's own cardsShared.js: every output of the web module (written by
// tool/learn2_parity/cards_shared.mjs into test/fixtures/learn2/parity/cards_shared.json) must come out of the Dart port exactly.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/cards/cards_shared.dart';

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/cards_shared.json').readAsStringSync()) as Map<String, dynamic>;
  final texts = (data['texts'] as List).cast<String>();
  final queries = (data['queries'] as List).cast<String?>();

  test('the run cap is the web\'s', () {
    expect(CardsShared.runCardsMax, data['runCardsMax']);
  });

  test('hitPattern makes the web\'s pattern for every query', () {
    for (final p in (data['patterns'] as List).cast<Map<String, dynamic>>()) {
      final q = p['q'] as String?;
      expect(CardsShared.hitSource(q), p['source'], reason: 'query "$q"');
      final re = CardsShared.hitPattern(q);
      expect(re == null, p['source'] == null);
      if (re != null) expect(re.isCaseSensitive, isFalse);
    }
  });

  test('hitParts marks the web\'s runs in ${data['hit'].length} text and query pairs, and never changes the text', () {
    for (final h in (data['hit'] as List).cast<Map<String, dynamic>>()) {
      final text = texts[h['t'] as int];
      final query = queries[h['q'] as int];
      final parts = CardsShared.hitParts(text, query);
      expect(parts.map((p) => p.text).join(), text, reason: 'text ${h['t']} query ${h['q']}');
      var at = 0;
      final runs = <List<int>>[];
      for (final p in parts) {
        if (p.hit) runs.add([at, at + p.text.length]);
        at += p.text.length;
      }
      expect(runs, (h['runs'] as List).map((r) => (r as List).cast<int>()).toList(), reason: 'text ${h['t']} "${text.length > 40 ? text.substring(0, 40) : text}" query "$query"');
      expect(parts.length, h['n'], reason: 'text ${h['t']} query ${h['q']}');
      // No two neighbours say the same thing: every run alternates, and no run is empty.
      if (text.isNotEmpty) {
        for (final p in parts) {
          expect(p.text, isNotEmpty);
        }
      }
    }
  });

  test('hitParts of nothing is one run', () {
    expect(CardsShared.hitParts(null, 'goodwill'), [(text: '', hit: false)]);
    expect(CardsShared.hitParts('Goodwill', null), [(text: 'Goodwill', hit: false)]);
    expect(CardsShared.hitParts('Goodwill is', 'goodwill'), [(text: 'Goodwill', hit: true), (text: ' is', hit: false)]);
  });

  test('snippet cuts the web\'s way in ${data['snippets'].length} cases', () {
    for (final s in (data['snippets'] as List).cast<Map<String, dynamic>>()) {
      final text = texts[s['t'] as int];
      final query = queries[s['q'] as int];
      final max = s['max'] as int?;
      final out = max == null ? CardsShared.snippet(text, query) : CardsShared.snippet(text, query, max: max);
      expect(out, s['out'], reason: 'text ${s['t']} query "$query" max $max');
    }
  });

  test('flat puts the NCERT line on one line as the web does', () {
    for (final f in (data['flats'] as List).cast<Map<String, dynamic>>()) {
      expect(CardsShared.flat(f['in'] as String?), f['out'], reason: 'in ${jsonEncode(f['in'])}');
    }
  });

  test('subjectLabel names a subject as the web does', () {
    for (final s in (data['subjectLabels'] as List).cast<Map<String, dynamic>>()) {
      expect(CardsShared.subjectLabel(s['id'] as String?), s['out'], reason: 'id ${s['id']}');
    }
  });

  test('withParams writes a link as URLSearchParams does', () {
    for (final p in (data['params'] as List).cast<Map<String, dynamic>>()) {
      final extra = <String, Object?>{
        for (final e in (p['extra'] as Map<String, dynamic>).entries) e.key: e.value is Map ? null : e.value,
      };
      expect(CardsShared.withParams(p['href'] as String, extra), p['out'], reason: '${p['href']} $extra');
    }
  });

  test('countWord says one and many as the web does', () {
    for (final c in (data['counts'] as List).cast<Map<String, dynamic>>()) {
      final many = c['many'] as String?;
      final out = many == null ? CardsShared.countWord(c['n'] as int, c['one'] as String) : CardsShared.countWord(c['n'] as int, c['one'] as String, many);
      expect(out, c['out']);
    }
  });
}
