import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/prefs_store.dart';

/// The preference key under which Ask Mobi remembers a question that was in flight when the app was
/// killed (`ask_controller.dart`). It is written as the account's own words, so it must not outlive the
/// account on this phone: sign-out and a recorded account deletion remove it by name.
const String pendingAskPrefsKey = 'ask_pending_request';

/// The phone's preferences, where that note lives. Replaceable in tests.
final pendingAskPrefsProvider = Provider<PrefsStore>((ref) {
  try {
    return SharedPrefsStore();
  } on Object {
    // No platform store (a test, an isolate without the plugin): nothing was saved there to remove.
    return MemoryPrefsStore();
  }
});

/// Removes the remembered question. Never throws: a note that cannot be removed expires by itself after
/// 24 hours, and signing out or deleting must not stop for it.
Future<void> forgetPendingAsk(PrefsStore store) async {
  try {
    await store.remove(pendingAskPrefsKey);
  } on Object {
    // Best effort.
  }
}
