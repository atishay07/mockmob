// An unopened result takes over the hero as the sealed sheet (brief 12): a folded charcoal
// answer sheet with a foil seal on the crease, waiting to be opened. No Mobi on a sealed sheet,
// no score anywhere on Today until it is opened, and "Open results directly" is always there
// (a reveal never withholds a result).
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';

class SealedHeroCard extends StatelessWidget {
  const SealedHeroCard({super.key, required this.sealed, required this.onOpen, required this.onOpenDirectly});

  final SealedHero sealed;
  final VoidCallback onOpen;
  final VoidCallback onOpenDirectly;

  @override
  Widget build(BuildContext context) {
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
            const FoldedSheet(height: 176),
            const SizedBox(height: MmSpace.s20),
            Semantics(header: true, child: Text(sealed.title, style: type.title)),
            const SizedBox(height: MmSpace.s4),
            Text(sealed.line, style: type.body.copyWith(color: colors.ink2)),
            if (sealed.moreLine != null) ...[
              const SizedBox(height: MmSpace.s4),
              Text(sealed.moreLine!, style: type.caption.copyWith(color: colors.ink3)),
            ],
            const SizedBox(height: MmSpace.s20),
            KeyButton(label: TodayCopy.openSheet, onPressed: onOpen),
            Center(child: KeyButton.quiet(label: TodayCopy.openDirectly, onPressed: onOpenDirectly)),
          ],
        ),
      ),
    );
  }
}

/// The folded answer sheet: the lower half is the face (charcoal paper embossed with bubbles),
/// the upper flap is folded over it along a crease at 45%, and a foil seal holds the fold.
/// Plain shapes and two images; static.
class FoldedSheet extends StatelessWidget {
  const FoldedSheet({super.key, this.height = 176});

  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    const radius = BorderRadius.all(Radius.circular(18));
    final crease = height * 0.45;
    final paper = colors.isNight ? const Color(0xFF1A1915) : const Color(0xFFE9DFCB);
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
                      ColoredBox(color: paper),
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
              top: crease - 38,
              height: 76,
              child: const Center(child: ArtImage(MmArt.foilSeal, height: 76, width: 76)),
            ),
          ],
        ),
      ),
    );
  }
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
          colors: colors.isNight
              ? [const Color(0x33FFE2B0), const Color(0x66000000)]
              : [const Color(0x55FFFFFF), const Color(0x1A2A2010)],
        ).createShader(flap),
    );
    canvas.drawLine(
      Offset(0, crease),
      Offset(size.width, crease),
      Paint()
        ..color = colors.isNight ? const Color(0xCC000000) : const Color(0x552A2010)
        ..strokeWidth = 1.2,
    );
    canvas.drawLine(
      Offset(0, crease + 1.2),
      Offset(size.width, crease + 1.2),
      Paint()
        ..color = colors.isNight ? const Color(0x2EFFF0D8) : const Color(0x99FFFFFF)
        ..strokeWidth = 1,
    );
    const notch = 22.0;
    final corner = Path()
      ..moveTo(size.width - notch, 0)
      ..lineTo(size.width, notch)
      ..lineTo(size.width - notch, notch)
      ..close();
    canvas.drawPath(corner, Paint()..color = colors.isNight ? const Color(0xFF2C2A24) : const Color(0xFFD3CCBC));
    canvas.drawPath(
      Path()
        ..moveTo(size.width - notch, 0)
        ..lineTo(size.width, notch),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.isNight ? const Color(0x40FFF0D8) : const Color(0x332A2010),
    );
  }

  @override
  bool shouldRepaint(_FoldPainter old) => old.crease != crease || old.colors != colors;
}
