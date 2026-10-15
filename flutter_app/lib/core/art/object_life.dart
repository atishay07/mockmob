import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/physics.dart' show SpringSimulation;
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import '../motion/motion.dart';

/// The numbers of a subject object's life, shared with the website's `SubjectObject`
/// (`src/components/ui/subject-object.css`): change one, change both.
///
/// | What | Value |
/// | --- | --- |
/// | Objects that come alive by default | [minSize] dp and up (smaller ones keep today's look) |
/// | Float | [floatPeriod] cycle, rising [floatRise] of the box and leaning [floatLeanDeg] degrees at the top, phase per subject |
/// | Tilt | up to [tiltMaxDeg] degrees of rotateX and rotateY, perspective [perspective] (about 900 dp), back on `Springs.smooth` (360 ms, bounce 0.12) |
/// | Scroll lean | full at [MmScrollLean.fullLeanPx] dp in one frame; [scrollShare] of the tilt |
/// | Tap | `MmObjectReact` at [tapAmplitude]: 0.94 at 22%, 1.04 at 58%, rest at 100% of 420 ms, a 2 degree damped twist, about the foot; one tick |
/// | Light | one band across the object's own pixels while it tilts: [lightWidth] of the diagonal, peak alpha [lightNight] (Night) and [lightDay] (Daylight) |
abstract final class ObjectLife {
  static const double minSize = 96;
  static const Duration floatPeriod = Duration(milliseconds: 7200);
  static const double floatRise = 0.03;
  static const double floatLeanDeg = 1.2;
  static const double tiltMaxDeg = 5;
  static const double perspective = 0.0011;
  static const double scrollShare = 0.7;
  static const double tapAmplitude = 0.4;
  static const Duration tapReaction = MmObjectReact.duration;
  static const double lightWidth = 0.22;
  static const double lightNight = 0.24;
  static const double lightDay = 0.32;

  /// A tap is a touch that travels less than this and lifts within [tapTime].
  static const double tapSlop = 18;
  static const Duration tapTime = Duration(milliseconds: 500);
}

/// Life on a standing object: it leans toward a finger resting on it and toward the scroll of
/// its list (up to [ObjectLife.tiltMaxDeg] degrees in perspective), catches one band of the
/// lamp's light on its own pixels while it leans, and reports a tap through [onTap] without taking
/// the tap from the card around it (a listener, not a gesture). At rest it costs nothing: no
/// transform, no layer.
///
/// [object] is where the object is inside the box (the light and the finger's lean are measured
/// against it); [lit] is the part of it the light may cross (it stops above the foot so the
/// contact shadow is never brightened). Under reduced motion it is just the child.
class MmObjectLife extends StatefulWidget {
  const MmObjectLife({
    super.key,
    required this.child,
    required this.object,
    required this.lit,
    required this.brightness,
    this.light = true,
    this.onTap,
  });

  final Widget child;
  final Rect object;
  final Rect lit;
  final Brightness brightness;
  final bool light;
  final VoidCallback? onTap;

  @override
  State<MmObjectLife> createState() => _MmObjectLifeState();
}

class _MmObjectLifeState extends State<MmObjectLife> with TickerProviderStateMixin {
  late final AnimationController _x;
  late final AnimationController _y;
  MmScrollLean? _ownLean;
  ValueListenable<double>? _lean;
  bool _reduced = false;

  Offset? _down;
  Duration? _downAt;
  bool _travelled = false;

  @override
  void initState() {
    super.initState();
    // Made here, not on first use: a dispose must never be the first to touch them.
    _x = AnimationController.unbounded(vsync: this);
    _y = AnimationController.unbounded(vsync: this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = Motion.reduced(context);
    final shared = _reduced ? null : MmParallax.leanOf(context);
    if (shared != null) {
      _ownLean?.dispose();
      _ownLean = null;
      _lean = shared;
    } else if (_reduced) {
      _ownLean?.attach(null);
      _lean = null;
    } else {
      final own = _ownLean ??= MmScrollLean(vsync: this);
      own.attach(Scrollable.maybeOf(context)?.position);
      _lean = own;
    }
  }

  @override
  void dispose() {
    _x.dispose();
    _y.dispose();
    _ownLean?.dispose();
    super.dispose();
  }

  /// The finger's place on the object, -1 to 1 on each axis.
  Offset _aim(Offset local) {
    final o = widget.object;
    if (o.width <= 0 || o.height <= 0) return Offset.zero;
    final d = local - o.center;
    return Offset((d.dx / (o.width / 2)).clamp(-1.0, 1.0), (d.dy / (o.height / 2)).clamp(-1.0, 1.0));
  }

  void _toward(Offset target, {required bool home}) {
    final spring = home ? Springs.smooth : Springs.snappy;
    _x.animateWith(SpringSimulation(spring, _x.value, target.dx, _x.velocity));
    _y.animateWith(SpringSimulation(spring, _y.value, target.dy, _y.velocity));
  }

  void _pointerDown(PointerDownEvent e) {
    _down = e.localPosition;
    _downAt = e.timeStamp;
    _travelled = false;
    if (!_reduced) _toward(_aim(e.localPosition), home: false);
  }

  void _pointerMove(PointerMoveEvent e) {
    final down = _down;
    if (down != null && (e.localPosition - down).distance > ObjectLife.tapSlop) _travelled = true;
    if (!_reduced) _toward(_aim(e.localPosition), home: false);
  }

  void _pointerUp(PointerUpEvent e) {
    final at = _downAt;
    final tapped = !_travelled && at != null && e.timeStamp - at <= ObjectLife.tapTime;
    _down = null;
    _downAt = null;
    if (!_reduced) _toward(Offset.zero, home: true);
    if (tapped) widget.onTap?.call();
  }

  void _pointerCancel(PointerCancelEvent e) {
    _down = null;
    _downAt = null;
    if (!_reduced) _toward(Offset.zero, home: true);
  }

  @override
  Widget build(BuildContext context) {
    Widget out = widget.child;
    if (!_reduced) {
      final lean = _lean;
      final motion = Listenable.merge([_x, _y, ?lean]);
      final night = widget.brightness == Brightness.dark;
      final peak = night ? ObjectLife.lightNight : ObjectLife.lightDay;
      final color = night ? const Color(0xFFFFF1D6) : const Color(0xFFFFFFFF);
      out = AnimatedBuilder(
        animation: motion,
        child: out,
        builder: (context, child) {
          final tilt = objectTilt(finger: Offset(_x.value, _y.value), scroll: lean?.value ?? 0);
          final strength = math.min(1.0, tilt.distance) * peak;
          // The band sits where the lamp (upper left) would catch the leaning face.
          final along = (0.5 - 0.45 * tilt.dy + 0.45 * tilt.dx).clamp(0.0, 1.0);
          Widget lit = widget.light
              ? _ObjectSheen(mask: widget.lit, strength: strength, along: along, color: color, child: child)
              : child!;
          // A spring comes to rest a hair off zero: at rest there is no transform at all.
          if (tilt.distance < 0.002) return lit;
          return Transform(
            transform: objectTiltMatrix(tilt),
            origin: widget.object.center,
            child: lit,
          );
        },
      );
    }
    return Listener(
      behavior: HitTestBehavior.deferToChild,
      onPointerDown: _pointerDown,
      onPointerMove: _pointerMove,
      onPointerUp: _pointerUp,
      onPointerCancel: _pointerCancel,
      child: out,
    );
  }
}

/// The object's tilt as a share of [ObjectLife.tiltMaxDeg] on each axis (x: about the vertical
/// axis, y: about the horizontal axis), from the finger's place on it ([finger], -1 to 1 each way:
/// the touched side presses away) and the list's lean ([scroll], -1 to 1: the top lags the
/// content's travel). Never past 1 on either axis.
Offset objectTilt({required Offset finger, required double scroll}) {
  final x = finger.dx.clamp(-1.0, 1.0);
  final y = (finger.dy - scroll * ObjectLife.scrollShare).clamp(-1.0, 1.0);
  return Offset(x, y);
}

/// The perspective matrix for [tilt] (see [objectTilt]): rotateX by y and rotateY by -x, up to
/// [ObjectLife.tiltMaxDeg] degrees, with [ObjectLife.perspective].
Matrix4 objectTiltMatrix(Offset tilt) {
  const max = ObjectLife.tiltMaxDeg * math.pi / 180;
  return Matrix4.identity()
    ..setEntry(3, 2, ObjectLife.perspective)
    ..rotateX(tilt.dy * max)
    ..rotateY(-tilt.dx * max);
}

/// A band of light painted over the child's own pixels only (`BlendMode.srcATop` on a
/// `ShaderMaskLayer`), inside [mask]. At zero [strength] it paints the child as it is, with no
/// layer, so a still object costs nothing.
class _ObjectSheen extends SingleChildRenderObjectWidget {
  const _ObjectSheen({required this.mask, required this.strength, required this.along, required this.color, super.child});

  final Rect mask;
  final double strength;
  final double along;
  final Color color;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderObjectSheen(mask, strength, along, color);

  @override
  void updateRenderObject(BuildContext context, _RenderObjectSheen renderObject) {
    renderObject
      ..mask = mask
      ..strength = strength
      ..along = along
      ..color = color;
  }
}

class _RenderObjectSheen extends RenderProxyBox {
  _RenderObjectSheen(this._mask, this._strength, this._along, this._color);

  Rect _mask;
  set mask(Rect v) {
    if (v == _mask) return;
    _mask = v;
    markNeedsPaint();
  }

  double _strength;
  set strength(double v) {
    if (v == _strength) return;
    _strength = v;
    markNeedsPaint();
  }

  double _along;
  set along(double v) {
    if (v == _along) return;
    _along = v;
    markNeedsPaint();
  }

  Color _color;
  set color(Color v) {
    if (v == _color) return;
    _color = v;
    markNeedsPaint();
  }

  @override
  bool get alwaysNeedsCompositing => child != null;

  @override
  void paint(PaintingContext context, Offset offset) {
    final child = this.child;
    if (child == null) return;
    if (_strength <= 0.004 || _mask.isEmpty) {
      layer = null;
      context.paintChild(child, offset);
      return;
    }
    final size = _mask.size;
    final half = ObjectLife.lightWidth / 2;
    final a = (_along - half).clamp(0.0, 1.0);
    final b = _along.clamp(a, 1.0);
    final c = (_along + half).clamp(b, 1.0);
    final clear = _color.withValues(alpha: 0);
    final shader = ui.Gradient.linear(
      Offset.zero,
      Offset(size.width, size.height),
      [clear, _color.withValues(alpha: _strength), clear],
      [a, b, c],
    );
    final mask = (layer as ShaderMaskLayer?) ?? ShaderMaskLayer();
    mask
      ..shader = shader
      ..maskRect = _mask.shift(offset)
      ..blendMode = BlendMode.srcATop;
    layer = mask;
    context.pushLayer(mask, super.paint, offset);
  }
}
