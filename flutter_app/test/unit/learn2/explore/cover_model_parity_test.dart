// The app's cover words against the website's own: `test/fixtures/learn2/parity/cover_model.json` holds what the web's
// coverModel.js returns for the six recorded Explore covers answers (every cover at every length, with and without
// Free and with the day used) and a set of edge covers (written by tool/learn2_parity/cover_model.mjs, which imports
// the web's functions). Every output is checked, so a rule that drifts on one real cover fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/explore/cover_model.dart';

Map<String, dynamic>? _line(CoverLine? l) => l == null ? null : {'prefix': l.prefix, 'text': l.text};

Map<String, dynamic> _media(CoverMedia m) => switch (m) {
  CoverMediaCard(:final text) => {'kind': 'card', 'text': text},
  CoverMediaCards(:final text, :final note) => {'kind': 'cards', 'text': text, 'note': note},
  CoverMediaLocked(:final label) => {'kind': 'locked', 'label': label},
  CoverMediaQuestions(:final text, :final note) => {'kind': 'questions', 'text': text, 'note': note},
};

/// Every output of the cover words for one cover, in the shape the script writes.
Map<String, dynamic> _describe(LearnCover c, List<int> minutes) {
  final media = CoverModel.mediaOf(c, CoverModel.defaultLength);
  return {
    'refLine': CoverModel.refLineOf(c),
    'lead': {
      'history': _line(CoverModel.leadLine(c)),
      'noHistory': _line(CoverModel.leadLine(c, history: false)),
    },
    'student': {
      'history': CoverModel.studentLineOf(c),
      'noHistory': CoverModel.studentLineOf(c, history: false),
    },
    'opensQuestions': {
      'open': CoverModel.opensQuestions(c),
      'done': CoverModel.opensQuestions(c, freeDone: true),
    },
    'tier': media is CoverMediaCard ? CoverModel.hookTier(media.text) : null,
    'byLength': {
      for (final m in minutes)
        '$m': {
          'counts': {
            'cards': CoverModel.countsOf(c, m).cards,
            'questions': CoverModel.countsOf(c, m).questions,
            'minutes': CoverModel.countsOf(c, m).minutes,
            'capped': CoverModel.countsOf(c, m).capped,
          },
          'mix': {
            'pro': CoverModel.mixLineOf(c, m),
            'free': CoverModel.mixLineOf(c, m, free: true),
            'noHistory': CoverModel.mixLineOf(c, m, history: false),
            'freeNoHistory': CoverModel.mixLineOf(c, m, free: true, history: false),
          },
          'key': {'open': CoverModel.keyLabelOf(c, m), 'done': CoverModel.keyLabelOf(c, m, freeDone: true)},
          'media': _media(CoverModel.mediaOf(c, m)),
        },
    },
  };
}

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/cover_model.json').readAsStringSync()) as Map<String, dynamic>;
  List<Map<String, dynamic>> rows(String key) => (data[key] as List).cast<Map<String, dynamic>>();
  final minutes = [for (final m in data['minutes'] as List) m as int];

  test('the fixture holds every recorded cover, the edge covers and every flag', () {
    final counts = data['counts'] as Map<String, dynamic>;
    expect(counts['recordings'], 6);
    expect(counts['recordedCovers'], 84);
    expect(counts['edgeCovers'], greaterThanOrEqualTo(100));
    expect(counts['dataSets'], greaterThanOrEqualTo(12));
    expect(data['lengths'], CoverModel.lengths);
    // Every shape of media and every key is there to be checked.
    final all = <Map<String, dynamic>>[
      for (final r in rows('recordings')) ...(r['covers'] as List).cast<Map<String, dynamic>>(),
      ...rows('edge'),
    ];
    final kinds = {
      for (final c in all)
        for (final l in (c['byLength'] as Map<String, dynamic>).values) ((l as Map<String, dynamic>)['media'] as Map<String, dynamic>)['kind'],
    };
    expect(kinds, {'card', 'cards', 'locked', 'questions'});
    final keys = {
      for (final c in all)
        for (final l in (c['byLength'] as Map<String, dynamic>).values) (((l as Map<String, dynamic>)['key'] as Map<String, dynamic>)['open'] as String).split(' ').first,
    };
    expect(keys, containsAll(['Start', 'Continue']));
    // A front over 105 characters is never a cover's line now (it is not readable cold), so the longest tier is reached only by the size test below.
    expect({for (final c in all) c['tier']}, containsAll(['s', 'm', 'l', 'xl']));
  });

  group('the recorded covers', () {
    for (final r in rows('recordings')) {
      final file = r['file'] as String;
      test(file, () {
        final json = jsonDecode(File('test/fixtures/learn2/$file.json').readAsStringSync()) as Map<String, dynamic>;
        final answer = LearnCovers.parse(json);
        expect(CoverModel.hasHistory(answer), r['hasHistory'], reason: 'hasHistory');
        expect(CoverModel.isFreePlan(answer), r['isFreePlan'], reason: 'isFreePlan');
        final want = (r['covers'] as List).cast<Map<String, dynamic>>();
        expect(answer.covers.length, want.length, reason: 'covers');
        for (var i = 0; i < want.length; i++) {
          expect(_describe(answer.covers[i], minutes), want[i], reason: '$file cover $i (${answer.covers[i].key})');
        }
      });
    }
  });

  test('every edge cover, at every length', () {
    for (final row in rows('edge')) {
      final raw = row['cover'] as Map<String, dynamic>;
      final c = LearnCover.tryParse(raw)!;
      final want = Map<String, dynamic>.of(row)..remove('cover');
      expect(_describe(c, minutes), want, reason: 'edge cover ${raw['key']}: $raw');
    }
  });

  test('the whole-answer flags: history and Free', () {
    for (final row in rows('dataSets')) {
      final raw = row['data'] as Map<String, dynamic>;
      final answer = LearnCovers.parse(raw);
      expect(CoverModel.hasHistory(answer), row['hasHistory'], reason: 'hasHistory of $raw');
      expect(CoverModel.isFreePlan(answer), row['isFreePlan'], reason: 'isFreePlan of $raw');
    }
  });

  test('hook sizes, at every length boundary', () {
    for (final row in rows('tiers')) {
      final text = row['text'] as String;
      expect(CoverModel.hookTier(text), row['tier'], reason: 'tier of ${text.length} characters');
    }
    expect(CoverModel.hookTier(null), data['tierEmpty']);
  });

  test('kind labels, with case and unknown kinds', () {
    for (final row in rows('kinds')) {
      expect(CoverModel.kindLabel(row['kind'] as String), row['label'], reason: 'kind ${row['kind']}');
    }
    final missing = data['kindMissing'] as Map<String, dynamic>;
    expect(CoverModel.kindLabel(null), missing['none']);
    expect(CoverModel.kindLabel(null), missing['nul']);
  });

  test('chapter names and slugs', () {
    for (final row in rows('chapterNames')) {
      final c = LearnCover.tryParse(row['cover'] as Map<String, dynamic>)!;
      final names = [for (final n in row['names'] as List) n as String];
      expect(CoverModel.chapterNameOf(c, names), row['out'], reason: 'chapter name of ${row['cover']}');
    }
    for (final row in rows('slugs')) {
      expect(CoverModel.slugOf(row['text'] as String), row['out'], reason: 'slug of "${row['text']}"');
    }
  });
}
