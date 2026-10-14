import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../copy/state_words.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';

/// The one plain line that ends a finished task and says what was recorded and when. A recorded
/// line leads with a check (the server has it); a pending one with a phone glyph (only on this
/// phone). Show a recorded line only after the server acknowledged.
///
/// It arrives once: it slides 8 dp in from the left and fades up over 160 ms, and a recorded line's
/// check draws itself as one pen stroke inside its ring as it lands. When a pending line turns
/// recorded (the server answered) the glyph and the words swap in place with no blank frame
/// ([MmOverlapSwitcher]) and the check draws then. Under reduced motion it is simply there.
/// [animate] false shows it at rest (a list that rebuilds).
class ReceiptLine extends StatefulWidget {
  const ReceiptLine({super.key, required this.text, this.recorded = true, this.animate = true});

  /// "On this phone. Not recorded yet."
  const ReceiptLine.pending({super.key, this.animate = true})
      : text = Receipts.notRecordedYet,
        recorded = false;

  final String text;

  /// True after server acknowledgment; false while the work is only on this phone.
  final bool recorded;
  final bool animate;

  static const Duration arrive = Duration(milliseconds: 160);

  @override
  State<ReceiptLine> createState() => _ReceiptLineState();
}

class _ReceiptLineState extends State<ReceiptLine> with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: ReceiptLine.arrive);
  bool _begun = false;
  bool _still = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _still = !widget.animate || Motion.reduced(context);
    if (_begun) return;
    _begun = true;
    if (_still) {
      _in.value = 1;
    } else {
      _in.forward();
    }
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final glyphColor = colors.ink.withValues(alpha: 0.7);
    final glyph = widget.recorded
        ? SizedBox.square(
            key: const ValueKey('receipt-recorded'),
            dimension: 16,
            child: Stack(
              children: [
                CustomPaint(size: const Size.square(16), painter: _RingPainter(color: glyphColor)),
                MmStrokeDraw(
                  key: const ValueKey('receipt-check'),
                  size: const Size.square(16),
                  path: _check,
                  color: glyphColor,
                  strokeWidth: 16 / 12,
                  duration: const Duration(milliseconds: 260),
                  delay: _still ? Duration.zero : const Duration(milliseconds: 90),
                  animateFirst: !_still,
                ),
              ],
            ),
          )
        : Icon(LucideIcons.smartphone, key: const ValueKey('receipt-pending'), size: 16, color: glyphColor);

    return Semantics(
      container: true,
      label: widget.text,
      excludeSemantics: true,
      child: AnimatedBuilder(
        animation: _in,
        builder: (context, child) {
          final t = Motion.glide.transform(_in.value);
          return Opacity(
            opacity: t,
            child: Transform.translate(offset: Offset(-8 * (1 - t), 0), child: child),
          );
        },
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: SizedBox.square(dimension: 16, child: MmOverlapSwitcher(alignment: Alignment.center, child: glyph)),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: MmOverlapSwitcher(
                alignment: AlignmentDirectional.topStart,
                child: Text(widget.text, key: ValueKey<String>(widget.text), style: type.small.copyWith(color: colors.ink2)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The check inside the ring, on Lucide's 24-unit grid scaled to the box (circle-check's
  /// "m9 12 2 2 4-4").
  static Path _check(Size size) {
    final k = size.width / 24;
    return Path()
      ..moveTo(9 * k, 12 * k)
      ..lineTo(11 * k, 14 * k)
      ..lineTo(15 * k, 10 * k);
  }
}

/// The ring of the recorded glyph: Lucide's circle (r 10 on a 24 grid), stroke 2 at 24.
class _RingPainter extends CustomPainter {
  const _RingPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 24;
    canvas.drawCircle(
      size.center(Offset.zero),
      10 * k,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 * k
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color;
}
