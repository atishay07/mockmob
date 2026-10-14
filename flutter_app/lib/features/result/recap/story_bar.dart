import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The top of every recap card: one segment per card showing where you are (position, not a
/// timer and not progress toward a reward), and "Skip to full result" on the right. When a card
/// arrives its segment is drawn in left to right once (420 ms, emphasized), the way a page is
/// turned to; cards already seen stay quietly filled.
class StoryBar extends StatefulWidget {
  const StoryBar({super.key, required this.card, required this.count, required this.onSkip, this.onBack});

  /// 1-based.
  final int card;
  final int count;
  final VoidCallback onSkip;

  /// The previous card; given on cards 2 to 4 (the chevron is the visible way back, besides the
  /// swipe). System back still goes to the full result.
  final VoidCallback? onBack;

  @override
  State<StoryBar> createState() => _StoryBarState();
}

class _StoryBarState extends State<StoryBar> with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(vsync: this, duration: Motion.emphasizedDuration);
  late final Animation<double> _curve = CurvedAnimation(parent: _fill, curve: Motion.emphasized);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _run();
  }

  @override
  void didUpdateWidget(StoryBar old) {
    super.didUpdateWidget(old);
    if (old.card != widget.card) _run();
  }

  void _run() {
    if (Motion.reduced(context)) {
      _fill.value = 1;
    } else {
      _fill.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final onBack = widget.onBack;
    return SizedBox(
      height: 56,
      child: Padding(
        padding: const EdgeInsets.only(left: MmSpace.s4, right: MmSpace.s8),
        child: Row(
          children: [
            // The slot is always there, so the segments do not move from card to card.
            SizedBox.square(
              dimension: MmTarget.min,
              child: onBack == null
                  ? null
                  : MmPressable(
                      onTap: onBack,
                      semanticsLabel: ResultCopy.previousCard,
                      focusRadius: MmRadius.pillAll,
                      builder: (context, pressed, _) => Center(child: Icon(LucideIcons.arrowLeft, size: 22, color: colors.ink)),
                    ),
            ),
            Expanded(
              child: Semantics(
                label: ResultCopy.cardOf(widget.card, widget.count),
                excludeSemantics: true,
                child: RepaintBoundary(
                  child: SizedBox(
                    height: 3,
                    child: CustomPaint(
                      painter: _SegmentsPainter(
                        card: widget.card,
                        count: widget.count,
                        fill: _curve,
                        current: colors.ink,
                        seen: colors.ink3,
                        track: colors.lineStrong,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            KeyButton.quiet(label: ResultCopy.skip, onPressed: widget.onSkip),
          ],
        ),
      ),
    );
  }
}

class _SegmentsPainter extends CustomPainter {
  _SegmentsPainter({
    required this.card,
    required this.count,
    required this.fill,
    required this.current,
    required this.seen,
    required this.track,
  }) : super(repaint: fill);

  final int card;
  final int count;
  final Animation<double> fill;
  final Color current;
  final Color seen;
  final Color track;

  static const double gap = 4;

  @override
  void paint(Canvas canvas, Size size) {
    if (count <= 0) return;
    final w = (size.width - gap * (count - 1)) / count;
    const r = Radius.circular(2);
    for (var i = 1; i <= count; i++) {
      final left = (i - 1) * (w + gap);
      final seg = Rect.fromLTWH(left, 0, w, size.height);
      canvas.drawRRect(RRect.fromRectAndRadius(seg, r), Paint()..color = i < card ? seen : track);
      if (i == card) {
        final f = fill.value.clamp(0.0, 1.0);
        if (f > 0) canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(left, 0, w * f, size.height), r), Paint()..color = current);
      }
    }
  }

  @override
  bool shouldRepaint(_SegmentsPainter old) =>
      old.card != card || old.count != count || old.fill != fill || old.current != current || old.seen != seen || old.track != track;
}
