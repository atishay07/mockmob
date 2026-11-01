/// The card's way out after a rating the server took (the web's `launch()` in `RunPlayer.jsx`, A4 3.5): a ghost of the card
/// flies above the whole screen, so the next item can rise while it is still in the air.
///
///   Got it, Easy   lift 4 dp and 0.96 (100 ms), then an arc into the In Revise pile in the top bar, shrinking to 0.18 and
///                  fading out (320 ms; Easy 280), the arc lifting `min(90, |dy| x 0.28 + 36)` dp over its first half
///   Missed, a look the card tilts -3 degrees, drops 64 dp and fades (260 ms)
///   reduced motion nothing flies (the screen fades the card in place in 120 ms)
///
/// The curves are the stage's: `Motion.out` for the lift and `Motion.drawer` for the arc; the ghost is a card-sized copy
/// (its kind and the book's words) in the card's surface. Transform and opacity only.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/shape.dart';

/// Where the ghost is at one moment of its flight.
class RunGhostPose {
  const RunGhostPose({required this.dx, required this.dy, required this.scale, required this.angle, required this.opacity});

  /// Offsets from where the card stood, in dp; the angle in radians.
  final double dx;
  final double dy;
  final double scale;
  final double angle;
  final double opacity;

  static RunGhostPose lerp(RunGhostPose a, RunGhostPose b, double t) => RunGhostPose(
    dx: a.dx + (b.dx - a.dx) * t,
    dy: a.dy + (b.dy - a.dy) * t,
    scale: a.scale + (b.scale - a.scale) * t,
    angle: a.angle + (b.angle - a.angle) * t,
    opacity: a.opacity + (b.opacity - a.opacity) * t,
  );
}

abstract final class RunFlight {
  /// On the ghost while it is in the air (tests find it by this key).
  static const Key ghostKey = ValueKey<String>('run-ghost');

  static const Duration lift = Duration(milliseconds: 100);
  static const Duration dropFor = Duration(milliseconds: 260);

  /// How long a ghost of [kind] (`got`, `easy`, `missed`) is in the air.
  static Duration durationOf(String kind) => kind == 'missed' ? dropFor : lift + Duration(milliseconds: kind == 'easy' ? 280 : 320);

  static const double _degree = math.pi / 180;

  /// The ghost's pose [ms] into a flight of [kind] that travels ([dx], [dy]) to the pile (a drop ignores them). The web's
  /// keyframes: the lift (0 to 100 ms, ease-out), the first half of the arc to 0.52 (the drawer curve), the rest to 0.18
  /// (linear).
  static RunGhostPose poseAt(String kind, double ms, {double dx = 0, double dy = 0}) {
    if (kind == 'missed') {
      final p = Motion.drawer.transform((ms / dropFor.inMilliseconds).clamp(0.0, 1.0));
      return RunGhostPose(dx: 0, dy: 64 * p, scale: 1, angle: -3 * _degree * p, opacity: 1 - p);
    }
    final fly = kind == 'easy' ? 280.0 : 320.0;
    final total = 100 + fly;
    final rise = math.min(90.0, dy.abs() * 0.28 + 36);
    final o1 = 100 / total;
    final o2 = (100 + fly * 0.45) / total;
    final v = (ms / total).clamp(0.0, 1.0);
    const start = RunGhostPose(dx: 0, dy: 0, scale: 1, angle: 0, opacity: 1);
    const lifted = RunGhostPose(dx: 0, dy: -4, scale: 0.96, angle: 0, opacity: 1);
    final mid = RunGhostPose(dx: dx * 0.45, dy: dy * 0.45 - rise, scale: 0.52, angle: 3 * _degree, opacity: 0.92);
    final end = RunGhostPose(dx: dx, dy: dy, scale: 0.18, angle: 6 * _degree, opacity: 0);
    if (v <= o1) return RunGhostPose.lerp(start, lifted, Motion.out.transform(v / o1));
    if (v <= o2) return RunGhostPose.lerp(lifted, mid, Motion.drawer.transform((v - o1) / (o2 - o1)));
    return RunGhostPose.lerp(mid, end, (v - o2) / (1 - o2));
  }

  /// Flies a ghost of the card at [from] into the pile at [to]. A drop (`missed`, or no pile on screen) falls away where the
  /// card stood. The card's size, its [label] (the kind) and its [words] come from the screen. The future completes when the
  /// ghost is gone. Nothing happens under reduced motion, or when the card is not on screen.
  static Future<void> fly(BuildContext context, {required GlobalKey from, GlobalKey? to, required String kind, String label = '', String words = ''}) async {
    if (Motion.reduced(context)) return;
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    final colors = context.mmColors;
    final type = context.mmType;
    final space = overlay.context.findRenderObject();
    final a = _rect(from, space);
    if (a == null || a.isEmpty) return;
    final pile = kind == 'missed' || to == null ? null : _rect(to, space);
    final path = pile == null ? 'missed' : kind;
    final travel = pile == null ? Offset.zero : pile.center - a.center;
    final total = durationOf(path);
    final controller = AnimationController(vsync: overlay, duration: total);
    final entry = OverlayEntry(
      builder: (context) => AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          final pose = poseAt(path, controller.value * total.inMilliseconds, dx: travel.dx, dy: travel.dy);
          return Positioned(
            left: a.left,
            top: a.top,
            width: a.width,
            height: a.height,
            child: IgnorePointer(
              child: Opacity(
                opacity: pose.opacity.clamp(0.0, 1.0),
                child: Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.translationValues(pose.dx, pose.dy, 0)
                    ..rotateZ(pose.angle)
                    ..scaleByDouble(pose.scale, pose.scale, 1, 1),
                  child: _Ghost(key: ghostKey, label: label, words: words, colors: colors, type: type),
                ),
              ),
            ),
          );
        },
      ),
    );
    overlay.insert(entry);
    try {
      await controller.forward().orCancel;
    } on TickerCanceled {
      // The overlay went away mid-flight.
    } finally {
      entry.remove();
      controller.dispose();
    }
  }

  static Rect? _rect(GlobalKey key, RenderObject? space) {
    final box = key.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return null;
    final origin = space is RenderBox ? box.localToGlobal(Offset.zero, ancestor: space) : box.localToGlobal(Offset.zero);
    return origin & box.size;
  }
}

/// A card-sized copy: the card's surface, its kind and the first of its words.
class _Ghost extends StatelessWidget {
  const _Ghost({super.key, required this.label, required this.words, required this.colors, required this.type});

  final String label;
  final String words;
  final MmColors colors;
  final MmType type;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(24);
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: mmShapeBorder(r, side: BorderSide(color: colors.lineStrong)),
        shadows: colors.cardShadow,
      ),
      child: ClipRRect(
        borderRadius: r,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (label.isNotEmpty)
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.label.copyWith(fontSize: 13, height: 1.3, color: colors.ink3),
                ),
              const SizedBox(height: 14),
              Expanded(
                child: Text(
                  words,
                  overflow: TextOverflow.fade,
                  style: type.body.copyWith(fontSize: 17, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
