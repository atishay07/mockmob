import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The top of every recap card: one segment per card showing where you are (position, not a
/// timer and not progress toward a reward), and "Skip" (to the full result) on the right. When a card
/// arrives its segment is drawn in left to right once (420 ms, emphasized), the way a page is
/// turned to; cards already seen stay quietly filled.
class StoryBar extends StatefulWidget {
  const StoryBar({super.key, required this.card, required this.count, required this.onSkip, this.onBack, this.titles = const [], this.onJump});

  /// 1-based.
  final int card;
  final int count;
  final VoidCallback onSkip;

  /// The previous card; given on cards 2 to 4 (the chevron is the visible way back, besides the
  /// swipe). System back still goes to the full result.
  final VoidCallback? onBack;

  /// The name of each card, in order, for "Card 2 of 4: Where the marks went". Empty names the
  /// position only.
  final List<String> titles;

  /// A segment was tapped: the 0-based position in the recap's order. Null makes the bar a plain
  /// indicator.
  final ValueChanged<int>? onJump;

  /// Each segment is a tap target this tall (and as wide as its share of the bar, which the short
  /// "Skip" key keeps at 48 dp or more on a phone), the 48 dp minimum, though only 3 dp of it is
  /// drawn.
  static const double target = MmTarget.min;

  @override
  State<StoryBar> createState() => _StoryBarState();
}

class _StoryBarState extends State<StoryBar> with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(vsync: this, duration: Motion.emphasizedDuration);
  late final Animation<double> _curve = CurvedAnimation(parent: _fill, curve: Motion.emphasized);
  bool _started = false;
  int? _pressed;

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

  Widget _segmentTarget(int i) {
    final titles = widget.titles;
    final label = i < titles.length ? ResultCopy.cardNamed(i + 1, widget.count, titles[i]) : ResultCopy.cardOf(i + 1, widget.count);
    final jump = widget.onJump;
    return Semantics(
      button: jump != null,
      selected: i + 1 == widget.card,
      label: label,
      excludeSemantics: true,
      onTap: jump == null ? null : () => jump(i),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: jump == null ? null : (_) => setState(() => _pressed = i),
        onTapUp: jump == null ? null : (_) => setState(() => _pressed = null),
        onTapCancel: jump == null ? null : () => setState(() => _pressed = null),
        onTap: jump == null ? null : () => jump(i),
        child: const SizedBox(height: StoryBar.target),
      ),
    );
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
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Only the thin bar is drawn; the targets above it carry the taps and the words.
                  ExcludeSemantics(
                    child: RepaintBoundary(
                      child: SizedBox(
                        height: 5,
                        child: CustomPaint(
                          size: const Size.fromHeight(5),
                          painter: _SegmentsPainter(
                            card: widget.card,
                            count: widget.count,
                            fill: _curve,
                            current: colors.ink,
                            seen: colors.ink3,
                            track: colors.lineStrong,
                            pressed: _pressed,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < widget.count; i++) ...[
                        if (i > 0) const SizedBox(width: _SegmentsPainter.gap),
                        Expanded(child: _segmentTarget(i)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            // "Skip" is all the bar has room for beside four 48 dp segments; TalkBack hears where it goes.
            KeyButton.quiet(label: ResultCopy.skipShort, semanticsLabel: ResultCopy.skip, onPressed: widget.onSkip),
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
    this.pressed,
  }) : super(repaint: fill);

  final int card;
  final int count;
  final Animation<double> fill;
  final Color current;
  final Color seen;
  final Color track;

  /// The 0-based segment under the finger: it thickens from 3 dp to 5 dp.
  final int? pressed;

  static const double gap = 4;

  @override
  void paint(Canvas canvas, Size size) {
    if (count <= 0) return;
    final w = (size.width - gap * (count - 1)) / count;
    const r = Radius.circular(2);
    for (var i = 1; i <= count; i++) {
      final left = (i - 1) * (w + gap);
      final thick = pressed == i - 1;
      final h = thick ? size.height : 3.0;
      final top = (size.height - h) / 2;
      final seg = Rect.fromLTWH(left, top, w, h);
      canvas.drawRRect(RRect.fromRectAndRadius(seg, r), Paint()..color = i < card ? seen : track);
      if (i == card) {
        final f = fill.value.clamp(0.0, 1.0);
        if (f > 0) canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(left, top, w * f, h), r), Paint()..color = current);
      }
    }
  }

  @override
  bool shouldRepaint(_SegmentsPainter old) =>
      old.card != card || old.count != count || old.fill != fill || old.pressed != pressed || old.current != current || old.seen != seen || old.track != track;
}
