// The token shelf: the brass milestone tokens standing on a lamp-lit ledge. An earned token
// stands in its slot with a contact shadow and the date it landed; a slot not yet earned is a
// quiet recess pressed into the shelf with one plain line of what fills it. No locks, no
// counts, nothing to chase (spec 6.5).
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/dates.dart';
import '../logic/tokens.dart';

class TokenShelf extends StatelessWidget {
  const TokenShelf({super.key, required this.slots, required this.zone, required this.now, this.loading = false});

  final List<TokenSlot> slots;

  /// The student's timezone, for the dates.
  final String zone;
  final DateTime now;

  /// The rhythm is still loading: recesses without words, announced as loading.
  final bool loading;

  static const double band = 104;
  static const double token = 78;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shelf = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: band,
          child: CustomPaint(
            painter: _ShelfPainter(colors: colors),
            child: Stack(
              fit: StackFit.expand,
              children: [
                // The lamp's light falling on the shelf from the upper left: a wide, low pool that
                // fades out before the band's edges.
                LightField(
                  pools: [
                    LightPool(
                      color: colors.lamp.withValues(alpha: colors.isNight ? 0.24 : 0.18),
                      center: const Alignment(-0.3, 0.92),
                      radius: 0.3,
                      aspect: 2.6,
                    ),
                  ],
                ),
                Row(
              children: [
                for (final slot in slots)
                  Expanded(
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 9),
                        child: slot.earned && !loading ? _Token(slot.token) : const _Recess(),
                      ),
                    ),
                  ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final slot in slots)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                  child: loading
                      ? const Column(children: [Skeleton.line(width: 72), SizedBox(height: 6), Skeleton.line(width: 56, height: 10)])
                      : _Label(slot: slot, zone: zone, now: now, type: type, colors: colors),
                ),
              ),
          ],
        ),
      ],
    );
    if (loading) return SkeletonGroup(label: 'Loading your milestones', child: shelf);
    return shelf;
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.slot, required this.zone, required this.now, required this.type, required this.colors});

  final TokenSlot slot;
  final String zone;
  final DateTime now;
  final MmType type;
  final MmColors colors;

  @override
  Widget build(BuildContext context) {
    final name = slot.token.label;
    final date = slot.earned ? formatAchievedDate(slot.earnedAt!, zone, now) : null;
    final semantics = date != null ? RhythmCopy.tokenEarned(name, date) : RhythmCopy.tokenWaiting(name, slot.token.emptyHint);
    return Semantics(
      container: true,
      label: semantics,
      excludeSemantics: true,
      child: Column(
        children: [
          Text(
            name,
            textAlign: TextAlign.center,
            style: type.labelLarge.copyWith(fontSize: 14, height: 18 / 14, color: slot.earned ? colors.ink : colors.ink2),
          ),
          const SizedBox(height: 2),
          Text(
            date ?? slot.token.emptyHint,
            textAlign: TextAlign.center,
            style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink3),
          ),
        ],
      ),
    );
  }
}

class _Token extends StatelessWidget {
  const _Token(this.token);

  final MilestoneToken token;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: TokenShelf.token + 8,
      height: TokenShelf.token + 6,
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          // The contact shadow where the coin's rim meets the ledge.
          Positioned(
            bottom: 0,
            child: CustomPaint(size: const Size(TokenShelf.token * 0.72, 10), painter: _ContactShadow()),
          ),
          Positioned(
            bottom: 3,
            child: ArtImage(token.art, height: TokenShelf.token, placeholder: const _Recess()),
          ),
        ],
      ),
    );
  }
}

class _ContactShadow extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawOval(
      Offset.zero & size,
      Paint()
        ..color = const Color(0x8C000000)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
  }

  @override
  bool shouldRepaint(_ContactShadow old) => false;
}

/// An empty slot: a shallow round recess pressed into the shelf, shadowed along its upper rim
/// and catching the lamp along its lower rim, with the faint ring of the coin it is waiting for.
class _Recess extends StatelessWidget {
  const _Recess();

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(size: const Size.square(62), painter: _RecessPainter(context.mmColors)),
    );
  }
}

class _RecessPainter extends CustomPainter {
  const _RecessPainter(this.colors);

  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    final rect = Rect.fromCircle(center: c, radius: r);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: colors.isNight ? [const Color(0xFF0B0A08), const Color(0xFF1C1A16)] : [const Color(0xFFDCD5C6), colors.sunken],
        ).createShader(rect),
    );
    // The upper rim falls into shadow, the lower rim catches the room's light.
    canvas.drawArc(
      rect.deflate(0.75),
      math.pi * 1.05,
      math.pi * 0.9,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = colors.isNight ? const Color(0x99000000) : const Color(0x332A2010),
    );
    canvas.drawArc(
      rect.deflate(0.5),
      math.pi * 0.1,
      math.pi * 0.8,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.isNight ? colors.lamp.withValues(alpha: 0.22) : Colors.white,
    );
    // The ghost of the coin's milled ring.
    canvas.drawCircle(
      c,
      r * 0.64,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.isNight ? colors.lineStrong.withValues(alpha: 0.6) : colors.line,
    );
  }

  @override
  bool shouldRepaint(_RecessPainter old) => old.colors != colors;
}

/// The ledge the tokens stand on, and the lamp light pooled above it from the upper left.
class _ShelfPainter extends CustomPainter {
  const _ShelfPainter({required this.colors});

  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final ledgeY = size.height - 6;
    // The ledge's front face: a band that darkens downward.
    final face = Rect.fromLTWH(0, ledgeY, size.width, 6);
    canvas.drawRect(
      face,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [colors.isNight ? colors.raised2 : colors.lineStrong, colors.ground],
        ).createShader(face),
    );
    // Its top edge catches the lamp, warm at the left and fading to the right.
    canvas.drawLine(
      Offset(0, ledgeY + 0.5),
      Offset(size.width, ledgeY + 0.5),
      Paint()
        ..strokeWidth = 1
        ..shader = LinearGradient(
          colors: colors.isNight
              ? [colors.lamp.withValues(alpha: 0.55), colors.edgeTop, colors.edgeBottom]
              : [colors.lamp.withValues(alpha: 0.6), Colors.white, colors.line],
          stops: const [0, 0.45, 1],
        ).createShader(face),
    );
  }

  @override
  bool shouldRepaint(_ShelfPainter old) => old.colors != colors;
}

