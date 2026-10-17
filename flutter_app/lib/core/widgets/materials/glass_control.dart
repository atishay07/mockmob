import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../feedback.dart';
import 'mm_glass.dart';

/// A control that floats over scrolling content (GLASS-1017 section 5.8, packet G5): a header
/// pill or a back key over hero art.
///
/// * It turns to glass only while content is scrolled under it. At scroll 0 it keeps its resting
///   look (no pane at all); over the first [fadeDistance] of scroll the glass cross-fades in,
///   driven by the scroll position, not by a clock, so it never lags the finger.
/// * Glass lifts out under the finger instead of pressing in like content: scale 1.04 on a
///   critically damped 180 ms spring, a light that blooms under the finger and spreads as it
///   leaves, and a brighter rim. The release settles on `Springs.release`.
/// * Reduced motion: no lift and no bloom; the rim brightens while pressed.
///
/// Its target is at least 48 dp. Rows on a glass bubble stay plain text (no glass on glass).
class MmGlassControl extends StatefulWidget {
  const MmGlassControl({
    super.key,
    required this.child,
    required this.onTap,
    required this.semanticsLabel,
    this.scroll,
    this.fadeDistance = 24,
    this.borderRadius = MmRadius.pillAll,
    this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.s16),
    this.haptic = MmPressHaptic.selection,
  });

  final Widget child;
  final VoidCallback? onTap;
  final String semanticsLabel;

  /// The scroll the control floats over. Null keeps the glass on at all times.
  final ScrollController? scroll;

  /// How much scroll brings the glass fully in.
  final double fadeDistance;
  final BorderRadius borderRadius;
  final EdgeInsets padding;
  final MmPressHaptic haptic;

  /// How much glass shows at scroll [offset] (0 at rest, 1 once content is under it).
  static double glassFor(double offset, double fadeDistance) =>
      fadeDistance <= 0 ? 1 : (offset / fadeDistance).clamp(0.0, 1.0);

  @override
  State<MmGlassControl> createState() => _MmGlassControlState();
}

class _MmGlassControlState extends State<MmGlassControl> with TickerProviderStateMixin {
  late final AnimationController _lift;
  late final AnimationController _lightIn;
  late final AnimationController _lightOut;
  Offset? _touch;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _lift = AnimationController.unbounded(vsync: this, value: 1);
    _lightIn = AnimationController(vsync: this, duration: GlassTokens.touchLightIn);
    _lightOut = AnimationController(vsync: this, duration: GlassTokens.touchLightOut);
  }

  @override
  void dispose() {
    _lift.dispose();
    _lightIn.dispose();
    _lightOut.dispose();
    super.dispose();
  }

  void _down(Offset local) {
    if (widget.onTap == null) return;
    setState(() {
      _pressed = true;
      _touch = local;
    });
    mmFireHaptic(context, widget.haptic);
    if (Motion.reduced(context)) return;
    _lift.animateWith(Motion.spring(GlassTokens.liftSpring, _lift.value, GlassTokens.liftScale, velocity: _lift.velocity));
    _lightOut.value = 0;
    _lightIn.animateTo(1, curve: Motion.out);
  }

  void _up() {
    if (!_pressed) return;
    setState(() => _pressed = false);
    if (Motion.reduced(context)) return;
    _lift.animateWith(Motion.spring(Springs.release, _lift.value, 1, velocity: _lift.velocity));
    _lightOut.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    final scroll = widget.scroll;
    Widget pane(double glass) => _Pane(
      glass: glass,
      radius: widget.borderRadius,
      boost: _pressed ? (reduced ? MmElevation.pressedEdgeBoost : 2) : 1,
      child: Padding(padding: widget.padding, child: Center(widthFactor: 1, child: widget.child)),
    );

    Widget body = scroll == null
        ? pane(1)
        : AnimatedBuilder(
            animation: scroll,
            builder: (context, _) {
              final offset = scroll.hasClients && scroll.positions.length == 1 ? scroll.offset : 0.0;
              return pane(MmGlassControl.glassFor(offset, widget.fadeDistance));
            },
          );

    if (!reduced) {
      final night = context.mmColors.isNight;
      body = AnimatedBuilder(
        animation: Listenable.merge([_lift, _lightIn, _lightOut]),
        child: body,
        builder: (context, child) => Transform.scale(
          scale: _lift.value,
          child: CustomPaint(
            foregroundPainter: _TouchLightPainter(
              center: _touch,
              strength: _lightIn.value * (1 - Motion.out.transform(_lightOut.value)),
              radius: GlassTokens.touchLightRadius +
                  (GlassTokens.touchLightSpread - GlassTokens.touchLightRadius) * Motion.out.transform(_lightOut.value),
              color: night ? const Color(0x33FFFAEC) : const Color(0xBFFFFFFF),
              shape: widget.borderRadius,
            ),
            child: child,
          ),
        ),
      );
    }

    return Semantics(
      button: true,
      enabled: widget.onTap != null,
      label: widget.semanticsLabel,
      excludeSemantics: true,
      onTap: widget.onTap,
      child: FocusableActionDetector(
        enabled: widget.onTap != null,
        mouseCursor: widget.onTap != null ? SystemMouseCursors.click : MouseCursor.defer,
        actions: {ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) => widget.onTap?.call())},
        // The glass answers on pointer-down (no 100 ms tap delay); the tap itself commits on up.
        child: Listener(
          onPointerDown: (e) => _down(e.localPosition),
          onPointerUp: (_) => _up(),
          onPointerCancel: (_) => _up(),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onTap,
            child: ConstrainedBox(constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: MmTarget.min), child: body),
          ),
        ),
      ),
    );
  }
}

/// The control's face: nothing behind it at rest, glass fading in as content goes under it.
class _Pane extends StatelessWidget {
  const _Pane({required this.glass, required this.radius, required this.boost, required this.child});

  final double glass;
  final BorderRadius radius;
  final double boost;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (glass <= 0) return child;
    final pane = MmGlass(kind: GlassKind.control, borderRadius: radius, boost: boost, child: const SizedBox.expand());
    return Stack(
      fit: StackFit.passthrough,
      children: [
        Positioned.fill(child: glass >= 1 ? pane : Opacity(opacity: glass, child: pane)),
        child,
      ],
    );
  }
}

/// The light under the finger, clipped to the control's shape.
class _TouchLightPainter extends CustomPainter {
  const _TouchLightPainter({required this.center, required this.strength, required this.radius, required this.color, required this.shape});

  final Offset? center;
  final double strength;
  final double radius;
  final Color color;
  final BorderRadius shape;

  @override
  void paint(Canvas canvas, Size size) {
    final c = center;
    if (c == null || strength <= 0.001 || size.isEmpty) return;
    final rect = Offset.zero & size;
    canvas.save();
    canvas.clipRRect(shape.resolve(TextDirection.ltr).toRRect(rect));
    canvas.drawCircle(
      c,
      radius,
      Paint()
        ..shader = RadialGradient(
          colors: [color.withValues(alpha: color.a * strength), color.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: c, radius: radius)),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_TouchLightPainter old) =>
      old.center != center || old.strength != strength || old.radius != radius || old.color != color || old.shape != shape;
}
