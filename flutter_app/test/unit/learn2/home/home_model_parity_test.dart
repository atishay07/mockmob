// The app's Learn home rules against the website's own: `test/fixtures/learn2/parity/home_model.json` holds what the web's
// homeModel.mjs returns for every recorded subject read and a set of edge inputs (written by
// tool/learn2_parity/home_model.mjs, which imports the web's functions). Every output is checked, so a rule that drifts on
// one real chapter fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/home/home_model.dart';

Map<String, dynamic> _file(String name) => jsonDecode(File(name).readAsStringSync()) as Map<String, dynamic>;

List<LearnPart> _parts(Object? raw) => [for (final p in asJsonList(raw)) ?LearnPart.tryParse(p)];

List<LearnSuggestion> _suggestions(Object? raw) => [for (final s in asJsonList(raw)) ?LearnSuggestion.tryParse(s)];

List<String> _keys(List<HomeFlatRow> rows) => [for (final f in rows) f.row.key];

/// What the app's model says about one map, in the shape tool/learn2_parity/home_model.mjs writes.
void _expectMap(List<LearnPart> parts, Map<String, dynamic> want, String where) {
  expect(HomeModel.chapterTotal(parts), want['chapterTotal'], reason: '$where: chapterTotal');
  expect(HomeModel.allNotStarted(parts), want['allNotStarted'], reason: '$where: allNotStarted');
  expect(HomeModel.hasMarks(parts), want['hasMarks'], reason: '$where: hasMarks');
  expect([for (final s in HomeModel.sortsFor(parts)) s.id], want['sortsFor'], reason: '$where: sortsFor');
  final sorts = want['sorts'] as Map<String, dynamic>;
  for (final id in ['book', 'due', 'needs', 'marks']) {
    expect(_keys(HomeModel.sortRows(parts, id)), sorts[id], reason: '$where: sort $id');
  }
  expect(_keys(HomeModel.marksOrder(parts)), want['marksOrder'], reason: '$where: marksOrder');
  expect(
    [for (final f in HomeModel.flatRows(parts)) {'key': f.row.key, 'part': f.part.id, 'unit': f.unit.title, 'at': f.at}],
    want['flat'],
    reason: '$where: flatRows',
  );

  final rows = (want['rows'] as List).cast<Map<String, dynamic>>();
  final flat = HomeModel.flatRows(parts);
  expect(flat.length, rows.length, reason: '$where: row count');
  for (var i = 0; i < rows.length; i++) {
    final row = flat[i].row;
    final w = rows[i];
    final at = '$where: row ${row.key}';
    expect(row.key, w['key'], reason: at);
    expect(HomeModel.stateShape(row.state.key), w['shape'], reason: '$at: shape');
    expect(HomeModel.cardsText(row), w['cardsText'], reason: '$at: cardsText');
    expect(HomeModel.nothingToPlay(row), w['nothingToPlay'], reason: '$at: nothingToPlay');
    expect(HomeModel.metaLine(row), w['metaLine'], reason: '$at: metaLine');
    expect(HomeModel.marksText(row), w['marksText'], reason: '$at: marksText');
    expect(HomeModel.rowSpoken(row), w['spoken'], reason: '$at: spoken');
    expect(HomeModel.rowSpoken(row, marks: true), w['spokenMarks'], reason: '$at: spoken with marks');
    expect(HomeModel.displayTitle(row.title), w['title'], reason: '$at: displayTitle');
  }

  final wantParts = (want['parts'] as List).cast<Map<String, dynamic>>();
  expect(parts.length, wantParts.length, reason: '$where: part count');
  for (var p = 0; p < parts.length; p++) {
    final part = parts[p];
    final w = wantParts[p];
    final at = '$where: part ${part.id}';
    expect(part.id, w['id'], reason: at);
    expect(HomeModel.unitsSignature(part.units), w['signature'], reason: '$at: unitsSignature');
    final units = (w['units'] as List).cast<Map<String, dynamic>>();
    expect(part.units.length, units.length, reason: '$at: unit count');
    for (var u = 0; u < units.length; u++) {
      final unit = part.units[u];
      expect(unit.title, units[u]['title'], reason: '$at: unit $u title');
      expect(unit.optionId, units[u]['optionId'], reason: '$at: unit $u optionId');
      expect(HomeModel.unitHeading(unit), units[u]['heading'], reason: '$at: unit "${unit.title}" heading');
      expect(HomeModel.visibleRefs(unit.chapters), units[u]['refs'], reason: '$at: unit $u refs');
      expect(HomeModel.visibleRefs(unit.chapters, always: true), units[u]['refsAlways'], reason: '$at: unit $u refs, always');
    }
    for (final e in (w['effective'] as List).cast<Map<String, dynamic>>()) {
      final local = e['local'] as String?;
      expect(HomeModel.effectiveChoice(part, {'${part.id}': ?local}), e['out'], reason: '$at: effectiveChoice with $local');
    }
    final shown = w['shown'] as Map<String, dynamic>;
    for (final e in shown.entries) {
      final choice = e.key == '' ? null : e.key;
      expect(HomeModel.unitsSignature(HomeModel.shownOptionUnits(part.units, choice)), e.value, reason: '$at: shown for "${e.key}"');
    }
    final counts = w['optionCounts'] as Map<String, dynamic>;
    for (final e in counts.entries) {
      expect(HomeModel.optionChapterCount(part.units, e.key), e.value, reason: '$at: option ${e.key} count');
    }
  }
}

void _expectSuggestions(List<LearnSuggestion> list, Map<String, dynamic> want, String where) {
  expect([for (final s in HomeModel.homeSuggestions(list)) s.title], want['home'], reason: '$where: homeSuggestions');
  final all = (want['all'] as List).cast<Map<String, dynamic>>();
  expect(list.length, all.length, reason: '$where: count');
  for (var i = 0; i < all.length; i++) {
    final s = list[i];
    final w = all[i];
    final at = '$where: ${s.kind} "${s.title}"';
    expect(s.kind, w['kind'], reason: at);
    final split = HomeModel.splitTitle(s);
    expect({'headline': split.headline, 'rest': split.rest}, w['split'], reason: '$at: splitTitle');
    final progress = HomeModel.pickupProgress(s);
    expect(progress == null ? null : {'done': progress.done, 'of': progress.of}, w['progress'], reason: '$at: pickupProgress');
    final target = HomeModel.suggestionTarget(s);
    expect(
      switch (target) {
        HomeRunTarget(:final run) => {'type': 'run', 'chapterKey': run.chapterKey},
        HomeHrefTarget(:final href) => {'type': 'href', 'href': href},
        null => null,
      },
      w['target'],
      reason: '$at: suggestionTarget',
    );
    expect(HomeModel.displayTitle(s.title), w['displayTitle'], reason: '$at: displayTitle');
  }
}

void main() {
  final data = _file('test/fixtures/learn2/parity/home_model.json');
  List<Map<String, dynamic>> rows(String key) => (data[key] as List).cast<Map<String, dynamic>>();

  test('the fixture holds every recorded subject, the edge maps, the shelves and the titles', () {
    final counts = data['counts'] as Map<String, dynamic>;
    expect(counts['subjects'], 8);
    expect(counts['rows'], greaterThan(120));
    expect(counts['displayTitles'], greaterThan(150));
    expect(rows('edgeParts').length, greaterThanOrEqualTo(8));
    expect(rows('edgeSuggestions').length, greaterThanOrEqualTo(4));
    expect(rows('shelves').length, greaterThanOrEqualTo(7));
  });

  test('the sorts are the website\'s, in the website\'s order', () {
    final sorts = (data['sorts'] as List).cast<Map<String, dynamic>>();
    expect([for (final s in HomeModel.sorts) {'id': s.id, 'label': s.label}], sorts);
  });

  group('every recorded subject read', () {
    for (final s in rows('subjects')) {
      final name = s['name'] as String;
      final raw = _file('test/fixtures/learn2/$name.json');
      final parsed = LearnSubjectData.parse(raw);

      test('$name: the line under the subject, the field and the map', () {
        expect(HomeModel.subjectLine(parsed.subject), s['subjectLine']);
        expect(HomeModel.searchPlaceholder(parsed.subject.cards), s['placeholder']);
        _expectMap(parsed.parts, s['map'] as Map<String, dynamic>, name);
      });

      test('$name: the suggestions', () {
        _expectSuggestions(parsed.suggestions, s['suggestions'] as Map<String, dynamic>, name);
      });
    }
  });

  group('edge maps', () {
    for (final e in rows('edgeParts')) {
      test(e['name'] as String, () {
        _expectMap(_parts(e['parts']), e['map'] as Map<String, dynamic>, e['name'] as String);
      });
    }
  });

  group('edge suggestions', () {
    for (final e in rows('edgeSuggestions')) {
      test(e['name'] as String, () {
        _expectSuggestions(_suggestions(e['list']), e, e['name'] as String);
      });
    }
  });

  group('shelves', () {
    for (final e in rows('shelves')) {
      test(e['name'] as String, () {
        final shelves = LearnShelves.parse(e['shelves']);
        for (final k in (e['keys'] as List).cast<Map<String, dynamic>>()) {
          final name = k['subjectName'] as String;
          expect(
            [
              for (final key in HomeModel.shelfKeys(shelves, name)) {'id': key.id, 'count': key.count, 'label': key.label, 'zero': key.zero, 'name': key.name},
            ],
            k['keys'],
            reason: 'shelfKeys for "$name"',
          );
        }
        for (final h in (e['heads'] as List).cast<Map<String, dynamic>>()) {
          final head = HomeModel.setHead(h['id'] as String, count: h['count'] as int, chapters: h['chapters'] as int, shelves: shelves);
          expect({'title': head.title, 'line': head.line}, h['out'], reason: 'setHead ${h['id']} ${h['count']} ${h['chapters']}');
        }
      });
    }
    test('nothing read gives no tiles', () => expect(HomeModel.shelfKeys(null), isEmpty));
  });

  test('titles read with "and" for a slash between words and a comma for a spaced one', () {
    for (final t in rows('displayTitles')) {
      expect(HomeModel.displayTitle(t['text'] as String), t['out'], reason: 'displayTitle of "${t['text']}"');
    }
  });

  test('plurals', () {
    for (final p in rows('plurals')) {
      final many = p['many'] as String?;
      final n = p['n'] as int;
      final one = p['one'] as String;
      expect(many == null ? HomeModel.plural(n, one) : HomeModel.plural(n, one, many), p['out']);
    }
  });

  test('the line of counts under a subject', () {
    for (final l in rows('subjectLines')) {
      final raw = l['subject'];
      final info = raw == null ? null : LearnSubjectInfo.parse(raw);
      expect(HomeModel.subjectLine(info), l['out'], reason: '${l['subject']}');
    }
  });

  test('the field\'s placeholder', () {
    for (final p in rows('placeholders')) {
      expect(HomeModel.searchPlaceholder(p['cards'] as int?), p['out']);
    }
  });

  test('a shelf named in the address', () {
    for (final p in rows('shelfParams')) {
      expect(HomeModel.shelfFromParam(p['value'] as String), p['out'], reason: '${p['value']}');
    }
  });

  test('India\'s day, as the service counts a Free session', () {
    for (final d in rows('istDays')) {
      final at = DateTime.fromMillisecondsSinceEpoch(d['ms'] as int, isUtc: true);
      expect(HomeModel.istDay(at), d['out'], reason: '${d['ms']}');
    }
  });
}
