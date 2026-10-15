import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';

/// The kinds of session a choice can start, each its own drawn object and gesture.
enum ChoiceGlyphKind {
  /// An answer sheet part inked: a paper in progress. The next bubble inks.
  resume,

  /// A solid lightning bolt: a quick set. It flashes and throws sparks.
  quick,

  /// An open book with a ribbon: one or more chapters. A page turns.
  chapter,

  /// A target with a wrong bubble at its heart and a ring closing round it: practice that leans
  /// toward your misses.
  smart,

  /// A stopwatch with a dark face: a full timed paper. The crown dips and the hand sweeps a turn.
  mock,

  /// The exam's own question palette on its panel: the exam-day screen. The cells dip in a wave.
  nta,

  /// An inked bubble with a tick that a volt ring closes around: the mistake put right.
  repair,

  /// A solid speech bubble whose dots hop in turn: ask about your record.
  ask,
}

/// How long one glyph gesture runs. Every gesture ends where it began, so a cut-short frame never
/// leaves a glyph half drawn. 420 ms, and only on the pressed tile (MOTION.md P1-6).
const Duration choiceGlyphGesture = Duration(milliseconds: 420);

/// Drives a glyph's gesture: [play] runs it once (a press), and [playAfter] once after a delay
/// (the leading choice's entrance). Nothing runs under reduced motion.
class GlyphPlayer {
  GlyphPlayer(TickerProvider vsync) : _c = AnimationController(vsync: vsync, duration: choiceGlyphGesture);

  final AnimationController _c;
  Timer? _timer;

  /// The gesture's progress, eased. 0 and 1 are the same resting pose.
  late final Animation<double> progress = CurvedAnimation(parent: _c, curve: Curves.easeInOutCubic);

  void play(BuildContext context) {
    if (!context.mounted || Motion.reduced(context)) return;
    _c.forward(from: 0);
  }

  void playAfter(BuildContext context, Duration delay) {
    _timer?.cancel();
    _timer = Timer(delay, () {
      if (context.mounted) play(context);
    });
  }

  void dispose() {
    _timer?.cancel();
    _c.dispose();
  }
}

/// A code-drawn object, posed at [motion] (a [GlyphPlayer.progress]; still when null). Each one is
/// a small solid thing with a lit face and a shaded edge, drawn in a 24-unit box, so the same
/// vector holds from a 40 dp list row to the 96 dp lead. Decorative: the choice it sits in names
/// itself.
class ChoiceGlyph extends StatelessWidget {
  const ChoiceGlyph({super.key, required this.kind, this.size = 48, this.lit = false, this.motion});

  final ChoiceGlyphKind kind;

  /// The object's box; the object fills about 92% of it.
  final double size;

  /// The leading choice: volt where the object has an accent, and a pool of volt light behind.
  final bool lit;
  final Animation<double>? motion;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(
            painter: ChoiceGlyphPainter(kind: kind, colors: colors, t: motion ?? kAlwaysDismissedAnimation, lit: lit),
          ),
        ),
      ),
    );
  }
}

/// Paints the object at gesture progress [t] (0 and 1 are the same resting pose).
///
/// Colour: the body is the page's ink (paper on Night, charcoal on Daylight) shaded from a lit top
/// left to a darker bottom right; faces and details are the opposite polarity; the accent is volt
/// on Night and its readable olive on Daylight, except where it is a fill on [lit] objects.
class ChoiceGlyphPainter extends CustomPainter {
  ChoiceGlyphPainter({required this.kind, required this.colors, required this.t, this.lit = false}) : super(repaint: t);

  final ChoiceGlyphKind kind;
  final MmColors colors;
  final Animation<double> t;
  final bool lit;

  // Light and shade, not paint (SPACING.md 8.4 parity): white lifts a lit face and black deepens
  // a shaded one by a fraction, on whatever role colour they are mixed into, so the same object
  // reads in both themes. Night and Day differ only through the role colours ([_body], [_face],
  // [_accent]) and the shade strength (Day drops cast 55% of Night's, see `_drop`).
  static const Color _white = Color(0xFFFFFFFF);
  static const Color _black = Color(0xFF000000);

  Color get _body => colors.ink;

  /// The face: the opposite polarity of the body, so details on it read.
  Color get _face => colors.isNight ? colors.sunken : colors.ground;

  /// An accent on the face or on the tile behind the object.
  Color get _accent => colors.isNight ? colors.volt : colors.accentText;

  /// 0 at both ends, 1 in the middle of the gesture.
  static double bell(double p) => math.sin(math.pi * p.clamp(0.0, 1.0));

  /// A bump of width [w] centred at [at]: 0 outside it, 1 at its centre.
  static double bump(double p, double at, double w) {
    final x = (p - at) / w;
    if (x <= -0.5 || x >= 0.5) return 0;
    return math.cos(math.pi * x);
  }

  Paint _stroke(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..color = color
    ..isAntiAlias = true;

  /// A solid fill that goes from lit (top left) through [c] to shaded (bottom right) across [r].
  Paint _solid(Color c, Rect r, {double hi = 0.2, double lo = 0.3}) => Paint()
    ..isAntiAlias = true
    ..shader = ui.Gradient.linear(
      r.topLeft,
      r.bottomRight,
      [Color.lerp(c, _white, hi)!, c, Color.lerp(c, _black, lo)!],
      const [0, 0.45, 1],
    );

  /// The soft shadow an object throws down and to the right.
  void _drop(Canvas canvas, Path path, {double dy = 0.9, double alpha = 0.34}) {
    canvas.drawPath(
      path.shift(Offset(0.2, dy)),
      Paint()
        ..color = _black.withValues(alpha: colors.isNight ? alpha : alpha * 0.55)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.9),
    );
  }

  /// A thin light along the top left edge of a solid shape: the catch of the light.
  void _rim(Canvas canvas, Path path, Rect r, {double width = 0.5, double alpha = 0.55}) {
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = width
        ..strokeJoin = StrokeJoin.round
        ..shader = ui.Gradient.linear(r.topLeft, r.bottomRight, [_white.withValues(alpha: alpha), _white.withValues(alpha: 0)]),
    );
  }

  void _bubble(Canvas canvas, Offset c, double r, BubbleState state, {double fill = 1, Offset origin = Offset.zero}) =>
      BubblePaint(colors).paint(canvas, c, r, state, fill: fill, origin: origin);

  @override
  void paint(Canvas canvas, Size size) {
    // The object lives in a 24-unit box and fills about 92% of the widget, so a ring or a spark
    // just outside it still sits inside.
    final unit = size.shortestSide * 0.92 / 24;
    final c = size.center(Offset.zero);
    canvas
      ..save()
      ..translate(c.dx - 12 * unit, c.dy - 12 * unit)
      ..scale(unit);
    final p = t.value;
    switch (kind) {
      case ChoiceGlyphKind.quick:
        _quick(canvas, p);
      case ChoiceGlyphKind.chapter:
        _chapter(canvas, p);
      case ChoiceGlyphKind.smart:
        _smart(canvas, p);
      case ChoiceGlyphKind.mock:
        _mock(canvas, p);
      case ChoiceGlyphKind.nta:
        _nta(canvas, p);
      case ChoiceGlyphKind.repair:
        _repair(canvas, p);
      case ChoiceGlyphKind.ask:
        _ask(canvas, p);
      case ChoiceGlyphKind.resume:
        _resume(canvas, p);
    }
    canvas.restore();
  }

  // ---- quick: a solid bolt --------------------------------------------------------------

  static final Path _bolt = Path()
    ..moveTo(14.2, 1.2)
    ..lineTo(3.6, 13.6)
    ..lineTo(10.6, 13.6)
    ..lineTo(9.2, 22.8)
    ..lineTo(20.4, 9.6)
    ..lineTo(13.2, 9.6)
    ..close();

  void _quick(Canvas canvas, double p) {
    final b = bell(p);
    if (lit) {
      // A pool of volt light the bolt sits in.
      canvas.drawCircle(
        const Offset(12, 12),
        12,
        Paint()
          ..shader = ui.Gradient.radial(const Offset(12, 12), 12, [
            colors.volt.withValues(alpha: 0.34 + 0.2 * b),
            colors.volt.withValues(alpha: 0),
          ]),
      );
    }
    canvas
      ..save()
      ..translate(12, 12)
      ..scale(1 + 0.1 * b)
      ..translate(-12, -12);
    _drop(canvas, _bolt);
    final base = lit ? colors.volt : Color.lerp(_body, colors.volt, b)!;
    final rect = _bolt.getBounds();
    canvas.drawPath(_bolt, _solid(base, rect, hi: 0.28, lo: lit ? 0.22 : 0.32));
    _rim(canvas, _bolt, rect, width: 0.6, alpha: 0.7);
    // The bolt's shaded half: a darker facet down its right side.
    final facet = Path()
      ..moveTo(13.2, 9.6)
      ..lineTo(20.4, 9.6)
      ..lineTo(9.2, 22.8)
      ..lineTo(11.6, 12.4)
      ..close();
    canvas.drawPath(facet, Paint()..color = _black.withValues(alpha: lit ? 0.13 : 0.1));
    canvas.restore();
    if (b < 0.02) return;
    // Four sparks thrown out from the bolt's tips.
    const sparks = [(Offset(2.6, 6.4), -2.7), (Offset(22, 15.4), 0.3), (Offset(5.2, 22), 2.5), (Offset(19.6, 3.4), -0.75)];
    final spark = _stroke(_accent.withValues(alpha: _accent.a * b), 1.5);
    for (final (o, angle) in sparks) {
      final dir = Offset(math.cos(angle), math.sin(angle));
      final start = o + dir * (1.4 * p);
      canvas.drawLine(start, start + dir * (3.4 * b), spark);
    }
  }

  // ---- chapter: an open book ------------------------------------------------------------

  static Path _page({required bool right}) {
    final path = Path();
    if (right) {
      path
        ..moveTo(12, 6.2)
        ..cubicTo(14.8, 4.6, 18.4, 4.2, 21.4, 5.2)
        ..lineTo(21.4, 18.6)
        ..cubicTo(18.4, 17.6, 14.8, 18, 12, 19.8)
        ..close();
    } else {
      path
        ..moveTo(12, 6.2)
        ..cubicTo(9.2, 4.6, 5.6, 4.2, 2.6, 5.2)
        ..lineTo(2.6, 18.6)
        ..cubicTo(5.6, 17.6, 9.2, 18, 12, 19.8)
        ..close();
    }
    return path;
  }

  static final Path _leftPage = _page(right: false);
  static final Path _rightPage = _page(right: true);
  static final Path _ribbon = Path()
    ..moveTo(15.4, 4.5)
    ..lineTo(18.2, 4.8)
    ..lineTo(18.2, 12.4)
    ..lineTo(16.8, 11.2)
    ..lineTo(15.4, 12.4)
    ..close();

  void _chapter(Canvas canvas, double p) {
    // The cover: the pages' outline thickened and darkened, so the book has an edge and a depth.
    final cover = Path()
      ..addPath(_leftPage, Offset.zero)
      ..addPath(_rightPage, Offset.zero);
    canvas
      ..save()
      ..translate(0, 0.7);
    _drop(canvas, cover, dy: 1.1);
    canvas.drawPath(cover, _stroke(Color.lerp(_body, _black, 0.62)!, 2.6));
    canvas.restore();
    final rect = cover.getBounds();
    canvas
      ..drawPath(_leftPage, _solid(_body, rect, hi: 0.1, lo: 0.34))
      ..drawPath(_rightPage, _solid(_body, rect, hi: 0.22, lo: 0.2));
    // The gutter: the dark crease where the pages meet.
    canvas.drawLine(const Offset(12, 6.2), const Offset(12, 19.8), _stroke(_black.withValues(alpha: 0.4), 0.9));
    final line = _stroke(_face.withValues(alpha: 0.4), 0.7);
    for (final y in [8.6, 11.2, 13.8]) {
      canvas
        ..drawLine(Offset(4.6, y), Offset(9.8, y + 0.5), line)
        ..drawLine(Offset(14.2, y + 0.5), Offset(19.4, y), line);
    }
    // The ribbon bookmark, volt with a dark edge so it holds on paper.
    canvas
      ..drawPath(_ribbon, Paint()..color = colors.volt)
      ..drawPath(_ribbon, _stroke(colors.voltInk.withValues(alpha: 0.55), 0.5));
    if (p <= 0.001 || p >= 0.999) return;
    // The turning page: the right page folded about the spine, foreshortened by the turn.
    final fold = math.cos(math.pi * p);
    canvas
      ..save()
      ..translate(12, 0)
      ..scale(fold, 1)
      ..translate(-12, 0)
      ..drawPath(_rightPage, _solid(_body, rect, hi: 0.3, lo: 0.1))
      ..drawPath(_rightPage, _stroke(Color.lerp(_black.withValues(alpha: 0.35), _accent, bell(p))!, 0.7))
      ..restore();
  }

  // ---- smart: a target ------------------------------------------------------------------

  void _smart(Canvas canvas, double p) {
    final b = bell(p);
    const c = Offset(12, 12);
    final disc = Path()..addOval(Rect.fromCircle(center: c, radius: 8.4));
    _drop(canvas, disc);
    canvas.drawPath(disc, _solid(_body, disc.getBounds(), hi: 0.22, lo: 0.3));
    _rim(canvas, disc, disc.getBounds());
    canvas
      ..drawCircle(c, 6.1, _stroke(_face.withValues(alpha: 0.7), 0.9))
      ..drawCircle(c, 3.9, _stroke(_face.withValues(alpha: 0.5), 0.7));
    _bubble(canvas, c, 2.9 * (1 - 0.14 * b), BubbleState.wrong);
    // The ring outside the target draws itself round the miss during the gesture.
    const ring = 10.9;
    final sweep = p <= 0.001 || p >= 0.999 ? 2 * math.pi : 2 * math.pi * Curves.easeOutCubic.transform(p);
    if (sweep < 2 * math.pi) canvas.drawCircle(c, ring, _stroke(_accent.withValues(alpha: 0.2), 1.3));
    canvas.drawArc(Rect.fromCircle(center: c, radius: ring), -math.pi / 2, sweep, false, _stroke(_accent, 1.6));
  }

  // ---- mock: a stopwatch ----------------------------------------------------------------

  void _mock(Canvas canvas, double p) {
    final b = bell(p);
    const c = Offset(12, 13.4);
    // The crown dips as if pressed.
    final dip = 1.3 * b;
    final crownStem = RRect.fromRectAndRadius(Rect.fromLTWH(10.8, 3.6 + dip, 2.4, 2.8), const Radius.circular(0.6));
    final crownCap = RRect.fromRectAndRadius(Rect.fromLTWH(9, 2.1 + dip, 6, 2.2), const Radius.circular(1.1));
    final bezel = Path()..addOval(Rect.fromCircle(center: c, radius: 8.6));
    _drop(canvas, bezel);
    canvas
      ..drawRRect(crownStem, Paint()..color = Color.lerp(_body, _black, 0.4)!)
      ..drawRRect(crownCap, _solid(_body, crownCap.outerRect, hi: 0.2, lo: 0.3))
      // The side button.
      ..save()
      ..translate(19.1, 7.1)
      ..rotate(0.8)
      ..drawRRect(
        RRect.fromRectAndRadius(const Rect.fromLTWH(-1.1, -2, 2.2, 3.4), const Radius.circular(0.7)),
        Paint()..color = Color.lerp(_body, _black, 0.25)!,
      )
      ..restore()
      ..drawPath(bezel, _solid(_body, bezel.getBounds(), hi: 0.24, lo: 0.32));
    _rim(canvas, bezel, bezel.getBounds());
    // The dark face, with its ticks and the hand.
    canvas.drawCircle(c, 6.6, Paint()..color = _face);
    final tick = _stroke(_body.withValues(alpha: 0.7), 0.8);
    for (var i = 0; i < 12; i++) {
      final a = i * math.pi / 6;
      final d = Offset(math.cos(a), math.sin(a));
      final major = i % 3 == 0;
      canvas.drawLine(c + d * (major ? 4.7 : 5.4), c + d * 6, major ? tick : _stroke(_body.withValues(alpha: 0.4), 0.6));
    }
    // The hand sweeps one full turn and lands back at twelve.
    final angle = -math.pi / 2 + 2 * math.pi * p;
    final hand = Offset(math.cos(angle), math.sin(angle)) * 4.6;
    final handColor = _accent;
    // A wedge of swept time trails the hand while it moves.
    if (p > 0.001 && p < 0.999) {
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: 5.4),
        -math.pi / 2,
        2 * math.pi * p,
        true,
        Paint()..color = handColor.withValues(alpha: 0.16),
      );
    }
    canvas
      ..drawLine(c, c + hand, _stroke(handColor, 1.3))
      ..drawCircle(c, 1.1, Paint()..color = handColor);
  }

  // ---- nta: the question palette --------------------------------------------------------

  /// One palette cell's side, the gap between cells, and the margin the grid keeps from the
  /// panel's edges and from its header, all in the glyph's 24-unit box.
  static const double ntaCell = 4.2;
  static const double ntaGap = 1.4;
  static const double ntaMargin = 1.6;

  /// The navy header band's height (equal to the panel's corner radius, so the band's rounded
  /// top meets straight sides).
  static const double ntaHeader = 3;
  static const double _ntaGrid = 3 * ntaCell + 2 * ntaGap;

  /// The pale panel, sized from the grid it holds and centred in the box: the header, then the
  /// 3 by 3 grid with [ntaMargin] on every side. It was a fixed 19.6 square once while the grid
  /// started 1.3 units below the header's margin, so the bottom row hung off the panel (owner,
  /// APK v8: "boxes and checkboxes are going out of the area of the image").
  static const Rect ntaPanel = Rect.fromLTWH(
    12 - (_ntaGrid / 2 + ntaMargin),
    12 - (ntaHeader + _ntaGrid + 2 * ntaMargin) / 2,
    _ntaGrid + 2 * ntaMargin,
    ntaHeader + _ntaGrid + 2 * ntaMargin,
  );

  /// The cell at [row], [col] (0 to 2 each), shrunk about its centre by [dip] (0 rests, 1 is
  /// the deepest point of the wave). Always inside [ntaPanel], under the header.
  static Rect ntaCellRect(int row, int col, {double dip = 0}) {
    final left = ntaPanel.left + ntaMargin + col * (ntaCell + ntaGap);
    final top = ntaPanel.top + ntaHeader + ntaMargin + row * (ntaCell + ntaGap);
    final s = ntaCell * (1 - 0.42 * dip.clamp(0.0, 1.0));
    return Rect.fromCenter(center: Offset(left + ntaCell / 2, top + ntaCell / 2), width: s, height: s);
  }

  /// How deep cell [i] (0 to 8, reading order) is in the wave at gesture progress [p].
  static double ntaDipAt(int i, double p) => p <= 0.001 ? 0.0 : bump(p, 0.18 + i * 0.075, 0.34);

  void _nta(Canvas canvas, double p) {
    // The exam palette's own colours: answered, not answered, marked, not visited, on the exam's
    // pale panel with its navy header. Identical in Night and Day on purpose: it must look like
    // the real NTA screen (SPACING.md 8.4, the NTA exam look).
    const answered = Color(0xFF309816);
    const notAnswered = Color(0xFFD84500);
    const marked = Color(0xFF512593);
    const notVisited = Color(0xFFE4E4E4);
    const states = [
      [answered, answered, notAnswered],
      [marked, answered, notVisited],
      [notVisited, notVisited, notVisited],
    ];
    const radius = Radius.circular(ntaHeader);
    final panelRect = RRect.fromRectAndRadius(ntaPanel, radius);
    final panel = Path()..addRRect(panelRect);
    _drop(canvas, panel);
    canvas.drawPath(panel, _solid(const Color(0xFFF1EEE6), ntaPanel, hi: 0.5, lo: 0.12));
    canvas.drawPath(panel, _stroke(_black.withValues(alpha: 0.22), 0.5));
    // The palette's header band, with the pale rule of its title.
    canvas
      ..drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(ntaPanel.left, ntaPanel.top, ntaPanel.width, ntaHeader),
          topLeft: radius,
          topRight: radius,
        ),
        Paint()..color = const Color(0xFF2F4A7D),
      )
      ..drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(ntaPanel.left + ntaMargin, ntaPanel.top + ntaHeader / 2 - 0.35, 6.4, 0.7),
          const Radius.circular(0.35),
        ),
        Paint()..color = _white.withValues(alpha: 0.6),
      );
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 3; col++) {
        // A wave runs through the palette: each cell dips and refills in turn.
        final rect = ntaCellRect(row, col, dip: ntaDipAt(row * 3 + col, p));
        final fill = states[row][col];
        // Marked for Review is the exam's round chip; the other states are its squares.
        final rr = RRect.fromRectAndRadius(rect, Radius.circular(fill == marked ? rect.width / 2 : 1.1));
        canvas.drawRRect(rr, Paint()..color = fill);
        if (fill == notVisited) canvas.drawRRect(rr.deflate(0.25), _stroke(const Color(0xFFA9A9A9), 0.5));
      }
    }
  }

  // ---- repair: the miss being closed ----------------------------------------------------

  void _repair(Canvas canvas, double p) {
    final b = bell(p);
    const c = Offset(12, 12);
    final disc = Path()..addOval(Rect.fromCircle(center: c, radius: 7));
    _drop(canvas, disc, alpha: 0.4);
    // Inked, never a cross: a red cross in a ring read as a close button. The bubble is the
    // answer being put right, with a tick through it.
    final r = 7 * (1 - 0.12 * b);
    _bubble(canvas, c, r, BubbleState.filled);
    _rim(canvas, disc, disc.getBounds(), alpha: 0.4);
    final tick = Path()
      ..moveTo(c.dx - r * 0.42, c.dy + r * 0.02)
      ..lineTo(c.dx - r * 0.1, c.dy + r * 0.36)
      ..lineTo(c.dx + r * 0.46, c.dy - r * 0.34);
    canvas.drawPath(tick, _stroke(colors.voltInk, math.max(1.3, r * 0.2)));
    const ring = 10.6;
    final sweep = p <= 0.001 || p >= 0.999 ? 2 * math.pi : 2 * math.pi * Curves.easeOutCubic.transform(p);
    if (sweep < 2 * math.pi) canvas.drawCircle(c, ring, _stroke(_accent.withValues(alpha: 0.2), 1.1));
    canvas.drawArc(Rect.fromCircle(center: c, radius: ring), -math.pi / 2, sweep, false, _stroke(_accent, 1.3));
  }

  // ---- ask: a speech bubble -------------------------------------------------------------

  static final RRect _askBody = RRect.fromRectAndRadius(const Rect.fromLTWH(2.4, 3.4, 19.2, 14), const Radius.circular(5.4));
  static final Path _askShape = Path()
    ..addRRect(_askBody)
    ..moveTo(6.6, 16.6)
    ..lineTo(4.6, 21.8)
    ..lineTo(11.6, 17.2)
    ..close();

  void _ask(Canvas canvas, double p) {
    _drop(canvas, _askShape);
    canvas.drawPath(_askShape, _solid(_body, _askShape.getBounds(), hi: 0.24, lo: 0.3));
    _rim(canvas, _askShape, _askShape.getBounds());
    for (var i = 0; i < 3; i++) {
      final hop = p <= 0.001 ? 0.0 : bump(p, 0.22 + i * 0.2, 0.36);
      canvas.drawCircle(Offset(12 + (i - 1) * 4.6, 10.4 - 2.6 * hop), 1.55, Paint()..color = i == 1 && lit ? colors.voltEdge : _face);
    }
  }

  // ---- resume: an answer sheet part inked -----------------------------------------------

  void _resume(Canvas canvas, double p) {
    final b = bell(p);
    final card = RRect.fromRectAndRadius(const Rect.fromLTWH(3.6, 1.8, 16.8, 20.4), const Radius.circular(3));
    final path = Path()..addRRect(card);
    _drop(canvas, path);
    canvas.drawPath(path, _solid(_body, card.outerRect, hi: 0.24, lo: 0.26));
    _rim(canvas, path, card.outerRect);
    // The sheet's header strip.
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(6.4, 4.2, 7, 1.5), const Radius.circular(0.75)),
      Paint()..color = _face.withValues(alpha: 0.5),
    );
    // Three rows of four bubbles: five inked, the sixth inks as the gesture plays.
    const r = 1.32;
    for (var i = 0; i < 12; i++) {
      final row = i ~/ 4;
      final col = i % 4;
      final centre = Offset(7.35 + col * 3.1, 9.6 + row * 4.1);
      if (i < 5) {
        _inked(canvas, centre, r, 1);
      } else if (i == 5) {
        canvas.drawCircle(centre, r, _stroke(_face.withValues(alpha: 0.6), 0.55));
        if (b > 0.01) _inked(canvas, centre, r, b);
      } else {
        canvas.drawCircle(centre, r, _stroke(_face.withValues(alpha: 0.6), 0.55));
      }
    }
  }

  void _inked(Canvas canvas, Offset c, double r, double fill) {
    final rr = r * fill;
    if (lit) {
      canvas
        ..drawCircle(c, rr, Paint()..color = colors.volt)
        ..drawCircle(c, rr, _stroke(colors.voltInk.withValues(alpha: 0.7), 0.5));
    } else {
      canvas.drawCircle(c, rr, Paint()..color = _face);
    }
  }

  @override
  bool shouldRepaint(ChoiceGlyphPainter old) => old.kind != kind || old.colors != colors || old.lit != lit || old.t != t;
}
