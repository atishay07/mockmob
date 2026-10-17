import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/brand/logo_geometry.g.dart';
import '../../../core/widgets/widgets.dart';

/// Mobi's flat face mark: the volt diamond, the dark visor and two warm-white eyes, painted from
/// the logo's own Mobi (logo B's "o"). Static: no glass, no light, no glow (ASK-MOBI-1018 2, D7).
///
/// While [blinking], the eyes close once every 1.6 s: a real wait, said with the face instead of
/// a spinner. Reduced motion keeps the eyes open.
class MobiMark extends StatefulWidget {
  const MobiMark({super.key, this.size = 24, this.blinking = false, this.semanticLabel});

  final double size;
  final bool blinking;
  final String? semanticLabel;

  /// The rect of Mobi alone in the logo's word coordinates.
  static Rect get bounds {
    final m = LogoGeometry.mobiSmall;
    return m.bounds.shift(Offset(m.x, 0));
  }

  /// Every letter of "mockmob" hidden except Mobi.
  static final List<LogoGlyphPose> _onlyMobi = [
    for (var i = 0; i < LogoGeometry.word.length; i++) i == LogoGeometry.mobiIndex ? LogoGlyphPose.rest : const LogoGlyphPose(opacity: 0),
  ];

  /// How closed the eyes are at [t] (0 to 1) of one blink period: shut briefly near the start.
  static double blinkAt(double t) {
    const shut = 0.06, open = 0.14;
    if (t < shut) return t / shut;
    if (t < open) return 1 - (t - shut) / (open - shut);
    return 0;
  }

  @override
  State<MobiMark> createState() => _MobiMarkState();
}

class _MobiMarkState extends State<MobiMark> with SingleTickerProviderStateMixin {
  static const Duration _period = Duration(milliseconds: 1600);
  late final AnimationController _blink = AnimationController(vsync: this, duration: _period);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(MobiMark old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final run = widget.blinking && !Motion.reduced(context);
    if (run && !_blink.isAnimating) {
      _blink.repeat();
    } else if (!run && _blink.isAnimating) {
      _blink
        ..stop()
        ..value = 0;
    }
  }

  @override
  void dispose() {
    _blink.dispose();
    super.dispose();
  }

  Widget _face(double blink) => ClipRect(
        child: BrandLogo.icon(
          size: widget.size,
          tile: false,
          semanticLabel: null,
          pose: LogoPose(view: MobiMark.bounds, glyphs: MobiMark._onlyMobi, mobi: MobiFacePose(blink: blink, detail: LogoDetail.small)),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final mark = widget.blinking
        ? AnimatedBuilder(animation: _blink, builder: (context, _) => _face(MobiMark.blinkAt(_blink.value)))
        : _face(0);
    final sized = SizedBox.square(dimension: widget.size, child: mark);
    if (widget.semanticLabel == null) return ExcludeSemantics(child: sized);
    return Semantics(image: true, label: widget.semanticLabel, excludeSemantics: true, child: sized);
  }
}
