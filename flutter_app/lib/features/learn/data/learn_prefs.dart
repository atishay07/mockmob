import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';

/// Learn's own per-phone flags (shared_preferences). Conveniences only: a failed read counts as
/// "already seen" so nothing repeats or blocks.
final learnPrefsStoreProvider = Provider<PrefsStore>(
  (ref) => SharedPrefsStore(),
);

const String _howSeenKey = 'learn_how_concepts_seen';

/// True once the student has seen the "How Concepts work" line with Mobi pointing at it.
final conceptsHowSeenProvider = FutureProvider.autoDispose<bool>((ref) async {
  try {
    return await ref.read(learnPrefsStoreProvider).getBool(_howSeenKey) ??
        false;
  } on Object {
    return true;
  }
});

/// Marks the first-visit explainer as seen. It stays seen on this phone.
Future<void> markConceptsHowSeen(PrefsStore store) async {
  try {
    await store.setBool(_howSeenKey, true);
  } on Object {
    // A convenience flag; the worst case is Mobi pointing at the line once more.
  }
}
