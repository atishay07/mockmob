import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';
import '../model/answers.dart';

/// Why a stored sheet could not be read.
enum SheetReadFailure {
  /// The phone's storage threw. Usually passes; nothing was copied.
  unreadable,

  /// The stored text is not a sheet this build understands (bad JSON, wrong shape).
  broken,

  /// Written by a newer MockMob ([OnboardingAnswers.version] is higher than this build's).
  newer,
}

/// Thrown by [AnswersStore.load] when a sheet is stored but cannot be read. The stored text
/// is never treated as an empty sheet, so nothing overwrites it by accident.
class SheetReadError implements Exception {
  const SheetReadError(this.failure, {required this.backedUp, this.cause});

  final SheetReadFailure failure;

  /// The stored text was copied to [AnswersStore.backupKey], so a fresh sheet can be started
  /// over it without losing it.
  final bool backedUp;
  final Object? cause;

  @override
  String toString() => 'SheetReadError(${failure.name}, backedUp: $backedUp${cause == null ? '' : ', $cause'})';
}

/// Keeps the onboarding answers on the phone, versioned (see [OnboardingAnswers.version]).
class AnswersStore {
  AnswersStore(this._prefs);

  final PrefsStore _prefs;

  static const String key = 'onboarding_sheet';

  /// Where a sheet this build cannot read is kept, untouched.
  static const String backupKey = 'onboarding_sheet.bak';

  /// The stored sheet; [OnboardingAnswers.empty] only when nothing is stored. Throws
  /// [SheetReadError] when something is stored that cannot be read.
  Future<OnboardingAnswers> load() async {
    final String? raw;
    try {
      raw = await _prefs.getString(key);
    } on Object catch (e) {
      throw SheetReadError(SheetReadFailure.unreadable, backedUp: false, cause: e);
    }
    if (raw == null) return OnboardingAnswers.empty;

    Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException catch (e) {
      throw SheetReadError(SheetReadFailure.broken, backedUp: await _backUp(raw), cause: e);
    }
    final v = decoded is Map<String, Object?> ? decoded['v'] : null;
    if (decoded is! Map<String, Object?> || v is! int) {
      throw SheetReadError(SheetReadFailure.broken, backedUp: await _backUp(raw));
    }
    if (v > OnboardingAnswers.version) {
      throw SheetReadError(SheetReadFailure.newer, backedUp: await _backUp(raw));
    }
    try {
      return OnboardingAnswers.fromJson(decoded);
    } on Object catch (e) {
      // A field of the wrong type.
      throw SheetReadError(SheetReadFailure.broken, backedUp: await _backUp(raw), cause: e);
    }
  }

  /// Copies [raw] to [backupKey]. False when that write failed too.
  Future<bool> _backUp(String raw) async {
    try {
      await _prefs.setString(backupKey, raw);
      return true;
    } on Object {
      return false;
    }
  }

  /// Copies whatever is stored under [key] to [backupKey], as it is. True when there was
  /// nothing to keep or the copy was written. Run before an unreadable sheet is given up.
  Future<bool> backUpStored() async {
    final String? raw;
    try {
      raw = await _prefs.getString(key);
    } on Object {
      return false;
    }
    if (raw == null) return true;
    return _backUp(raw);
  }

  Future<void> save(OnboardingAnswers answers) => _prefs.setString(key, jsonEncode(answers.toJson()));

  Future<void> clear() => _prefs.remove(key);

  /// Unsent sheets of accounts that are not signed in, by account id, so another account on this
  /// phone starts its own sheet without losing them.
  static const String parkedKey = 'onboarding_sheet.parked';

  /// How long a put-away sheet waits for its account to sign in again on this phone.
  static const Duration parkedFor = Duration(days: 30);

  /// Puts [answers] away for [answers.owner] until that account signs in again. A finished
  /// (sealed) sheet already put away is not replaced by an unfinished one.
  Future<void> park(OnboardingAnswers answers, DateTime now) async {
    final owner = answers.owner;
    if (owner == null) return;
    final parked = await _readParked(now);
    if (_sheetIn(parked[owner], owner)?.sealed == true && !answers.sealed) return;
    parked[owner] = {'at': now.toIso8601String(), 'sheet': answers.toJson()};
    await _writeParked(parked);
  }

  /// The sheet put away for [userId], or null when there is none or it has expired. It stays
  /// put away until [dropParked].
  Future<OnboardingAnswers?> parked(String userId, DateTime now) async => _sheetIn((await _readParked(now))[userId], userId);

  Future<void> dropParked(String userId, DateTime now) async {
    final parked = await _readParked(now);
    if (parked.remove(userId) == null) return;
    await _writeParked(parked);
  }

  /// A put-away entry's sheet, or null when this build cannot read it as [owner]'s.
  static OnboardingAnswers? _sheetIn(Map<String, Object?>? entry, String owner) {
    final sheet = entry?['sheet'];
    if (sheet is! Map<String, Object?> || sheet['v'] is! int || (sheet['v']! as int) > OnboardingAnswers.version) return null;
    try {
      final answers = OnboardingAnswers.fromJson(sheet);
      return answers.owner == owner ? answers : null;
    } on Object {
      return null;
    }
  }

  /// The put-away entries that have not expired, as stored. An entry this build cannot read
  /// (a newer one) is carried along untouched until it expires.
  Future<Map<String, Map<String, Object?>>> _readParked(DateTime now) async {
    final out = <String, Map<String, Object?>>{};
    final raw = await _prefs.getString(parkedKey);
    if (raw == null) return out;
    final Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      return out;
    }
    if (decoded is! Map) return out;
    for (final e in decoded.entries) {
      final key = e.key, v = e.value;
      if (key is! String || v is! Map<String, Object?>) continue;
      final at = v['at'] is String ? DateTime.tryParse(v['at']! as String) : null;
      if (at == null || now.difference(at) > parkedFor) continue;
      out[key] = v;
    }
    return out;
  }

  Future<void> _writeParked(Map<String, Map<String, Object?>> parked) =>
      parked.isEmpty ? _prefs.remove(parkedKey) : _prefs.setString(parkedKey, jsonEncode(parked));
}

/// Replaced in tests with an in-memory store.
final answersStoreProvider = Provider<AnswersStore>((ref) => AnswersStore(SharedPrefsStore()));
