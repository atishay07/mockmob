// Today's one authored page-load moment (ui-blitz/today.md 2.6): on the first build with data
// the masthead, the week, the hero and the sections rise 16 dp and fade in, one after another,
// on a single controller. Transform and opacity only; every control is live from the first
// frame. Reduced motion (system or in-app) shows everything in place at once.
import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

/// Total length of the entrance: the last piece starts at [lastDelay] and lands 420 ms later.
const Duration todayEntranceDuration = Duration(milliseconds: 760);

/// Hands the entrance progress (0 to 1 over [todayEntranceDuration]) to the pieces under it.
class TodayEntranceScope extends InheritedWidget {
  const TodayEntranceScope({super.key, required this.progress, required super.child});

  /// Null: nothing animates (no scope, or the entrance already ran).
  final Animation<double>? progress;

  static Animation<double>? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<TodayEntranceScope>()?.progress;

  @override
  bool updateShouldNotify(TodayEntranceScope old) => old.progress != progress;
}

/// One piece of the entrance, starting [delay] after the page opens.
class TodayEnter extends StatelessWidget {
  const TodayEnter({super.key, required this.delay, required this.child, this.rise = 16, this.length = const Duration(milliseconds: 420)});

  final Duration delay;
  final Widget child;

  /// How far below its place the piece starts, in dp.
  final double rise;
  final Duration length;

  @override
  Widget build(BuildContext context) {
    final progress = TodayEntranceScope.of(context);
    if (progress == null || Motion.reduced(context) || progress.isCompleted) return child;
    final total = todayEntranceDuration.inMilliseconds;
    final start = (delay.inMilliseconds / total).clamp(0.0, 1.0);
    final end = ((delay + length).inMilliseconds / total).clamp(start, 1.0);
    final t = CurvedAnimation(parent: progress, curve: Interval(start, end, curve: Motion.emphasized));
    return AnimatedBuilder(
      animation: t,
      child: child,
      builder: (context, child) {
        final v = t.value;
        if (v >= 1) return child!;
        return Opacity(
          opacity: v,
          child: Transform.translate(offset: Offset(0, rise * (1 - v)), child: child),
        );
      },
    );
  }
}

/// The 0 to 1 value of a piece's own window of the entrance, for painters that draw themselves
/// in (the week's ink, the road's travelled stretch). 1 when there is no entrance.
Animation<double> todayEnterValue(BuildContext context, {required Duration delay, Duration length = const Duration(milliseconds: 420), Curve curve = Motion.emphasized}) {
  final progress = TodayEntranceScope.of(context);
  if (progress == null || Motion.reduced(context)) return kAlwaysCompleteAnimation;
  final total = todayEntranceDuration.inMilliseconds;
  final start = (delay.inMilliseconds / total).clamp(0.0, 1.0);
  final end = ((delay + length).inMilliseconds / total).clamp(start, 1.0);
  return CurvedAnimation(parent: progress, curve: Interval(start, end, curve: curve));
}
