import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../../motion/motion.dart';
import '../../motion/motion_tokens.g.dart';

/// The light a finger puts into a glass surface (GLASS-1017 section 5.4, LG-1: touch makes the
/// material "fill with light", starting under the fingertip and spreading).
///
/// * **Down:** a radial bloom centred on the finger, 56 dp across its radius, rises from nothing
///   over 80 ms on `Motion.out`.
/// * **Up:** the bloom widens to 96 dp while it fades out over 360 ms on `Motion.out`, so the light
///   spreads across the glass as it leaves.
/// * **Reduced motion:** no bloom; [strength] still rises and falls (over 100 ms), so the owner of
///   the surface can brighten its rim instead.
///
/// Only glass chrome carries it (the bar, the key, the live capsule), never the content layer. It
/// runs only while a finger is down or the fade is finishing; at rest it produces no frames.
class TouchLightController {
  TouchLightController({required TickerProvider vsync})
    : _bloom = AnimationController(vsync: vsync, duration: MotionDurations.touchLightIn),
      _spread = AnimationController(vsync: vsync, duration: MotionDurations.touchLightOut, value: 1);

  final AnimationController _bloom;
  final AnimationController _spread;

  /// Repaints a painter that reads this light.
  late final Listenable listenable = Listenable.merge([_bloom, _spread]);

  /// The finger, in the coordinates of whoever called [down] and [move].
  Offset? get position => _position;
  Offset? _position;

  bool _reduced = false;

  /// Whether the bloom is drawn (false under reduced motion: only [strength] moves).
  bool get blooms => !_reduced;

  /// 0 at rest, 1 while a finger is fully down, falling back to 0 as the light leaves.
  double get strength => Motion.out.transform(_bloom.value) * (1 - Motion.out.transform(_spread.value));

  /// The bloom's radius: 56 dp under the finger, widening to 96 as it leaves.
  double get radius => ui.lerpDouble(56, 96, Motion.out.transform(_spread.value))!;

  bool get isActive => _bloom.value > 0 && _spread.value < 1;

  void down(Offset position, {required bool reduced}) {
    _reduced = reduced;
    _position = position;
    _spread.value = 0;
    if (reduced) {
      _bloom.animateTo(1, duration: const Duration(milliseconds: 100));
    } else {
      _bloom.forward(from: _bloom.value);
    }
  }

  void move(Offset position) {
    if (_spread.value >= 1) return;
    _position = position;
  }

  /// The finger lifted (or the gesture was cancelled): the light spreads and leaves.
  void up() {
    if (_spread.value >= 1 && _bloom.value == 0) return;
    if (_reduced) {
      _spread.animateTo(1, duration: const Duration(milliseconds: 100));
    } else {
      _spread.forward(from: 0);
    }
  }

  void dispose() {
    _bloom.dispose();
    _spread.dispose();
  }
}

/// Paints a [TouchLightController]'s bloom, clipped to [shape] (the surface's own outline at
/// this moment). [color] is the light at full strength: a warm white at 20% on Night, white at
/// 75% on Day.
class TouchLightPainter extends CustomPainter {
  TouchLightPainter({required this.light, required this.shape, required this.color, Listenable? repaint})
    : super(repaint: repaint == null ? light.listenable : Listenable.merge([light.listenable, repaint]));

  final TouchLightController light;
  final RRect Function(Size size) shape;
  final Color color;

  /// The light's colour per theme (GLASS-1017 5.4).
  static Color colorFor({required bool night}) => night ? const Color(0x33FFFAEC) : const Color(0xBFFFFFFF);

  @override
  void paint(Canvas canvas, Size size) {
    final at = light.position;
    final strength = light.strength;
    if (at == null || strength <= 0.001 || !light.blooms) return;
    final r = light.radius;
    canvas.save();
    canvas.clipRRect(shape(size));
    canvas.drawCircle(
      at,
      r,
      Paint()
        ..shader = ui.Gradient.radial(
          at,
          r,
          [color.withValues(alpha: color.a * strength), color.withValues(alpha: color.a * strength * 0.35), color.withValues(alpha: 0)],
          const [0, 0.45, 1],
        ),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(TouchLightPainter old) => old.light != light || old.color != color || old.shape != shape;
}
