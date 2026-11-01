// The app's feed rules (lib/features/learn2/feed/feed_model.dart) against the website's own functions: every case of
// test/fixtures/learn2/parity/feed_model.json, written by tool/learn2_parity/feed_model.mjs from the web's
// feedModel.mjs and data/learn/feed.js over the recorded feeds and the edge lists.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/feed/feed_model.dart';

Json _read(String path) => asJson(jsonDecode(File(path).readAsStringSync()));

/// A state as the web's test data writes it.
FeedItemState stateOf(Json j) {
  FeedAnswer? answer;
  if (j['answer'] is Map) {
    final a = asJson(j['answer']);
    final choice = asStringOr(a['choice'], 'A');
    answer = a['res'] is Map ? FeedAnswer.graded(choice, LearnAnswer.parse(a['res'])) : FeedAnswer.pending(choice);
  }
  return FeedItemState(
    seen: j['seen'] == true,
    turned: j['turned'] == true,
    seenBack: j['seenBack'] == true,
    kept: j['kept'] == true,
    skipped: asString(j['skipped']),
    answer: answer,
  );
}

Map<String, FeedItemState> statesOf(Object? raw) => {for (final e in asJson(raw).entries) e.key: stateOf(asJson(e.value))};

void main() {
  final data = _read('test/fixtures/learn2/parity/feed_model.json');
  final raw = <String, List<Json>>{};
  for (final e in asJson(data['lists']).entries) {
    final l = asJson(e.value);
    final fixture = asString(l['fixture']);
    final items = fixture != null ? asJsonList(_read('test/fixtures/learn2/$fixture.json')['items']) : asJsonList(l['items']);
    raw[e.key] = [
      for (final i in items)
        if (i['type'] == 'card' || i['type'] == 'question') i,
    ];
  }
  final lists = {
    for (final e in raw.entries) e.key: [for (final i in e.value) LearnItem.tryParse(i)].whereType<LearnItem>().toList(),
  };
  final states = {for (final e in asJson(data['states']).entries) e.key: {for (final s in asJson(e.value).entries) s.key: statesOf(s.value)}};

  test('every list item the web reads, the app reads', () {
    for (final name in raw.keys) {
      expect(lists[name]!.length, raw[name]!.length, reason: name);
      expect([for (final i in lists[name]!) i.id], [for (final i in raw[name]!) i['id']], reason: name);
    }
  });

  test('the checkpoint rule and its line are the web\'s', () {
    expect(FeedModel.checkpointEvery, data['every']);
    expect(FeedModel.checkpointMinAfter, data['minAfter']);
    expect(FeedModel.checkpointLine, data['checkpointLine']);
  });

  test('feedSlots', () {
    final cases = asJsonList(data['slots']);
    expect(cases, isNotEmpty);
    for (final c in cases) {
      final all = lists[c['list']]!;
      final take = asInt(c['take']);
      final every = asInt(c['every']);
      final items = take == null ? all : all.take(take).toList();
      final out = every == null ? FeedModel.slots(items) : FeedModel.slots(items, every: every);
      final said = [
        for (final s in out)
          switch (s) {
            FeedItemSlot(:final item, :final n) => {'type': 'item', 'n': n, 'id': item.id},
            FeedCheckpointSlot(:final id, :final after) => {'type': 'checkpoint', 'id': id, 'after': after},
            FeedEndSlot() => {'type': 'end'},
          },
      ];
      expect(said, c['out'], reason: '${c['list']} take $take every $every');
    }
  });

  test('checkpointNumber and keptLine', () {
    for (final c in asJsonList(data['checkpointNumber'])) {
      final n = asJson(c['in']);
      expect(
        FeedModel.checkpointNumber(answered: asInt(n['answered'])!, right: asInt(n['right'])!, seen: asInt(n['seen'])!, kept: asInt(n['kept'])!),
        c['out'],
        reason: '$n',
      );
    }
    for (final c in asJsonList(data['keptLine'])) {
      expect(FeedModel.keptLine(asInt(c['in'])!), c['out'], reason: '${c['in']}');
    }
  });

  test('secondsFrom', () {
    for (final c in asJsonList(data['secondsFrom'])) {
      expect(FeedModel.secondsFrom(lists[c['list']]!, asInt(c['from'])!), c['out'], reason: '${c['list']} from ${c['from']}');
    }
  });

  test('questionPlaces', () {
    for (final c in asJsonList(data['questionPlaces'])) {
      final places = FeedModel.questionPlaces(lists[c['list']]!);
      expect([for (final e in places.entries) [e.key, e.value.n, e.value.of]], c['out'], reason: '${c['list']}');
    }
  });

  test('feedNumbers', () {
    for (final c in asJsonList(data['numbers'])) {
      final n = FeedModel.numbers(lists[c['list']]!, states[c['list']]![c['states']]!);
      expect(n.toJson(), c['out'], reason: '${c['list']} ${c['states']}');
    }
  });

  test('checkpointText', () {
    for (final c in asJsonList(data['checkpointText'])) {
      final j = asJson(c['numbers']);
      final n = FeedNumbers(
        answered: asInt(j['answered'])!,
        right: asInt(j['right'])!,
        mistakes: asInt(j['mistakes'])!,
        fixed: asInt(j['fixed'])!,
        kept: asInt(j['kept'])!,
        seen: asInt(j['seen'])!,
      );
      final t = FeedModel.checkpointText(n, done: asInt(c['done'])!, of: asInt(c['of'])!, seconds: c['seconds'] as num);
      expect({'big': t.big, 'status': t.status, 'line': t.line}, c['out'], reason: '$j ${c['done']} ${c['of']} ${c['seconds']}');
    }
  });

  test('upNextText', () {
    for (final c in asJsonList(data['upNext'])) {
      final at = c['slot'];
      final FeedSlot? slot = at == null ? null : (at == 'end' ? const FeedEndSlot() : FeedModel.slots(lists[c['list']]!)[asInt(at)!]);
      expect(FeedModel.upNextText(slot), c['out'], reason: '${c['list']} $at');
    }
  });

  test('spliceReinsert', () {
    final cases = asJsonList(data['splice']);
    expect(cases.length, greaterThan(100));
    for (final c in cases) {
      final name = c['list'] as String;
      final reinsert = asJson(c['reinsert']);
      final ref = asJson(reinsert['item']);
      if (reinsert['item'] is Map) {
        final from = raw[name]!.firstWhere((i) => i['id'] == ref['ref']);
        reinsert['item'] = {...from, 'id': ref['id']};
      }
      final back = LearnReinsert.tryParse(reinsert);
      expect(back, isNotNull, reason: '$reinsert');
      final own = lists[name]!;
      final List<LearnItem> input;
      if (c['ids'] is List) {
        final byId = {for (final i in own) i.id: i, if (back!.item != null) back.item!.id: back.item!};
        input = [for (final id in asStringList(c['ids'])) byId[id]!];
      } else {
        input = own;
      }
      final out = FeedModel.spliceReinsert(input, answeredId: c['answeredId'] as String, reinsert: back, resumed: c['resumed'] == true);
      final why = '$name ${c['answeredId']} ${c['reinsert']} resumed ${c['resumed']}';
      expect(identical(out, input), c['same'], reason: why);
      if (c['same'] != true) expect([for (final i in out) i.id], c['out'], reason: why);
    }
  });

  test('sheetRows', () {
    for (final c in asJsonList(data['sheetRows'])) {
      final rows = FeedModel.sheetRows(lists[c['list']]!, states[c['list']]![c['states']]!, asInt(c['base'])!);
      expect(
        [for (final r in rows) {'id': r.id, 'n': r.n, 'kind': r.kind, 'words': r.words, 'state': r.mark?.name}],
        c['out'],
        reason: '${c['list']} ${c['states']} ${c['base']}',
      );
    }
  });
}
