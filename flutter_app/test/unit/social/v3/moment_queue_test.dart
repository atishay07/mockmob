// The den's moment queue and K5 (spec 5.6 "Moment queue", 5.3 K5).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/moment_queue.dart';
import 'package:mockmob/features/social/v3/screens/moment_overlay.dart';

void main() {
  test('order: quest done, week stitched, reveal, then chain milestones; rest notices are not moments', () {
    final keys = momentOrder(['reveal:hop', 'rest:2026-10-18', 'stitch:2026-10-19', 'quest_done:2026-10-19'], ['chain:14', 'quest_done:2026-10-19']);
    expect(keys, ['quest_done:2026-10-19', 'stitch:2026-10-19', 'reveal:hop', 'chain:14']);
  });

  test('Mob-scoped keys order the same way', () {
    final keys = momentOrder(['reveal:hop', 'stitch:mob-1:2026-10-19', 'quest_done:mob-1:2026-10-19'], ['chain:14']);
    expect(keys, ['quest_done:mob-1:2026-10-19', 'stitch:mob-1:2026-10-19', 'reveal:hop', 'chain:14']);
  });

  test('each moment is marked seen after it closes, one at a time', () async {
    final log = <String>[];
    final played = await runMomentQueue(
      keys: ['quest_done:w', 'stitch:w'],
      canPlay: () => true,
      play: (k) async {
        log.add('play $k');
        return null;
      },
      seen: (k) async => log.add('seen ${k.join()}'),
    );
    expect(played, ['quest_done:w', 'stitch:w']);
    expect(log, ['play quest_done:w', 'seen quest_done:w', 'play stitch:w', 'seen stitch:w']);
  });

  test('the queue stops while the den is covered (a run) and resumes later', () async {
    var covered = false;
    final memory = DenSessionMemory();
    final seen = <String>[];
    final first = await runMomentQueue(
      keys: ['quest_done:w', 'stitch:w'],
      canPlay: () => !covered,
      play: (k) async {
        covered = true;
        return null;
      },
      seen: (k) async => seen.addAll(k),
      played: memory.playedMoments,
    );
    expect(first, ['quest_done:w']);
    covered = false;
    final second = await runMomentQueue(keys: ['quest_done:w', 'stitch:w'], canPlay: () => !covered, play: (k) async => null, seen: (k) async => seen.addAll(k), played: memory.playedMoments);
    expect(second, ['stitch:w']);
    expect(seen, ['quest_done:w', 'stitch:w']);
  });

  test('a moment shown inside another (K4 inside K2) is marked seen with it and not played again', () async {
    final log = <String>[];
    final shown = await runMomentQueue(
      keys: ['quest_done:w', 'stitch:w', 'reveal:hop'],
      canPlay: () => true,
      play: (k) async {
        log.add('play $k');
        return k == 'quest_done:w' ? ['quest_done:w', 'reveal:hop'] : null;
      },
      seen: (k) async => log.add('seen ${k.join(',')}'),
    );
    expect(shown, ['quest_done:w', 'reveal:hop', 'stitch:w']);
    expect(log, ['play quest_done:w', 'seen quest_done:w,reveal:hop', 'play stitch:w', 'seen stitch:w']);
  });

  test('a moment that fails to open is not marked seen', () async {
    final seen = <String>[];
    final memory = DenSessionMemory();
    await runMomentQueue(keys: ['reveal:hop'], canPlay: () => true, play: (k) async => throw StateError('no route'), seen: (k) async => seen.addAll(k), played: memory.playedMoments);
    expect(seen, isEmpty);
    expect(memory.playedMoments, isEmpty);
  });

  test('K5: one pass notice a day, only rested ones, never with the chain hidden', () {
    const chain = ChainState(
      days: 12,
      notices: [ChainNotice(key: 'rest:2026-10-16', kind: 'rested', day: '2026-10-16', days: 12)],
    );
    final n = passNoticeFor(chain, today: '2026-10-22');
    expect(n?.key, 'rest:2026-10-16');
    expect(passNoticeText(n!, chain), 'Friday was covered by a rest pass. Your chain is still 12.');
    expect(passNoticeFor(chain, today: '2026-10-22', shownOn: '2026-10-22'), isNull);
    expect(passNoticeFor(chain, today: '2026-10-23', shownOn: '2026-10-22'), isNotNull);
    expect(
      passNoticeFor(
        const ChainState(
          hidden: true,
          notices: [ChainNotice(key: 'k', kind: 'rested')],
        ),
        today: 'x',
      ),
      isNull,
    );
    expect(
      passNoticeFor(
        const ChainState(
          notices: [ChainNotice(key: 'k', kind: 'made_up')],
        ),
        today: 'x',
      ),
      isNull,
    );
  });

  test('IST day key', () {
    expect(istDayKey(DateTime.utc(2026, 10, 22, 19, 0)), '2026-10-23');
    expect(istDayKey(DateTime.utc(2026, 10, 22, 15, 10)), '2026-10-22');
  });

  group('walk 19 Oct fixes', () {
    ChainState chain(int days, {bool done = false, List<String> due = const []}) => ChainState.fromJson({
          'days': days,
          'today': {'answered': done ? 5 : 2, 'needed': 5, 'done': done},
          'due': due,
        });

    test('K1: a stale chain read is read again when the den chip disagrees, so chain:14 plays', () async {
      var fresh = 0;
      final due = await chainDueFor(
        const ChainChip(days: 14, todayDone: true),
        cached: () async => chain(13),
        fresh: () async {
          fresh++;
          return chain(14, done: true, due: ['chain:14']);
        },
      );
      expect(due, ['chain:14']);
      expect(fresh, 1);
    });

    test('K1: an up-to-date chain is not read twice', () async {
      var fresh = 0;
      final due = await chainDueFor(
        const ChainChip(days: 14, todayDone: true),
        cached: () async => chain(14, done: true, due: ['chain:14']),
        fresh: () async {
          fresh++;
          return chain(14, done: true);
        },
      );
      expect(due, ['chain:14']);
      expect(fresh, 0);
    });

    testWidgets('H3: the default player returns every key the overlay showed in place, so none plays twice', (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      // A stale record from before is dropped when the next moment starts.
      container.read(momentsShownProvider.notifier).add('stale:1');
      late BuildContext ctx;
      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: MaterialApp(home: Builder(builder: (c) {
          ctx = c;
          return const SizedBox();
        })),
      ));
      final player = container.read(momentPlayerProvider);
      final future = player(ctx, 'quest_done:m:w');
      // The overlay shows K2, then K3 and K4 in place, and closes (with no den here it closes itself).
      final shown = container.read(momentsShownProvider.notifier);
      shown.add('quest_done:m:w');
      shown.add('stitch:m:w');
      shown.add('reveal:hop');
      await tester.pumpAndSettle();
      expect(await future, ['quest_done:m:w', 'stitch:m:w', 'reveal:hop']);

      // The queue then skips the reveal it was going to play next.
      final log = <String>[];
      final memory = DenSessionMemory();
      await runMomentQueue(
        keys: ['quest_done:m:w', 'stitch:m:w', 'reveal:hop'],
        canPlay: () => true,
        play: (k) async {
          log.add(k);
          return ['quest_done:m:w', 'stitch:m:w', 'reveal:hop'];
        },
        seen: (k) async {},
        played: memory.playedMoments,
      );
      expect(log, ['quest_done:m:w'], reason: 'each moment exactly once');
    });
  });
}
