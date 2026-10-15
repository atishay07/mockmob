import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart' show SpringSimulation;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../../core/widgets/materials/edge_light.dart';
import 'surface_roles.dart';

/// How many questions, as a piece of paper you can feel: each stop is its number over a small
/// answer sheet sized to it (5 is one row of five bubbles, 20 is four rows), the chosen stop
/// sits on a raised thumb that springs to its stop, and its bubbles ink in order.
/// Drag across the track to scrub: a segment tick at every stop crossed (`SEGMENT_TICK` where the
/// phone has it, else a selection click). Each stop is a button
/// with its selected state, so TalkBack reads "10 questions, selected".
class LengthDial extends ConsumerStatefulWidget {
  const LengthDial({super.key, required this.count, required this.counts, required this.onChanged, this.semanticsLabel});

  final int count;
  final List<int> counts;

  /// Null disables the dial.
  final ValueChanged<int>? onChanged;
  final String? semanticsLabel;

  /// The dial's height for [scaler]: the pill row (the number line grows with the text size) and,
  /// under it, the tallest sheet (the longest length), so no stop is ever cut.
  static double heightFor(TextScaler scaler, List<int> counts) {
    final longest = counts.isEmpty ? perRow : counts.reduce((a, b) => a > b ? a : b);
    return pillHeight(scaler) + sheetGap + _SheetPainter.sizeFor(longest).height + 4;
  }

  /// A pill is the number line with 12 dp above and below: 56 dp at 1x text, never under 48.
  static double pillHeight(TextScaler scaler) => scaler.scale(_StopState.numberLine) + 2 * MmSpace.s12;

  /// One pill's width in a row of [n] across [width].
  static double pillWidth(double width, int n) => (width - gap * (n - 1)) / n;

  /// The gap between pills, and between a pill and its sheet.
  static const double gap = MmSpace.s8;
  static const double sheetGap = MmSpace.s8;

  /// Bubbles per row of a stop's sheet.
  static const int perRow = 5;

  @override
  ConsumerState<LengthDial> createState() => _LengthDialState();
}

class _LengthDialState extends ConsumerState<LengthDial> with SingleTickerProviderStateMixin {
  /// The thumb's place in stop units (0 is the first stop's centre, n - 1 the last). Unbounded so
  /// a spring may overshoot a hair. It follows the finger while dragging, and springs to a stop.
  late final AnimationController _pos = AnimationController.unbounded(vsync: this, value: _index.toDouble());

  /// The stop under the thumb while dragging, so each stop crossed ticks once.
  int? _dragIndex;
  bool _dragging = false;

  int get _index => widget.counts.indexOf(widget.count).clamp(0, widget.counts.length - 1);

  @override
  void didUpdateWidget(LengthDial old) {
    super.didUpdateWidget(old);
    // A length chosen elsewhere (a tap on a stop, a link) springs there, carrying whatever speed
    // the thumb already had, so a second tap mid-flight turns it without a jolt; while the finger
    // is down the thumb is the finger's.
    if (_dragging) return;
    _springTo(_index.toDouble());
  }

  /// The thumb to [target] on the cards' spring (360 ms, bounce 0.12: a hair past the stop and
  /// back, a detent you can see). At once under reduced motion.
  void _springTo(double target) {
    if ((_pos.value - target).abs() < 0.001 && !_pos.isAnimating) return;
    if (Motion.reduced(context)) {
      _pos.value = target;
    } else {
      _pos.animateWith(SpringSimulation(Springs.smooth, _pos.value, target, _pos.velocity));
    }
  }

  @override
  void dispose() {
    _pos.dispose();
    super.dispose();
  }

  void _choose(int index) {
    final onChanged = widget.onChanged;
    if (onChanged == null || index < 0 || index >= widget.counts.length) return;
    if (widget.counts[index] == widget.count) return;
    final end = index == 0 || index == widget.counts.length - 1;
    // The first and last stop are detents you feel more: a firmer tick than the ones between.
    unawaited(end ? ref.read(hapticsProvider).light() : ref.read(hapticsProvider).segmentTick());
    onChanged(widget.counts[index]);
  }

  /// Moves the length one stop (TalkBack's increase and decrease).
  void _step(int by) => _choose((_index + by).clamp(0, widget.counts.length - 1));

  /// The thumb under the finger at [x] (local to the row), in stop units, clamped to the row: a
  /// pill's centre is its own stop.
  double _posAt(double x, double pillW, double stride) {
    final n = widget.counts.length;
    return ((x - pillW / 2) / stride).clamp(0.0, (n - 1).toDouble());
  }

  void _dragStart(DragStartDetails d, double pillW, double stride) {
    _dragging = true;
    _pos.stop();
    _pos.value = _posAt(d.localPosition.dx, pillW, stride);
    // The thumb jumps to the finger when the drag is recognised, which may already be past a
    // stop: that stop is chosen at once (and ticks), not on the next move.
    final index = _pos.value.round().clamp(0, widget.counts.length - 1);
    _dragIndex = index;
    _choose(index);
  }

  void _dragUpdate(DragUpdateDetails d, double pillW, double stride) {
    _pos.value = _posAt(d.localPosition.dx, pillW, stride);
    // The sheet and the stub follow live: the length is the nearest stop to the thumb.
    final index = _pos.value.round().clamp(0, widget.counts.length - 1);
    if (index == _dragIndex) return;
    _dragIndex = index;
    _choose(index);
  }

  void _dragEnd(DragEndDetails d, double stride) {
    final n = widget.counts.length;
    _dragging = false;
    _dragIndex = null;
    // Release velocity in stop units per second; a flick carries a little past the nearest stop.
    final velocity = (d.primaryVelocity ?? 0) / stride;
    final target = (_pos.value + velocity * 0.06).round().clamp(0, n - 1);
    _choose(target);
    if (Motion.reduced(context)) {
      _pos.value = target.toDouble();
    } else {
      _pos.animateWith(SpringSimulation(Springs.smooth, _pos.value, target.toDouble(), velocity));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = widget.counts.length;
    final index = _index;
    final enabled = widget.onChanged != null;
    final canUp = enabled && index < n - 1;
    final canDown = enabled && index > 0;
    final scaler = MediaQuery.textScalerOf(context);

    return Semantics(
      container: true,
      label: widget.semanticsLabel,
      value: '${widget.counts[index]} questions',
      increasedValue: canUp ? '${widget.counts[index + 1]} questions' : null,
      decreasedValue: canDown ? '${widget.counts[index - 1]} questions' : null,
      onIncrease: canUp ? () => _step(1) : null,
      onDecrease: canDown ? () => _step(-1) : null,
      child: Opacity(
        opacity: enabled ? 1 : 0.5,
        // No well around the pills: they sit on the page, so the picker is never a box inside a box.
        child: SizedBox(
          height: LengthDial.heightFor(scaler, widget.counts),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final pillW = LengthDial.pillWidth(width, n);
              final pillH = LengthDial.pillHeight(scaler);
              final stride = pillW + LengthDial.gap;
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onHorizontalDragStart: enabled ? (d) => _dragStart(d, pillW, stride) : null,
                onHorizontalDragUpdate: enabled ? (d) => _dragUpdate(d, pillW, stride) : null,
                onHorizontalDragEnd: enabled ? (d) => _dragEnd(d, stride) : null,
                onHorizontalDragCancel: enabled
                    ? () {
                        _dragging = false;
                        _dragIndex = null;
                        _springTo(_index.toDouble());
                      }
                    : null,
                child: Stack(
                  children: [
                    // The thumb: the selected surface with a 2 dp ink ring (SPACING.md 8.1, the
                    // same weight in both themes) over the chosen pill. It rides the finger, then
                    // springs to a stop.
                    Positioned(
                      left: 0,
                      top: 0,
                      width: pillW,
                      height: pillH,
                      child: RepaintBoundary(
                        child: AnimatedBuilder(
                          animation: _pos,
                          builder: (context, child) => Transform.translate(offset: Offset(_pos.value * stride, 0), child: child),
                          child: DecoratedBox(
                            decoration: ShapeDecoration(
                              color: selectedSurface(colors),
                              shape: RoundedSuperellipseBorder(
                                borderRadius: MmRadius.smallAll,
                                side: BorderSide(color: colors.ink, width: 2),
                              ),
                              shadows: colors.isNight ? null : colors.cardShadow,
                            ),
                            child: CustomPaint(
                              foregroundPainter: EdgeLightPainter(
                                borderRadius: MmRadius.smallAll,
                                top: colors.edgeTop,
                                bottom: colors.edgeBottom,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    // Top-aligned: every number sits on one line; the chosen length's sheet hangs
                    // under its pill, so a longer sheet never pushes its number up.
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var i = 0; i < n; i++) ...[
                          if (i > 0) const SizedBox(width: LengthDial.gap),
                          SizedBox(
                            width: pillW,
                            child: Semantics(
                              button: true,
                              selected: i == index,
                              inMutuallyExclusiveGroup: true,
                              label: '${widget.counts[i]} questions',
                              excludeSemantics: true,
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: enabled ? () => _choose(i) : null,
                                child: _Stop(count: widget.counts[i], selected: i == index, style: type.title, pillHeight: pillH),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// One stop: the number in its glass pill, and, under the chosen one only, its small sheet. The
/// pill's own fill is the resting surface; the sheet inks when the stop is chosen.
class _Stop extends StatefulWidget {
  const _Stop({required this.count, required this.selected, required this.style, required this.pillHeight});

  final int count;
  final bool selected;
  final TextStyle style;
  final double pillHeight;

  @override
  State<_Stop> createState() => _StopState();
}

class _StopState extends State<_Stop> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(
    vsync: this,
    duration: _inkDuration(widget.count),
    value: widget.selected ? 1 : 0,
  );

  static const double numberLine = 32;

  /// 18 ms between bubbles plus the last bubble's own 200 ms.
  static Duration _inkDuration(int count) => Duration(milliseconds: 200 + 18 * count);

  @override
  void didUpdateWidget(_Stop old) {
    super.didUpdateWidget(old);
    if (old.selected == widget.selected) return;
    if (widget.selected && !Motion.reduced(context)) {
      _ink.forward(from: 0);
    } else {
      _ink.value = widget.selected ? 1 : 0;
    }
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final selected = widget.selected;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // The pill: a glass fill and a hairline at rest (the chosen thumb covers it with its own).
        // One size and one box for every numeral, chosen or not: only the ink changes, so all the
        // numbers share a baseline (SPACING-AUDIT P6).
        SizedBox(
          height: widget.pillHeight,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: selected ? null : colors.raised,
              shape: RoundedSuperellipseBorder(
                borderRadius: MmRadius.smallAll,
                side: BorderSide(color: selected ? Colors.transparent : colors.line),
              ),
            ),
            child: Center(
              child: AnimatedDefaultTextStyle(
                duration: Motion.of(context, Motion.ui),
                style: widget.style.copyWith(fontSize: 28, height: numberLine / 28, color: selected ? colors.ink : colors.ink2),
                child: Text('${widget.count}', textHeightBehavior: const TextHeightBehavior(leadingDistribution: TextLeadingDistribution.even)),
              ),
            ),
          ),
        ),
        const SizedBox(height: LengthDial.sheetGap),
        // Only the chosen length draws its sheet; the room is kept for the longest, so choosing
        // another length never moves what is below.
        AnimatedOpacity(
          duration: Motion.of(context, Motion.ui),
          opacity: selected ? 1 : 0,
          child: RepaintBoundary(
            child: CustomPaint(
              size: _SheetPainter.sizeFor(widget.count),
              painter: _SheetPainter(count: widget.count, ink: _ink, totalMs: _inkDuration(widget.count).inMilliseconds, colors: colors),
            ),
          ),
        ),
      ],
    );
  }
}

/// A stop's little answer sheet: rows of five bubbles, hollow, inking in order with [ink].
class _SheetPainter extends CustomPainter {
  _SheetPainter({required this.count, required this.ink, required this.totalMs, required this.colors}) : super(repaint: ink);

  final int count;
  final Animation<double> ink;
  final int totalMs;
  final MmColors colors;

  static const double r = 3;
  static const double gap = 2.6;

  static Size sizeFor(int count) {
    final rows = (count / LengthDial.perRow).ceil();
    const cols = LengthDial.perRow;
    return Size(cols * r * 2 + (cols - 1) * gap, rows * r * 2 + (rows - 1) * gap);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final b = BubblePaint(colors);
    final now = ink.value * totalMs;
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1
      ..color = colors.ink3;
    for (var i = 0; i < count; i++) {
      final row = i ~/ LengthDial.perRow;
      final col = i % LengthDial.perRow;
      final c = Offset(r + col * (2 * r + gap), r + row * (2 * r + gap));
      // Bubble i starts inking at 18 ms * i and takes 200 ms.
      final fill = ((now - 18 * i) / 200).clamp(0.0, 1.0);
      // An empty bubble is a full-strength ring in the third ink tone (3:1 or better on the
      // dial's ground), so every length shows as a sheet you can count, not a faint texture.
      canvas.drawCircle(c, r - 0.5, ring);
      if (fill > 0) b.paint(canvas, c, r, BubbleState.filled, fill: Curves.easeOut.transform(fill));
    }
  }

  @override
  bool shouldRepaint(_SheetPainter old) => old.count != count || old.colors != colors || old.ink != ink;
}
