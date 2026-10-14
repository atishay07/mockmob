// Regression for ROBUSTNESS you-02 (rhythm half): a stored-preference read that is still in
// flight must never overwrite a choice the student just made, and the read must use the keys of
// the account that asked for it.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';

/// A store whose reads wait for [release], so a test can act while a read is in flight.
class _GatedStore extends MemoryPrefsStore {
  final Completer<void> gate = Completer<void>();
  int reads = 0;

  void release() => gate.complete();

  @override
  Future<bool?> getBool(String key) async {
    reads++;
    await gate.future;
    return super.getBool(key);
  }

  @override
  Future<String?> getString(String key) async {
    await gate.future;
    return super.getString(key);
  }
}

class _User extends Notifier<String?> {
  @override
  String? build() => 'u1';

  void set(String? id) => state = id;
}

final _userProvider = NotifierProvider<_User, String?>(_User.new);

void main() {
  late _GatedStore store;
  late ProviderContainer container;

  setUp(() {
    store = _GatedStore();
    container = ProviderContainer(
      overrides: [
        userIdProvider.overrideWith((ref) => ref.watch(_userProvider)),
        rhythmPrefsStoreProvider.overrideWithValue(store),
      ],
    );
  });

  tearDown(() => container.dispose());

  RhythmPrefs prefs() => container.read(rhythmPrefsProvider.notifier);

  test('Turn off rhythm tapped while the load is in flight is not undone by the load', () async {
    store.values['rhythm_hidden_u1'] = false;
    final loading = prefs().ensureLoaded();
    await Future<void>.delayed(Duration.zero);
    expect(store.reads, greaterThan(0), reason: 'the read is in flight');

    await prefs().setHidden(true);
    store.release();
    await loading;

    expect(container.read(rhythmPrefsProvider).hidden, isTrue);
    expect(container.read(rhythmVisibleProvider), isFalse);
    expect(store.values['rhythm_hidden_u1'], isTrue, reason: 'the screen and the store agree');
  });

  test('a Celebrations choice made during the load wins, and the untouched field still loads', () async {
    store.values['rhythm_hidden_u1'] = true;
    store.values['rhythm_celebrations_u1'] = CelebrationMode.full.name;
    final loading = prefs().ensureLoaded();
    await Future<void>.delayed(Duration.zero);

    await prefs().setMode(CelebrationMode.quiet);
    store.release();
    await loading;

    final state = container.read(rhythmPrefsProvider);
    expect(state.mode, CelebrationMode.quiet, reason: 'the tap wins');
    expect(state.hidden, isTrue, reason: 'the field that was not touched is filled from the store');
    expect(state.loaded, isTrue);
  });

  test('a read that began for one account does not fill the state of the next account', () async {
    store.values['rhythm_hidden_u1'] = true;
    store.values['rhythm_celebrations_u1'] = CelebrationMode.off.name;
    final first = prefs().ensureLoaded();
    await Future<void>.delayed(Duration.zero);

    container.read(_userProvider.notifier).set('u2');
    // Reading the provider again rebuilds it for u2 while the u1 read is still waiting.
    expect(container.read(rhythmPrefsProvider).loaded, isFalse);
    store.release();
    await first;
    await prefs().ensureLoaded();

    final state = container.read(rhythmPrefsProvider);
    expect(state.hidden, isFalse, reason: 'u2 never turned rhythm off');
    expect(state.mode, CelebrationMode.full, reason: 'u1 chose Off; u2 has not chosen');
  });

  test('a write made after the account changed goes to the key of the account that made it', () async {
    store.release();
    await prefs().ensureLoaded();
    final write = prefs().setHidden(true);
    container.read(_userProvider.notifier).set('u2');
    await write;
    expect(store.values['rhythm_hidden_u1'], isTrue);
    expect(store.values.containsKey('rhythm_hidden_u2'), isFalse);
  });
}
