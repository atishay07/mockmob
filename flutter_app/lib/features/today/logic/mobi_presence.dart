// Which Mobi is on Today's screen right now, so there is never a second one in view
// (owner rule: one Mobi per screen). The header's Mobi says when he is in view; the road's walker
// waits until he is not, because the walker is the calmer of the two: he is small, he arrives
// once per app run and he adds nothing the header's Mobi does not already say.
import 'dart:async';

import 'package:flutter/foundation.dart';

abstract final class TodayMobiPresence {
  static final ValueNotifier<bool> _header = ValueNotifier(false);

  /// True while the header's Mobi is in the viewport of the Today tab.
  static ValueListenable<bool> get headerVisible => _header;

  /// The header's Mobi reports whether he is in view. Called after layout, never during build.
  static void reportHeader(bool visible) {
    if (_header.value != visible) _header.value = visible;
  }

  /// The header's Mobi left the tree. Deferred a turn so no listener rebuilds in the middle of
  /// the tree being torn down.
  static void headerGone() {
    scheduleMicrotask(() {
      if (_header.value) _header.value = false;
    });
  }

  /// Back to the start (tests).
  @visibleForTesting
  static void reset() => _header.value = false;
}
