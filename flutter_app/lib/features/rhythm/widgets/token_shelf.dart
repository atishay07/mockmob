// The token shelf: the brass milestone tokens standing on a hairline shelf, each in its own
// small pool of lamp light. An earned token stands in its slot with a contact shadow and the
// date it landed; a slot not yet earned shows the token as a faint grey ghost with one plain
// line of what fills it. No locks, no counts, nothing to chase (spec 6.5).
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/dates.dart';
import '../logic/tokens.dart';
import 'locked_coin.dart';

class TokenShelf extends StatelessWidget {
  const TokenShelf({super.key, required this.slots, required this.zone, required this.now, this.loading = false});

  final List<TokenSlot> slots;

  /// The student's timezone, for the dates.
  final String zone;
  final DateTime now;

  /// The rhythm is still loading: recesses without words, announced as loading.
  final bool loading;

  static const double band = 122;
  static const double token = 92;

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
            child: Row(
              children: [
                for (final slot in slots)
                  Expanded(
                    child: CustomPaint(
                      // Each socket's own pool of lamp light, 56 dp, fading to nothing.
                      painter: _SocketPool(colors.lamp.withValues(alpha: colors.isNight ? 0.10 : 0.12)),
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: slot.earned && !loading ? _Token(slot.token) : _Ghost(slot.token, loading: loading),
                        ),
                      ),
                    ),
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
    if (loading) return SkeletonGroup(label: RhythmCopy.loadingMilestones, child: shelf);
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
    final name = slot.earned ? (slot.title ?? slot.token.label) : slot.token.label;
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
            child: ArtImage(token.art, height: TokenShelf.token, placeholder: const SizedBox.square(dimension: 76)),
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

/// A slot not earned yet: the token itself, small, grey and faint, waiting on the shelf.
class _Ghost extends StatelessWidget {
  const _Ghost(this.token, {this.loading = false});

  final MilestoneToken token;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: 76,
      child: loading ? null : LockedCoin(token, size: 76),
    );
  }
}

/// A small round pool of lamp light behind one socket.
class _SocketPool extends CustomPainter {
  const _SocketPool(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height - 4 - 44);
    const r = 72.0;
    canvas.drawCircle(
      c,
      r,
      Paint()..shader = RadialGradient(colors: [color, color.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: c, radius: r)),
    );
  }

  @override
  bool shouldRepaint(_SocketPool old) => old.color != color;
}

/// The shelf the tokens stand on.
class _ShelfPainter extends CustomPainter {
  const _ShelfPainter({required this.colors});

  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    // The shelf: one 2 dp hairline under the tokens.
    canvas.drawRect(Rect.fromLTWH(0, size.height - 3, size.width, 2), Paint()..color = colors.line);
  }

  @override
  bool shouldRepaint(_ShelfPainter old) => old.colors != colors;
}

