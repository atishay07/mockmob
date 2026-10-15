import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/model/time_decisions.dart';

import 'support/lab_fixtures.dart';

/// Mistake Lab v4 slice 2 in the app: `lab.replay` and `lab.time` read from the website's own
/// contracts (copied byte for byte from `data/tests/fixtures/mistake_lab/`), and the moving clock
/// agreeing with every sentence the server wrote.
void main() {
  const contracts = ['replay', 'replay_time_up', 'replay_nta', 'replay_bst', 'replay_english'];

  group('the replay contract', () {
    for (final name in contracts) {
      test('$name: reads in full, and the clock counts what each row says', () {
        final lab = labOf(name);
        final replay = lab.replay;
        expect(replay, isNotNull);
        expect(replay!.total, 50);
        expect(replay.rowSec, 600);
        expect(replay.playMs, 15000);
        expect(replay.chips.first.id, ReplayChip.all);
        expect(replay.end, isNotNull);
        expect(replay.end!.at, replay.recordSec);
        expect(replay.facts, isNotEmpty);
        for (final row in replay.rows) {
          final at = math.min(row.to, replay.recordSec);
          // The moving clock reads the same count and pace as the server's row sentence.
          expect(replay.answeredAt(at), row.answeredBy, reason: row.label);
          expect(replay.evenPaceAt(at), row.evenPaceBy, reason: row.label);
          expect(row.label, ResultCopy.replayAnsweredBy(clockLabel(at), row.answeredBy, replay.total, row.evenPaceBy));
        }
        // Visits run in time order and never overlap.
        final bars = replay.bars;
        for (var i = 1; i < bars.length; i++) {
          expect(bars[i].from >= bars[i - 1].to, isTrue, reason: 'Q${bars[i].n} at ${bars[i].from}');
        }
        // Every chip but All filters by a ledger group's own questions.
        for (final c in replay.chips.skip(1)) {
          expect(lab.numbersOf(c.id), hasLength(c.count), reason: c.id);
        }
        final moments = replay.moments;
        expect(moments.first, 0);
        expect(moments.last, replay.recordSec);
        expect([...moments]..sort(), moments);
      });
    }

    test('what was on screen and answered at a given moment', () {
      final replay = labOf('replay').replay!;
      expect(replay.barAt(1002)!.n, 17);
      expect(replay.barAt(0)!.n, 1);
      expect(replay.barAt(replay.recordSec)!.n, 22, reason: 'the question open when the paper was submitted');
      expect(replay.openedAt(replay.recordSec), hasLength(50));
      // Q40 was picked at 40:16 and cleared at 40:33: answered between, unanswered after.
      expect(replay.answeredSetAt(2420), contains(40));
      expect(replay.answeredSetAt(2440), isNot(contains(40)));
      expect(labOf('replay').numbersOf('changed_from_right'), [17, 31]);
    });

    test('a passage set shown whole on the website: every question it showed is opened, with or without a bar', () {
      for (final name in ['replay_bst', 'replay_english']) {
        final replay = labOf(name).replay!;
        final listed = labContract(name)['replay']['opened'] as List;
        final withBar = {for (final b in replay.bars) b.n};
        final shownOnly = {for (final o in listed) o['n'] as int}.difference(withBar);
        expect(shownOnly, isNotEmpty, reason: '$name has questions shown with their set and never in focus');
        expect(replay.openedAt(replay.recordSec), containsAll(shownOnly), reason: name);
        expect(replay.openedAt(replay.recordSec), hasLength(listed.length), reason: name);
      }
      // A replay without the list (an older server) reads its bars alone.
      final old = labContract('replay');
      (old['replay'] as Map).remove('opened');
      expect(MistakeLab.tryParse(old)!.replay!.openedAt(0), {1});
    });

    test('an older server sends neither the replay nor the time read', () {
      final lab = labOf('ready');
      expect(lab.replay, isNull);
      expect(lab.time, isNull);
    });

    test('a replay that cannot be read honestly is set aside, never the lab', () {
      Map<String, dynamic> broken(void Function(Map<String, dynamic> replay) edit) {
        final c = labContract('replay');
        edit(c['replay'] as Map<String, dynamic>);
        return c;
      }

      final badResult = MistakeLab.tryParse(broken((r) => ((r['rows'] as List).first['bars'] as List).first['result'] = 'maybe'));
      expect(badResult, isNotNull);
      expect(badResult!.replay, isNull);
      final outside = MistakeLab.tryParse(broken((r) => ((r['rows'] as List).first['bars'] as List).first['to'] = 900));
      expect(outside!.replay, isNull, reason: 'a bar past its row');
      final noRows = MistakeLab.tryParse(broken((r) => r['rows'] = []));
      expect(noRows!.replay, isNull);
      final badNumber = MistakeLab.tryParse(broken((r) => ((r['rows'] as List).first['bars'] as List).first['n'] = 51));
      expect(badNumber!.replay, isNull);
    });
  });

  group('the server\'s time read', () {
    test('replay: every question\'s lines arrive as written, with the 4.6 trace lines', () {
      final raw = labContract('replay')['time'] as Map<String, dynamic>;
      final read = TimeDecisions.fromServer(raw)!;
      expect(read.isReady, isTrue);
      expect(read.rows, hasLength(50));
      for (final r in raw['rows'] as List) {
        expect(read.rowFor(r['qid'] as String)!.lines, (r['lines'] as List).cast<String>());
      }
      expect(read.rowFor('q22')!.lines.first, startsWith('1m 40s on this question, until you submitted at 51:46.'));
      expect(read.rowFor('q22')!.lines, contains('Picked D at 20:04. Changed to A at 20:34, 30s later, without leaving the question.'));
      expect(read.rowFor('q10')!.lines, contains('Away from the paper for 1m 10s while this question was open. Not counted.'));
      expect(read.rowFor('q6')!.lines, contains('You crossed out C, the key, at 5:22.'));
      expect(read.rowFor('q28')!.lines, contains('You marked it for review at 25:49. It was still marked when you submitted.'));
      final summary = raw['summary'] as Map<String, dynamic>;
      expect(read.paceLine, summary['pace']);
      expect(read.medianLine, summary['median']);
      expect(read.splitLine, summary['split']);
      expect(read.longestNote, summary['longestNote']);
      expect(read.longest.map((l) => l.number), [17, 5, 12, 28, 22]);
      expect(read.changesLead, 'You changed answers 5 times across 5 questions. Net effect on your marks: −5.');
      expect(read.changeParts.map((p) => p.kind), ['gained', 'cost', 'neutral']);
      expect(read.changeRows.map((c) => c.number), [8, 17, 22, 31, 40]);
      expect(read.changeRows.first.text, 'Picked C at 7:17. Changed to A at 48:56, 41m 39s later, on a later visit.');
    });

    test('time up and the third warning end the last question\'s time in their own words', () {
      final timeUp = TimeDecisions.fromServer(labContract('replay_time_up')['time'])!;
      expect(timeUp.rowFor('q44')!.lines, contains('Time ran out at 60:00 with this question open.'));
      final nta = TimeDecisions.fromServer(labContract('replay_nta')['time'])!;
      expect(nta.rowFor('r26')!.lines, contains('Your answers were submitted at 31:10, after the third warning, with this question open.'));
    });

    test('a read that is not ready keeps its message; a broken one is set aside', () {
      final device = TimeDecisions.fromServer({'state': 'device', 'message': TimeCopy.device})!;
      expect(device.isReady, isFalse);
      expect(device.message, TimeCopy.device);
      expect(TimeDecisions.fromServer(null), isNull);
      expect(TimeDecisions.fromServer({'state': 'ready'}), isNull);
      expect(TimeDecisions.fromServer({'state': 'ready', 'rows': ['x']}), isNull);
      expect(TimeDecisions.fromServer({'state': 'odd', 'message': 'x'}), isNull);
    });
  });

  test('the words the app adds keep the copy rules', () {
    final words = [
      ResultCopy.replayAnsweredBy('16:42', 17, 50, 13),
      ResultCopy.replayAnsweredBy('16:42', 17, 50, null),
      ResultCopy.replayClockSpoken('16:42'),
      ResultCopy.replayMapSpoken(17, 18, 50),
      ResultCopy.replayBarSpoken(10, 'right', '8:17', '10:22', ['Away 1m 10s']),
      ResultCopy.replayBarSpoken(28, 'blank', '24:49', '26:54', const []),
      const ReplayLabels().evenPaceNote,
    ];
    for (final w in words) {
      expect(w.contains('!') || w.contains('—') || w.contains('·'), isFalse, reason: w);
      expect(RegExp(r'would have|could have|potential', caseSensitive: false).hasMatch(w), isFalse, reason: w);
    }
    expect(ResultCopy.replayBarSpoken(10, 'right', '8:17', '10:22', ['Away 1m 10s']), 'Question 10, right, on screen from 8:17 to 10:22. Away 1m 10s. Open the answer.');
  });
}
