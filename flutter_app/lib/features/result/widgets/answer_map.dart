import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../sheet/sheet_geometry.dart';

/// The paper's answers as a map of the paper (full result): the same grid of bubbles as the
/// sheet, each one a way into its question. A tap pops the bubble and opens that answer
/// ([onOpen] gets the 1-based number); a long press says what it is ("Q12, Accountancy: wrong")
/// until the finger lifts.
///
/// When [arrival] is set (the result has just been opened) one soft ripple runs across the
/// bubbles in paper order, then two coral rings pulse on the first wrong answer, once. Reduced
/// motion: no ripple and no pop, the tap and the label still work. Painted in one overlay inside
/// a RepaintBoundary, so only that layer repaints.
class AnswerMap extends StatefulWidget {
  const AnswerMap({super.key, required this.cells, required this.subject, required this.onOpen, this.arrival = false, this.onPeek});

  final List<BubbleState> cells;

  /// The paper's subject, named in the long-press label.
  final String subject;

  /// A bubble was tapped: the 1-based question number.
  final ValueChanged<int> onOpen;
  final bool arrival;

  /// A long press began on a bubble (1-based), so the screen can add a light tick.
  final ValueChanged<int>? onPeek;

  /// The whole arrival: a ripple of [rippleSpan] ms across the grid, each ring living [ringLife]
  /// ms, then two coral pulses [pulseGap] ms apart.
  static const Duration total = Duration(milliseconds: 1750);
  static const double rippleSpan = 620;
  static const double ringLife = 380;
  static const double pulseStart = 960;
  static const double pulseGap = 300;
  static const double pulseLife = 440;

  /// Which bubble the two coral pulses land on: the first wrong answer, or null with none.
  static int? firstWrong(List<BubbleState> cells) {
    final i = cells.indexOf(BubbleState.wrong);
    return i < 0 ? null : i;
  }

  /// The words of a long press: "Q12, Accountancy: wrong".
  static String tip(int number, String subject, BubbleState state) => ResultCopy.bubbleTip(number, subject, state);

  @override
  State<AnswerMap> createState() => _AnswerMapState();
}

class _AnswerMapState extends State<AnswerMap> with TickerProviderStateMixin {
  // Built in initState, not lazily: a controller first touched by dispose() would create its ticker
  // on an element that is already deactivated.
  late final AnimationController _arrive;
  late final AnimationController _pop;
  Timer? _start;
  Timer? _hide;
  int _popped = -1;
  int? _peek;
  bool _ran = false;

  @override
  void initState() {
    super.initState();
    _arrive = AnimationController(vsync: this, duration: AnswerMap.total);
    _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_ran || !widget.arrival) return;
    _ran = true;
    if (Motion.reduced(context)) return;
    // After the page's own entrance has landed.
    _start = Timer(const Duration(milliseconds: 520), () {
      if (mounted) _arrive.forward();
    });
  }

  @override
  void dispose() {
    _start?.cancel();
    _hide?.cancel();
    _arrive.dispose();
    _pop.dispose();
    super.dispose();
  }

  int _indexAt(Offset p, _Geo g) {
    final col = (p.dx / (g.bubble + g.gap)).floor().clamp(0, g.cols - 1);
    final row = ((p.dy + g.rowGap / 2) / (g.rowHeight + g.rowGap)).floor().clamp(0, g.rows - 1);
    final i = row * g.cols + col;
    return i >= widget.cells.length ? -1 : i;
  }

  void _tap(Offset p, _Geo g) {
    final i = _indexAt(p, g);
    if (i < 0) return;
    if (!Motion.reduced(context)) {
      _popped = i;
      _pop.forward(from: 0);
    }
    widget.onOpen(i + 1);
  }

  void _longPress(Offset p, _Geo g) {
    final i = _indexAt(p, g);
    if (i < 0) return;
    _hide?.cancel();
    setState(() => _peek = i);
    widget.onPeek?.call(i + 1);
    // A label never outstays a held finger by much, nor stays up for ever on a missed lift.
    _hide = Timer(const Duration(milliseconds: 2600), _unpeek);
  }

  void _unpeek() {
    _hide?.cancel();
    if (mounted && _peek != null) setState(() => _peek = null);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final cells = widget.cells;
    return LayoutBuilder(
      builder: (context, c) {
        final g0 = SheetGeometry.fit(maxWidth: c.maxWidth, maxHeight: 2000, questions: cells.length);
        final numberHeight = BubbleGrid.numberHeightFor(MediaQuery.textScalerOf(context));
        return Center(
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              BubbleGrid(
                states: cells,
                columns: g0.columns,
                bubbleSize: g0.bubble,
                minGap: 4,
                maxGap: 18,
                rowGap: SheetGeometry.rowGap,
                numbers: true,
                sealed: false,
              ),
              Positioned.fill(
                child: LayoutBuilder(
                  builder: (context, box) {
                    final cols = math.min(g0.columns, math.max(cells.length, 1));
                    final gap = cols == 1 ? 0.0 : ((box.maxWidth - cols * g0.bubble) / (cols - 1)).clamp(0.0, 40.0);
                    final geo = _Geo(
                      cols: cols,
                      rows: (cells.length / cols).ceil(),
                      bubble: g0.bubble,
                      gap: gap,
                      rowGap: SheetGeometry.rowGap,
                      numberSpace: numberHeight > 0 ? numberHeight + 3 : 0,
                    );
                    final peek = _peek;
                    return Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned.fill(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTapUp: (d) => _tap(d.localPosition, geo),
                            onLongPressStart: (d) => _longPress(d.localPosition, geo),
                            onLongPressEnd: (_) => _unpeek(),
                            onLongPressCancel: _unpeek,
                            child: ExcludeSemantics(
                              child: RepaintBoundary(
                                child: CustomPaint(
                                  painter: _MapPainter(
                                    cells: cells,
                                    geo: geo,
                                    colors: colors,
                                    arrive: _arrive,
                                    pop: _pop,
                                    popped: () => _popped,
                                    ripples: widget.arrival,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (peek != null)
                          _PeekLabel(
                            key: ValueKey('peek-$peek'),
                            text: AnswerMap.tip(peek + 1, widget.subject, cells[peek]),
                            anchorX: geo.center(peek).dx,
                            anchorY: geo.center(peek).dy,
                            width: box.maxWidth,
                            lift: geo.bubble / 2 + 8,
                          ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// The grid's geometry, mirrored from the bubble grid's own layout so the overlay lands exactly
/// on the bubbles.
class _Geo {
  const _Geo({required this.cols, required this.rows, required this.bubble, required this.gap, required this.rowGap, required this.numberSpace});

  final int cols;
  final int rows;
  final double bubble;
  final double gap;
  final double rowGap;
  final double numberSpace;

  double get rowHeight => bubble + numberSpace;

  Offset center(int i) {
    final col = i % cols;
    final row = i ~/ cols;
    return Offset(col * (bubble + gap) + bubble / 2, row * (rowHeight + rowGap) + numberSpace + bubble / 2);
  }
}

/// The long-press label: a small ink chip above the bubble, centred on it and kept inside the
/// grid's width.
class _PeekLabel extends StatelessWidget {
  const _PeekLabel({super.key, required this.text, required this.anchorX, required this.anchorY, required this.width, required this.lift});

  final String text;
  final double anchorX;
  final double anchorY;
  final double width;
  final double lift;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    return Positioned(
      left: -12,
      right: -12,
      top: anchorY - lift - 30,
      height: 30,
      child: IgnorePointer(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: reduced ? Duration.zero : const Duration(milliseconds: 160),
          curve: Motion.out,
          builder: (context, t, child) => Opacity(
            opacity: t,
            child: Transform.translate(offset: Offset(0, 6 * (1 - t)), child: child),
          ),
          child: CustomSingleChildLayout(
            delegate: _ChipDelegate(anchorX + 12),
            child: DecoratedBox(
              decoration: ShapeDecoration(
                color: colors.ink,
                shape: RoundedSuperellipseBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Text(text, style: type.small.copyWith(color: colors.ground, fontWeight: FontWeight.w600), maxLines: 1),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChipDelegate extends SingleChildLayoutDelegate {
  _ChipDelegate(this.x);

  /// The chip's centre, in the delegate's own space.
  final double x;

  @override
  BoxConstraints getConstraintsForChild(BoxConstraints constraints) => BoxConstraints(maxWidth: constraints.maxWidth);

  @override
  Offset getPositionForChild(Size size, Size childSize) {
    final left = (x - childSize.width / 2).clamp(0.0, math.max(0.0, size.width - childSize.width)).toDouble();
    return Offset(left, (size.height - childSize.height) / 2);
  }

  @override
  bool shouldRelayout(_ChipDelegate old) => old.x != x;
}

class _MapPainter extends CustomPainter {
  _MapPainter({
    required this.cells,
    required this.geo,
    required this.colors,
    required this.arrive,
    required this.pop,
    required this.popped,
    required this.ripples,
  }) : super(repaint: Listenable.merge([arrive, pop]));

  final List<BubbleState> cells;
  final _Geo geo;
  final MmColors colors;
  final Animation<double> arrive;
  final Animation<double> pop;
  final int Function() popped;
  final bool ripples;

  @override
  void paint(Canvas canvas, Size size) {
    final r = geo.bubble / 2;
    // The tapped bubble pops: it swells past its place and settles, with one ring leaving it.
    final p = pop.value;
    final i = popped();
    if (i >= 0 && i < cells.length && p > 0 && p < 1) {
      final c = geo.center(i);
      final scale = 1 + 0.42 * math.sin(math.pi * Curves.easeOutCubic.transform(p)) * (1 - 0.35 * p);
      canvas.drawCircle(c, r * scale + 1.5, Paint()..color = colors.ground);
      BubblePaint(colors).paint(canvas, c, r * scale, cells[i]);
      final ring = Curves.easeOut.transform(p);
      canvas.drawCircle(
        c,
        r * (1.1 + 0.9 * ring),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = _stateColor(cells[i]).withValues(alpha: 0.55 * (1 - ring)),
      );
    }
    if (!ripples) return;
    final v = arrive.value;
    if (v <= 0 || v >= 1) return;
    final ms = v * AnswerMap.total.inMilliseconds;
    // The ripple: each bubble in paper order lights a soft ring, the next a few ms after it.
    final n = cells.length;
    final step = n <= 1 ? 0.0 : AnswerMap.rippleSpan / (n - 1);
    for (var k = 0; k < n; k++) {
      final q = (ms - k * step) / AnswerMap.ringLife;
      if (q <= 0) break;
      if (q >= 1) continue;
      final e = Curves.easeOut.transform(q);
      canvas.drawCircle(
        geo.center(k),
        r * (1.05 + 0.6 * e),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = colors.ink2.withValues(alpha: 0.5 * (1 - q)),
      );
    }
    // Then two coral rings on the first wrong answer.
    final first = AnswerMap.firstWrong(cells);
    if (first != null) {
      for (var k = 0; k < 2; k++) {
        final q = (ms - AnswerMap.pulseStart - k * AnswerMap.pulseGap) / AnswerMap.pulseLife;
        if (q <= 0 || q >= 1) continue;
        final e = Curves.easeOutCubic.transform(q);
        canvas.drawCircle(
          geo.center(first),
          r * (1.1 + 1.0 * e),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2 * (1 - 0.5 * e)
            ..color = colors.wrongMark.withValues(alpha: 0.85 * (1 - e)),
        );
      }
    }
  }

  Color _stateColor(BubbleState s) => switch (s) {
    BubbleState.filled => colors.volt,
    BubbleState.wrong => colors.wrongMark,
    _ => colors.ink3,
  };

  @override
  bool shouldRepaint(_MapPainter old) =>
      old.cells != cells ||
      old.colors != colors ||
      old.ripples != ripples ||
      old.geo.gap != geo.gap ||
      old.geo.bubble != geo.bubble ||
      old.geo.cols != geo.cols ||
      old.geo.numberSpace != geo.numberSpace;
}
