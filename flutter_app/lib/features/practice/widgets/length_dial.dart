import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../../core/widgets/materials/edge_light.dart';

/// How many questions, as a piece of paper you can feel: each stop is its number over a small
/// answer sheet sized to it (5 is one row of five bubbles, 20 is four rows), the chosen stop
/// sits on a raised thumb that glides on the emphasized curve, and its bubbles ink in order.
/// Drag across the track to scrub: a selection tick at every stop crossed. Each stop is a button
/// with its selected state, so TalkBack reads "10 questions, selected".
class LengthDial extends ConsumerStatefulWidget {
  const LengthDial({super.key, required this.count, required this.counts, required this.onChanged, this.semanticsLabel});

  final int count;
  final List<int> counts;

  /// Null disables the dial.
  final ValueChanged<int>? onChanged;
  final String? semanticsLabel;

  /// The dial's height for [scaler]: the number line grows with the text size and the tallest
  /// sheet (the longest length) hangs under it, so no stop is ever cut.
  static double heightFor(TextScaler scaler, List<int> counts) {
    final longest = counts.isEmpty ? perRow : counts.reduce((a, b) => a > b ? a : b);
    return 8 + _StopState.top + scaler.scale(_StopState.numberLine) + _StopState.gap + _SheetPainter.sizeFor(longest).height + 16;
  }

  /// Bubbles per row of a stop's sheet.
  static const int perRow = 5;

  @override
  ConsumerState<LengthDial> createState() => _LengthDialState();
}

class _LengthDialState extends ConsumerState<LengthDial> {
  /// The stop under the finger while dragging, so each stop crossed ticks once.
  int? _dragIndex;

  int get _index => widget.counts.indexOf(widget.count).clamp(0, widget.counts.length - 1);

  void _choose(int index) {
    final onChanged = widget.onChanged;
    if (onChanged == null || index < 0 || index >= widget.counts.length) return;
    if (widget.counts[index] == widget.count) return;
    unawaited(ref.read(hapticsProvider).selection());
    onChanged(widget.counts[index]);
  }

  void _dragTo(Offset local, double width) {
    final n = widget.counts.length;
    final index = (local.dx / (width / n)).floor().clamp(0, n - 1);
    if (index == _dragIndex) return;
    _dragIndex = index;
    _choose(index);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = widget.counts.length;
    final index = _index;
    final enabled = widget.onChanged != null;
    final reduced = Motion.reduced(context);
    const radius = BorderRadius.all(Radius.circular(22));

    return Semantics(
      container: true,
      label: widget.semanticsLabel,
      child: Opacity(
        opacity: enabled ? 1 : 0.5,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.sunken,
            shape: RoundedSuperellipseBorder(
              borderRadius: radius,
              side: BorderSide(color: colors.line),
            ),
          ),
          child: SizedBox(
            height: LengthDial.heightFor(MediaQuery.textScalerOf(context), widget.counts),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth - 8;
                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onHorizontalDragStart: enabled ? (d) => _dragIndex = index : null,
                  onHorizontalDragUpdate: enabled ? (d) => _dragTo(d.localPosition - const Offset(4, 0), width) : null,
                  onHorizontalDragEnd: enabled ? (_) => _dragIndex = null : null,
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Stack(
                      children: [
                        // The thumb: a raised pane with the glass edge light, gliding to the stop.
                        AnimatedAlign(
                          alignment: Alignment(n == 1 ? 0 : -1 + 2 * index / (n - 1), 0),
                          duration: reduced ? Duration.zero : Motion.emphasizedDuration,
                          curve: Motion.emphasized,
                          child: FractionallySizedBox(
                            widthFactor: 1 / n,
                            heightFactor: 1,
                            child: DecoratedBox(
                              decoration: ShapeDecoration(
                                color: colors.isNight ? colors.raised2 : colors.raised,
                                shape: const RoundedSuperellipseBorder(borderRadius: BorderRadius.all(Radius.circular(18))),
                                shadows: colors.cardShadow,
                              ),
                              child: CustomPaint(
                                foregroundPainter: EdgeLightPainter(
                                  borderRadius: const BorderRadius.all(Radius.circular(18)),
                                  top: colors.edgeTop,
                                  bottom: colors.edgeBottom,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Row(
                          children: [
                            for (var i = 0; i < n; i++)
                              Expanded(
                                child: Semantics(
                                  button: true,
                                  selected: i == index,
                                  inMutuallyExclusiveGroup: true,
                                  label: '${widget.counts[i]} questions',
                                  excludeSemantics: true,
                                  child: GestureDetector(
                                    behavior: HitTestBehavior.opaque,
                                    onTap: enabled ? () => _choose(i) : null,
                                    child: _Stop(count: widget.counts[i], selected: i == index, style: type.title),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// One stop: the number over its small sheet. The sheet inks when the stop is chosen.
class _Stop extends StatefulWidget {
  const _Stop({required this.count, required this.selected, required this.style});

  final int count;
  final bool selected;
  final TextStyle style;

  @override
  State<_Stop> createState() => _StopState();
}

class _StopState extends State<_Stop> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(
    vsync: this,
    duration: _inkDuration(widget.count),
    value: widget.selected ? 1 : 0,
  );

  static const double top = 14;
  static const double numberLine = 32;
  static const double gap = 8;

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
    // Every number sits on the same line; the sheets hang below it, so a longer sheet never
    // pushes its number up.
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: top),
        AnimatedDefaultTextStyle(
          duration: Motion.of(context, Motion.ui),
          style: widget.style.copyWith(fontSize: 28, height: numberLine / 28, color: selected ? colors.ink : colors.ink2),
          child: Text('${widget.count}'),
        ),
        const SizedBox(height: gap),
        RepaintBoundary(
          child: CustomPaint(
            size: _SheetPainter.sizeFor(widget.count),
            painter: _SheetPainter(count: widget.count, ink: _ink, totalMs: _inkDuration(widget.count).inMilliseconds, colors: colors),
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
