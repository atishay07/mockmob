import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/prefs_store.dart';

/// Per-phone memory for the native touches (review prompt, in-app update): when the app was
/// first seen, when the review prompt was last asked for and when Play was last checked for an
/// update. Per-viewer conveniences only, so a lost value just means one more ask or check.
class NativePrefs {
  NativePrefs(this._store);

  final PrefsStore _store;

  static const _firstSeen = 'native_first_seen_ms';
  static const _reviewAsked = 'native_review_asked_ms';
  static const _updateChecked = 'native_update_checked_ms';

  Future<DateTime?> _read(String key) async {
    final ms = await _store.getInt(key);
    return ms == null ? null : DateTime.fromMillisecondsSinceEpoch(ms);
  }

  Future<void> _write(String key, DateTime at) => _store.setInt(key, at.millisecondsSinceEpoch);

  /// The first time this build of the app ran on this phone, or null before [markFirstSeen].
  Future<DateTime?> firstSeen() => _read(_firstSeen);

  /// Remembers [now] as the first run, once. Later calls keep the first value.
  Future<void> markFirstSeen(DateTime now) async {
    if (await firstSeen() == null) await _write(_firstSeen, now);
  }

  Future<DateTime?> reviewAskedAt() => _read(_reviewAsked);
  Future<void> setReviewAskedAt(DateTime at) => _write(_reviewAsked, at);

  Future<DateTime?> updateCheckedAt() => _read(_updateChecked);
  Future<void> setUpdateCheckedAt(DateTime at) => _write(_updateChecked, at);
}

final nativePrefsProvider = Provider<NativePrefs>((ref) => NativePrefs(_LazyPrefsStore()));

/// [SharedPrefsStore] made on first use, so building the provider never touches the platform
/// plugin (it is not available in every test, and the first frame does not need it).
class _LazyPrefsStore implements PrefsStore {
  SharedPrefsStore? _store;

  SharedPrefsStore get _s => _store ??= SharedPrefsStore();

  @override
  Future<bool?> getBool(String key) async => _s.getBool(key);

  @override
  Future<int?> getInt(String key) async => _s.getInt(key);

  @override
  Future<String?> getString(String key) async => _s.getString(key);

  @override
  Future<List<String>?> getStringList(String key) async => _s.getStringList(key);

  @override
  Future<void> setBool(String key, bool value) async => _s.setBool(key, value);

  @override
  Future<void> setInt(String key, int value) async => _s.setInt(key, value);

  @override
  Future<void> setString(String key, String value) async => _s.setString(key, value);

  @override
  Future<void> setStringList(String key, List<String> value) async => _s.setStringList(key, value);

  @override
  Future<void> remove(String key) async => _s.remove(key);
}
