// The app's chapter rules against the website's own: `test/fixtures/learn2/parity/chapter_model.json` holds what the web's
// chapterModel.mjs (and `minutesFor` of runMath.js) return for every preview the server recorded, the cases of the web's
// own test and a set of edge inputs (written by tool/learn2_parity/chapter_model.mjs, which imports the web's functions).
// Every case is checked on every output, so a word that drifts on one real answer fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/chapter/chapter_model.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/chapter_model.json').readAsStringSync()) as Map<String, dynamic>;
  List<Map<String, dynamic>> rows(String key) => (data[key] as List).cast<Map<String, dynamic>>();

  test('the fixture holds every recorded preview, the web cases and the edges', () {
    final counts = data['counts'] as Map<String, dynamic>;
    expect(counts['previews'], greaterThanOrEqualTo(13));
    expect(counts['chapters'], greaterThanOrEqualTo(20));
    expect(counts['piles'], greaterThanOrEqualTo(100));
    expect(counts['quiet'], greaterThanOrEqualTo(30));
    expect(counts['shelves'], greaterThanOrEqualTo(24));
    // Every rule shows at least once: a unit that is shown, a mistakes pile "of 3", a held pile, each quiet line, a locked row.
    expect(rows('chapters').where((c) => (c['out'] as Map)['eyebrow'] != null), isNotEmpty);
    expect(rows('piles').where((p) => ((p['view'] as Map)['of']) != null), isNotEmpty);
    expect(rows('piles').where((p) => ((p['view'] as Map)['state']) == 'held'), isNotEmpty);
    expect(rows('quiet').map((q) => q['out']).whereType<String>().toSet().length, greaterThanOrEqualTo(6));
    expect(rows('shelves').any((s) => ((s['out'] as Map)['rows'] as List).any((r) => (r as Map)['locked'] == true)), isTrue);
  });

  test('the head: the unit only when it does not repeat the title, and the ref "Part 1, Ch 2"', () {
    for (final c in rows('chapters')) {
      final lines = ChapterModel.headLines(LearnChapterHead.parse(c['chapter']));
      expect({'eyebrow': lines.eyebrow, 'ref': lines.ref}, c['out'], reason: '${c['name']}');
    }
  });

  test('the short part name', () {
    for (final p in rows('partShorts')) {
      expect(ChapterModel.partShort(p['title'] as String?), p['out'], reason: 'partShort of ${p['title']}');
    }
  });

  test('a pile: its minutes, its state, its line, "2 of 3", its note and its spoken label', () {
    for (final c in rows('piles')) {
      final pile = ChapterPile.fromJson(c['pile'] as Map<String, dynamic>);
      expect(ChapterModel.pileMinutes(pile), c['minutes'], reason: '${c['name']} minutes');
      final v = ChapterModel.pileView(pile);
      expect({'state': v.state.wire, 'line': v.line, 'of': v.of, 'note': v.note, 'aria': v.aria}, c['view'], reason: '${c['name']} view');
    }
  });

  test('the quiet line under Start, by priority, for every recorded answer and every rule', () {
    for (final c in rows('quiet')) {
      expect(ChapterModel.quietLine(LearnPreview.parse(c['data'])), c['out'], reason: '${c['name']}');
    }
  });

  test('"Everything in this chapter": the rows, their lines and what is missing', () {
    for (final c in rows('shelves')) {
      final view = ChapterModel.shelfView(LearnPreview.parse(c['data']), mistakeMinutes: (n) => ChapterModel.minutesFor(n * 60));
      final out = {
        'rows': [
          for (final r in view.rows) {'id': r.id, 'title': r.title, 'line': r.line, 'locked': r.locked, 'link': r.link, 'action': r.action},
        ],
        'missing': view.missing,
      };
      expect(out, c['out'], reason: '${c['name']}');
    }
  });

  test('a chapter that is not in the book list', () {
    for (final c in rows('errors')) {
      final e = c['error'] as Map<String, dynamic>;
      final kind = LearnErrorKind.values.firstWhere((k) => k.wire == e['kind'], orElse: () => LearnErrorKind.error);
      final error = LearnError(kind: kind, status: e['status'] as int?, code: e['code'] as String?);
      expect(ChapterModel.isChapterMissing(error), c['out'], reason: '$e');
    }
    // Anything that is not a Learn error is not a missing chapter.
    expect(ChapterModel.isChapterMissing(null), isFalse);
    expect(ChapterModel.isChapterMissing(StateError('x')), isFalse);
  });

  test("Learn's one minutes rule", () {
    for (final m in rows('minutes')) {
      expect(ChapterModel.minutesFor(m['seconds'] as num), m['out'], reason: 'minutesFor ${m['seconds']}');
    }
  });
}
