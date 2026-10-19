// Shared motion plumbing for the Mob v3 (spec 5.0, 5.1, BRAND-MOTION-KIT 6 and 7):
// - MobBeat: the Mob clock (600 ms beat) and the squash numbers, from the generated tokens;
// - MobFx: reduced motion and the Lite tier, read once per frame by every Mob widget;
// - MobIdleScope: idle loops (breathe, blink, sway) run only while the student is touching the screen
//   recently: they stop 10 s after the last touch, and when the tab is hidden (TickerMode off).

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/glass_quality.dart';

abstract final class MobBeat {
  static const Duration beat = MotionDurations.mobBeat;
  static const Duration halfBeat = MotionDurations.mobHalfBeat;
  static const Duration squashHold = MotionDurations.mobSquashHold;
  static const Duration rollCallStep = MotionDurations.mobRollCallStep;
  static const Duration t4 = MotionDurations.momentT4;
  static const double squashX = MotionNumbers.mobSquashX;
  static const double squashY = MotionNumbers.mobSquashY;

  /// Every show moment lands its end state this fast after a tap or Skip (spec 5.6).
  static const Duration skip = Duration(milliseconds: 200);

  /// Idle loops stop this long after the last touch (spec 5.2).
  static const Duration idleTimeout = Duration(seconds: 10);
}

abstract final class MobFx {
  static bool reduced(BuildContext context) => Motion.reduced(context);

  /// Lite halves the particles and drops the shader and blur (spec 5.0).
  static bool lite(BuildContext context) {
    try {
      return GlassScope.of(context) != GlassQuality.full;
    } on Object {
      return false;
    }
  }

  /// The particle cap for this phone: 60 on Full, 30 on Lite, none in reduced motion.
  static int particles(BuildContext context, int wanted) {
    if (reduced(context)) return 0;
    final cap = lite(context) ? 30 : 60;
    final n = lite(context) ? (wanted / 2).ceil() : wanted;
    return n.clamp(0, cap);
  }
}

/// Wrap a Mob screen in this. Idle loops ask [MobIdleScope.awakeOf] (a listenable) whether to run.
class MobIdleScope extends StatefulWidget {
  const MobIdleScope({super.key, required this.child, this.timeout = MobBeat.idleTimeout});

  final Widget child;
  final Duration timeout;

  /// True while loops may run. A widget outside any scope is always awake (tests, sheets).
  static ValueListenable<bool> awakeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_IdleInherited>()?.awake ?? _alwaysAwake;

  /// Marks a touch from code (a moment that plays wakes the room).
  static void poke(BuildContext context) => context.getInheritedWidgetOfExactType<_IdleInherited>()?.poke();

  @override
  State<MobIdleScope> createState() => _MobIdleScopeState();
}

final ValueNotifier<bool> _alwaysAwake = ValueNotifier<bool>(true);

class _MobIdleScopeState extends State<MobIdleScope> {
  final ValueNotifier<bool> _awake = ValueNotifier<bool>(true);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _poke();
  }

  void _poke() {
    _timer?.cancel();
    if (!_awake.value) _awake.value = true;
    _timer = Timer(widget.timeout, () {
      if (mounted) _awake.value = false;
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _awake.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _poke(),
      onPointerMove: (_) => _poke(),
      onPointerSignal: (_) => _poke(),
      child: _IdleInherited(awake: _awake, poke: _poke, child: widget.child),
    );
  }
}

class _IdleInherited extends InheritedWidget {
  const _IdleInherited({required this.awake, required this.poke, required super.child});

  final ValueNotifier<bool> awake;
  final VoidCallback poke;

  @override
  bool updateShouldNotify(_IdleInherited oldWidget) => awake != oldWidget.awake;
}
