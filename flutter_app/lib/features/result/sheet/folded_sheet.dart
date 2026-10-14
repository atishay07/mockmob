import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'light_sweep.dart';
import 'paper.dart';
import 'sheet_geometry.dart';

/// The answer sheet folded along its crease (spec amendment A1). [open] runs 0 (folded: the flap
/// lies face-down over the bubbles) to 1 (flat). The flap rotates about the crease with one
/// perspective transform, `Matrix4..setEntry(3, 2, 0.0012)..rotateX(angle)`: no saveLayer, no
/// image, no rebuild of the faces while it moves. Past halfway the inside of the flap turns
/// toward the student.
///
/// The light is part of the motion: the flap darkens as it stands up and turns away from the
/// lamp, the bubbles under it come out of its shadow, and a soft contact shadow lies under the
/// folded edge until it lifts.
class FoldedSheet extends StatelessWidget {
  const FoldedSheet({
    super.key,
    required this.geometry,
    required this.open,
    required this.outside,
    required this.inside,
    required this.body,
    this.sweep,
    this.day = false,
  });

  final SheetGeometry geometry;
  final Animation<double> open;
  final Widget outside;
  final Widget inside;
  final Widget body;

  /// The single light sweep across the open sheet (celebratory variants only).
  final Animation<double>? sweep;

  /// The room is Daylight. The sheet itself is the same charcoal object in both themes; only its
  /// shadow on the desk changes (SPACING 8.2): a soft sepia shadow on paper, and on charcoal,
  /// where a shadow cannot show, the paper's own lit edge does the work.
  final bool day;

  static const double perspective = 0.0012;

  @override
  Widget build(BuildContext context) {
    final g = geometry;
    final f = g.flapHeight;
    // Held inside the transform, so moving the flap never rebuilds or repaints the faces.
    final insideFace = RepaintBoundary(child: inside);
    final outsideFace = RepaintBoundary(
      child: Transform(alignment: Alignment.center, transform: Matrix4.rotationX(math.pi), child: outside),
    );

    return SizedBox(
      width: g.width,
      height: g.height,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // The sheet's shadow on the desk: under the body always, under the flap as it lands.
          Positioned(
            left: 0,
            right: 0,
            top: f,
            height: g.bodyHeight,
            child: _DeskShadow(day: day),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: f,
            child: AnimatedBuilder(
              animation: open,
              builder: (context, _) => _DeskShadow(day: day, strength: ((open.value - 0.85) / 0.15).clamp(0.0, 1.0)),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: f,
            height: g.bodyHeight,
            child: RepaintBoundary(child: body),
          ),
          // The crease: a darker line with a lit lip below it, once the sheet lies open.
          Positioned(
            left: 0,
            right: 0,
            top: f - 1,
            height: 3,
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: open,
                builder: (context, _) => open.value < 0.98 ? const SizedBox.shrink() : const _Crease(),
              ),
            ),
          ),
          // The bubbles under the flap sit in its shadow until it lifts away.
          Positioned(
            left: 0,
            right: 0,
            top: f,
            height: math.min(f * 1.1, g.bodyHeight),
            child: IgnorePointer(child: _UnderShadow(open: open)),
          ),
          // The folded flap's soft contact shadow just past its free edge.
          Positioned(
            left: 8,
            right: 8,
            top: 2 * f - 2,
            height: 18,
            child: IgnorePointer(child: _EdgeShadow(open: open)),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: f,
            // The flap never paints wider than the sheet: near upright, perspective would push its
            // free edge past the screen's sides.
            child: ClipRect(
              clipper: const _SheetWidth(),
              child: AnimatedBuilder(
                animation: open,
                builder: (context, _) {
                  final p = open.value.clamp(0.0, 1.0);
                  final angle = math.pi * (1 - p);
                  final showOutside = angle > math.pi / 2;
                  // Lit flat; darkest when standing on edge, turned away from the lamp.
                  final shade = showOutside ? (math.pi - angle) / (math.pi / 2) * 0.5 : angle / (math.pi / 2) * 0.38;
                  return Transform(
                    alignment: Alignment.bottomCenter,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, perspective)
                      ..rotateX(angle),
                    child: Stack(
                      clipBehavior: Clip.none,
                      fit: StackFit.expand,
                      children: [
                        showOutside ? outsideFace : insideFace,
                        if (shade > 0.01)
                          IgnorePointer(
                            // Both faces put their folded corner top right in the flap's own space.
                            child: ClipPath(
                              clipper: const PaperClipper(notch: PaperNotch.topRight),
                              child: ColoredBox(color: Color.fromRGBO(6, 5, 3, shade.clamp(0.0, 1.0))),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          if (sweep != null)
            Positioned.fill(
              child: IgnorePointer(
                child: RepaintBoundary(child: LightSweep(progress: sweep!)),
              ),
            ),
        ],
      ),
    );
  }
}

/// Clips to the sheet's width plus a margin for the fold's perspective (the flap's free edge
/// comes toward the viewer and grows a little); the flap may still rise above or below its slot.
class _SheetWidth extends CustomClipper<Rect> {
  const _SheetWidth();

  @override
  Rect getClip(Size size) => Rect.fromLTRB(-24, -size.height * 2, size.width + 24, size.height * 3);

  @override
  bool shouldReclip(_SheetWidth oldClipper) => false;
}

/// The sheet's shadow on the desk. An analytic rounded rect whose blur is at least 1.5 times its
/// offset, drawn unclipped (SPACING 8.2). Night: a deep, wide shadow under the charcoal (it only
/// reads at the edges; the paper's lit rim gives the edge). Day: sepia `0x1F2A2010`, blur 28,
/// so the sheet rests on the cream instead of sitting on a hard grey strip.
class _DeskShadow extends StatelessWidget {
  const _DeskShadow({required this.day, this.strength = 1});

  final bool day;
  final double strength;

  static const Color daySepia = Color(0x1F2A2010);

  @override
  Widget build(BuildContext context) {
    if (strength <= 0.01) return const SizedBox.expand();
    final shadows = day
        ? [
            BoxShadow(color: daySepia.withValues(alpha: daySepia.a * strength), blurRadius: 28, offset: const Offset(0, 12), spreadRadius: -2),
            BoxShadow(color: Color.fromRGBO(42, 32, 16, 0.10 * strength), blurRadius: 4, offset: const Offset(0, 1)),
          ]
        : [
            BoxShadow(color: Color.fromRGBO(0, 0, 0, 0.4 * strength), blurRadius: 40, offset: const Offset(0, 16), spreadRadius: -8),
            BoxShadow(color: Color.fromRGBO(0, 0, 0, 0.16 * strength), blurRadius: 6, offset: const Offset(0, 1)),
          ];
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: const BorderRadius.all(Radius.circular(10)), boxShadow: shadows),
    );
  }
}

class _Crease extends StatelessWidget {
  const _Crease();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        SizedBox(
          height: 1,
          width: double.infinity,
          child: ColoredBox(color: Color(0x80000000)),
        ),
        SizedBox(
          height: 1,
          width: double.infinity,
          child: ColoredBox(color: Color(0x1AFFF4E0)),
        ),
        SizedBox(
          height: 1,
          width: double.infinity,
          child: ColoredBox(color: Color(0x0D000000)),
        ),
      ],
    );
  }
}

class _UnderShadow extends StatelessWidget {
  const _UnderShadow({required this.open});

  final Animation<double> open;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: open,
      builder: (context, _) {
        final a = (1 - open.value).clamp(0.0, 1.0) * 0.62;
        if (a <= 0.01) return const SizedBox.expand();
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color.fromRGBO(4, 3, 2, a), Color.fromRGBO(4, 3, 2, a * 0.4), const Color(0x00040302)],
              stops: const [0, 0.6, 1],
            ),
          ),
        );
      },
    );
  }
}

class _EdgeShadow extends StatelessWidget {
  const _EdgeShadow({required this.open});

  final Animation<double> open;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: open,
      builder: (context, _) {
        final a = (1 - open.value / 0.25).clamp(0.0, 1.0) * 0.55;
        if (a <= 0.01) return const SizedBox.expand();
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color.fromRGBO(0, 0, 0, a), const Color(0x00000000)],
            ),
          ),
        );
      },
    );
  }
}
