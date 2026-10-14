import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// How many questions each bubble of the sheet stands for, and how many bubbles of each kind.
class SheetCounts {
  const SheetCounts({required this.right, required this.wrong, required this.blank, required this.perBubble});

  final int right;
  final int wrong;
  final int blank;

  /// Questions behind each bubble: 1 until there are more questions than the sheet has room for.
  final int perBubble;

  int get cells => right + wrong + blank;

  /// Splits [right], [wrong] and [blank] questions over at most [maxCells] bubbles in proportion
  /// (largest remainder), keeping at least one bubble for each kind that has any question.
  factory SheetCounts.of(int right, int wrong, int blank, {int maxCells = 120}) {
    final total = right + wrong + blank;
    if (total <= maxCells) return SheetCounts(right: right, wrong: wrong, blank: blank, perBubble: 1);
    final per = (total / maxCells).ceil();
    final parts = [right, wrong, blank];
    final cells = [for (final p in parts) p == 0 ? 0 : (p / per).floor().clamp(1, maxCells)];
    // Hand the remainder to the kinds with the largest leftover, until the sheet is as full as
    // the proportion allows.
    final want = (total / per).round();
    var have = cells.fold<int>(0, (a, b) => a + b);
    final order = [0, 1, 2]..sort((a, b) => (parts[b] % per).compareTo(parts[a] % per));
    for (final i in order) {
      if (have >= want) break;
      if (parts[i] > 0) {
        cells[i]++;
        have++;
      }
    }
    return SheetCounts(right: cells[0], wrong: cells[1], blank: cells[2], perBubble: per);
  }

  @override
  bool operator ==(Object other) => other is SheetCounts && other.right == right && other.wrong == wrong && other.blank == blank && other.perBubble == perBubble;

  @override
  int get hashCode => Object.hash(right, wrong, blank, perBubble);
}

/// The three kinds of bubble on the sheet, in the order they are inked.
enum SheetKind { right, wrong, blank }

/// Lets the legend under the sheet ask it to ripple one kind of bubble.
class AnswerSheetController extends ChangeNotifier {
  SheetKind? _kind;
  int _tick = 0;

  /// The kind last asked for.
  SheetKind? get kind => _kind;

  /// Changes with every [ripple], even for the same kind, so a second tap plays again.
  int get tick => _tick;

  /// Ripples every bubble of [kind] once, in reading order.
  void ripple(SheetKind kind) {
    _kind = kind;
    _tick++;
    notifyListeners();
  }
}

/// The student's answer sheet for the record: one bubble per answered question, inked volt for
/// right, a coral cross for wrong and a dashed ring for left blank, in that order. When there are
/// more questions than room, each bubble stands for several and the caption says how many.
///
/// The bubbles ink in reading order over 700 ms once per visit; a rebuild with the same counts
/// does not repeat it, a rebuild with new counts re-inks only the bubbles whose kind changed, and
/// under reduced motion the sheet is simply inked.
///
/// It answers a finger: pressing or dragging along the sheet lifts the bubbles under the finger
/// (a soft falloff over a few bubbles), floats a label that names the kind under it with its real
/// count ("Wrong, 14 of 41 answered"), and ticks once each time the kind changes. A
/// [controller] ripples every bubble of one kind (the legend's keys). The same counts are always
/// in the legend as text, so nothing here is the only way to read them.
class AnswerSheet extends StatefulWidget {
  const AnswerSheet({super.key, required this.right, required this.wrong, required this.blank, this.columns = 12, this.gap = 6, this.controller});

  final int right;
  final int wrong;
  final int blank;
  final int columns;
  final double gap;
  final AnswerSheetController? controller;

  @override
  State<AnswerSheet> createState() => _AnswerSheetState();
}

class _AnswerSheetState extends State<AnswerSheet> with TickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: const Duration(milliseconds: 700), value: 1);
  late final AnimationController _touch = AnimationController(vsync: this, duration: const Duration(milliseconds: 140), reverseDuration: const Duration(milliseconds: 240), value: 0);
  late final AnimationController _ripple = AnimationController(vsync: this, duration: const Duration(milliseconds: 700), value: 1);
  final ValueNotifier<Offset?> _finger = ValueNotifier(null);
  bool _started = false;

  /// Bubble index to its place among the changed bubbles, after a change in the counts; null while
  /// every bubble inks (the first visit).
  Map<int, int>? _changed;
  SheetKind? _kind;
  SheetKind? _rippleKind;
  Size _box = Size.zero;

  @override
  void initState() {
    super.initState();
    widget.controller?.addListener(_onRipple);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _ink.forward(from: 0);
  }

  @override
  void didUpdateWidget(AnswerSheet old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller?.removeListener(_onRipple);
      widget.controller?.addListener(_onRipple);
    }
    final same = old.right == widget.right && old.wrong == widget.wrong && old.blank == widget.blank;
    if (same) return;
    // Only the bubbles whose kind changed (or that are new) ink again; the rest stay as they were.
    final before = SheetCounts.of(old.right, old.wrong, old.blank);
    final after = SheetCounts.of(widget.right, widget.wrong, widget.blank);
    final changed = <int, int>{};
    for (var i = 0; i < after.cells; i++) {
      if (i >= before.cells || SheetPainter.stateAt(before, i) != SheetPainter.stateAt(after, i)) changed[i] = changed.length;
    }
    _changed = changed;
    if (!Motion.reduced(context)) _ink.forward(from: 0);
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_onRipple);
    _ink.dispose();
    _touch.dispose();
    _ripple.dispose();
    _finger.dispose();
    super.dispose();
  }

  void _onRipple() {
    if (Motion.reduced(context)) return;
    setState(() => _rippleKind = widget.controller?.kind);
    _ripple.forward(from: 0);
  }

  /// The kind of the bubble nearest [at], by the grid's own geometry.
  SheetKind? _kindAt(Offset at, SheetCounts counts) {
    final cols = widget.columns;
    final d = (_box.width - (cols - 1) * widget.gap) / cols;
    if (d <= 0 || counts.cells == 0) return null;
    final col = (at.dx / (d + widget.gap)).floor().clamp(0, cols - 1);
    final row = (at.dy / (d + widget.gap)).floor().clamp(0, (counts.cells / cols).ceil() - 1);
    final i = (row * cols + col).clamp(0, counts.cells - 1);
    return i < counts.right ? SheetKind.right : (i < counts.right + counts.wrong ? SheetKind.wrong : SheetKind.blank);
  }

  void _press(Offset at) {
    if (!mounted) return;
    final counts = SheetCounts.of(widget.right, widget.wrong, widget.blank);
    _finger.value = at;
    final kind = _kindAt(at, counts);
    if (Motion.reduced(context)) {
      _touch.value = 1;
    } else if (!_touch.isAnimating || _touch.status == AnimationStatus.reverse) {
      if (_touch.value < 1) _touch.forward();
    }
    if (kind != _kind) {
      final first = _kind == null;
      setState(() => _kind = kind);
      // A tick each time the finger crosses into another kind; none for the first touch.
      if (!first) mmHapticsOf(context)?.selection();
    }
  }

  void _lift() {
    if (!mounted) return;
    if (_kind != null) setState(() => _kind = null);
    if (Motion.reduced(context)) {
      _touch.value = 0;
    } else {
      _touch.reverse();
    }
  }

  String? _label(SheetKind? kind) {
    if (kind == null) return null;
    final answered = widget.right + widget.wrong;
    return switch (kind) {
      SheetKind.right => InsightsCopy.sheetScrubRight(widget.right, answered),
      SheetKind.wrong => InsightsCopy.sheetScrubWrong(widget.wrong, answered),
      SheetKind.blank => InsightsCopy.sheetScrubBlank(widget.blank, answered + widget.blank),
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final counts = SheetCounts.of(widget.right, widget.wrong, widget.blank);
    final cells = counts.cells;
    if (cells == 0) return const SizedBox.shrink();
    return Semantics(
      label: '${widget.right} right, ${widget.wrong} wrong, ${widget.blank} left blank',
      image: true,
      child: ExcludeSemantics(
        child: LayoutBuilder(
          builder: (context, box) {
            final cols = widget.columns;
            final d = (box.maxWidth - (cols - 1) * widget.gap) / cols;
            final rows = (cells / cols).ceil();
            final height = rows * d + (rows - 1) * widget.gap;
            _box = Size(box.maxWidth, height);
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              // Horizontal drags and presses only: a vertical drag is the page scrolling.
              onHorizontalDragStart: (e) => _press(e.localPosition),
              onHorizontalDragUpdate: (e) => _press(e.localPosition),
              onHorizontalDragEnd: (_) => _lift(),
              onHorizontalDragCancel: _lift,
              onTapDown: (e) => _press(e.localPosition),
              onTapUp: (_) => _lift(),
              onTapCancel: _lift,
              child: SizedBox(
                width: box.maxWidth,
                height: height,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: RepaintBoundary(
                        child: AnimatedBuilder(
                          animation: Listenable.merge([_ink, _touch, _ripple, _finger]),
                          builder: (context, _) => CustomPaint(
                            painter: SheetPainter(
                              counts: counts,
                              columns: cols,
                              gap: widget.gap,
                              colors: colors,
                              t: _ink.value,
                              changed: _changed,
                              finger: _finger.value,
                              touch: Motion.out.transform(_touch.value),
                              rippleKind: _rippleKind,
                              ripple: _ripple.value,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (_label(_kind) case final label?)
                      ValueListenableBuilder<Offset?>(
                        valueListenable: _finger,
                        builder: (context, at, _) {
                          if (at == null) return const SizedBox.shrink();
                          // Above the finger, or below it on the top row, so it never lands on
                          // the text above the sheet.
                          final above = at.dy > 46;
                          return Positioned(
                            left: 0,
                            right: 0,
                            top: above ? at.dy - 52 : at.dy + 26,
                            child: IgnorePointer(
                              child: Align(
                                alignment: Alignment((at.dx / box.maxWidth * 2 - 1).clamp(-1.0, 1.0), -1),
                                child: FadeTransition(opacity: _touch, child: _ScrubLabel(label)),
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// The floating name of the kind under the finger.
class _ScrubLabel extends StatelessWidget {
  const _ScrubLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised2,
        shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        shadows: const [BoxShadow(color: Color(0x33000000), blurRadius: 14, offset: Offset(0, 4))],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4 + 2),
        child: Text(text, maxLines: 1, style: context.mmType.caption.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// Paints the sheet. Public so tests can read what a frame was asked to draw.
class SheetPainter extends CustomPainter {
  SheetPainter({
    required this.counts,
    required this.columns,
    required this.gap,
    required this.colors,
    required this.t,
    this.changed,
    this.finger,
    this.touch = 0,
    this.rippleKind,
    this.ripple = 1,
  });

  final SheetCounts counts;
  final int columns;
  final double gap;
  final MmColors colors;

  /// The inking run, 0 to 1.
  final double t;

  /// After a change in the counts: the bubbles that ink again, by index, with their order. Null:
  /// every bubble inks.
  final Map<int, int>? changed;

  /// Where the finger is on the sheet, and how far the lift has risen (0 to 1).
  final Offset? finger;
  final double touch;

  /// The kind the legend asked to ripple, and how far the ripple has run (1 is finished).
  final SheetKind? rippleKind;
  final double ripple;

  /// How many bubbles lift around the finger (the falloff's reach), in bubble pitches.
  static const double reach = 1.35;

  /// The lift of a bubble whose centre is [distance] from the finger, 1 under it and falling to
  /// nothing a few bubbles away: a smooth bell.
  static double lift(double distance, double pitch) {
    final sigma = reach * pitch;
    return math.exp(-(distance * distance) / (2 * sigma * sigma));
  }

  /// The state bubble [i] has in [c].
  static BubbleState stateAt(SheetCounts c, int i) =>
      i < c.right ? BubbleState.filled : (i < c.right + c.wrong ? BubbleState.wrong : BubbleState.blank);

  SheetKind _kindOf(int i) => i < counts.right ? SheetKind.right : (i < counts.right + counts.wrong ? SheetKind.wrong : SheetKind.blank);

  /// How far bubble [i] has inked: 1 for a bubble that did not change.
  double _inked(int i, int inkCount) {
    final ch = changed;
    if (ch != null && !ch.containsKey(i)) return 1;
    final order = ch?[i] ?? i;
    final start = order / math.max(1, inkCount) * 0.72;
    return ((t - start) / 0.28).clamp(0.0, 1.0);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final d = (size.width - (columns - 1) * gap) / columns;
    final r = d / 2;
    final paint = BubblePaint(colors);
    final total = counts.cells;
    final inkCount = changed?.length ?? total;
    final rippling = rippleKind != null && ripple < 1;
    // Bubbles of the rippled kind, in reading order, so each waits for its turn.
    final inKind = rippling ? [for (var i = 0; i < total; i++) if (_kindOf(i) == rippleKind) i] : const <int>[];
    final lifted = <(int, Offset, double)>[];
    for (var i = 0; i < total; i++) {
      final row = i ~/ columns, col = i % columns;
      var c = Offset(col * (d + gap) + r, row * (d + gap) + r);
      var lift = 0.0;
      final f = finger;
      if (f != null && touch > 0) {
        final dist = (c - f).distance;
        if (dist < reach * (d + gap) * 3.4) lift = SheetPainter.lift(dist, d + gap) * touch;
      }
      if (rippling && _kindOf(i) == rippleKind) {
        final k = i - (rippleKind == SheetKind.right ? 0 : (rippleKind == SheetKind.wrong ? counts.right : counts.right + counts.wrong));
        final start = k / math.max(1, inKind.length) * 0.5;
        final local = ((ripple - start) / 0.5).clamp(0.0, 1.0);
        lift = math.max(lift, math.sin(math.pi * local) * 0.8);
      }
      if (lift > 0.01) {
        c = c.translate(0, -7 * lift);
        lifted.add((i, c, 1 + 0.55 * lift));
        continue;
      }
      _draw(canvas, paint, c, r, stateAt(counts, i), _inked(i, inkCount));
    }
    // Lifted bubbles are drawn last so they sit over their neighbours, each on a soft shadow.
    for (final (i, c, scale) in lifted) {
      canvas.drawCircle(c.translate(0, 3), r * scale, Paint()..color = const Color(0x22000000)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
      canvas.drawCircle(c, r * scale + 0.5, Paint()..color = colors.raised);
      _draw(canvas, paint, c, r * scale, stateAt(counts, i), _inked(i, inkCount));
    }
  }

  void _draw(Canvas canvas, BubblePaint paint, Offset c, double r, BubbleState state, double f) {
    if (f <= 0) {
      paint.paint(canvas, c, r, BubbleState.hollow);
    } else if (state == BubbleState.blank) {
      paint.paint(canvas, c, r, BubbleState.blank, dim: Curves.easeOut.transform(f));
    } else {
      paint.paint(canvas, c, r, state, fill: Motion.out.transform(f));
    }
  }

  @override
  bool shouldRepaint(SheetPainter old) =>
      old.t != t ||
      old.counts != counts ||
      old.colors != colors ||
      old.columns != columns ||
      old.changed != changed ||
      old.finger != finger ||
      old.touch != touch ||
      old.rippleKind != rippleKind ||
      old.ripple != ripple;
}
