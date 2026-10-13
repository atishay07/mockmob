import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';
import '../model/answers.dart';

/// Keeps the onboarding answers on the phone, versioned (see [OnboardingAnswers.version]).
class AnswersStore {
  AnswersStore(this._prefs);

  final PrefsStore _prefs;

  static const String key = 'onboarding_sheet';

  Future<OnboardingAnswers> load() async {
    try {
      final raw = await _prefs.getString(key);
      if (raw == null) return OnboardingAnswers.empty;
      final decoded = jsonDecode(raw);
      return decoded is Map<String, Object?> ? OnboardingAnswers.fromJson(decoded) : OnboardingAnswers.empty;
    } on Object {
      // A broken or unreadable store starts a fresh sheet rather than blocking the app.
      return OnboardingAnswers.empty;
    }
  }

  Future<void> save(OnboardingAnswers answers) => _prefs.setString(key, jsonEncode(answers.toJson()));

  Future<void> clear() => _prefs.remove(key);
}

/// Replaced in tests with an in-memory store.
final answersStoreProvider = Provider<AnswersStore>((ref) => AnswersStore(SharedPrefsStore()));
