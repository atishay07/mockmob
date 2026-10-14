import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/sheet_cells.dart';
import 'runner_motion.dart';

/// Where every cell of the track sits for a given width: the pitch comes from the real width,
/// never from a fixed number, so each cell of the paper always has a mark.
///
/// Bubbles grow with the room they have, from [bubble] (10 dp) up to [maxBubble] (15 dp) on a
/// short paper, and sit at most [maxPitch] apart; as the paper grows or the phone narrows the
/// pitch tightens, and below [marksBelow] the strip switches to the timing marks of an OMR sheet.
class TrackGeometry {
  TrackGeometry({required this.count, required this.width}) {
    final room = width - 2 * inset;
    diameter = count <= 1 ? maxBubble : (room / count * 0.78).clamp(bubble, maxBubble);
    pitch = count <= 1 ? maxPitch : (maxPitch < (room - diameter) / (count - 1) ? maxPitch : (room - diameter) / (count - 1));
  }

  final int count;
  final double width;

  /// The smallest bubble diameter.
  static const double bubble = 10;

  /// The largest: a short practice gets 15 dp bubbles you can see from across the desk.
  static const double maxBubble = 15;

  /// The widest a bubble slot gets.
  static const double maxPitch = 24;

  /// Below this slot width, bubbles crowd; marks take over.
  static const double marksBelow = 12;

  /// Room kept at each end for the current cell's ring, which grows past its bubble: the first
  /// and the last ring never touch the edge of the strip.
  static const double inset = 2.5;

  /// This strip's bubble diameter.
  late final double diameter;

  /// Distance between bubble centres.
  late final double pitch;

  bool get marks => pitch < marksBelow;

  /// The painted width of one timing mark and the distance between mark centres.
  double get markWidth => (width / count * 0.42).clamp(2.5, 64.0);
  double get markStep => count == 1 ? 0 : (width - markWidth) / (count - 1);

  /// The centre of cell [i] along the strip.
  double centerX(int i) => centerAt(i.toDouble());

  /// The centre of a point [position] cells along the strip (fractional while the ring glides).
  double centerAt(double position) => marks ? position * markStep + markWidth / 2 : inset + diameter / 2 + position * pitch;

  /// Distance between neighbouring centres.
  double get step => marks ? markStep : pitch;

  /// The slot a tap on cell [i] lands in: neighbours share edges, nothing overlaps.
  (double, double) slot(int i) {
    if (marks) {
      final step = width / count;
      return (i * step, (i + 1) * step);
    }
    final half = pitch / 2;
    return ((centerX(i) - half).clamp(0.0, width), (centerX(i) + half).clamp(0.0, width));
  }
}

/// Progress along the top of the paper, answered of total (spec 5.5, runner.md 3.2).
///
/// A short practice reads as a row of answer bubbles: answered ones inked solid in paper ink (the
/// one answered state of the whole runner, the same as the palette and the submit sheet), the
/// current one ringed, the rest hairline rings. When the paper is long or the
/// phone narrow the bubbles give way to the timing marks along the edge of an OMR sheet, with the
/// current mark a taller paper-white bar.
///
/// It is alive in four ways, all on one painter and three small controllers:
///
/// - the current ring **glides** from cell to cell on the dock's spring, stretching with speed;
/// - a newly answered cell **sparks**: it floods volt and cools to paper ink (when the lock-in
///   dot flies in from the option it waits for it, see [TimingTrackState.hold] and
///   [TimingTrackState.land]);
/// - a marked question shows a **notch**, a small ink pennant above its bubble;
/// - at half the paper answered, and at all of it, one soft light band crosses the strip.
///
/// The strip is a labelled control, not a picture: it reads "Question 3 of 20, answered", and a
/// tap on a bubble jumps there (a 48 dp tall hit box per cell; the screen-reader target of every
/// cell is a full 48 x 48 dp, wider than the slot it is drawn in). Timing marks are too fine to
/// tap, so on a long paper only TalkBack gets jump targets, for the few cells around the current
/// question; the Questions key holds the whole sheet.
class TimingTrack extends StatefulWidget {
  const TimingTrack({super.key, required this.cells, this.onJump});

  final List<SheetCell> cells;

  /// Zero-based index to go to; null makes the strip a plain, labelled indicator.
  final ValueChanged<int>? onJump;

  /// Height of the bubble strip: the touch height of one cell.
  static const double tappableHeight = 48;

  /// The smallest screen-reader (and touch) target of one cell, in either direction.
  static const double minTarget = 48;

  /// Height of the timing-mark strip: 4 dp of air above 14 dp of marks.
  static const double marksHeight = 18;

  /// Cells either side of the current one TalkBack can jump to on a long paper.
  static const int semanticsWindow = 3;

  /// The strip's height for a paper of [count] questions in [width].
  static double heightFor(int count, double width) => TrackGeometry(count: count, width: width).marks ? marksHeight : tappableHeight;

  @override
  State<TimingTrack> createState() => TimingTrackState();
}

class TimingTrackState extends State<TimingTrack> with TickerProviderStateMixin {
  /// The ring's position in cells (fractional while it glides). Unbounded: a spring drives it.
  late final AnimationController _ring = AnimationController.unbounded(vsync: this);
  late final AnimationController _spark = AnimationController(vsync: this, duration: RunnerMotion.spark);
  late final AnimationController _sweep = AnimationController(vsync: this, duration: RunnerMotion.sweep);

  TrackGeometry? _geometry;
  int _sparkIndex = -1;

  /// Cells held back as unanswered until their lock-in dot lands.
  final Set<int> _held = {};
  Timer? _failsafe;
  bool _halfSeen = false;
  bool _fullSeen = false;

  int get _current {
    final i = widget.cells.indexWhere((c) => c.current);
    return i < 0 ? 0 : i;
  }

  static int _answered(List<SheetCell> cells) => cells.where((c) => c.answered).length;

  @override
  void initState() {
    super.initState();
    _ring.value = _current.toDouble();
    // Reopening a half-done paper starts quiet: the sweeps mark crossings, not states.
    final n = widget.cells.length;
    final answered = _answered(widget.cells);
    _halfSeen = n > 0 && answered * 2 >= n;
    _fullSeen = n > 0 && answered == n;
  }

  @override
  void didUpdateWidget(TimingTrack oldWidget) {
    super.didUpdateWidget(oldWidget);
    final old = oldWidget;
    final from = old.cells.indexWhere((c) => c.current);
    final to = _current;
    if (from != to || old.cells.length != widget.cells.length) _glideTo(to);

    final n = widget.cells.length;
    final answered = _answered(widget.cells);
    final half = n > 0 && answered * 2 >= n;
    final full = n > 0 && answered == n;
    final crossed = (half && !_halfSeen) || (full && !_fullSeen);
    _halfSeen = half;
    _fullSeen = full;
    if (crossed && old.cells.length == n && !RunnerMotion.reduced(context)) _sweep.forward(from: 0);

    // A cell that became answered with no dot on its way sparks at once.
    if (old.cells.length == n) {
      for (var i = 0; i < n; i++) {
        if (widget.cells[i].answered && !old.cells[i].answered && !_held.contains(i)) _startSpark(i);
      }
    }
  }

  void _glideTo(int target) {
    if (RunnerMotion.reduced(context)) {
      _ring.value = target.toDouble();
      return;
    }
    _ring.animateWith(SpringSimulation(Springs.smooth, _ring.value, target.toDouble(), _ring.velocity));
  }

  void _startSpark(int index) {
    if (RunnerMotion.reduced(context)) return;
    _sparkIndex = index;
    _spark.forward(from: 0);
  }

  /// Keeps cell [index] drawn as not answered until [land] (its dot is in the air). A failsafe
  /// releases it if the dot never arrives.
  void hold(int index) {
    setState(() => _held.add(index));
    _failsafe?.cancel();
    _failsafe = Timer(const Duration(milliseconds: 900), () {
      if (mounted && _held.isNotEmpty) setState(_held.clear);
    });
  }

  /// The dot for cell [index] has arrived: the cell shows its answer and sparks.
  void land(int index) {
    if (!mounted) return;
    _failsafe?.cancel();
    setState(() => _held.remove(index));
    _startSpark(index);
  }

  /// The centre of cell [index] in global coordinates, or null before the first layout.
  Offset? cellCenterGlobal(int index) {
    final box = context.findRenderObject();
    final g = _geometry;
    if (box is! RenderBox || !box.hasSize || g == null) return null;
    final height = g.marks ? TimingTrack.marksHeight : TimingTrack.tappableHeight;
    final y = g.marks ? height - 7 : height / 2;
    return box.localToGlobal(Offset(g.centerX(index), y));
  }

  @override
  void dispose() {
    _failsafe?.cancel();
    _ring.dispose();
    _spark.dispose();
    _sweep.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cells = widget.cells;
    final onJump = widget.onJump;
    if (cells.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, box) {
        final geometry = TrackGeometry(count: cells.length, width: box.maxWidth.isFinite ? box.maxWidth : 328);
        _geometry = geometry;
        final height = geometry.marks ? TimingTrack.marksHeight : TimingTrack.tappableHeight;
        final current = cells.indexWhere((c) => c.current);
        final at = current < 0 ? 0 : current;
        final label = RunnerCopy.trackSemantics(number: at + 1, total: cells.length, answered: cells[at].answered);
        final from = geometry.marks ? (at - TimingTrack.semanticsWindow).clamp(0, cells.length - 1) : 0;
        final to = geometry.marks ? (at + TimingTrack.semanticsWindow).clamp(0, cells.length - 1) : cells.length - 1;
        return Semantics(
          container: true,
          explicitChildNodes: true,
          label: label,
          child: SizedBox(
            height: height,
            width: double.infinity,
            child: Stack(
              // The cells' screen-reader targets are 48 dp tall even on the 18 dp marks strip.
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: ExcludeSemantics(
                    child: RepaintBoundary(
                      child: CustomPaint(
                        painter: _TrackPainter(
                          cells: cells,
                          colors: context.mmColors,
                          geometry: geometry,
                          ring: _ring,
                          spark: _spark,
                          sweep: _sweep,
                          sparkIndex: _sparkIndex,
                          held: Set.unmodifiable(_held),
                        ),
                      ),
                    ),
                  ),
                ),
                if (onJump != null)
                  for (var i = from; i <= to; i++) ..._cellTarget(i, geometry, height: height, touch: !geometry.marks, onJump: onJump),
              ],
            ),
          ),
        );
      },
    );
  }

  /// One cell's targets. The screen-reader node is at least 48 x 48 dp, centred on the slot it is
  /// drawn in (on a crowded strip it overlaps its neighbours' nodes; swipe navigation reads them
  /// in order). A finger's hit box is the slot itself, so neighbours never share a touch.
  List<Widget> _cellTarget(
    int i,
    TrackGeometry geometry, {
    required double height,
    required bool touch,
    required ValueChanged<int> onJump,
  }) {
    final c = widget.cells[i];
    final (start, end) = geometry.slot(i);
    final slot = (end - start).clamp(1.0, geometry.width);
    final nodeWidth = slot < TimingTrack.minTarget ? TimingTrack.minTarget : slot;
    final nodeHeight = height < TimingTrack.minTarget ? TimingTrack.minTarget : height;
    return [
      Positioned(
        key: ValueKey('track-cell-$i'),
        left: start + slot / 2 - nodeWidth / 2,
        width: nodeWidth,
        top: (height - nodeHeight) / 2,
        height: nodeHeight,
        child: Semantics(
          button: true,
          selected: c.current,
          label: RunnerCopy.cellSemantics(
            number: c.number,
            answered: c.answered,
            visited: c.visited,
            marked: c.marked,
            unsynced: c.unsynced,
            current: c.current,
          ),
          onTap: () => onJump(i),
          child: const SizedBox.expand(),
        ),
      ),
      if (touch)
        Positioned(
          left: start,
          width: slot,
          top: 0,
          bottom: 0,
          child: ExcludeSemantics(
            child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: c.current ? null : () => onJump(i), child: const SizedBox.expand()),
          ),
        ),
    ];
  }
}

class _TrackPainter extends CustomPainter {
  _TrackPainter({
    required this.cells,
    required this.colors,
    required this.geometry,
    required this.ring,
    required this.spark,
    required this.sweep,
    required this.sparkIndex,
    required this.held,
  }) : super(repaint: Listenable.merge([ring, spark, sweep]));

  final List<SheetCell> cells;
  final MmColors colors;
  final TrackGeometry geometry;
  final AnimationController ring;
  final AnimationController spark;
  final AnimationController sweep;
  final int sparkIndex;
  final Set<int> held;

  bool _answered(int i) => cells[i].answered && !held.contains(i);

  /// The ink of an answered cell at rest: solid paper ink, as on the palette and the submit sheet.
  Color get _inkFill => colors.ink;

  @override
  void paint(Canvas canvas, Size size) {
    if (cells.isEmpty) return;
    geometry.marks ? _marks(canvas, size) : _bubbles(canvas, size);
    _sweepBand(canvas, size);
  }

  /// Where the ring is, in cells: the spring's value while it travels, the exact cell once it
  /// has landed (a spring settles within a hair of its target, never exactly on it).
  double _ringPosition() {
    final last = cells.length - 1.0;
    if (!ring.isAnimating) {
      final at = cells.indexWhere((c) => c.current);
      return (at < 0 ? 0 : at).toDouble().clamp(0.0, last);
    }
    return ring.value.clamp(0.0, last);
  }

  /// 0 at rest; up to 7 dp while the ring is moving fast.
  double _stretch() {
    final v = ring.velocity.abs() * geometry.step;
    return (v * 0.012).clamp(0.0, 7.0);
  }

  /// 1 once the spark is over (or never ran).
  double get _sparkT => spark.value;

  /// The colour of a sparking cell: volt flooding in, then cooling to [rest].
  Color _cooled(Color rest, double t) => Color.lerp(colors.volt, rest, Curves.easeIn.transform(((t - 0.3) / 0.7).clamp(0.0, 1.0)))!;

  void _bubbles(Canvas canvas, Size size) {
    final d = geometry.diameter;
    final mid = size.height / 2;
    // The current ring grows 2.5 dp, less when the slots are tight, so it never touches a neighbour.
    final grow = ((geometry.pitch - d) / 2).clamp(1.0, 2.5);
    final lift = d / 2 + 4;
    final t = _sparkT;
    for (var i = 0; i < cells.length; i++) {
      final c = cells[i];
      final center = Offset(geometry.centerX(i), mid);
      if (_answered(i)) {
        if (i == sparkIndex && t > 0 && t < 1) {
          // Floods volt from the centre in the first third, then cools to paper ink.
          final reach = Curves.easeOut.transform((t / 0.34).clamp(0.0, 1.0));
          canvas.drawCircle(center, d / 2 * (0.25 + 0.75 * reach), Paint()..color = _cooled(_inkFill, t));
        } else {
          canvas.drawCircle(center, d / 2 - 0.4, Paint()..color = _inkFill);
        }
      }
      if (c.marked) _notch(canvas, center, lift + grow);
      // The current cell's ring is the gliding one drawn below.
      if (c.current) continue;
      final stroke = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = _answered(i) ? colors.ink.withValues(alpha: 0) : colors.lineStrong;
      // The same outer edge as an answered dot (d / 2 - 0.4), so a filled and an empty dot are one size.
      canvas.drawCircle(center, d / 2 - 0.4 - stroke.strokeWidth / 2, stroke);
    }
    _glidingRing(canvas, mid, d, grow);
  }

  /// The ring that travels: a circle at rest, a stretched capsule while moving.
  void _glidingRing(Canvas canvas, double mid, double d, double grow) {
    final pos = _ringPosition();
    final x = geometry.centerAt(pos);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = colors.ink;
    final r = d / 2 - paint.strokeWidth / 2 + grow;
    final stretch = _stretch();
    if (stretch < 0.05) {
      canvas.drawCircle(Offset(x, mid), r, paint);
    } else {
      final rect = Rect.fromCenter(center: Offset(x, mid), width: 2 * r + stretch, height: 2 * r);
      canvas.drawRRect(RRect.fromRectAndRadius(rect, Radius.circular(r)), paint);
    }
  }

  /// A marked-for-review question: a small ink pennant above its bubble, pointing down at it.
  void _notch(Canvas canvas, Offset center, double lift) {
    final tip = center - Offset(0, lift - 1);
    final path = Path()
      ..moveTo(tip.dx - 3.4, tip.dy - 5)
      ..lineTo(tip.dx + 3.4, tip.dy - 5)
      ..lineTo(tip.dx, tip.dy)
      ..close();
    canvas.drawPath(path, Paint()..color = colors.ink);
  }

  void _marks(Canvas canvas, Size size) {
    final n = cells.length;
    final mark = geometry.markWidth;
    final mid = size.height - 7;
    final t = _sparkT;
    for (var i = 0; i < n; i++) {
      final c = cells[i];
      if (c.current) continue;
      final x = geometry.centerX(i);
      final answered = _answered(i);
      final h = c.marked ? 14.0 : (answered ? 8.0 : 6.0);
      var color = answered ? colors.ink : colors.lineStrong;
      if (answered && i == sparkIndex && t > 0 && t < 1) color = _cooled(color, t);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(x, mid), width: mark, height: h), Radius.circular(mark / 2)),
        Paint()..color = color,
      );
    }
    // The current mark is a taller paper-white bar that glides.
    final x = geometry.centerAt(_ringPosition());
    const w = 3.0;
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(x, mid), width: w + _stretch(), height: 12), const Radius.circular(w / 2)),
      Paint()..color = colors.ink,
    );
  }

  /// One soft band of light crossing the strip (half the paper answered, or all of it).
  void _sweepBand(Canvas canvas, Size size) {
    final t = sweep.value;
    if (t <= 0 || t >= 1) return;
    const band = 64.0;
    final x = -band + (size.width + 2 * band) * Curves.easeInOut.transform(t);
    final rect = Rect.fromLTWH(x - band, -6, band * 2, size.height + 12);
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, -6, size.width, size.height + 12));
    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          colors: [
            colors.ink.withValues(alpha: 0),
            colors.ink.withValues(alpha: colors.isNight ? 0.16 : 0.10),
            colors.ink.withValues(alpha: 0),
          ],
        ).createShader(rect),
    );
    canvas.restore();
  }

  /// The picture takes no taps: the cells' own boxes do, and the strip's empty space stays free
  /// for the touch band of the meta line's retry above it (`TapSlop`).
  @override
  bool? hitTest(Offset position) => false;

  @override
  bool shouldRepaint(_TrackPainter old) =>
      old.colors != colors ||
      old.geometry.width != geometry.width ||
      old.sparkIndex != sparkIndex ||
      old.held.length != held.length ||
      !old.held.containsAll(held) ||
      !_same(old.cells);

  bool _same(List<SheetCell> other) {
    if (other.length != cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (other[i] != cells[i]) return false;
    }
    return true;
  }
}
