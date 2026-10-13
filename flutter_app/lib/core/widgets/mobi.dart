import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'art/mm_art.dart';
import 'materials/fake_glass.dart';

/// Mobi's poses: the seven warm, lamp-lit renders in `assets/art/` (Night Sheet brief, section
/// 2), each falling back to the original flat artwork in `assets/mobi/` if its file is missing.
///
/// The older pose names are kept so existing screens compile; they map onto the new renders.
/// Mobi never shows a sad pose and is never in the runner or on a sealed sheet.
enum MobiPose {
  greet(MmArt.mobiGreet, 'greeting'),
  point(MmArt.mobiPoint, 'pointing'),
  think(MmArt.mobiThink, 'thinking'),
  cheer(MmArt.mobiCheer, 'celebrating'),
  rest(MmArt.mobiRest, 'idle'),
  sleepy(MmArt.mobiSleepy, 'idle'),
  read(MmArt.mobiRead, 'attentive'),
  attentive(MmArt.mobiGreet, 'attentive'),
  celebrating(MmArt.mobiCheer, 'celebrating'),
  encouraging(MmArt.mobiPoint, 'encouraging'),
  greeting(MmArt.mobiGreet, 'greeting'),
  idle(MmArt.mobiGreet, 'idle'),
  pointing(MmArt.mobiPoint, 'pointing'),
  thinking(MmArt.mobiThink, 'thinking');

  const MobiPose(this.art, this._legacy);

  /// The warm render.
  final MmArt art;
  final String _legacy;

  /// The render's asset path.
  String get asset => art.asset;

  /// The original flat artwork, used when the render is missing.
  String get legacyAsset => 'assets/mobi/$_legacy.webp';
}

/// The single motion Mobi may play, once, when it appears. Transforms only; never an idle loop.
enum MobiMotion {
  /// Static pose.
  none,

  /// 420 ms settle: rises 6 dp into place and grows from 0.96 to 1.
  settle,

  /// 400 ms hop.
  hop,

  /// 420 ms lean of 5 degrees toward what Mobi points at (to the right), then holds.
  tilt,
}

/// Mobi, the companion at the human moments: welcome, onboarding guide moments, empty states,
/// return after a gap, late night, celebrations. It may [say] one short line in a glass bubble,
/// never evaluative of the person.
class Mobi extends StatefulWidget {
  const Mobi({
    super.key,
    this.pose = MobiPose.greet,
    this.size = 96,
    this.motion = MobiMotion.none,
    this.semanticLabel,
    this.say,
    this.sayLive = false,
  });

  final MobiPose pose;

  /// Height in dp.
  final double size;
  final MobiMotion motion;

  /// Mobi is decoration and is excluded from semantics unless a label is given.
  final String? semanticLabel;

  /// One short line in a glass speech bubble beside Mobi.
  final String? say;

  /// Announce [say] when it changes (a line that answers the student's own choice).
  final bool sayLive;

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

  Widget _transform(double t, Widget child) {
    switch (widget.motion) {
      case MobiMotion.none:
        return child;
      case MobiMotion.hop:
        final lift = -widget.size * 0.16 * 4 * t * (1 - t);
        return Transform.translate(offset: Offset(0, lift), child: child);
      case MobiMotion.settle:
        final e = Motion.emphasized.transform(t);
        return Transform.translate(
          offset: Offset(0, 6 * (1 - e)),
          child: Transform.scale(scale: 0.96 + 0.04 * e, alignment: Alignment.bottomCenter, child: child),
        );
      case MobiMotion.tilt:
        final e = Motion.emphasized.transform(t);
        return Transform.rotate(angle: 5 * math.pi / 180 * e, alignment: Alignment.bottomCenter, child: child);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final legacy = Image.asset(
      widget.pose.legacyAsset,
      height: widget.size,
      fit: BoxFit.contain,
      cacheHeight: (widget.size * dpr).round(),
      excludeFromSemantics: true,
      errorBuilder: (context, error, stack) => SizedBox.square(dimension: widget.size),
    );
    final image = ArtImage(
      widget.pose.art,
      height: widget.size,
      placeholder: legacy,
      semanticLabel: widget.semanticLabel,
    );

    final controller = _controller;
    Widget body = controller == null
        ? (widget.motion == MobiMotion.tilt && !Motion.reduced(context) ? _transform(1, image) : image)
        : AnimatedBuilder(animation: controller, child: image, builder: (context, child) => _transform(controller.value, child!));
    body = RepaintBoundary(child: body);

    final line = widget.say;
    if (line == null) return body;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        body,
        const SizedBox(width: MmSpace.s8),
        Flexible(child: MobiLine(line, live: widget.sayLive)),
      ],
    );
  }
}

/// Mobi's one short line: a small smoked-glass bubble with a tail toward Mobi. Read in place
/// with the screen; a [live] line (one that changes after the student acts, such as the worry
/// step) is announced when it changes.
class MobiLine extends StatelessWidget {
  const MobiLine(this.text, {super.key, this.live = false});

  final String text;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = BorderRadius.only(
      topLeft: Radius.circular(6),
      topRight: Radius.circular(18),
      bottomLeft: Radius.circular(18),
      bottomRight: Radius.circular(18),
    );
    return Semantics(
      liveRegion: live,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 240),
        child: FakeGlass(
          borderRadius: radius,
          opacity: colors.isNight ? 0.86 : 0.92,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12 + 2, vertical: MmSpace.s8 + 2),
            child: Text(text, style: type.labelLarge.copyWith(fontSize: 14, height: 19 / 14, color: colors.ink)),
          ),
        ),
      ),
    );
  }
}
