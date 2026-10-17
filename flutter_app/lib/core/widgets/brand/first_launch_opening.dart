import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../storage/app_prefs.dart';

/// M-001 (owner, 18 Oct): the brand opening plays its whole 3 second version on the first launch
/// after install, and the short one on every launch after. This is the flag logic, apart from the
/// opening's timeline.
///
/// The flag is the phone's own `cold_open_seen`: set once the first-launch opening has played, on
/// the phone only (the app does not back up its data, so a reinstall starts clean). When the flag
/// cannot be read, the short opening plays: a launch never waits on storage and never shows the
/// long version by guesswork.
abstract final class FirstLaunchOpening {
  /// Whether the opening about to play is the first one on this install.
  static Future<bool> due(AppPrefs prefs) async {
    try {
      return !await prefs.coldOpenSeen();
    } on Object {
      return false;
    }
  }

  /// Records that the long opening has played; the next launch plays the short one. A failed
  /// write is dropped: the worst case is the long opening once more.
  static Future<void> markPlayed(AppPrefs prefs) async {
    try {
      await prefs.setColdOpenSeen(true);
    } on Object {
      // A convenience.
    }
  }
}

/// Whether this launch is the first after install. Read once before the first frame (`main`
/// overrides it); tests and the lab keep the short opening.
final firstLaunchOpeningProvider = Provider<bool>((ref) => false);
