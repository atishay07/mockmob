import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/storage/app_prefs.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_page.dart' show youText;

/// The three themes as small pictures of the app itself, side by side: Night, Daylight and
/// Match phone (the two split on a diagonal). Each is painted in its own theme's colours, so the
/// choice is seen, not read. The chosen one wears the ink rim and lifts.
///
/// The tiles answer the tap: the rim thickens and the picture lifts on a 220 ms spring, the three
/// scenes breathe from one shared 6 s controller (the lamp swells, the Start circle swells a
/// hair), and choosing Match phone draws its two halves with a diagonal wipe. Under reduced
/// motion the scenes hold still and the rim just changes.
class ThemeTiles extends StatefulWidget {
  const ThemeTiles({super.key, required this.mode, required this.onChoose});

  final ThemeMode mode;
  final ValueChanged<ThemeChoice> onChoose;

  /// One slow breath of the little scenes, shared by the three.
  static const Duration breath = Duration(seconds: 6);

  /// The diagonal wipe that draws Match phone's two halves when it is chosen.
  static const Duration wipe = Duration(milliseconds: 520);

  @override
  State<ThemeTiles> createState() => _ThemeTilesState();
}

class _ThemeTilesState extends State<ThemeTiles> with TickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(vsync: this, duration: ThemeTiles.breath);
  late final AnimationController _wipe = AnimationController(vsync: this, duration: ThemeTiles.wipe, value: 1);
  bool? _reduced;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = Motion.reduced(context);
    if (reduced == _reduced) return;
    _reduced = reduced;
    if (reduced) {
      _breath.stop();
      _breath.value = 0.5;
      _wipe.value = 1;
    } else {
      _breath.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(ThemeTiles old) {
    super.didUpdateWidget(old);
    if (old.mode != widget.mode && widget.mode == ThemeMode.system && _reduced != true) _wipe.forward(from: 0);
  }

  @override
  void dispose() {
    _breath.dispose();
    _wipe.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: youText),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (choice, themeMode, title, note) in const [
            (ThemeChoice.dark, ThemeMode.dark, YouCopy.themeDark, YouCopy.themeDarkNote),
            (ThemeChoice.light, ThemeMode.light, YouCopy.themeLight, YouCopy.themeLightNote),
            (ThemeChoice.system, ThemeMode.system, YouCopy.themeSystem, YouCopy.themeSystemNote),
          ]) ...[
            if (choice != ThemeChoice.dark) const SizedBox(width: MmSpace.s12),
            Expanded(
              child: _ThemeTile(
                title: title,
                note: note,
                night: themeMode != ThemeMode.light,
                day: themeMode != ThemeMode.dark,
                selected: widget.mode == themeMode,
                breath: _breath,
                wipe: themeMode == ThemeMode.system ? _wipe : null,
                onTap: () => widget.onChoose(choice),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ThemeTile extends ConsumerStatefulWidget {
  const _ThemeTile({
    required this.title,
    required this.note,
    required this.night,
    required this.day,
    required this.selected,
    required this.breath,
    required this.wipe,
    required this.onTap,
  });

  final String title;
  final String note;
  final bool night;
  final bool day;
  final bool selected;
  final Animation<double> breath;
  final Animation<double>? wipe;
  final VoidCallback onTap;

  @override
  ConsumerState<_ThemeTile> createState() => _ThemeTileState();
}

class _ThemeTileState extends ConsumerState<_ThemeTile> with SingleTickerProviderStateMixin {
  /// 0 resting, 1 chosen: the rim thickens and darkens and the picture lifts, on a 220 ms spring
  /// that keeps its velocity if the student taps another tile mid-flight.
  late final AnimationController _sel = AnimationController.unbounded(vsync: this, value: widget.selected ? 1 : 0);

  @override
  void didUpdateWidget(_ThemeTile old) {
    super.didUpdateWidget(old);
    if (old.selected == widget.selected) return;
    final target = widget.selected ? 1.0 : 0.0;
    if (Motion.reduced(context)) {
      _sel.value = target;
      return;
    }
    _sel.animateWith(SpringSimulation(Springs.snappy, _sel.value, target, _sel.velocity));
  }

  @override
  void dispose() {
    _sel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final selected = widget.selected;
    const radius = BorderRadius.all(Radius.circular(18));
    final picture = RepaintBoundary(
      child: CustomPaint(
        painter: _PreviewPainter(night: widget.night, day: widget.day, breath: widget.breath, wipe: widget.wipe),
      ),
    );
    return MmPressable(
      semanticsLabel: '${widget.title}. ${widget.note}',
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: radius,
      onTap: () {
        if (!selected) ref.read(hapticsProvider).selection();
        widget.onTap();
      },
      builder: (context, pressed, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AnimatedBuilder(
            animation: _sel,
            child: AspectRatio(aspectRatio: 0.72, child: MmClip(borderRadius: radius, child: picture)),
            builder: (context, child) {
              final t = _sel.value;
              final c = t.clamp(0.0, 1.0);
              return Transform.translate(
                offset: Offset(0, -4 * t),
                child: Transform.scale(
                  scale: 1 + 0.015 * t,
                  child: DecoratedBox(
                    position: DecorationPosition.foreground,
                    decoration: ShapeDecoration(
                      shape: mmShapeBorder(
                        radius,
                        // Selected is the strongest edge on the page in both themes: a 2 dp ink border.
                        side: BorderSide(color: Color.lerp(colors.line, colors.ink, c)!, width: 1 + c),
                      ),
                    ),
                    child: child,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: MmSpace.s12),
          // The ink rim on the picture is the one selected indicator (with the heavier title);
          // a second dot beside the name said the same thing twice.
          Text(
            widget.title,
            style: type.labelLarge.copyWith(fontSize: 14, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? colors.ink : colors.ink2),
          ),
          const SizedBox(height: 2),
          Text(widget.note, style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink3)),
        ],
      ),
    );
  }
}

/// A tiny Today: the ground with its lamp, a sheet card with the lit edge, two rows of bubbles,
/// and the dock with its volt Start. "Match phone" shows Night and Daylight split on a diagonal.
class _PreviewPainter extends CustomPainter {
  _PreviewPainter({required this.night, required this.day, required this.breath, this.wipe})
      : super(repaint: wipe == null ? breath : Listenable.merge([breath, wipe]));

  final bool night;
  final bool day;
  final Animation<double> breath;

  /// Match phone only: 0 shows Night alone, 1 the two halves split on the diagonal. The Daylight
  /// half grows from the bottom right corner to the diagonal.
  final Animation<double>? wipe;

  @override
  void paint(Canvas canvas, Size size) {
    // 0 to 1 to 0 over the shared 6 s; eased so the breath has no hard turn.
    final b = Curves.easeInOut.transform(breath.value.clamp(0.0, 1.0));
    if (night && day) {
      final w = size.width;
      final h = size.height;
      final v = (wipe?.value ?? 1).clamp(0.0, 1.0);
      _scene(canvas, size, MmColors.dark, b);
      if (v > 0) {
        // The line x/w + y/h = k moves from the far corner (k = 2) to the diagonal (k = 1).
        final k = 2 - v;
        canvas.save();
        canvas.clipPath(Path()
          ..moveTo(w, h * (k - 1))
          ..lineTo(w, h)
          ..lineTo(w * (k - 1), h)
          ..close());
        _scene(canvas, size, MmColors.light, b);
        canvas.restore();
        canvas.drawLine(
          Offset(w, h * (k - 1)),
          Offset(w * (k - 1), h),
          Paint()
            ..strokeWidth = 1
            ..color = const Color(0x40000000),
        );
      }
    } else {
      _scene(canvas, size, night ? MmColors.dark : MmColors.light, b);
    }
  }

  void _scene(Canvas canvas, Size size, MmColors c, double b) {
    final rect = Offset.zero & size;
    final w = size.width;
    final h = size.height;
    canvas.drawRect(rect, Paint()..color = c.ground);
    // The lamp in the upper left; it swells and settles with the breath.
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-1, -1),
          radius: 1.05 + 0.1 * b,
          colors: [c.lamp.withValues(alpha: (c.isNight ? 0.2 : 0.13) + (c.isNight ? 0.07 : 0.05) * b), c.lamp.withValues(alpha: 0)],
        ).createShader(rect),
    );
    // The sheet card.
    final card = RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.1, h * 0.14, w * 0.8, h * 0.4), Radius.circular(w * 0.07));
    canvas.drawRRect(card, Paint()..color = c.isNight ? c.raised2 : c.raised);
    canvas.drawRRect(card, Paint()..style = PaintingStyle.stroke..strokeWidth = 0.8..color = c.line);
    final lit = Paint()
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..color = c.isNight ? c.volt : c.accentText;
    canvas.drawLine(Offset(w * 0.24, h * 0.14 + 0.7), Offset(w * 0.76, h * 0.14 + 0.7), lit);
    // A title line and two rows of bubbles.
    final ink = Paint()
      ..strokeWidth = h * 0.028
      ..strokeCap = StrokeCap.round
      ..color = c.ink;
    canvas.drawLine(Offset(w * 0.2, h * 0.22), Offset(w * 0.56, h * 0.22), ink);
    final bubbles = BubblePaint(c);
    final r = w * 0.045;
    for (var row = 0; row < 2; row++) {
      for (var i = 0; i < 5; i++) {
        final centre = Offset(w * 0.24 + i * w * 0.13, h * (0.33 + row * 0.1));
        final filled = row == 0 ? i < 3 : i == 1;
        bubbles.paint(canvas, centre, r, filled ? BubbleState.filled : BubbleState.hollow);
      }
    }
    // The dock and the Start circle, which swells a hair with the breath.
    final dock = RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.08, h * 0.84, w * 0.58, h * 0.09), Radius.circular(h));
    canvas.drawRRect(dock, Paint()..color = c.isNight ? c.raised2 : c.raised);
    canvas.drawRRect(dock, Paint()..style = PaintingStyle.stroke..strokeWidth = 0.8..color = c.line);
    canvas.drawCircle(Offset(w * 0.8, h * 0.885), h * 0.045 * (1 + 0.06 * b), Paint()..color = c.volt);
  }

  @override
  bool shouldRepaint(_PreviewPainter old) => old.night != night || old.day != day || old.breath != breath || old.wipe != wipe;
}
