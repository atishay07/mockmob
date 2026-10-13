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

  Future<void> save(OnboardingAnswers answers) => _prefs.setString(key, jsonEncode(answers.toJson()));

  Future<void> clear() => _prefs.remove(key);
}

/// Replaced in tests with an in-memory store.
final answersStoreProvider = Provider<AnswersStore>((ref) => AnswersStore(SharedPrefsStore()));
