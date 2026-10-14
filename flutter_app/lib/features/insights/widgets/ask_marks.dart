import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// Three answer bubbles inking in turn: Mobi is working on a reply. Loops while it is on screen
/// and [looping]; under reduced motion, or once [looping] is false or [settleAfter] has passed
/// (the wait has run long and the words say so), the three sit half inked.
class InkDots extends StatefulWidget {
  const InkDots({super.key, this.size = 12, this.looping = true, this.settleAfter});

  final double size;
  final bool looping;

  /// Stops the loop this long after the dots appear. Null loops until removed.
  final Duration? settleAfter;

  @override
  State<InkDots> createState() => _InkDotsState();
}

class _InkDotsState extends State<InkDots> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));
  bool _reduced = false;
  bool _settled = false;
  Timer? _patience;

  @override
  void initState() {
    super.initState();
    final after = widget.settleAfter;
    if (after != null) {
      _patience = Timer(after, () {
        if (!mounted) return;
        setState(() => _settled = true);
        _sync();
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = Motion.reduced(context);
    _sync();
  }

  @override
  void didUpdateWidget(InkDots old) {
    super.didUpdateWidget(old);
    if (old.looping != widget.looping) _sync();
  }

  void _sync() {
    if (_reduced || !widget.looping || _settled) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _patience?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final size = widget.size;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox(
          width: size * 3 + MmSpace.s8 * 2,
          height: size,
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) => CustomPaint(painter: _InkDotsPainter(colors: colors, t: _reduced || !widget.looping || _settled ? 0.5 : _c.value)),
          ),
        ),
      ),
    );
  }
}

class _InkDotsPainter extends CustomPainter {
  const _InkDotsPainter({required this.colors, required this.t});

  final MmColors colors;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = BubblePaint(colors);
    final r = size.height / 2;
    for (var i = 0; i < 3; i++) {
      final c = Offset(r + i * (size.height + MmSpace.s8), r);
      // Each bubble inks over the first half of its slot, holds, then the sheet resets together.
      final start = i * 0.18;
      final fill = ((t - start) / 0.28).clamp(0.0, 1.0);
      final out = t > 0.86 ? ((1 - t) / 0.14).clamp(0.0, 1.0) : 1.0;
      paint.paint(canvas, c, r, fill > 0 ? BubbleState.filled : BubbleState.hollow, fill: Curves.easeOut.transform(fill), dim: out);
      if (fill == 0 || out < 1) {
        // A resetting bubble shows its ring.
        paint.paint(canvas, c, r, BubbleState.hollow, dim: 1 - out);
      }
    }
  }

  @override
  bool shouldRepaint(_InkDotsPainter old) => old.t != t || old.colors != colors;
}
