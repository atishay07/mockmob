// The app's Learn home rules against the website's own (rounds 2 to 4): `test/fixtures/learn2/parity/home_model.json` holds what the
// web's homeModel.mjs returns for every recorded subject and home read and a set of edge inputs (written by
// tool/learn2_parity/home_model.mjs, which imports the web's functions). Every output is checked, so a rule that drifts on one real
// chapter fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/home/home_model.dart';

Map<String, dynamic> _file(String name) => jsonDecode(File(name).readAsStringSync()) as Map<String, dynamic>;

List<LearnPart> _parts(Object? raw) => [for (final p in asJsonList(raw)) ?LearnPart.tryParse(p)];

List<String> _keys(List<HomeFlatRow> rows) => [for (final f in rows) f.row.key];

/// What the app's model says about one map, in the shape tool/learn2_parity/home_model.mjs writes.
void _expectMap(List<LearnPart> all, Map<String, dynamic> want, String where) {
  final parts = HomeModel.playableParts(all);
  expect(
    [
      for (final p in parts)
        {
          'id': p.id,
          'hasOption': p.option != null,
          'units': [
            for (final u in p.units) {'title': u.title, 'optionId': u.optionId, 'chapters': [for (final c in u.chapters) c.key]},
          ],
        },
    ],
    want['playable'],
    reason: '$where: playableParts',
  );
  expect(HomeModel.chapterTotal(parts), want['chapterTotal'], reason: '$where: chapterTotal');
  expect(HomeModel.hasMarks(parts), want['hasMarks'], reason: '$where: hasMarks');
  expect([for (final s in HomeModel.sortsFor(parts)) s.id], want['sortsFor'], reason: '$where: sortsFor');
  final sorts = want['sorts'] as Map<String, dynamic>;
  for (final id in ['book', 'due', 'needs', 'marks']) {
    expect(_keys(HomeModel.sortRows(parts, id)), sorts[id], reason: '$where: sort $id');
  }
  expect(_keys(HomeModel.marksOrder(parts)), want['marksOrder'], reason: '$where: marksOrder');
  final flat = HomeModel.flatRows(parts);
  expect([for (final f in flat) {'key': f.row.key, 'part': f.part.id, 'unit': f.unit.title, 'at': f.at}], want['flat'], reason: '$where: flatRows');
  final rowsOnly = [for (final f in flat) f.row];
  final freeEach = want['freeEach'] as Map<String, dynamic>;
  expect(HomeModel.freeEach(rowsOnly, true), freeEach['pro'], reason: '$where: freeEach on Pro');
  expect(HomeModel.freeEach(rowsOnly, false), freeEach['free'], reason: '$where: freeEach on Free');

  final rows = (want['rows'] as List).cast<Map<String, dynamic>>();
  expect(flat.length, rows.length, reason: '$where: row count');
  for (var i = 0; i < rows.length; i++) {
    final row = flat[i].row;
    final w = rows[i];
    final at = '$where: row ${row.key}';
    expect(row.key, w['key'], reason: at);
    expect(HomeModel.cardsText(row), w['cardsText'], reason: '$at: cardsText');
    expect(HomeModel.nothingToPlay(row), w['nothingToPlay'], reason: '$at: nothingToPlay');
    expect(HomeModel.metaLine(row), w['metaLine'], reason: '$at: metaLine');
    expect(HomeModel.marksText(row), w['marksText'], reason: '$at: marksText');
    expect(HomeModel.displayTitle(row.title), w['title'], reason: '$at: displayTitle');
    expect(HomeModel.verdictText(row), w['verdictText'], reason: '$at: verdictText');
    final road = HomeModel.roadmapRow(row);
    final wr = w['road'] as Map<String, dynamic>;
    expect(road.line, wr['line'], reason: '$at: roadmapRow line');
    expect(road.share, closeTo((wr['share'] as num).toDouble(), 1e-12), reason: '$at: roadmapRow share');
    expect(road.seen, wr['seen'], reason: '$at: roadmapRow seen');
    expect(road.verdict, wr['verdict'], reason: '$at: roadmapRow verdict');
    expect(road.total, wr['total'], reason: '$at: roadmapRow total');
  }

  final wantParts = (want['parts'] as List).cast<Map<String, dynamic>>();
  expect(parts.length, wantParts.length, reason: '$where: part count');
  for (var p = 0; p < parts.length; p++) {
    final part = parts[p];
    final w = wantParts[p];
    final at = '$where: part ${part.id}';
    expect(part.id, w['id'], reason: at);
    expect(HomeModel.unitsSignature(part.units), w['signature'], reason: '$at: unitsSignature');
    expect(part.option == null ? null : HomeModel.optionLine(part, p), w['optionLine'], reason: '$at: optionLine');
    for (final e in (w['implied'] as List).cast<Map<String, dynamic>>()) {
      expect(HomeModel.impliedOptionLine(part, e['choice'] as String?), e['out'], reason: '$at: impliedOptionLine with ${e['choice']}');
    }
    final units = (w['units'] as List).cast<Map<String, dynamic>>();
    expect(part.units.length, units.length, reason: '$at: unit count');
    for (var u = 0; u < units.length; u++) {
      final unit = part.units[u];
      expect(unit.title, units[u]['title'], reason: '$at: unit $u title');
      expect(unit.optionId, units[u]['optionId'], reason: '$at: unit $u optionId');
      expect(HomeModel.unitHeading(unit), units[u]['heading'], reason: '$at: unit "${unit.title}" heading');
    }
    for (final e in (w['effective'] as List).cast<Map<String, dynamic>>()) {
      final local = e['local'] as String?;
      expect(HomeModel.effectiveChoice(part, {part.id: ?local}), e['out'], reason: '$at: effectiveChoice with $local');
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

void main() {
  final data = _file('test/fixtures/learn2/parity/home_model.json');
  List<Map<String, dynamic>> rows(String key) => (data[key] as List).cast<Map<String, dynamic>>();

  test('the fixture holds every recorded subject and home, the edge maps, the shelves and the titles', () {
    final counts = data['counts'] as Map<String, dynamic>;
    expect(counts['subjects'], 17);
    expect(counts['rows'], greaterThan(150));
    expect(counts['displayTitles'], greaterThan(150));
    expect(rows('edgeParts').length, greaterThanOrEqualTo(7));
    expect(rows('shelves').length, greaterThanOrEqualTo(7));
  });

  test('the sorts are the website\'s, in the website\'s order; the roadmap\'s menu offers two', () {
    final sorts = (data['sorts'] as List).cast<Map<String, dynamic>>();
    expect([for (final s in HomeModel.sorts) {'id': s.id, 'label': s.label}], sorts);
    final parts = LearnSubjectData.parse(_file('test/fixtures/learn2/home_accountancy_pro.json')).parts;
    expect([for (final s in HomeModel.mapSorts(HomeModel.playableParts(parts))) s.id], ['book', 'needs']);
    expect(HomeModel.optionComing, data['noOptionComing']);
  });

  group('every recorded subject and home read', () {
    for (final s in rows('subjects')) {
      final name = s['name'] as String;
      final parsed = LearnSubjectData.parse(_file('test/fixtures/learn2/$name.json'));

      test('$name: the line of counts and the roadmap', () {
        expect(HomeModel.subjectLine(parsed.subject), s['subjectLine']);
        _expectMap(parsed.parts, s['map'] as Map<String, dynamic>, name);
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

  group('shelves', () {
    for (final e in rows('shelves')) {
      test(e['name'] as String, () {
        final shelves = LearnShelves.parse(e['shelves']);
        for (final k in (e['keys'] as List).cast<Map<String, dynamic>>()) {
          final name = k['subjectName'] as String;
          expect(
            [for (final key in HomeModel.shelfKeys(shelves, name)) {'id': key.id, 'count': key.count, 'title': key.title, 'name': key.name}],
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
    test('nothing read gives no rows', () {
      expect(HomeModel.shelfKeys(null), isEmpty);
      expect(HomeModel.findRows(null), isEmpty);
    });
    test('Find\'s rows: each set that holds cards with its line, then the Must-know lines', () {
      final shelves = LearnShelves.parse(_file('test/fixtures/learn2/shelves_pro.json'));
      expect(HomeModel.findRows(shelves), [
        (id: 'due', title: 'Due today', line: '9 cards · about 2 min'),
        (id: 'missed', title: 'Missed lately', line: '6 cards'),
        (id: 'revise', title: 'In Revise', line: '26 cards'),
        (id: 'must', title: 'Must-know lines', line: '235 cards in 14 chapters'),
      ]);
      // A student with nothing in the three sets still has the book's Must-know lines (and then Find says a word to try).
      expect(HomeModel.findRows(LearnShelves.parse(_file('test/fixtures/learn2/shelves_new_pro.json'))).map((r) => r.id), ['must']);
      expect(HomeModel.findRows(LearnShelves.parse({'must': {'count': 1, 'chapters': 0}})).single.line, '1 card in 1 chapter');
    });
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

  test('the line of counts under a subject uses the web\'s middle dots', () {
    for (final l in rows('subjectLines')) {
      final raw = l['subject'];
      final info = raw == null ? null : LearnSubjectInfo.parse(raw);
      expect(HomeModel.subjectLine(info), l['out'], reason: '${l['subject']}');
    }
  });

  test('the words to try in Find, and the field\'s placeholder', () {
    for (final h in rows('hints')) {
      final subject = h['subject'] as String?;
      expect(HomeModel.findHints(subject), h['hints'], reason: '$subject hints');
      expect(HomeModel.findHintLine(subject), h['line'], reason: '$subject line');
      final first = (h['hints'] as List).cast<String>();
      expect(HomeModel.findPlaceholder(subject), first.isEmpty ? 'Find a chapter or topic' : 'Find a topic, like ${first.first}', reason: '$subject placeholder');
    }
  });

  test('the option line above the part\'s pills', () {
    for (final o in rows('optionLines')) {
      final n = o['n'] as int?;
      final part = n == null
          ? null
          : LearnPart(
              id: 'p',
              title: o['title'] as String,
              option: LearnPartOption(label: 'Your part', choices: [for (var i = 0; i < n; i++) LearnChoice('c$i', 'Choice $i')]),
            );
      expect(HomeModel.optionLine(part, o['at'] as int), o['out'], reason: '${o['title']} with $n');
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
