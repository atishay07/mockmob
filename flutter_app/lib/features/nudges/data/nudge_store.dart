import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../../../core/storage/prefs_store.dart';
import '../nudge_rules.dart';

/// The nudges' clock: the app's, replaceable alone (the demo walks the evening kinds at any hour).
final nudgeClockProvider = Provider<DateTime Function()>((ref) => ref.watch(nowProvider));

/// The phone's preferences, where the nudges remember what they showed. Replaceable in tests and the demo.
final nudgePrefsProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

/// What one account remembers about nudges on this phone: one JSON string under `nudges.v1.<uid>`.
/// A per-phone convenience: a value that is lost only means a note may show once more.
class NudgeStore {
  const NudgeStore(this._prefs);

  final PrefsStore _prefs;

  static String keyFor(String userId) => 'nudges.v1.$userId';

  Future<NudgeMemory> load(String userId) async {
    final raw = await _prefs.getString(keyFor(userId));
    if (raw == null || raw.isEmpty) return NudgeMemory.empty;
    try {
      return NudgeMemory.fromJson(jsonDecode(raw));
    } on Object {
      return NudgeMemory.empty;
    }
  }

  Future<void> save(String userId, NudgeMemory memory) => _prefs.setString(keyFor(userId), jsonEncode(memory.toJson()));
}

final nudgeStoreProvider = Provider<NudgeStore>((ref) => NudgeStore(ref.watch(nudgePrefsProvider)));

/// Today's root is the router's top location (nothing pushed over it, no sheet the router opened). The router
/// reports every change of its location; a sheet or dialog opened without the router is checked by the card
/// itself at the moment it shows. False until the router says otherwise.
class NudgeCalmController extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool calm) {
    if (state != calm) state = calm;
  }
}

final nudgeCalmProvider = NotifierProvider<NudgeCalmController, bool>(NudgeCalmController.new);

class NudgeState {
  const NudgeState({this.userId, this.loaded = false, this.memory = NudgeMemory.empty, this.shown, this.closed = false});

  final String? userId;

  /// What was saved on the phone has been read. No nudge shows before it.
  final bool loaded;
  final NudgeMemory memory;

  /// The one nudge shown in this run of the app (not saved: a new launch is a new run).
  final NudgeOffer? shown;

  /// The shown nudge was put away in this run: its X, its key, or the sheet closed.
  final bool closed;

  bool get shownThisRun => shown != null;

  NudgeState copyWith({bool? loaded, NudgeMemory? memory, NudgeOffer? shown, bool? closed}) =>
      NudgeState(userId: userId, loaded: loaded ?? this.loaded, memory: memory ?? this.memory, shown: shown ?? this.shown, closed: closed ?? this.closed);
}

/// The nudges' memory for the signed-in account, and this run's one shown nudge.
class NudgeController extends Notifier<NudgeState> {
  @override
  NudgeState build() {
    final userId = ref.watch(authSnapshotProvider.select((s) => s.status == AuthStatus.signedIn ? s.userId : null));
    if (userId != null) unawaited(Future<void>.microtask(() => _load(userId)));
    return NudgeState(userId: userId);
  }

  Future<void> _load(String userId) async {
    final NudgeMemory memory;
    try {
      memory = await ref.read(nudgeStoreProvider).load(userId);
    } on Object {
      // The phone's preferences cannot be read: nothing is known, so no nudge shows.
      return;
    }
    if (!ref.mounted || state.userId != userId || state.loaded) return;
    state = state.copyWith(loaded: true, memory: memory);
  }

  /// Best effort, as everything here: a tap never waits for, or fails with, the phone's storage.
  void _persist() {
    final userId = state.userId;
    if (userId == null) return;
    final memory = state.memory;
    try {
      unawaited(ref.read(nudgeStoreProvider).save(userId, memory).catchError((Object _) {}));
    } on Object {
      // See above.
    }
  }

  /// [offer] is on screen now: it is this run's one nudge, and its event is seen (never shown again).
  void markShown(NudgeOffer offer) {
    if (!state.loaded || state.shown != null) return;
    state = state.copyWith(shown: offer, memory: state.memory.seen(offer.eventId));
    _persist();
  }

  /// [eventId] needs no showing again.
  void markSeen(String eventId) {
    if (!state.loaded || state.memory.seenEvents.contains(eventId)) return;
    state = state.copyWith(memory: state.memory.seen(eventId));
    _persist();
  }

  /// The student closed [kind] with its X: it stays quiet for [NudgeRules.quietFor], and the shown event is seen.
  void dismiss(NudgeKind kind) {
    if (!state.loaded) return;
    var memory = state.memory.dismiss(kind, ref.read(nudgeClockProvider)());
    final shown = state.shown;
    if (shown != null) memory = memory.seen(shown.eventId);
    state = state.copyWith(memory: memory, closed: true);
    _persist();
  }

  /// The student acted on the shown nudge (its key, Not now, or the sheet closed): it is put away for this run.
  void close() {
    if (state.closed) return;
    state = state.copyWith(closed: true);
  }
}

final nudgeControllerProvider = NotifierProvider<NudgeController, NudgeState>(NudgeController.new);
