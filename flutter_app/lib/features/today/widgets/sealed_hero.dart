// An unopened result takes over the hero as the sealed sheet (brief 12): a folded charcoal
// answer sheet with a foil seal on the crease, waiting to be opened. No Mobi on a sealed sheet,
// no score anywhere on Today until it is opened, and "Open results directly" is always there
// (a reveal never withholds a result).
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'today_tones.dart';

class SealedHeroCard extends StatefulWidget {
  const SealedHeroCard({super.key, required this.sealed, required this.onOpen, required this.onOpenDirectly});

  final SealedHero sealed;
  final VoidCallback onOpen;
  final VoidCallback onOpenDirectly;

  /// Lets a test see the once-per-run glint again.
  @visibleForTesting
  static void debugResetGlint() => _SealedHeroCardState._glinted = false;

  @override
  State<SealedHeroCard> createState() => _SealedHeroCardState();
}

class _SealedHeroCardState extends State<SealedHeroCard> with TickerProviderStateMixin {
  /// The glint has crossed the seal in this app run.
  static bool _glinted = false;

  /// One band of light across the foil: it waits 900 ms, then takes 900 ms. Once per run.
  late final AnimationController _glint = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800));

  /// The seal's crack when Open sheet starts: it splits in 200 ms and closes again while the
  /// page opens over it (a quick break and a slow heal, so it is whole when the student is back).
  late final AnimationController _crack =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 200), reverseDuration: const Duration(milliseconds: 600));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (_glinted || Motion.reduced(context)) return;
    _glinted = true;
    _glint.forward();
  }

  @override
  void dispose() {
    _glint.dispose();
    _crack.dispose();
    super.dispose();
  }

  void _open() {
    MmLaunchRect.capture(context);
    // The seal breaks as the card starts to grow into the sheet. No score, no Mobi: the foil only.
    if (!Motion.reduced(context)) {
      _crack.forward().whenComplete(() {
        if (mounted) _crack.reverse();
      });
    }
    widget.onOpen();
  }

  @override
  Widget build(BuildContext context) {
    final sealed = widget.sealed;
    final colors = context.mmColors;
    final type = context.mmType;
    return HeroStage(
      subjectId: sealed.subjectId,
      lampStrength: 1.2,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(TodayCopy.sealedOverline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
            const SizedBox(height: MmSpace.s16),
            FoldedSheet(height: 176, glint: _glint, crack: _crack),
            const SizedBox(height: MmSpace.s20),
            Semantics(header: true, child: Text(sealed.title, style: type.headline)),
            const SizedBox(height: MmSpace.s4),
            Text(sealed.line, style: type.body.copyWith(color: colors.ink2)),
            if (sealed.moreLine != null) ...[
              const SizedBox(height: MmSpace.s4),
              Text(sealed.moreLine!, style: type.caption.copyWith(color: colors.ink3)),
            ],
            const SizedBox(height: MmSpace.s20),
            // The card grows into the sheet it opens (MOTION.md C4).
            KeyButton(label: TodayCopy.openSheet, onPressed: _open),
            const SizedBox(height: MmSpace.s4),
            Center(child: KeyButton.quiet(label: TodayCopy.openDirectly, onPressed: widget.onOpenDirectly)),
          ],
        ),
      ),
    );
  }
}

/// The folded answer sheet: the lower half is the face (charcoal paper embossed with bubbles),
/// the upper flap is folded over it along a crease at 45%, and a foil seal holds the fold.
/// Plain shapes and two images. It is still unless given [glint] (one band of light across the
/// foil, 0 to 1 of which the first half is the wait) or [crack] (0 to 1: the seal splits along
/// a jagged line and its halves part a little).
class FoldedSheet extends StatelessWidget {
  const FoldedSheet({super.key, this.height = 176, this.glint, this.crack});

  final double height;
  final Animation<double>? glint;
  final Animation<double>? crack;

  static const double sealSize = 76;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    const radius = BorderRadius.all(Radius.circular(18));
    final crease = height * 0.45;
    const seal = ArtImage(MmArt.foilSeal, height: sealSize, width: sealSize);
    final cracking = crack;
    final glinting = glint;
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(borderRadius: radius, boxShadow: colors.cardShadow),
                child: ClipRRect(
                  borderRadius: radius,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ColoredBox(color: colors.foldPaper),
                      // One cover of the tile (it has a visible seam when repeated); the image
                      // carries its own opacity, so no extra layer.
                      ArtImage(MmArt.paperTile, fit: BoxFit.cover, opacity: colors.isNight ? 0.9 : 0.2),
                      CustomPaint(painter: _FoldPainter(crease: crease, colors: colors)),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              top: crease - sealSize / 2,
              height: sealSize,
              child: Center(
                child: SizedBox.square(
                  dimension: sealSize,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned.fill(child: cracking == null ? seal : _CrackedSeal(crack: cracking, child: seal)),
                      if (glinting != null)
                        Positioned.fill(
                          child: IgnorePointer(child: RepaintBoundary(child: CustomPaint(painter: _GlintPainter(progress: glinting)))),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The foil seal in two halves that part along a jagged break as [crack] goes 0 to 1.
class _CrackedSeal extends StatelessWidget {
  const _CrackedSeal({required this.crack, required this.child});

  final Animation<double> crack;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: crack,
      child: child,
      builder: (context, child) {
        final c = Motion.emphasized.transform(crack.value.clamp(0.0, 1.0));
        if (c <= 0) return child!;
        Widget half(Alignment side, double dir) => Transform.translate(
              offset: Offset(dir * 3 * c, 0.8 * c),
              child: Transform.rotate(
                angle: dir * 0.07 * c,
                alignment: Alignment.bottomCenter,
                child: ClipPath(clipper: _HalfClipper(left: dir < 0), child: child),
              ),
            );
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(child: half(Alignment.centerLeft, -1)),
            Positioned.fill(child: half(Alignment.centerRight, 1)),
            Positioned.fill(child: CustomPaint(painter: _CrackLinePainter(progress: c))),
          ],
        );
      },
    );
  }
}

/// One side of the seal's jagged break.
class _HalfClipper extends CustomClipper<Path> {
  const _HalfClipper({required this.left});

  final bool left;

  @override
  Path getClip(Size size) {
    final zig = _CrackLinePainter.points(size);
    final path = Path()..moveTo(left ? 0 : size.width, 0)..lineTo(zig.first.dx, zig.first.dy);
    for (final p in zig.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    path
      ..lineTo(left ? 0 : size.width, size.height)
      ..close();
    return path;
  }

  @override
  bool shouldReclip(_HalfClipper old) => old.left != left;
}

class _CrackLinePainter extends CustomPainter {
  const _CrackLinePainter({required this.progress});

  final double progress;

  /// The break: a jagged line down the middle of the seal.
  static List<Offset> points(Size s) {
    final m = s.width / 2;
    return [
      Offset(m + 1, 0),
      Offset(m - 5, s.height * 0.22),
      Offset(m + 4, s.height * 0.42),
      Offset(m - 4, s.height * 0.62),
      Offset(m + 3, s.height * 0.8),
      Offset(m - 1, s.height),
    ];
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final pts = points(size);
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (final p in pts.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..strokeJoin = StrokeJoin.miter
        ..color = const Color(0xFF000000).withValues(alpha: 0.55 * progress),
    );
  }

  @override
  bool shouldRepaint(_CrackLinePainter old) => old.progress != progress;
}

/// One soft band of light crossing the foil, clipped to the seal's disc: it waits for the first
/// half of [progress] and crosses in the second.
class _GlintPainter extends CustomPainter {
  _GlintPainter({required this.progress}) : super(repaint: progress);

  final Animation<double> progress;

  @override
  void paint(Canvas canvas, Size size) {
    final v = progress.value;
    if (v <= 0.5 || v >= 1) return;
    final p = Motion.sweepCurve.transform((v - 0.5) / 0.5);
    final centre = size.center(Offset.zero);
    canvas.save();
    canvas.clipPath(Path()..addOval(Rect.fromCircle(center: centre, radius: size.shortestSide / 2 - 2)));
    canvas.translate(centre.dx, centre.dy);
    canvas.rotate(0.6);
    final band = size.width * 0.34;
    final x = -size.width * 0.9 + (size.width * 1.8) * p - band / 2;
    final rect = Rect.fromLTWH(x, -size.height, band, size.height * 2);
    const peak = Color(0x99FFFFFF);
    canvas.drawRect(
      rect,
      Paint()..shader = const LinearGradient(colors: [Color(0x00FFFFFF), peak, Color(0x00FFFFFF)]).createShader(rect),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlintPainter old) => old.progress != progress;
}

/// The flap above the crease (a shade darker, catching the lamp at its top), the crease itself
/// (a dark line with a lit lip under it) and the folded corner notch, echoing Mobi's body.
class _FoldPainter extends CustomPainter {
  const _FoldPainter({required this.crease, required this.colors});

  final double crease;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final flap = Rect.fromLTWH(0, 0, size.width, crease);
    canvas.drawRect(
      flap,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: colors.foldFlap,
        ).createShader(flap),
    );
    canvas.drawLine(
      Offset(0, crease),
      Offset(size.width, crease),
      Paint()
        ..color = colors.foldCrease
        ..strokeWidth = 1.2,
    );
    canvas.drawLine(
      Offset(0, crease + 1.2),
      Offset(size.width, crease + 1.2),
      Paint()
        ..color = colors.foldLip
        ..strokeWidth = 1,
    );
    const notch = 22.0;
    final corner = Path()
      ..moveTo(size.width - notch, 0)
      ..lineTo(size.width, notch)
      ..lineTo(size.width - notch, notch)
      ..close();
    canvas.drawPath(corner, Paint()..color = colors.foldCorner);
    canvas.drawPath(
      Path()
        ..moveTo(size.width - notch, 0)
        ..lineTo(size.width, notch),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.foldCornerEdge,
    );
  }

  @override
  bool shouldRepaint(_FoldPainter old) => old.crease != crease || old.colors != colors;
}
