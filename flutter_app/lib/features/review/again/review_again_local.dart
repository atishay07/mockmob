import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';

/// Where the questions the student missed in their last Review again are kept: this phone's
/// preferences. They only order the next set (missed ones first). Nothing here is sent to the
/// server and nothing here changes the repair record. Replaced with a `MemoryPrefsStore` in tests.
final reviewAgainStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

/// The question keys (`attemptId/questionId`) that did not hold in the last Review again.
final reviewAgainMissedProvider = AsyncNotifierProvider<ReviewAgainMissed, Set<String>>(ReviewAgainMissed.new);

class ReviewAgainMissed extends AsyncNotifier<Set<String>> {
  static const storageKey = 'review.again.missed.v1';

  @override
  Future<Set<String>> build() async {
    try {
      return decodeMissed(await ref.read(reviewAgainStoreProvider).getString(storageKey));
    } on Object {
      return <String>{};
    }
  }

  /// Records one answer: a miss is remembered, a hold forgets it.
  Future<void> record(String key, {required bool held}) async {
    final next = {...?state.value};
    if (held) {
      next.remove(key);
    } else {
      next.add(key);
    }
    state = AsyncData(next);
    try {
      await ref.read(reviewAgainStoreProvider).setString(storageKey, jsonEncode(next.toList()));
    } on Object {
      // The order of the next set is the only thing lost.
    }
  }
}

/// The stored form back into keys; anything unreadable is an empty set.
Set<String> decodeMissed(String? raw) {
  if (raw == null || raw.isEmpty) return <String>{};
  try {
    final parsed = jsonDecode(raw);
    if (parsed is! List) return <String>{};
    return {for (final v in parsed) if (v is String) v};
  } on Object {
    return <String>{};
  }
}
