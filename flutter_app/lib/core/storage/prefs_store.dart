import 'package:shared_preferences/shared_preferences.dart';

/// The key-value operations [AppPrefs] needs, so tests and the background isolate can swap the
/// backing store.
abstract class PrefsStore {
  Future<bool?> getBool(String key);
  Future<int?> getInt(String key);
  Future<String?> getString(String key);
  Future<List<String>?> getStringList(String key);
  Future<void> setBool(String key, bool value);
  Future<void> setInt(String key, int value);
  Future<void> setString(String key, String value);
  Future<void> setStringList(String key, List<String> value);
  Future<void> remove(String key);
}

/// Backed by `shared_preferences` (the async API, safe across isolates).
class SharedPrefsStore implements PrefsStore {
  SharedPrefsStore([SharedPreferencesAsync? prefs]) : _prefs = prefs ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _prefs;

  @override
  Future<bool?> getBool(String key) => _prefs.getBool(key);

  @override
  Future<int?> getInt(String key) => _prefs.getInt(key);

  @override
  Future<String?> getString(String key) => _prefs.getString(key);

  @override
  Future<List<String>?> getStringList(String key) => _prefs.getStringList(key);

  @override
  Future<void> setBool(String key, bool value) => _prefs.setBool(key, value);

  @override
  Future<void> setInt(String key, int value) => _prefs.setInt(key, value);

  @override
  Future<void> setString(String key, String value) => _prefs.setString(key, value);

  @override
  Future<void> setStringList(String key, List<String> value) => _prefs.setStringList(key, value);

  @override
  Future<void> remove(String key) => _prefs.remove(key);
}

/// In-memory store for tests.
class MemoryPrefsStore implements PrefsStore {
  final Map<String, Object> values = {};

  @override
  Future<bool?> getBool(String key) async => values[key] as bool?;

  @override
  Future<int?> getInt(String key) async => values[key] as int?;

  @override
  Future<String?> getString(String key) async => values[key] as String?;

  @override
  Future<List<String>?> getStringList(String key) async => (values[key] as List<String>?)?.toList();

  @override
  Future<void> setBool(String key, bool value) async => values[key] = value;

  @override
  Future<void> setInt(String key, int value) async => values[key] = value;

  @override
  Future<void> setString(String key, String value) async => values[key] = value;

  @override
  Future<void> setStringList(String key, List<String> value) async => values[key] = value.toList();

  @override
  Future<void> remove(String key) async => values.remove(key);
}
