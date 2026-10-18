import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';

/// Where the reel's own flag lives: a phone-only memory, never state that matters to the account.
final reelPrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

const String _seenKey = 'paper_reel_seen_v1';

/// How many papers the memory keeps. Older ones are forgotten, and a paper that old has no card to hide anyway.
const int reelSeenKept = 60;

/// The papers whose reel the student has played or turned down with "Not now" (D29, v15 walk M3).
///
/// This is the reel card's own flag. It is not "the result was opened": a Quick set opens its result at once, so
/// keying the card on that flag meant it never appeared after the sets a student takes most. The card shows once per
/// paper, after any fresh submission, until the reel has played or the card has been dismissed. The value is null
/// while the memory is being read, and the card waits for it rather than flash for a paper already seen.
class ReelSeen extends AsyncNotifier<Set<String>> {
  @override
  Future<Set<String>> build() async {
    try {
      return {...?await ref.read(reelPrefsStoreProvider).getStringList(_seenKey)};
    } on Object {
      return <String>{};
    }
  }

  /// This paper's reel was played, or "Not now" was tapped. Idempotent; a write that fails still hides the card
  /// for this run.
  Future<void> mark(String attemptId) async {
    if (attemptId.isEmpty) return;
    final current = state.value ?? await future;
    if (current.contains(attemptId)) return;
    final next = {...current, attemptId};
    while (next.length > reelSeenKept) {
      next.remove(next.first);
    }
    state = AsyncData(next);
    try {
      await ref.read(reelPrefsStoreProvider).setStringList(_seenKey, next.toList());
    } on Object {
      // Only a convenience: at worst the card shows once more after a restart.
    }
  }
}

final reelSeenProvider = AsyncNotifierProvider<ReelSeen, Set<String>>(ReelSeen.new);
