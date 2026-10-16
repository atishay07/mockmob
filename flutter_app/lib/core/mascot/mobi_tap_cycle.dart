import 'package:flutter/foundation.dart';

import 'mobi_acts.dart';

/// How Mobi answers being tapped again and again: each tap plays the next act of [acts], so a
/// student poking him gets a small escalating game (hello, a curious tilt, a little hop, then
/// ticklish) instead of the same squash every time.
///
/// Rules: never the same act twice in a row; after [resetAfter] with no tap the cycle starts
/// over; after [cap] acts in one visit (one life of the widget) further taps only get the light
/// squash and haptic. Give it to `MobiCharacter(tapCycle: MobiTapCycle.standard)`.
@immutable
class MobiTapCycle {
  /// [acts] needs at least two different acts, or the cycle would repeat itself.
  const MobiTapCycle(this.acts, {this.resetAfter = const Duration(seconds: 8), this.cap = 6});

  /// hello, tilt, hop, startle. (Before rig v2 the third was `correct`, whose tick bubble said
  /// "right answer" to a poke; a plain hop says only "hi again".)
  static const MobiTapCycle standard = MobiTapCycle([MobiAct.hello, MobiAct.tilt, MobiAct.hop, MobiAct.startle]);

  final List<MobiAct> acts;
  final Duration resetAfter;
  final int cap;

  /// A fresh run of this cycle for one visit.
  MobiTapRun start() => MobiTapRun(this);
}

/// One visit's progress through a [MobiTapCycle].
class MobiTapRun {
  MobiTapRun(this.cycle);

  final MobiTapCycle cycle;
  int _next = 0;
  int _played = 0;
  MobiAct? _last;
  DateTime? _lastTap;

  /// Acts played so far this visit.
  int get played => _played;

  /// The act for a tap at [now], or null when the visit's cap is reached (a squash only).
  MobiAct? tap(DateTime now) {
    final last = _lastTap;
    _lastTap = now;
    if (last != null && now.difference(last) >= cycle.resetAfter) _next = 0;
    if (_played >= cycle.cap) return null;
    var act = cycle.acts[_next % cycle.acts.length];
    if (act == _last) {
      _next++;
      act = cycle.acts[_next % cycle.acts.length];
    }
    _next++;
    _played++;
    _last = act;
    return act;
  }
}
