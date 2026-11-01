// The text styles of the Cards view and Find (the web's cards.css values, from the tokens) and the one fade the lists use
// when something opens in place.
library;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The text styles of a row, from the tokens (the web's cards.css values).
abstract final class CardStyles {
  static TextStyle kind(BuildContext context) =>
      context.mmType.label.copyWith(fontSize: 13, height: 1.3, fontWeight: FontWeight.w600, color: context.mmColors.ink3);

  static TextStyle front(BuildContext context) =>
      context.mmType.body.copyWith(fontSize: 16.5, height: 1.42, fontWeight: FontWeight.w600, color: context.mmColors.ink);

  static TextStyle fold(BuildContext context) =>
      context.mmType.body.copyWith(fontSize: 15.5, height: 1.55, fontWeight: FontWeight.w400, color: context.mmColors.ink2);

  static TextStyle bar(BuildContext context) =>
      context.mmType.title.copyWith(fontSize: 14.5, height: 1.3, letterSpacing: -0.07, color: context.mmColors.ink);

  static TextStyle barCompact(BuildContext context) =>
      context.mmType.label.copyWith(fontSize: 13, height: 1.3, fontWeight: FontWeight.w600, color: context.mmColors.ink3);

  static TextStyle barCount(BuildContext context) =>
      context.mmType.label.copyWith(fontSize: 13, height: 1.3, fontWeight: FontWeight.w600, color: context.mmColors.ink3);

  /// A search's words: underlined in the accent, nothing boxed.
  static TextStyle hitStyle(BuildContext context) {
    final mark = context.mmColors.accentText;
    return TextStyle(decoration: TextDecoration.underline, decorationColor: mark.withValues(alpha: mark.a * 0.7), decorationThickness: 2);
  }
}

/// Fades its child in once when it first appears (an opening row's line, the NCERT block).
class CardFadeIn extends StatelessWidget {
  const CardFadeIn({super.key, required this.child, this.duration = const Duration(milliseconds: 220), this.delay = Duration.zero});

  final Widget child;
  final Duration duration;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final total = Motion.of(context, duration + delay);
    if (total == Duration.zero) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: _Delayed(delay: delay, total: total, curve: Motion.out),
      builder: (context, t, child) => Opacity(opacity: t, child: child),
      child: child,
    );
  }
}

class _Delayed extends Curve {
  const _Delayed({required this.delay, required this.total, required this.curve});

  final Duration delay;
  final Duration total;
  final Curve curve;

  @override
  double transformInternal(double t) {
    if (delay == Duration.zero) return curve.transform(t);
    final start = delay.inMicroseconds / total.inMicroseconds;
    return t <= start ? 0 : curve.transform((t - start) / (1 - start));
  }
}
