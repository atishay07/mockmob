// Small pieces shared by the results screens (R8 Everyone's moment, R9 Fix it together): the paper
// card with a dog-ear, the Fold head disc, the lamp glow behind a sheet, the step tile and the
// segment progress. Paper, lamp and stationery, never glass (BRAND-MOTION-KIT 1).

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';

/// A raised paper card with a folded top-right corner.
class PaperCard extends StatelessWidget {
  const PaperCard({super.key, required this.child, this.padding = const EdgeInsets.all(MmSpace.s16), this.ear = 16});

  final Widget child;
  final EdgeInsets padding;
  final double ear;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return CustomPaint(
      painter: _CardPainter(fill: c.raised, edge: c.line, ground: c.ground, ear: ear, night: c.isNight),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _CardPainter extends CustomPainter {
  _CardPainter({required this.fill, required this.edge, required this.ground, required this.ear, required this.night});

  final Color fill;
  final Color edge;
  final Color ground;
  final double ear;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    const r = 16.0;
    final w = size.width;
    final h = size.height;
    final body = Path()
      ..moveTo(r, 0)
      ..lineTo(w - ear, 0)
      ..lineTo(w, ear)
      ..lineTo(w, h - r)
      ..quadraticBezierTo(w, h, w - r, h)
      ..lineTo(r, h)
      ..quadraticBezierTo(0, h, 0, h - r)
      ..lineTo(0, r)
      ..quadraticBezierTo(0, 0, r, 0)
      ..close();
    canvas.drawPath(body, Paint()..color = fill);
    canvas.drawPath(body, Paint()
      ..color = edge
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1);
    final fold = Path()
      ..moveTo(w - ear, 0)
      ..lineTo(w - ear, ear - 4)
      ..quadraticBezierTo(w - ear, ear, w - ear + 4, ear)
      ..lineTo(w, ear)
      ..close();
    canvas.drawPath(fold, Paint()..color = Color.lerp(fill, night ? const Color(0xFF000000) : const Color(0xFF8C8270), night ? 0.35 : 0.25)!);
    canvas.drawPath(fold, Paint()
      ..color = edge
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(_CardPainter old) => old.fill != fill || old.edge != edge || old.ear != ear;
}

/// The Fold's head (`fold-<key>-head@128.webp`) in a disc with the member's colour ring; the initial
/// disc when the file or the Fold is missing.
class FoldHeadDisc extends StatelessWidget {
  const FoldHeadDisc({super.key, required this.fold, required this.name, required this.colour, this.size = 40});

  final FoldKey? fold;
  final String name;
  final int colour;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final ring = MobColours.of(context, colour);
    final head = FoldManifest.cached?[fold]?.head;
    final initial = name.trim().isEmpty ? '?' : String.fromCharCode(name.trim().runes.first).toUpperCase();
    final fallback = Container(
      color: ring,
      alignment: Alignment.center,
      child: Text(initial, style: context.mmType.label.copyWith(color: MobColours.inkOn(context), fontSize: size * 0.42, height: 1, fontWeight: FontWeight.w700)),
    );
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(shape: BoxShape.circle, color: ring),
        child: ClipOval(
          child: ColoredBox(
            color: c.raised2,
            child: head == null
                ? fallback
                : Image.asset(head, fit: BoxFit.cover, filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => fallback),
          ),
        ),
      ),
    );
  }
}

/// A warm lamp pool from above, behind an answer sheet (light only, never a fill).
class LampGlow extends StatelessWidget {
  const LampGlow({super.key, this.strength = 1});

  final double strength;

  @override
  Widget build(BuildContext context) => CustomPaint(painter: _GlowPainter(night: context.mmColors.isNight, strength: strength, grid: context.mmColors.ink));
}

class _GlowPainter extends CustomPainter {
  _GlowPainter({required this.night, required this.strength, required this.grid});

  final bool night;
  final double strength;
  final Color grid;

  @override
  void paint(Canvas canvas, Size size) {
    // Graph paper at 4% ink.
    final p = Paint()
      ..color = grid.withValues(alpha: night ? 0.04 : 0.05)
      ..strokeWidth = 1;
    for (var y = 0.0; y < size.height; y += 20) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
    for (var x = 0.0; x < size.width; x += 20) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    }
    // The cone from above, narrowing onto the sheet.
    const lamp = Color(0xFFF2A93B);
    final a = (night ? 0.34 : 0.24) * strength;
    final cx = size.width * 0.4;
    final cone = Path()
      ..moveTo(cx - 26, 0)
      ..lineTo(cx + 26, 0)
      ..lineTo(cx + size.width * 0.42, size.height)
      ..lineTo(cx - size.width * 0.42, size.height)
      ..close();
    canvas.drawPath(
      cone,
      Paint()
        ..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [lamp.withValues(alpha: a), lamp.withValues(alpha: a * 0.25)])
            .createShader(Offset.zero & size)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
  }

  @override
  bool shouldRepaint(_GlowPainter old) => old.night != night || old.strength != strength;
}

/// A numbered step: the lead in bold ("1. Now"), then the rest ("See why, then one fresh question.").
class StepTile extends StatelessWidget {
  const StepTile({super.key, required this.text, this.split = ': '});

  /// The whole sentence; the part before [split] is the lead.
  final String text;
  final String split;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final i = text.indexOf(split);
    final lead = i < 0 ? text : text.substring(0, i + (split.trim().isEmpty ? 0 : split.trim().length));
    final rest = i < 0 ? '' : text.substring(i + split.length);
    return Container(
      padding: const EdgeInsets.all(MmSpace.s12),
      decoration: BoxDecoration(color: c.raised2.withValues(alpha: c.isNight ? 0.6 : 0.7), borderRadius: BorderRadius.circular(12)),
      child: Semantics(
        label: text,
        excludeSemantics: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(lead.endsWith(':') ? lead.substring(0, lead.length - 1) : lead, style: type.labelLarge.copyWith(color: c.ink, fontWeight: FontWeight.w700)),
            if (rest.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(rest, style: type.caption.copyWith(color: c.ink2, fontSize: 14, height: 1.35)),
            ],
          ],
        ),
      ),
    );
  }
}

/// [have] of [of] as paper segments (a fixed count, never a countdown).
class SegmentProgress extends StatelessWidget {
  const SegmentProgress({super.key, required this.have, required this.of, this.width = 96});

  final int have;
  final int of;
  final double width;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final n = math.max(1, of);
    return ExcludeSemantics(
      child: SizedBox(
        width: width,
        height: 8,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < n; i++) ...[
              if (i > 0) const SizedBox(width: 4),
              Expanded(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: i < have ? c.lamp : c.raised2,
                    borderRadius: BorderRadius.circular(3),
                    border: Border.all(color: c.line),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The results run's step (MOB-MINIMAL 3.4, A10): set by `ResultsRun` around each of its screens. A screen that
/// finds one shows the step dots in its header, an X to the den, and moves on with [onNext] instead of pushing the
/// next screen itself. Outside a run (a podium opened from the den) there is none and the screens behave as before.
class RunStep extends InheritedWidget {
  const RunStep({super.key, required this.index, required this.total, required this.onNext, required this.onExit, this.onRematch, required super.child});

  /// 0-based.
  final int index;
  final int total;

  /// Continue: the next true screen, or the den after the last.
  final VoidCallback onNext;

  /// The X: back to the den from any screen.
  final VoidCallback onExit;

  /// Rematch on Everyone's moment: Start a game prefilled with this game (`rematchOf`).
  final VoidCallback? onRematch;

  bool get last => index >= total - 1;

  static RunStep? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<RunStep>();

  @override
  bool updateShouldNotify(RunStep old) => old.index != index || old.total != total;
}

/// The step dots: one per true screen in this run, the current one a longer volt bar (the mock-ups' header).
/// Read as "Step 2 of 4". The current dot stretches over the card duration; reduced motion jumps.
class RunStepDots extends StatelessWidget {
  const RunStepDots({super.key, required this.index, required this.total});

  final int index;
  final int total;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (total <= 1) return const SizedBox.shrink();
    return Semantics(
      label: 'Step ${index + 1} of $total',
      excludeSemantics: true,
      child: Row(
        key: const ValueKey('run-step-dots'),
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < total; i++) ...[
            if (i > 0) const SizedBox(width: 5),
            AnimatedContainer(
              duration: reduced ? Duration.zero : const Duration(milliseconds: 240),
              curve: Curves.easeOutCubic,
              width: i == index ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(3),
                color: i == index ? (c.isNight ? c.volt : c.ink) : (i < index ? c.ink3 : c.ink4),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A header's middle in a results run: the step dots centred, or [fallback] outside a run.
Widget runHeaderMiddle(BuildContext context, Widget fallback) {
  final step = RunStep.maybeOf(context);
  if (step == null) return fallback;
  return Center(child: RunStepDots(index: step.index, total: step.total));
}
