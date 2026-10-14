import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';

/// A clock with controllable monotonic and wall sources.
class Sources {
  int mono = 5000;
  int wall = 1700000000000;

  SessionClock clock() => SessionClock(monotonicMs: () => mono, wallMs: () => wall);

  void advance(int ms, {bool wallToo = true}) {
    mono += ms;
    if (wallToo) wall += ms;
  }
}

void main() {
  const serverNow = 1000000;
  const startedAt = 1000000 - 12000; // 12 s ago on the server
  const expiresAt = startedAt + 3600000;

  test('anchors on receipt from the server numbers', () {
    final s = Sources();
    final clock = s.clock()..anchor(serverNowMs: serverNow, startedAtMs: startedAt, expiresAtMs: expiresAt);
    // 12 s already elapsed on the server, 3588 s left.
    expect(clock.elapsedMs, 12000);
    expect(clock.remainingMs, 3600000 - 12000);
    expect(clock.durationMs, 3600000);
    expect(clock.isOver, isFalse);
  });

  test('elapsed and remaining follow the monotonic clock', () {
    final s = Sources();
    final clock = s.clock()..anchor(serverNowMs: serverNow, startedAtMs: startedAt, expiresAtMs: expiresAt);
    s.advance(30000);
    expect(clock.elapsedMs, 42000);
    expect(clock.remainingMs, 3600000 - 42000);
  });

  test('a start in the future (clock skew) never gives negative elapsed', () {
    final s = Sources();
    final clock = s.clock()..anchor(serverNowMs: 1000, startedAtMs: 5000, expiresAtMs: 605000);
    expect(clock.elapsedMs, 0);
    expect(clock.remainingMs, 604000);
  });

  test('an already expired session has zero remaining and is over', () {
    final s = Sources();
    final clock = s.clock()..anchor(serverNowMs: 700000, startedAtMs: 0, expiresAtMs: 600000);
    expect(clock.remainingMs, 0);
    expect(clock.isOver, isTrue);
  });

  test('the deadline is reached exactly when the remaining time has passed', () {
    final s = Sources();
    final clock = s.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 60000);
    s.advance(59999);
    expect(clock.isOver, isFalse);
    s.advance(1);
    expect(clock.isOver, isTrue);
    s.advance(5000);
    expect(clock.remainingMs, 0);
  });

  group('event at', () {
    test('is an integer of elapsed milliseconds', () {
      final s = Sources();
      final clock = s.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      s.advance(1234);
      expect(clock.eventAt(0), 1234);
      expect(clock.eventAt(0), isA<int>());
    });

    test('never decreases: a later call with the same elapsed returns the previous at', () {
      final s = Sources();
      final clock = s.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      s.advance(1000);
      expect(clock.eventAt(5000), 5000);
      expect(clock.eventAt(1000), 1000);
    });

    test('does not move when the wall clock is changed', () {
      final s = Sources();
      final clock = s.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      s.advance(10000);
      final before = clock.eventAt(0);
      s.wall += 3 * 3600 * 1000; // the student sets the phone clock 3 hours ahead
      expect(clock.eventAt(0), before);
      expect(clock.remainingMs, 590000);
    });
  });

  group('resync', () {
    test('catches up time the phone spent asleep (monotonic stopped, wall moved)', () {
      final s = Sources();
      final clock = s.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      s.advance(10000);
      s.advance(120000, wallToo: true); // wall advances 120 s
      s.mono -= 120000; // but the monotonic clock did not move during sleep
      clock.resync();
      expect(clock.elapsedMs, 130000);
      expect(clock.remainingMs, 470000);
    });

    test('ignores small differences', () {
      final s = Sources();
      final clock = s.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      s.advance(10000);
      s.wall += 1500;
      clock.resync();
      expect(clock.elapsedMs, 10000);
    });

    test('never gives time back when the wall clock moves backwards', () {
      final s = Sources();
      final clock = s.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      s.advance(10000);
      s.wall -= 3600000;
      clock.resync();
      expect(clock.elapsedMs, 10000);
    });
  });

  group('restore after a process kill', () {
    test('rebuilds from the wall-clock estimates in the draft', () {
      final first = Sources();
      final clock = first.clock()..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      first.advance(100000);
      final startedRef = clock.startedRefWallMs;
      final endsAt = clock.endsAtWallMs;

      // New process: fresh monotonic origin, wall clock 40 s later.
      final second = Sources()
        ..mono = 123
        ..wall = first.wall + 40000;
      final restored = second.clock()..restore(startedRefWallMs: startedRef, endsAtWallMs: endsAt);
      expect(restored.elapsedMs, 140000);
      expect(restored.remainingMs, 460000);
      expect(restored.durationMs, 600000);
    });

    test('a deadline that passed while away restores as over', () {
      final s = Sources();
      final clock = s.clock()..restore(startedRefWallMs: s.wall - 700000, endsAtWallMs: s.wall - 100000);
      expect(clock.isOver, isTrue);
      expect(clock.remainingMs, 0);
    });
  });
}
