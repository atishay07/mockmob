import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A 44 dp rounded tile for an icon at the start of a flat tools row: raised on Night, sunken
/// paper on Daylight, a hairline round it and the icon in full ink so it reads at a glance.
class ToolsIconTile extends StatelessWidget {
  const ToolsIconTile(this.icon, {super.key});

  final IconData icon;

  static const double size = 44;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: colors.isNight ? colors.raised2 : colors.sunken,
          border: Border.all(color: colors.line),
        ),
        child: SizedBox.square(dimension: size, child: Icon(icon, size: 22, color: colors.ink)),
      ),
    );
  }
}

/// Rows on the ground, no card behind them: one icon column, and hairlines that run from the
/// text on the left to the end of the chevron on the right, so both ends line up with the row.
class ToolsFlatList extends StatelessWidget {
  const ToolsFlatList({super.key, required this.children, this.margin = const EdgeInsets.symmetric(horizontal: MmSpace.gutter)});

  final List<Widget> children;
  final EdgeInsetsGeometry margin;

  /// The row's own side padding (the 4 dp the screen titles use past the gutter).
  static const double edge = 4;

  /// Where the hairlines start: past the edge, the tile and its gap.
  static const double textStart = edge + ToolsIconTile.size + MmSpace.s16;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) {
        rows.add(Padding(
          padding: const EdgeInsets.only(left: textStart, right: edge),
          child: SizedBox(height: 1, child: ColoredBox(color: colors.line)),
        ));
      }
      rows.add(children[i]);
    }
    return Padding(
      padding: margin,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows),
    );
  }
}

/// A small text action with its icon (Edit subjects, Change): accent ink, at least 48 dp tall
/// and 48 dp wide, so it is a real target and reads as an action, not a label.
class ToolsInlineAction extends ConsumerWidget {
  const ToolsInlineAction({super.key, required this.label, required this.onTap, this.icon, this.semanticsLabel});

  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: semanticsLabel ?? label,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) {
        final ink = pressed ? colors.ink : colors.accentText;
        return ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[Icon(icon, size: 16, color: ink), const SizedBox(width: MmSpace.s6)],
                Flexible(child: Text(label, style: context.mmType.labelLarge.copyWith(fontSize: 14, color: ink))),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// A horizontal row that scrolls, with a soft fade on the right edge while more lies past it
/// (a cut-off chip alone reads as a mistake; the fade says it moves).
class ToolsFadingScroller extends StatefulWidget {
  const ToolsFadingScroller({super.key, required this.child, this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter)});

  final Widget child;
  final EdgeInsets padding;

  @override
  State<ToolsFadingScroller> createState() => _ToolsFadingScrollerState();
}

class _ToolsFadingScrollerState extends State<ToolsFadingScroller> {
  final _controller = ScrollController();
  bool _more = true;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_update);
    WidgetsBinding.instance.addPostFrameCallback((_) => _update());
  }

  void _update() {
    if (!mounted || !_controller.hasClients) return;
    final more = _controller.position.maxScrollExtent - _controller.offset > 2;
    if (more != _more) setState(() => _more = more);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scroller = SingleChildScrollView(
      controller: _controller,
      scrollDirection: Axis.horizontal,
      padding: widget.padding,
      child: widget.child,
    );
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) => LinearGradient(
        colors: [Colors.white, Colors.white, _more ? Colors.transparent : Colors.white],
        stops: const [0, 0.9, 1],
      ).createShader(rect),
      child: scroller,
    );
  }
}

/// A progress ring: [fraction] of a full turn in volt over a quiet track, with [child] (a
/// number) in the middle. The arc sweeps in once when the card arrives; under reduced motion it
/// is simply drawn.
class ToolsRing extends StatelessWidget {
  const ToolsRing({super.key, required this.fraction, required this.child, this.size = 112, this.stroke = 8});

  final double fraction;
  final Widget child;
  final double size;
  final double stroke;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final reduced = MediaQuery.disableAnimationsOf(context);
    final target = fraction.clamp(0.0, 1.0);
    Widget ring(double t) => CustomPaint(
          painter: _RingPainter(
            fraction: target * t,
            track: colors.lineStrong,
            arc: colors.isNight ? colors.volt : colors.accentText,
            stroke: stroke,
          ),
          child: SizedBox.square(dimension: size, child: Padding(padding: EdgeInsets.all(stroke + 6), child: Center(child: child))),
        );
    if (reduced) return ring(1);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 700),
      curve: const Cubic(0.45, 0, 0.55, 1),
      builder: (context, t, _) => ring(t),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({required this.fraction, required this.track, required this.arc, required this.stroke});

  final double fraction;
  final Color track;
  final Color arc;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final inner = rect.deflate(stroke / 2);
    canvas.drawArc(
      inner,
      0,
      6.283185307179586,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    if (fraction <= 0) return;
    canvas.drawArc(
      inner,
      -1.5707963267948966,
      6.283185307179586 * fraction,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = arc,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.track != track || old.arc != arc || old.stroke != stroke;
}
