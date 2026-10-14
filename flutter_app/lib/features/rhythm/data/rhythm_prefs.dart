// Two per-phone choices of this feature: whether rhythm is turned off, and the Celebrations
// setting (Full, Quiet, Off). `AppPrefs` has no keys for them and core is not edited here, so they
// live in the same shared-preferences store under keys of their own, one per account.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/local_scope.dart';
import '../../../core/storage/prefs_store.dart';

enum CelebrationMode {
  full,
  quiet,
  off;

  static CelebrationMode fromName(String? name) => values.asNameMap()[name] ?? CelebrationMode.full;
}

class RhythmPrefsState {
  const RhythmPrefsState({this.loaded = false, this.hidden = false, this.mode = CelebrationMode.full});

  /// False until the stored choices have been read, so a hidden strip never flashes.
  final bool loaded;

  /// "Turn off rhythm": the strip and the cards are hidden everywhere. Records stay.
  final bool hidden;
  final CelebrationMode mode;

  RhythmPrefsState copyWith({bool? loaded, bool? hidden, CelebrationMode? mode}) =>
      RhythmPrefsState(loaded: loaded ?? this.loaded, hidden: hidden ?? this.hidden, mode: mode ?? this.mode);
}

/// Replaced with a [MemoryPrefsStore] in tests.
final rhythmPrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

class RhythmPrefs extends Notifier<RhythmPrefsState> {
  Completer<void>? _loading;

  /// Bumped every time the notifier is rebuilt (an account switch). A read that started under an
  /// earlier generation belongs to the previous account and must not touch the new state.
  int _generation = 0;

  /// A choice made while the stored values were still being read. The student's tap always wins:
  /// the read then fills only the fields that were not touched.
  bool _hiddenTouched = false;
  bool _modeTouched = false;

  String? get _user => ref.read(userIdProvider);
  static String _keyFor(String? user, String name) => 'rhythm_${name}_${user ?? 'none'}';

  @override
  RhythmPrefsState build() {
    ref.watch(userIdProvider);
    _generation++;
    _hiddenTouched = false;
    _modeTouched = false;
    _loading = null;
    scheduleMicrotask(ensureLoaded);
    return const RhythmPrefsState();
  }

  /// Reads the stored choices once. Safe to call from anywhere and to await.
  Future<void> ensureLoaded() {
    final existing = _loading;
    if (existing != null) return existing.future;
    final done = _loading = Completer<void>();
    // Both keys are for the account that asked, read once before the first await.
    final generation = _generation;
    final user = _user;
    () async {
      final store = ref.read(rhythmPrefsStoreProvider);
      try {
        final hidden = await store.getBool(_keyFor(user, 'hidden')) ?? false;
        final mode = CelebrationMode.fromName(await store.getString(_keyFor(user, 'celebrations')));
        if (ref.mounted && generation == _generation) {
          state = RhythmPrefsState(
            loaded: true,
            hidden: _hiddenTouched ? state.hidden : hidden,
            mode: _modeTouched ? state.mode : mode,
          );
        }
      } on Object {
        if (ref.mounted && generation == _generation) state = state.copyWith(loaded: true);
      } finally {
        done.complete();
      }
    }();
    return done.future;
  }

  Future<void> setHidden(bool hidden) async {
    _hiddenTouched = true;
    final user = _user;
    state = state.copyWith(hidden: hidden, loaded: true);
    await ref.read(rhythmPrefsStoreProvider).setBool(_keyFor(user, 'hidden'), hidden);
  }

  Future<void> setMode(CelebrationMode mode) async {
    _modeTouched = true;
    final user = _user;
    state = state.copyWith(mode: mode, loaded: true);
    await ref.read(rhythmPrefsStoreProvider).setString(_keyFor(user, 'celebrations'), mode.name);
  }
}

final rhythmPrefsProvider = NotifierProvider<RhythmPrefs, RhythmPrefsState>(RhythmPrefs.new);

/// True once the choices are read and the student has not turned rhythm off. Today shows the
/// week strip and the weekly cards only while this is true.
final rhythmVisibleProvider = Provider<bool>((ref) {
  final prefs = ref.watch(rhythmPrefsProvider);
  return prefs.loaded && !prefs.hidden;
});

final celebrationModeProvider = Provider<CelebrationMode>((ref) => ref.watch(rhythmPrefsProvider.select((p) => p.mode)));
