// The app's run rules (lib/features/learn2/run/run_math.dart and run_view.dart) against the website's own functions: every
// case of test/fixtures/learn2/parity/run_math.json, written by tool/learn2_parity/run_math.mjs from the web's runMath.js and
// runView.mjs over the recorded runs and ends and a set of edge lists and strings.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/run/run_math.dart';
import 'package:mockmob/features/learn2/run/run_view.dart';

Json _read(String path) => asJson(jsonDecode(File(path).readAsStringSync()));

LearnItem _item(Object? raw) => LearnItem.tryParse(raw)!;

/// A bare item of a type, for the rules that read only the type.
LearnItem? _typed(String? type) => switch (type) {
  'card' => _item({
    'id': 'x',
    'type': 'card',
    'card': {'id': 'c', 'front': 'F', 'back': 'B'},
  }),
  'question' => _item({
    'id': 'x',
    'type': 'question',
    'question': {'id': 'q', 'body': 'B', 'options': <Object>[]},
  }),
  'lesson' => _item({
    'id': 'x',
    'type': 'lesson',
    'lesson': {'id': 'l'},
  }),
  _ => null,
};

Map<String, Object?> _pile(RunPile p) => {'id': p.id, 'label': p.label, 'done': p.done, 'of': p.of, 'current': p.current, 'value': p.value};

void main() {
  final data = _read('test/fixtures/learn2/parity/run_math.json');
  final raw = <String, List<Json>>{};
  for (final e in asJson(data['lists']).entries) {
    final l = asJson(e.value);
    final fixture = asString(l['fixture']);
    raw[e.key] = fixture != null ? asJsonList(_read('test/fixtures/learn2/$fixture.json')['items']) : asJsonList(l['items']);
  }
  final lists = {
    for (final e in raw.entries) e.key: [for (final i in e.value) _item(i)],
  };
  final ends = <String, LearnEnd>{
    for (final e in asJson(data['ends']).entries)
      e.key: LearnEnd.parse(
        asString(asJson(e.value)['fixture']) != null ? _read('test/fixtures/learn2/${asJson(e.value)['fixture']}.json') : asJson(asJson(e.value)['end']),
      ),
  };

  List<Json> cases(String name) => asJsonList(data[name]);

  test('every item the web reads, the app reads', () {
    for (final name in raw.keys) {
      expect([for (final i in lists[name]!) i.id], [for (final i in raw[name]!) i['id']], reason: name);
    }
  });

  group('runMath.js', () {
    test('itemSeconds', () {
      for (final c in cases('itemSeconds')) {
        expect(RunMath.itemSeconds(lists[c['list']]![c['i'] as int], c['kind'] as String), c['out'], reason: '$c');
      }
    });

    test('minutesFor and minutesLeftLine', () {
      for (final c in cases('minutesFor')) {
        expect(RunMath.minutesFor(c['seconds'] as num), c['out'], reason: '$c');
      }
      for (final c in cases('minutesLeftLine')) {
        expect(RunMath.minutesLeftLine(lists[c['list']]!, c['done'] as int, c['kind'] as String), c['out'], reason: '${c['list']} ${c['done']} ${c['kind']}');
      }
    });

    test('upNextLine', () {
      for (final c in cases('upNextLine')) {
        expect(RunMath.upNextLine(lists[c['list']]!, c['at'] as int), c['out'], reason: '${c['list']} ${c['at']}');
      }
    });

    test('optionText and firstLine', () {
      for (final c in cases('optionText')) {
        expect(
          RunMath.optionText(key: c['key'] as String, text: c['text'] as String),
          c['out'],
          reason: '$c',
        );
      }
      for (final c in cases('firstLine')) {
        expect(RunMath.firstLine(c['text'] as String?), c['out'], reason: '$c');
      }
    });

    test('reinsertAt, FLIGHT and pipGroups', () {
      for (final c in cases('reinsertAt')) {
        expect(RunMath.reinsertAt(c['length'] as int, c['current'] as int, c['at'] as num?), c['out'], reason: '$c');
      }
      expect({for (final e in RunMath.flight.entries) '${e.key}': e.value}, data['flight']);
      for (final c in cases('pipGroups')) {
        final groups = RunMath.pipGroups(lists[c['list']]!, c['max'] as int);
        expect(
          groups == null
              ? null
              : [
                  for (final g in groups) {'type': g.type, 'from': g.from, 'to': g.to},
                ],
          c['out'],
          reason: '${c['list']} ${c['max']}',
        );
      }
    });

    test('endAct and numberDetail', () {
      for (final c in cases('endAct')) {
        final t = asJson(c['tally']);
        final tally = RunTally(
          missed: asInt(t['missed']) ?? 0,
          got: asInt(t['got']) ?? 0,
          easy: asInt(t['easy']) ?? 0,
          right: asInt(t['right']) ?? 0,
          wrong: asInt(t['wrong']) ?? 0,
        );
        expect(RunMath.endAct(tally), c['out'], reason: '$c');
      }
      for (final c in cases('numberDetail')) {
        expect(RunMath.numberDetail(c['text'] as String?), c['out'], reason: '$c');
      }
    });
  });

  group('runView.mjs', () {
    test('frontStep and stageTag', () {
      for (final c in cases('frontStep')) {
        expect(RunView.frontStep(c['text'] as String?), c['out'], reason: '$c');
      }
      for (final c in cases('stageTag')) {
        final item = c['item'] != null ? _item(c['item']) : lists[c['list']]![c['i'] as int];
        expect(RunView.stageTag(item, recap: c['recap'] as bool), c['out'], reason: '${c['list'] ?? c['item']} ${c['i']} ${c['recap']}');
      }
    });

    test('runPiles', () {
      for (final c in cases('runPiles')) {
        final piles = RunView.runPiles(lists[c['list']]!, c['finished'] as int, at: c['at'] as int, resumed: c['resumed'] as bool);
        expect(
          [for (final p in piles) _pile(p)],
          [for (final p in asJsonList(c['out'])) p],
          reason: '${c['list']} ${c['finished']} ${c['at']} ${c['resumed']}',
        );
      }
    });

    test('answerTally and the right line', () {
      for (final c in cases('answerTally')) {
        final graded = {for (final e in asJson(c['answers']).entries) e.key: e.value as bool};
        final t = RunView.answerTally(lists[c['list']]!, graded);
        expect(
          {'answered': t.answered, 'right': t.right, 'tried': t.tried, 'fixed': t.fixed, 'streak': t.streak},
          c['out'],
          reason: '${c['list']} ${c['case']}',
        );
      }
      for (final c in cases('rightLine')) {
        expect(RunView.rightLine(c['streak'] as int), c['out']);
      }
    });

    test('positionWords and stopLine', () {
      for (final c in cases('positionWords')) {
        expect(RunView.positionWords(_typed(c['type'] as String?), c['position'] as int, c['total'] as int), c['out'], reason: '$c');
      }
      for (final c in cases('stopLine')) {
        expect(RunView.stopLine(c['done'] as int, c['total'] as int), c['out']);
      }
    });

    test('placeReinsert puts a copy 3 on, moves one already ahead and never duplicates (resumed lists too)', () {
      final list = {for (final e in lists.entries) e.key: e.value};
      for (final c in cases('placeReinsert')) {
        final before = list[c['list']]!;
        final r = asJson(c['reinsert']);
        final after = RunView.placeReinsert(
          before,
          itemId: r['itemId'] as String,
          at: r['at'] as num?,
          item: r['item'] == null ? null : _item(r['item']),
          moved: r['moved'] == true,
          current: c['current'] as int,
          offset: c['offset'] as int,
        );
        final out = asJson(c['out']);
        expect([for (final i in after) i.id], out['ids'], reason: '$c');
        expect(identical(after, before), out['same'], reason: '$c');
        expect([for (final i in after) i is LearnCardItem ? i.stage : null], out['stages'], reason: '$c');
      }
    });

    test('the end: state keys, the moved line, the Revise summary', () {
      for (final c in cases('stateKeyOf')) {
        expect(RunView.stateKeyOf(c['label'] as String?), c['out'], reason: '$c');
      }
      for (final c in cases('movedParts')) {
        final m = RunView.movedParts(c['moved'] as String?);
        expect(m == null ? null : {'from': m.from, 'to': m.to}, c['out'], reason: '$c');
      }
      for (final c in cases('reviseSummary')) {
        final groups = [for (final g in asJsonList(c['groups'])) LearnPileGroup.tryParse(g)!];
        final s = RunView.reviseSummary(groups);
        expect({'total': s.total, 'line': s.line}, c['out'], reason: '$c');
      }
    });

    test('endLines', () {
      for (final c in cases('endLines')) {
        final lines = RunView.endLines(ends[c['end']]!, kind: c['kind'] as String);
        expect(
          [
            for (final l in lines) {'label': l.label, 'value': l.value},
          ],
          c['out'],
          reason: '${c['end']} ${c['kind']}',
        );
      }
    });

    test('leadView, freeEndLines, firstSentence', () {
      for (final c in cases('leadView')) {
        final v = RunView.leadView(LearnOption.tryParse(c['option']));
        expect({'heading': v?.heading, 'reason': v?.reason, 'key': v?.key}, c['out'], reason: '${c['option']}');
      }
      for (final c in cases('freeEndLines')) {
        final lead = c['lead'];
        final v = RunView.freeEndLines(lead is Map ? asString(lead['line']) : null);
        expect(v == null ? null : {'head': v.head, 'rest': v.rest}, c['out'], reason: '$c');
      }
      for (final c in cases('firstSentence')) {
        expect(RunView.firstSentence(c['text'] as String?), c['out'], reason: '$c');
      }
    });

    test('endTitle and plural', () {
      for (final c in cases('endTitle')) {
        final t = RunView.endTitle(c['title'] as String?, stoppedAt: c['stoppedAt'] as int?, total: c['total'] as int?, kind: c['kind'] as String);
        expect({'lead': t.lead, 'name': t.name}, c['out'], reason: '$c');
      }
      for (final c in cases('plural')) {
        expect(RunView.plural(c['n'] as int, c['one'] as String, c['many'] as String?), c['out'], reason: '$c');
      }
    });
  });
}
