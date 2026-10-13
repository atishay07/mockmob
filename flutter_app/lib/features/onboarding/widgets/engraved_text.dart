import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// Text that engraves itself left to right when it first appears or changes (brief section 7:
/// a 280 ms mask reveal). Animates a clip width, never a shader mask. Reduced motion shows it
/// at once. [delay] staggers lines on the plan.
class EngravedText extends StatefulWidget {
  const EngravedText(this.text, {super.key, required this.style, this.delay = Duration.zero, this.maxLines, this.animate = true});

  final String text;
  final TextStyle style;
  final Duration delay;
  final int? maxLines;

  /// False draws it settled (goldens of a finished sheet, a return visit).
  final bool animate;

  @override
  State<EngravedText> createState() => _EngravedTextState();
}

class _EngravedTextState extends State<EngravedText> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: Motion.engrave);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _play();
  }

  @override
  void didUpdateWidget(EngravedText old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) _play();
  }

  void _play() {
    if (!widget.animate || Motion.reduced(context)) {
      _t.value = 1;
      return;
    }
    // The delay is part of the controller's run (no timers), then the 280 ms engrave.
    _t.duration = widget.delay + Motion.engrave;
    _t.forward(from: 0);
  }

  double get _progress {
    final total = _t.duration!.inMicroseconds;
    final wait = widget.delay.inMicroseconds / (total == 0 ? 1 : total);
    if (wait >= 1) return _t.value >= 1 ? 1 : 0;
    return ((_t.value - wait) / (1 - wait)).clamp(0.0, 1.0);
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Text(widget.text, style: widget.style, maxLines: widget.maxLines, overflow: widget.maxLines == null ? null : TextOverflow.ellipsis);
    return Semantics(
      label: widget.text,
      excludeSemantics: true,
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: _t,
          child: text,
          builder: (context, child) {
            final v = _t.value >= 1 ? 1.0 : Motion.glide.transform(_progress);
            if (v >= 1) return child!;
            return Opacity(
              opacity: (v * 1.6).clamp(0.0, 1.0),
              child: ClipRect(clipper: _Reveal(v), child: child),
            );
          },
        ),
      ),
    );
  }
}

/// Clips to the left [fraction] of the box, so the layout never changes while it reveals.
class _Reveal extends CustomClipper<Rect> {
  const _Reveal(this.fraction);

  final double fraction;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(-2, -4, (size.width + 4) * fraction, size.height + 8);

  @override
  bool shouldReclip(_Reveal old) => old.fraction != fraction;
}
