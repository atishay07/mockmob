import 'package:flutter/widgets.dart' show AppLifecycleState;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/runner/logic/sheet_cells.dart';
import 'package:mockmob/features/runner/nta/nta_chip.dart';
import 'package:mockmob/features/runner/nta/nta_copy.dart';
import 'package:mockmob/features/runner/nta/nta_integrity.dart';

SheetCell _cell({bool answered = false, bool visited = false, bool marked = false}) =>
    SheetCell(number: 1, answered: answered, visited: visited, marked: marked, unsynced: false, current: false);

void main() {
  group('palette states', () {
    test('follow the exam precedence', () {
      expect(NtaChipState.of(_cell(answered: true, visited: true, marked: true)), NtaChipState.answeredMarked);
      expect(NtaChipState.of(_cell(marked: true)), NtaChipState.marked);
      expect(NtaChipState.of(_cell(answered: true, visited: true)), NtaChipState.answered);
      expect(NtaChipState.of(_cell(visited: true)), NtaChipState.notAnswered);
      expect(NtaChipState.of(_cell()), NtaChipState.notVisited);
    });

    test('counts are exclusive and add up to the total', () {
      final counts = NtaCounts.of([
        _cell(answered: true, visited: true),
        _cell(answered: true, visited: true, marked: true),
        _cell(visited: true, marked: true),
        _cell(visited: true),
        _cell(),
        _cell(),
      ]);
      expect([for (final s in NtaChipState.values) counts[s]], [1, 1, 2, 1, 1]);
      expect(counts.answeredAll, 2);
      expect(counts.pending, 4);
      expect(counts.markedAll, 2);
    });
  });

  group('copy', () {
    test('the exam clock never shows hours', () {
      expect(NtaCopy.clock(const Duration(minutes: 60)), '60:00');
      expect(NtaCopy.clock(const Duration(minutes: 4, seconds: 3)), '4:03');
      expect(NtaCopy.clock(const Duration(seconds: -2)), '0:00');
    });

    test('the confirm line names what is left', () {
      expect(NtaCopy.confirmLine(pending: 5, marked: 4), 'You have 5 unanswered questions and 4 marked for review. Submit anyway?');
      expect(NtaCopy.confirmLine(pending: 1, marked: 0), 'You have 1 unanswered question. Submit anyway?');
      expect(NtaCopy.confirmLine(pending: 0, marked: 0), 'Every question has an answer.');
    });

    test('warning body counts down to the last warning', () {
      expect(NtaCopy.warningBody('You left the exam screen', 1), contains('Two more warnings'));
      expect(NtaCopy.warningBody('You left the exam screen', 2), contains('One more warning'));
    });
  });

  group('integrity guard', () {
    late MemoryPrefsStore store;
    late int terminations;
    var live = true;

    NtaIntegrity guard({String id = 's1'}) {
      final g = NtaIntegrity(
        sessionId: id,
        store: store,
        onTerminate: () => terminations++,
        isLive: () => live,
        inactiveGrace: const Duration(milliseconds: 60),
      );
      addTearDown(g.dispose);
      return g;
    }

    setUp(() {
      store = MemoryPrefsStore();
      terminations = 0;
      live = true;
    });

    test('one warning per absence, and answering waits for the acknowledgement', () async {
      final g = guard();
      await g.load();
      g
        ..onLeft()
        ..onLeft();
      expect(g.strikes, 1);
      expect(g.locksAnswers, isTrue);
      g.onReturned();
      expect(g.locksAnswers, isTrue);
      g.acknowledge();
      expect(g.locksAnswers, isFalse);
      g.onLeft();
      expect(g.strikes, 2);
      expect(store.values['nta.strikes.s1'], 2);
    });

    test('the third warning ends the session once', () async {
      final g = guard();
      await g.load();
      for (var i = 0; i < 3; i++) {
        g
          ..onLeft()
          ..onReturned()
          ..acknowledge();
      }
      g.onLeft();
      expect(g.strikes, 3);
      expect(g.terminated, isTrue);
      expect(terminations, 1);
      expect(g.locksAnswers, isTrue);
    });

    test('a short cover is free, a long one counts', () async {
      final g = guard();
      g.onInactive();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      g.onReturned();
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(g.strikes, 0);
      g.onInactive();
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(g.strikes, 1);
      expect(g.lastViolation, NtaViolation.window);
    });

    test('nothing counts after a submit started', () async {
      final g = guard();
      await g.load();
      live = false;
      g.onLeft();
      expect(g.strikes, 0);
    });

    test('the count survives a restart; an absence is not counted twice', () async {
      final first = guard();
      await first.load();
      first.onLeft();
      first.dispose();
      await Future<void>.delayed(Duration.zero);

      final second = guard();
      await second.load();
      expect(second.strikes, 1);
      expect(second.showing, isTrue, reason: 'the warning is shown on return');
    });

    test('a paper reopened without a recorded absence is the restored warning', () async {
      final first = guard();
      await first.load();
      first.dispose();

      final second = guard();
      await second.load();
      expect(second.strikes, 1);
      expect(second.lastViolation, NtaViolation.restored);
      second.acknowledge();
      expect(second.locksAnswers, isFalse, reason: 'restored is not an absence that is still going on');
    });

    test('the same paper rebuilt on screen while its guard is alive is not the restored warning', () async {
      final first = guard();
      await first.load();
      // A remount: the new screen's guard is made before the old screen's is disposed.
      final second = guard();
      final loading = second.load();
      first.dispose();
      await loading;
      expect(second.strikes, 0);
      expect(second.showing, isFalse);
      expect(store.values['nta.strikes.s1'], isNull);
    });

    test('dispose twice is harmless', () {
      guard()
        ..dispose()
        ..dispose();
    });

    test('a stored third warning submits on open', () async {
      store.values['nta.strikes.s1'] = 3;
      final g = guard();
      await g.load();
      expect(g.terminated, isTrue);
      expect(terminations, 1);
    });

    group('the 3 s inactive grace (owner decision 14 Oct 2026), on a fake clock', () {
      // The real default, not the short test grace above.
      NtaIntegrity real() => NtaIntegrity(sessionId: 's1', store: store, onTerminate: () => terminations++, isLive: () => live);

      test('the default is 3 s', () {
        expect(NtaIntegrity.defaultInactiveGrace, const Duration(seconds: 3));
        final g = real();
        expect(g.inactiveGrace, NtaIntegrity.defaultInactiveGrace);
        g.dispose();
      });

      testWidgets('a 2 s cover does not count', (tester) async {
        final g = real();
        g.onInactive();
        await tester.pump(const Duration(seconds: 2));
        g.onReturned();
        await tester.pump(const Duration(seconds: 4));
        expect(g.strikes, 0);
        g.dispose();
      });

      testWidgets('a 4 s cover counts once', (tester) async {
        final g = real();
        g.onInactive();
        await tester.pump(const Duration(milliseconds: 2999));
        expect(g.strikes, 0);
        await tester.pump(const Duration(milliseconds: 1001));
        expect(g.strikes, 1);
        expect(g.lastViolation, NtaViolation.window);
        // Still covered: the same absence is not counted again.
        g.onInactive();
        await tester.pump(const Duration(seconds: 5));
        expect(g.strikes, 1);
        g.dispose();
      });

      testWidgets('a return re-arms the grace from zero', (tester) async {
        final g = real();
        g.onInactive();
        await tester.pump(const Duration(seconds: 2));
        g.onReturned();
        g.onInactive();
        await tester.pump(const Duration(seconds: 2));
        expect(g.strikes, 0, reason: '4 s in all, but never 3 s in one go');
        await tester.pump(const Duration(milliseconds: 1100));
        expect(g.strikes, 1);
        g.dispose();
      });
    });

    group('the app lifecycle, as the website reads the tab (M-003)', () {
      NtaIntegrity real() => NtaIntegrity(sessionId: 's1', store: store, onTerminate: () => terminations++, isLive: () => live);

      testWidgets('a notification shade pulled for 2 s (inactive, then resumed) is forgiven', (tester) async {
        final g = real();
        await g.load();
        g.onLifecycle(AppLifecycleState.inactive);
        await tester.pump(const Duration(seconds: 2));
        g.onLifecycle(AppLifecycleState.resumed);
        await tester.pump(const Duration(seconds: 5));
        expect(g.strikes, 0);
        expect(g.locksAnswers, isFalse);
        g.dispose();
      });

      testWidgets('a shade held past 3 s counts once', (tester) async {
        final g = real();
        await g.load();
        g.onLifecycle(AppLifecycleState.inactive);
        await tester.pump(const Duration(milliseconds: 3100));
        expect(g.strikes, 1);
        g.onLifecycle(AppLifecycleState.resumed);
        g.dispose();
      });

      testWidgets('a deliberate switch (inactive, hidden, paused) counts at once, and only once', (tester) async {
        final g = real();
        await g.load();
        g.onLifecycle(AppLifecycleState.inactive);
        await tester.pump(const Duration(milliseconds: 300));
        g.onLifecycle(AppLifecycleState.hidden);
        expect(g.strikes, 1, reason: 'no 3 s grace for a real switch');
        g.onLifecycle(AppLifecycleState.paused);
        await tester.pump(const Duration(seconds: 6));
        expect(g.strikes, 1, reason: 'the pending cover was dropped and the absence counts once');
        expect(g.lastViolation, NtaViolation.left);
        g.dispose();
      });

      testWidgets('three deliberate switches end the paper, with no grace between them', (tester) async {
        final g = real();
        await g.load();
        for (var i = 0; i < 3; i++) {
          g.onLifecycle(AppLifecycleState.hidden);
          g.onLifecycle(AppLifecycleState.resumed);
          g.acknowledge();
        }
        expect(g.strikes, 3);
        expect(g.terminated, isTrue);
        expect(terminations, 1);
        g.dispose();
      });

      testWidgets('a switch right after the shade, with the first return in between, still counts', (tester) async {
        final g = real();
        await g.load();
        g.onLifecycle(AppLifecycleState.inactive);
        await tester.pump(const Duration(seconds: 1));
        g.onLifecycle(AppLifecycleState.resumed);
        g.onLifecycle(AppLifecycleState.hidden);
        expect(g.strikes, 1);
        g.dispose();
      });

      testWidgets('detached counts nothing', (tester) async {
        final g = real();
        await g.load();
        g.onLifecycle(AppLifecycleState.detached);
        expect(g.strikes, 0);
        g.dispose();
      });
    });

    test('clear forgets the session', () async {
      final g = guard();
      await g.load();
      g.onLeft();
      await Future<void>.delayed(Duration.zero);
      await g.clear();
      expect(store.values.keys.where((k) => k.contains('s1')), isEmpty);
    });
  });
}
