import 'package:flutter/material.dart';

import '../../theme/theme.dart';

/// One pool of environment light, painted in code (no image): a soft radial falloff from [color]
/// at [center] to nothing at [radius]. Light fields sit behind art, never behind text that is read.
class LightPool {
  const LightPool({required this.color, required this.center, this.radius = 0.9, this.strength = 1, this.aspect = 1});

  final Color color;

  /// Alignment of the light's centre (`Alignment(-0.9, -1)` is the desk lamp, upper left).
  final Alignment center;

  /// Radius as a fraction of the larger side.
  final double radius;

  /// 0 to 1, multiplies the colour's alpha.
  final double strength;

  /// Width over height of the pool: above 1 spreads it sideways like light on a desk.
  final double aspect;
}

/// The room's light (brief sections 1.1 and 5): a subject field and/or the warm desk-lamp pool,
/// painted over the ground. Use [LightField.subject] behind a subject's object, [LightField.lamp]
/// for the moment layer.
class LightField extends StatelessWidget {
  const LightField({super.key, required this.pools, this.child});

  /// The subject's colour pooled behind its object (lower right by default), with a quiet lamp
  /// from the upper left so the scene stays warm.
  factory LightField.subject(
    BuildContext context,
    SubjectLight subject, {
    Key? key,
    Alignment center = const Alignment(0.55, -0.1),
    double strength = 1,
    Widget? child,
  }) {
    final colors = context.mmColors;
    final brightness = Theme.of(context).brightness;
    return LightField(
      key: key,
      pools: [
        LightPool(color: subject.of(brightness), center: center, radius: 0.85, strength: strength),
        LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.14 : 0.12), center: const Alignment(-1.1, -1.15), radius: 0.8),
      ],
      child: child,
    );
  }

  /// The tungsten lamp pooling from the upper left, at 10 to 22% (Night) or 14% (Daylight).
  factory LightField.lamp(
    BuildContext context, {
    Key? key,
    double strength = 1,
    Alignment center = const Alignment(-1, -1.1),
    bool withVolt = false,
    Widget? child,
  }) {
    final colors = context.mmColors;
    final alpha = (colors.isNight ? 0.2 : 0.14) * strength;
    return LightField(
      key: key,
      pools: [
        LightPool(color: colors.lamp.withValues(alpha: alpha), center: center, radius: 1.05),
        if (withVolt) LightPool(color: colors.voltGlow, center: const Alignment(0.8, 0.9), radius: 0.7),
      ],
      child: child,
    );
  }

  final List<LightPool> pools;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        painter: LightFieldPainter(pools),
        child: child ?? const SizedBox.expand(),
      ),
    );
  }
}

class LightFieldPainter extends CustomPainter {
  const LightFieldPainter(this.pools);

  final List<LightPool> pools;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final rect = Offset.zero & size;
    for (final pool in pools) {
      final c = pool.center.withinRect(rect);
      final r = size.longestSide * pool.radius;
      final base = pool.color.withValues(alpha: pool.color.a * pool.strength);
      // Four stops approximate a soft (roughly gaussian) falloff instead of a hard linear cone.
      final gradient = RadialGradient(
        transform: pool.aspect == 1 ? null : _Stretch(pool.aspect, c),
        colors: [
          base,
          base.withValues(alpha: base.a * 0.55),
          base.withValues(alpha: base.a * 0.18),
          base.withValues(alpha: 0),
        ],
        stops: const [0, 0.35, 0.7, 1],
      );
      canvas.drawRect(rect, Paint()..shader = gradient.createShader(Rect.fromCircle(center: c, radius: r)));
    }
  }

  @override
  bool shouldRepaint(LightFieldPainter old) {
    if (old.pools.length != pools.length) return true;
    for (var i = 0; i < pools.length; i++) {
      final a = old.pools[i], b = pools[i];
      if (a.color != b.color || a.center != b.center || a.radius != b.radius || a.strength != b.strength || a.aspect != b.aspect) {
        return true;
      }
    }
    return false;
  }
}

/// Stretches a radial gradient horizontally about its centre.
class _Stretch extends GradientTransform {
  const _Stretch(this.aspect, this.center);

  final double aspect;
  final Offset center;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) => Matrix4.identity()
    ..translateByDouble(center.dx, center.dy, 0, 1)
    ..scaleByDouble(aspect, 1, 1, 1)
    ..translateByDouble(-center.dx, -center.dy, 0, 1);
}

/// The moment layer's room (brief 1.1): one pool of tungsten lamp light from the upper left that
/// falls off to the bare ground, and the floor of the scene settling back into the ground. Work
/// screens get no lamp at all.
class LampScene extends StatelessWidget {
  const LampScene({super.key, this.strength = 1, this.vignette = true});

  /// Multiplies the lamp: a calm result dims it.
  final double strength;

  /// The ground rising over the lower 35% of the scene.
  final bool vignette;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return RepaintBoundary(
      child: CustomPaint(
        painter: LampScenePainter(
          lamp: colors.lamp.withValues(alpha: (colors.isNight ? 0.18 : 0.14) * strength),
          ground: vignette ? colors.ground : null,
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}

class LampScenePainter extends CustomPainter {
  const LampScenePainter({required this.lamp, this.ground});

  final Color lamp;
  final Color? ground;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final rect = Offset.zero & size;
    final c = const Alignment(-0.65, -0.95).withinRect(rect);
    final r = size.width * 1.1;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          colors: [lamp, lamp.withValues(alpha: lamp.a / 3), lamp.withValues(alpha: 0)],
          stops: const [0, 0.55, 1],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
    final g = ground;
    if (g != null) {
      final floor = Rect.fromLTWH(0, size.height * 0.65, size.width, size.height * 0.35);
      canvas.drawRect(
        floor,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [g.withValues(alpha: 0), g.withValues(alpha: 0.85)],
          ).createShader(floor),
      );
    }
  }

  @override
  bool shouldRepaint(LampScenePainter old) => old.lamp != lamp || old.ground != ground;
}
