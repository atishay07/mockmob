// Regression tests for the core sync bug hunt (14 Oct 2026): sync-storage-api-06 and 07.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';

class _FakeAuth extends AuthController {
  _FakeAuth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;

  void switchTo(AuthSnapshot next) => state = next;
}

/// What the probe does on its next read, per account.
class _Script {
  final Map<String, Completer<String>> fetches = {};
  Object? cacheFailure;
  Object? writeFailure;
  Object? fetchFailure;
  final List<String> fetchedFor = [];
}

final _script = _Script();

class _Probe extends RemoteNotifier<String> {
  @override
  Future<CachedValue<String>?> readCache(String userId) async {
    final failure = _script.cacheFailure;
    if (failure != null) throw failure;
    return null;
  }

  @override
  Future<Fetched<String>> fetchRemote() async {
    final id = userId!;
    _script.fetchedFor.add(id);
    final failure = _script.fetchFailure;
    if (failure != null) throw failure;
    final c = _script.fetches.putIfAbsent(id, Completer<String>.new);
    return Fetched(await c.future, null);
  }

  @override
  Future<void> writeCache(String userId, Fetched<String> fetched, DateTime at) async {
    final failure = _script.writeFailure;
    if (failure != null) throw failure;
  }
}

final _probeProvider = NotifierProvider<_Probe, RemoteState<String>>(_Probe.new);

AuthSnapshot _user(String id) => AuthSnapshot(status: AuthStatus.signedIn, userId: id);

void main() {
  late ProviderContainer container;
  late _FakeAuth auth;

  setUp(() {
    _script.fetches.clear();
    _script.fetchedFor.clear();
    _script.cacheFailure = null;
    _script.writeFailure = null;
    _script.fetchFailure = null;
    container = ProviderContainer(overrides: [
      authSnapshotProvider.overrideWith(() => auth = _FakeAuth(_user('a'))),
      nowProvider.overrideWithValue(() => DateTime.utc(2026, 10, 14, 10)),
    ]);
  });

  tearDown(() => container.dispose());

  /// Opens the provider once the test has set up its script.
  void open() => container.listen(_probeProvider, (_, _) {});

  Future<void> settle() async {
    for (var i = 0; i < 20; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  group('sync-storage-api-06: no spinner forever', () {
    test('a failed cache write still shows the fresh value', () async {
      _script.writeFailure = StateError('disk full');
      open();
      await settle();
      _script.fetches['a']!.complete('fresh');
      await settle();
      final s = container.read(_probeProvider);
      expect(s.value, 'fresh');
      expect(s.loading, isFalse);
    });

    test('an unreadable cache falls through to the network', () async {
      _script.cacheFailure = const FormatException('bad row');
      open();
      await settle();
      _script.fetches['a']!.complete('fresh');
      await settle();
      expect(container.read(_probeProvider).value, 'fresh');
    });

    test('an unexpected failure is a failed read, not a spinner', () async {
      _script.fetchFailure = StateError('locked database');
      open();
      await settle();
      final s = container.read(_probeProvider);
      expect(s.loading, isFalse);
      expect(s.isFailedEmpty, isTrue);
    });
  });

  group('sync-storage-api-07: a read for one account never lands in the next', () {
    test("A's late reply is dropped and B gets its own read", () async {
      open();
      await settle();
      expect(_script.fetchedFor, ['a']);

      auth.switchTo(_user('b'));
      container.read(_probeProvider);
      await settle();
      expect(_script.fetchedFor, ['a', 'b']);

      _script.fetches['a']!.complete("A's attempts");
      await settle();
      expect(container.read(_probeProvider).value, isNull);

      _script.fetches['b']!.complete("B's attempts");
      await settle();
      expect(container.read(_probeProvider).value, "B's attempts");
    });
  });
}
