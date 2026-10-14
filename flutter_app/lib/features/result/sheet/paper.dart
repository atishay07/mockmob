import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The answer sheet is the same object in both themes: charcoal paper under a desk lamp. Its
/// subtree always reads the Night roles, so on Daylight it sits on the warm paper ground like a
/// black envelope handed back across the desk.
class NightObject extends StatelessWidget {
  const NightObject({super.key, required this.child});

  final Widget child;

  static final ThemeData _night = buildTheme(Brightness.dark);

  /// The sheet is a printed object with fixed proportions: its small print grows with the system
  /// text size only up to 1.2x. Every number on it is also said in full text around it.
  @override
  Widget build(BuildContext context) => Theme(data: _night, child: MediaQuery.withClampedTextScaling(maxScaleFactor: 1.2, child: child));
}

/// Which corner of a paper face is folded over (the small notch that echoes Mobi's body).
enum PaperNotch { none, topRight, bottomRight }

/// The paper sheet's outline: soft 10 dp corners and an optional folded corner. [squareTop] and
/// [squareBottom] give that edge square corners, where two faces meet along the crease.
class PaperClipper extends CustomClipper<Path> {
  const PaperClipper({this.notch = PaperNotch.none, this.radius = 10, this.notchSize = 22, this.squareTop = false, this.squareBottom = false});

  final PaperNotch notch;
  final double radius;
  final double notchSize;
  final bool squareTop;
  final bool squareBottom;

  @override
  Path getClip(Size size) => paperPath(size, notch: notch, radius: radius, notchSize: notchSize, squareTop: squareTop, squareBottom: squareBottom);

  @override
  bool shouldReclip(PaperClipper old) =>
      old.notch != notch || old.radius != radius || old.notchSize != notchSize || old.squareTop != squareTop || old.squareBottom != squareBottom;
}

Path paperPath(
  Size size, {
  PaperNotch notch = PaperNotch.none,
  double radius = 10,
  double notchSize = 22,
  bool squareTop = false,
  bool squareBottom = false,
}) {
  final w = size.width;
  final h = size.height;
  final n = notchSize;
  final top = squareTop ? 0.0 : radius;
  final bottom = squareBottom ? 0.0 : radius;
  Path arc(Path p, Offset to, double r) => r <= 0 ? (p..lineTo(to.dx, to.dy)) : (p..arcToPoint(to, radius: Radius.circular(r)));
  final path = Path()..moveTo(top, 0);
  if (notch == PaperNotch.topRight) {
    path
      ..lineTo(w - n, 0)
      ..lineTo(w, n);
  } else {
    path.lineTo(w - top, 0);
    arc(path, Offset(w, top), top);
  }
  if (notch == PaperNotch.bottomRight) {
    path
      ..lineTo(w, h - n)
      ..lineTo(w - n, h);
  } else {
    path.lineTo(w, h - bottom);
    arc(path, Offset(w - bottom, h), bottom);
  }
  path.lineTo(bottom, h);
  arc(path, Offset(0, h - bottom), bottom);
  path.lineTo(0, top);
  arc(path, Offset(top, 0), top);
  path.close();
  return path;
}

/// One face of the charcoal sheet: warm charcoal paper, an optional embossed paper texture (the
/// `paper-tile` art, used on the outside where the bubbles press through from the other side),
/// film grain and the lamp's catch along the top edge. Static: it never repaints while the flap
/// moves, because it sits inside the transform, not under it.
class PaperFace extends StatelessWidget {
  const PaperFace({
    super.key,
    required this.child,
    this.notch = PaperNotch.none,
    this.texture = false,
    this.tone = 0,
    this.edge = true,
    this.squareTop = false,
    this.squareBottom = false,
  });

  final Widget child;
  final PaperNotch notch;

  /// Shows the embossed paper texture.
  final bool texture;

  /// 0 is the inside of the sheet; 1 is the slightly lighter outside of the flap.
  final double tone;
  final bool edge;

  /// Square corners along the top or bottom edge, where this face meets another along the crease.
  final bool squareTop;
  final bool squareBottom;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final base = Color.lerp(const Color(0xFF1C1A16), const Color(0xFF221F1A), tone)!;
    return ClipPath(
      clipper: PaperClipper(notch: notch, squareTop: squareTop, squareBottom: squareBottom),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: base,
          image: texture
              ? const DecorationImage(
                  // One tile, never repeated: the generated tile has a visible seam.
                  image: AssetImage('assets/art/paper-tile.webp'),
                  fit: BoxFit.cover,
                  opacity: 0.3,
                  alignment: Alignment.topLeft,
                )
              : null,
        ),
        child: CustomPaint(
          foregroundPainter: edge ? _PaperEdgePainter(notch: notch, lamp: colors.lamp, squareTop: squareTop, squareBottom: squareBottom) : null,
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              Positioned.fill(child: Grain(opacity: colors.grain * 1.1)),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

/// Paper catches the lamp on its upper-left edge and falls into shadow toward the lower right.
class _PaperEdgePainter extends CustomPainter {
  const _PaperEdgePainter({required this.notch, required this.lamp, this.squareTop = false, this.squareBottom = false});

  final PaperNotch notch;
  final bool squareTop;
  final bool squareBottom;
  final Color lamp;

  /// Night's `edgeTop` light (the sheet is a Night object in both themes).
  static const Color _edgeTop = Color(0x24FFF6E4);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final path = paperPath(size, notch: notch, squareTop: squareTop, squareBottom: squareBottom);
    // The rim: a 6% lamp line all the way round, so the charcoal sheet keeps an edge on the
    // charcoal desk at Night (audit X2), plus the shared top-edge light along the top.
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = lamp.withValues(alpha: 0.06),
    );
    canvas.drawLine(
      Offset(squareTop ? 0 : 10, 0.5),
      Offset(size.width - (notch == PaperNotch.topRight ? 22 : 10), 0.5),
      Paint()
        ..strokeWidth = 1
        ..shader = const LinearGradient(colors: [_edgeTop, Color(0x00FFF6E4)]).createShader(rect),
    );
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [lamp.withValues(alpha: 0.38), const Color(0x14FFF6E4), const Color(0x05FFF6E4)],
          stops: const [0, 0.35, 1],
        ).createShader(rect),
    );
    // A whisper of lamp light pooled on the paper's upper-left, so the sheet sits in the room.
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-1, -1),
          radius: 1.2,
          colors: [lamp.withValues(alpha: 0.075), lamp.withValues(alpha: 0)],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_PaperEdgePainter old) => old.notch != notch || old.lamp != lamp || old.squareTop != squareTop || old.squareBottom != squareBottom;
}

/// The small folded-over corner on the flap's free edge: a lighter triangle of the same paper,
/// lit along its fold.
class FoldedCorner extends StatelessWidget {
  const FoldedCorner({super.key, this.size = 22});

  final double size;

  @override
  Widget build(BuildContext context) => CustomPaint(size: Size.square(size), painter: _CornerPainter(context.mmColors.lamp));
}

class _CornerPainter extends CustomPainter {
  const _CornerPainter(this.lamp);

  final Color lamp;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    // The corner is folded up and over: the triangle sits inside the cut, its long side the fold.
    final tri = Path()
      ..moveTo(0, s)
      ..lineTo(s, 0)
      ..lineTo(0, 0)
      ..close();
    canvas.drawShadow(tri, const Color(0xFF000000), 2, false);
    canvas.drawPath(
      tri,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [const Color(0xFF34302A), const Color(0xFF2A2721)],
        ).createShader(Offset.zero & size),
    );
    canvas.drawLine(
      Offset(0, s),
      Offset(s, 0),
      Paint()
        ..strokeWidth = 1
        ..color = lamp.withValues(alpha: 0.35),
    );
  }

  @override
  bool shouldRepaint(_CornerPainter old) => old.lamp != lamp;
}
