import 'package:flutter/material.dart';

import '../motion/motion.dart';

/// Mobi's seven poses, one per `assets/mobi/<name>.webp`. Spec 2.6 says "neutral" is [idle].
/// Mobi never speaks and never shows a sad pose (binding rule 9).
enum MobiPose {
  attentive,
  celebrating,
  encouraging,
  greeting,
  idle,
  pointing,
  thinking;

  String get asset => 'assets/mobi/$name.webp';
}

/// The single motion Mobi may play, once, when it first appears.
enum MobiMotion {
  /// Static pose.
  none,

  /// 420 ms settle: rises 6 dp into place and grows from 0.96 to 1.
  settle,

  /// 400 ms hop (a transform on the pose, not extra frames).
  hop,
}

class Mobi extends StatefulWidget {
  const Mobi({
    super.key,
    this.pose = MobiPose.idle,
    this.size = 96,
    this.motion = MobiMotion.none,
    this.semanticLabel,
  });

  final MobiPose pose;

  /// Height in dp (the artwork is pre-sized to 288 px tall).
  final double size;
  final MobiMotion motion;

  /// Mobi is decoration and is excluded from semantics unless a label is given.
  final String? semanticLabel;

  static const Duration settleDuration = Duration(milliseconds: 420);
  static const Duration hopDuration = Duration(milliseconds: 400);

  @override
  State<Mobi> createState() => _MobiState();
}

class _MobiState extends State<Mobi> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  bool _started = false;

  Duration get _duration => widget.motion == MobiMotion.hop ? Mobi.hopDuration : Mobi.settleDuration;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Play once, the first time we have a context to read reduced motion from.
    if (_started || widget.motion == MobiMotion.none) return;
    _started = true;
    if (Motion.reduced(context)) return;
    _controller = AnimationController(vsync: this, duration: _duration)..forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final image = Image.asset(
      widget.pose.asset,
      height: widget.size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      cacheHeight: (widget.size * dpr).round(),
      gaplessPlayback: true,
      semanticLabel: widget.semanticLabel,
      excludeFromSemantics: widget.semanticLabel == null,
    );

    final controller = _controller;
    if (controller == null) return RepaintBoundary(child: image);

    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: controller,
        child: image,
        builder: (context, child) {
          final t = controller.value;
          if (widget.motion == MobiMotion.hop) {
            final lift = -widget.size * 0.16 * 4 * t * (1 - t);
            return Transform.translate(offset: Offset(0, lift), child: child);
          }
          final eased = Motion.out.transform(t);
          return Transform.translate(
            offset: Offset(0, 6 * (1 - eased)),
            child: Transform.scale(scale: 0.96 + 0.04 * eased, alignment: Alignment.bottomCenter, child: child),
          );
        },
      ),
    );
  }
}
