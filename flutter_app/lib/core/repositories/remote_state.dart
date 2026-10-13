import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../auth/auth_state.dart';

/// A server read with its cache story, for screens that show "Updated 9:40 PM".
class RemoteState<T> {
  const RemoteState({this.value, this.fetchedAt, this.fromCache = false, this.loading = false, this.error});

  /// Nothing signed in yet or nothing requested.
  const RemoteState.idle()
      : value = null,
        fetchedAt = null,
        fromCache = false,
        loading = false,
        error = null;

  final T? value;

  /// When [value] was fetched from the server. For a cached value this is the cache time.
  final DateTime? fetchedAt;

  /// True while [value] is the cached copy and the network read has not (yet) replaced it.
  final bool fromCache;

  /// A network read is in flight. [value] may still hold the cached copy.
  final bool loading;

  /// The last network read failed. [value] may still hold the cached copy (offline use).
  final ApiError? error;

  bool get hasValue => value != null;

  /// First load with nothing to show yet.
  bool get isInitialLoading => loading && value == null;

  /// The read failed and nothing is cached.
  bool get isFailedEmpty => error != null && value == null && !loading;

  /// A cached value is showing because the network read failed: label it with [fetchedAt].
  bool get isStale => error != null && value != null;

  RemoteState<T> copyWith({bool? loading, ApiError? error, bool clearError = false}) => RemoteState(
        value: value,
        fetchedAt: fetchedAt,
        fromCache: fromCache,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

/// A value read from the cache with the time it was fetched.
class CachedValue<T> {
  const CachedValue(this.value, this.fetchedAt);

  final T value;
  final DateTime fetchedAt;
}

/// A value read from the network plus whatever the cache writer needs (usually the JSON body).
class Fetched<T> {
  const Fetched(this.value, this.payload);

  final T value;
  final Object? payload;
}

/// Base for notifiers that read one server resource: shows the cache at once, then reads the
/// network once, and not again until [refresh] is called (screens refresh on open and after a
/// session, never on a timer). Resets when the signed-in account changes.
abstract class RemoteNotifier<T> extends Notifier<RemoteState<T>> {
  /// Null while signed out. Set in [build].
  String? userId;
  Future<void>? _inFlight;

  /// The account [_inFlight] reads for. A read started for one account never serves another.
  String? _inFlightFor;

  Future<CachedValue<T>?> readCache(String userId);
  Future<Fetched<T>> fetchRemote();
  Future<void> writeCache(String userId, Fetched<T> fetched, DateTime at);

  /// Set false for resources that are only read when asked for.
  bool get autoLoad => true;

  /// True for resources fetched once and then served from the cache until `refresh(force: true)`
  /// (the attempts list, which is a heavy unpaginated dump).
  bool get cacheFirst => false;

  @override
  RemoteState<T> build() {
    userId = ref.watch(authSnapshotProvider.select((s) => s.userId));
    // A read still running for the previous account must not be joined by this one.
    if (_inFlightFor != userId) {
      _inFlight = null;
      _inFlightFor = null;
    }
    if (userId == null) return RemoteState<T>.idle();
    if (autoLoad) scheduleMicrotask(refresh);
    return RemoteState<T>(loading: autoLoad);
  }

  /// Reads the cache (when nothing is showing yet), then the network. Overlapping calls share
  /// one request. A [cacheFirst] resource skips the network when the cache has data, unless
  /// [force] is set (after a submit, or when the student asks to refresh).
  Future<void> refresh({bool force = false}) {
    final id = userId;
    final running = _inFlight;
    if (running != null && _inFlightFor == id) return running;
    late final Future<void> started;
    started = _refresh(id, force).whenComplete(() {
      if (identical(_inFlight, started)) {
        _inFlight = null;
        _inFlightFor = null;
      }
    });
    _inFlight = started;
    _inFlightFor = id;
    return started;
  }

  /// Still the same signed-in account the read started for, and the notifier is alive.
  bool _current(String id) => ref.mounted && userId == id;

  Future<void> _refresh(String? id, bool force) async {
    if (id == null || !_current(id)) return;
    if (state.value == null) {
      CachedValue<T>? cached;
      try {
        cached = await readCache(id);
      } on Object {
        cached = null; // An unreadable cache is no cache: the network read below decides.
      }
      if (!_current(id)) return;
      if (cached != null) {
        final settled = cacheFirst && !force;
        state = RemoteState(value: cached.value, fetchedAt: cached.fetchedAt, fromCache: true, loading: !settled);
        if (settled) return;
      }
    }
    state = state.copyWith(loading: true, clearError: true);
    try {
      final fetched = await fetchRemote();
      if (!_current(id)) return;
      final at = ref.read(nowProvider)();
      try {
        await writeCache(id, fetched, at);
      } on Object {
        // The fresh value still shows; only the offline copy is older.
      }
      if (_current(id)) state = RemoteState(value: fetched.value, fetchedAt: at);
    } on ApiError catch (e) {
      if (_current(id)) state = state.copyWith(loading: false, error: e);
    } on Object {
      // Never leave the screen on a spinner: an unexpected failure is a failed read.
      if (_current(id)) state = state.copyWith(loading: false, error: const ApiError(kind: ApiErrorKind.unknown, code: 'unknown'));
    }
  }

  /// Replaces the value after a write the server acknowledged (for example a goal edit),
  /// keeping the cache in step.
  Future<void> setAcknowledged(Fetched<T> fetched) async {
    final id = userId;
    if (id == null) return;
    final at = ref.read(nowProvider)();
    await writeCache(id, fetched, at);
    if (ref.mounted) state = RemoteState(value: fetched.value, fetchedAt: at);
  }
}
