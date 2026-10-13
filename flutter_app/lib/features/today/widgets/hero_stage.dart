// The stage every Today hero stands on: a lamp-lit panel with the subject's light pooled behind
// its object in the upper right, warm grain, and the screen's one lit edge along the top. The
// light and the art stay in the upper right; everything a student reads sits on the calm,
// darker lower left (brief section 5: no art behind text that is read).
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

/// Corner radius of the hero panel.
const double heroRadius = 28;
const BorderRadius heroBorderRadius = BorderRadius.all(Radius.circular(heroRadius));

/// Height of the art corner. Content below this line never sits over art.
const double heroArtHeight = 150;

class HeroStage extends StatelessWidget {
  const HeroStage({super.key, required this.child, this.subjectId, this.art, this.artWidth = 220, this.lit = true, this.lampStrength = 1});

  final Widget child;
  final String? subjectId;

  /// The upper-right corner: an object or Mobi. Drawn under the content layer.
  final Widget? art;

  /// Width of the art corner, from the right edge.
  final double artWidth;

  /// The volt top edge: true on the one focal element of the screen.
  final bool lit;
  final double lampStrength;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final brightness = Theme.of(context).brightness;
    final subject = SubjectLight.forSubject(subjectId);
    final surface = colors.isNight ? Color.lerp(colors.raised, colors.ground, 0.25)! : colors.raised;

    final pools = <LightPool>[
      if (subject != null)
        LightPool(color: subject.of(brightness), center: const Alignment(0.62, -0.62), radius: 0.62, strength: colors.isNight ? 1 : 0.9),
      LightPool(
        color: colors.lamp.withValues(alpha: (colors.isNight ? 0.2 : 0.13) * lampStrength),
        center: const Alignment(-1.05, -1.1),
        radius: 0.75,
        aspect: 1.3,
      ),
    ];

    final panel = MmClip(
      borderRadius: heroBorderRadius,
      child: Stack(
        children: [
          Positioned.fill(child: ColoredBox(color: surface)),
          Positioned.fill(child: LightField(pools: pools)),
          Positioned.fill(child: Grain(opacity: colors.grain)),
          if (art != null)
            Positioned(top: 0, right: 0, width: artWidth, height: heroArtHeight + 8, child: art!),
          child,
        ],
      ),
    );

    final framed = CustomPaint(
      foregroundPainter: EdgeLightPainter(
        borderRadius: heroBorderRadius,
        top: colors.edgeTop,
        bottom: colors.edgeBottom,
        lamp: colors.isNight ? colors.lamp : null,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(borderRadius: heroBorderRadius, boxShadow: colors.glassShadow),
        child: panel,
      ),
    );

    if (!lit) return framed;
    return LitEdge(glow: true, borderRadius: heroBorderRadius, child: framed);
  }
}

/// The hero's art corner: the subject object or Mobi. Arrives once (rise 12 dp, scale 0.96 to
/// 1, fade, 600 ms emphasized), then never moves. Reduced motion shows it in place.
class HeroArtView extends StatefulWidget {
  const HeroArtView({super.key, required this.art, this.mobiLine});

  final HeroArt art;
  final String? mobiLine;

  @override
  State<HeroArtView> createState() => _HeroArtViewState();
}

class _HeroArtViewState extends State<HeroArtView> with SingleTickerProviderStateMixin {
  late final AnimationController _arrive = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context) || widget.art.isMobi) {
      _arrive.value = 1;
    } else {
      _arrive.forward();
    }
  }

  @override
  void dispose() {
    _arrive.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final art = widget.art;
    final Widget image = art.isMobi
        ? Align(
            alignment: const Alignment(0.55, 0.4),
            child: Mobi(pose: _pose(art.art), size: 150, motion: MobiMotion.settle),
          )
        : Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 8, 4),
            child: ArtImage(art.art, alignment: const Alignment(0.6, 0)),
          );

    final line = widget.mobiLine;
    final body = RepaintBoundary(
      child: AnimatedBuilder(
        animation: _arrive,
        child: image,
        builder: (context, child) {
          final t = Motion.emphasized.transform(_arrive.value);
          return Opacity(
            opacity: t,
            child: Transform.translate(
              offset: Offset(0, 12 * (1 - t)),
              child: Transform.scale(scale: 0.96 + 0.04 * t, child: child),
            ),
          );
        },
      ),
    );
    if (line == null || !art.isMobi) return body;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(child: body),
        // Beside Mobi's head, left of it, clear of the overline above and the number below.
        Positioned(right: 132, top: 76, child: MobiLine(line)),
      ],
    );
  }

  static MobiPose _pose(MmArt art) => switch (art) {
        MmArt.mobiSleepy => MobiPose.sleepy,
        MmArt.mobiThink => MobiPose.think,
        MmArt.mobiRead => MobiPose.read,
        MmArt.mobiRest => MobiPose.rest,
        MmArt.mobiCheer => MobiPose.cheer,
        MmArt.mobiPoint => MobiPose.point,
        _ => MobiPose.greet,
      };
}
