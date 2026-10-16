import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_motion.dart';

/// A swatch of the glass the app really draws, over a slow drifting gradient so the blur has
/// something to work on. It reads [glassQualityProvider] (the tier in effect, including the
/// automatic step down to Lite), so Full shows the live blur, Lite the tint without it and Off a
/// solid surface. The gradient drifts over 14 s; it holds still under reduced motion and while
/// the screen is off.
class GlassSwatch extends ConsumerStatefulWidget {
  const GlassSwatch({super.key});

  /// The picker's own words for each choice (GLASS-1017 section 5.11), so the swatch and the
  /// setting never disagree.
  static String lineFor(GlassQuality quality) => GlassQualityPicker.describe(quality);

  static const Duration drift = Duration(seconds: 14);

  @override
  ConsumerState<GlassSwatch> createState() => _GlassSwatchState();
}

class _GlassSwatchState extends ConsumerState<GlassSwatch> with SingleTickerProviderStateMixin {
  late final AnimationController _drift = AnimationController(vsync: this, duration: GlassSwatch.drift, value: 0.3);
  bool? _reduced;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = Motion.reduced(context);
    if (reduced == _reduced) return;
    _reduced = reduced;
    if (reduced) {
      _drift.stop();
    } else {
      _drift.repeat();
    }
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final quality = ref.watch(glassQualityProvider);
    final line = GlassSwatch.lineFor(quality);
    const radius = BorderRadius.all(Radius.circular(18));
    return Semantics(
      container: true,
      label: '${YouCopy.glassPreviewLabel}. $line',
      excludeSemantics: true,
      child: SizedBox(
        height: 96,
        child: MmClip(
          borderRadius: radius,
          child: BackdropGroup(
            child: Stack(
              fit: StackFit.expand,
              children: [
                RepaintBoundary(child: CustomPaint(painter: _DriftPainter(t: _drift, colors: colors))),
                Center(
                  child: GlassSurface(
                    role: GlassRole.control,
                    quality: quality,
                    borderRadius: MmRadius.pillAll,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 280),
                        child: YouNote(line, style: type.small.copyWith(color: colors.ink), maxLines: 2),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Two soft pools of colour that drift past each other on the ground: the lamp's warm one and a
/// volt one. Painted from one controller; nothing else repaints.
class _DriftPainter extends CustomPainter {
  _DriftPainter({required this.t, required this.colors}) : super(repaint: t);

  final Animation<double> t;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = colors.ground);
    final a = t.value * math.pi * 2;
    final r = size.height * 1.1;
    void pool(Offset c, Color color, double alpha) {
      canvas.drawCircle(
        c,
        r,
        Paint()..shader = RadialGradient(colors: [color.withValues(alpha: alpha), color.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: c, radius: r)),
      );
    }

    final night = colors.isNight;
    pool(Offset(size.width * (0.28 + 0.2 * math.sin(a)), size.height * (0.5 + 0.25 * math.cos(a))), colors.lamp, night ? 0.5 : 0.4);
    pool(Offset(size.width * (0.72 - 0.2 * math.sin(a)), size.height * (0.5 - 0.25 * math.cos(a))), night ? colors.volt : colors.accentText, night ? 0.32 : 0.22);
  }

  @override
  bool shouldRepaint(_DriftPainter old) => old.colors != colors || old.t != t;
}
