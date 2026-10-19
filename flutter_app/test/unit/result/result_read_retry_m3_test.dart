// M3 (walk, 19 Oct): the full-mock result and "Replay recap" stayed on "Your result is taking longer to load" while the
// server answered in 8 s, and Try again did not recover in a minute. Two causes in the app, both fixed here:
//  * a forced read joined the queue behind the read it was meant to replace, so Try again did nothing for as long as
//    that read stalled (a request runs 30 s and is tried twice more before it gives up): a Try again now restarts;
//  * the reveal waited for the whole attempts list (a heavy read) to number the mock, with no limit: it waits 8 s.
import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/result/data/result_providers.dart';

class _Auth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
}

/// A server whose every answer the test holds back: the "fake slow client".
class _SlowReads {
  final List<Completer<String>> calls = [];
}

final _slow = _SlowReads();

class _Probe extends RemoteNotifier<String> {
  @override
  bool get autoLoad => false;

  @override
  Future<CachedValue<String>?> readCache(String userId) async => null;

  @override
  Future<Fetched<String>> fetchRemote() async {
    final c = Completer<String>();
    _slow.calls.add(c);
    return Fetched(await c.future, null);
  }

  @override
  Future<void> writeCache(String userId, Fetched<String> fetched, DateTime at) async {}
}

final _probe = NotifierProvider<_Probe, RemoteState<String>>(_Probe.new);

void main() {
  late ProviderContainer container;

  setUp(() {
    _slow.calls.clear();
    container = ProviderContainer(overrides: [
      authSnapshotProvider.overrideWith(_Auth.new),
      nowProvider.overrideWithValue(() => DateTime.utc(2026, 10, 19, 10)),
    ]);
    container.listen(_probe, (_, _) {});
  });
  tearDown(() => container.dispose());

  test('a plain forced read still waits for the running one (a change must not be read from an older answer)', () async {
    unawaited(container.read(_probe.notifier).refresh());
    await Future<void>.delayed(Duration.zero);
    expect(_slow.calls, hasLength(1));
    unawaited(container.read(_probe.notifier).refresh(force: true));
    await Future<void>.delayed(Duration.zero);
    expect(_slow.calls, hasLength(1), reason: 'it queues behind the running read');
  });

  test('Try again (restart) asks at once even while a read is stalled, and its answer lands', () async {
    unawaited(container.read(_probe.notifier).refresh());
    await Future<void>.delayed(Duration.zero);
    expect(container.read(_probe).loading, isTrue);

    // The student taps Try again while the first request is still out.
    unawaited(container.read(_probe.notifier).restart());
    await Future<void>.delayed(Duration.zero);
    expect(_slow.calls, hasLength(2), reason: 'a second request went out at once');

    _slow.calls[1].complete('the result');
    await Future<void>.delayed(Duration.zero);
    expect(container.read(_probe).value, 'the result');
    expect(container.read(_probe).loading, isFalse);
    expect(container.read(_probe).error, isNull);

    // The stalled read finally gives up: its failure is not the screen's story any more.
    _slow.calls[0].completeError(const ApiError(kind: ApiErrorKind.timeout, code: 'timeout'));
    await Future<void>.delayed(Duration.zero);
    expect(container.read(_probe).value, 'the result');
    expect(container.read(_probe).error, isNull);
  });

  test('the older read failing first does not show an error while the restarted read is still running', () async {
    unawaited(container.read(_probe.notifier).refresh());
    await Future<void>.delayed(Duration.zero);
    unawaited(container.read(_probe.notifier).restart());
    await Future<void>.delayed(Duration.zero);
    _slow.calls[0].completeError(const ApiError(kind: ApiErrorKind.timeout, code: 'timeout'));
    await Future<void>.delayed(Duration.zero);
    expect(container.read(_probe).error, isNull);
    expect(container.read(_probe).loading, isTrue, reason: 'the new read is still the one being waited for');
    _slow.calls[1].complete('late but here');
    await Future<void>.delayed(Duration.zero);
    expect(container.read(_probe).value, 'late but here');
  });

  group('the reveal does not wait for the attempts list for ever', () {
    test('the rule: only while the list is read after the result, and only until the wait is over', () {
      expect(recapListPending(listStale: true, listLoading: true, gaveUp: false), isTrue);
      expect(recapListPending(listStale: true, listLoading: true, gaveUp: true), isFalse);
      expect(recapListPending(listStale: false, listLoading: true, gaveUp: false), isFalse);
      expect(recapListPending(listStale: true, listLoading: false, gaveUp: false), isFalse);
    });

    test('the wait is 8 seconds from the moment the result opens, and ends with the screen', () {
      expect(recapListWait, const Duration(seconds: 8));
      fakeAsync((async) {
        final c = ProviderContainer();
        final gone = c.listen(recapListGaveUpProvider('a7'), (_, _) {});
        expect(c.read(recapListGaveUpProvider('a7')), isFalse);
        async.elapse(const Duration(seconds: 7, milliseconds: 900));
        expect(c.read(recapListGaveUpProvider('a7')), isFalse, reason: 'a list that answers in 8 s is still waited for');
        async.elapse(const Duration(milliseconds: 200));
        expect(c.read(recapListGaveUpProvider('a7')), isTrue);
        gone.close();
        c.dispose();
      });
    });
  });
}
