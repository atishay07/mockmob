import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'mobi_controller.dart';

/// Which way the bubble's tail points (toward Mobi).
/// Where the bubble's tail points: down at Mobi below it, or sideways at Mobi beside it.
enum MobiTail { down, left, right }

/// Mobi's speech bubble. The line types in character by character (laid out in full from the
/// start, so nothing reflows), the bubble grows out of its tail, and TalkBack reads the whole
/// line once. Under reduced motion the line is simply there.
class MobiBubble extends StatefulWidget {
  const MobiBubble({super.key, required this.speech, this.tail = MobiTail.down, this.maxWidth = 260, this.delay = 0.18});

  final MobiSpeech speech;
  final MobiTail tail;
  final double maxWidth;

  /// Seconds before typing starts (lets the bubble land first).
  final double delay;

  @override
  State<MobiBubble> createState() => _MobiBubbleState();
}

class _MobiBubbleState extends State<MobiBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  late List<double> _schedule;
  bool _reduced = false;

  @override
  void initState() {
    super.initState();
    _schedule = MobiTyping.schedule(widget.speech.text);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = Motion.reduced(context);
    _start();
  }

  @override
  void didUpdateWidget(MobiBubble old) {
    super.didUpdateWidget(old);
    if (old.speech.id != widget.speech.id) {
      _schedule = MobiTyping.schedule(widget.speech.text);
      _start();
    }
  }

  double get _total => widget.delay + (_schedule.isEmpty ? 0 : _schedule.last);

  void _start() {
    if (_reduced) {
      _c.value = 1;
      return;
    }
    _c.duration = Duration(microseconds: (_total * 1e6).round().clamp(1, 1 << 40));
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  int _visible(double seconds) {
    final t = seconds - widget.delay;
    var n = 0;
    while (n < _schedule.length && _schedule[n] <= t) {
      n++;
    }
    return n;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, color: colors.ink);
    final text = widget.speech.text;
    final pad = switch (widget.tail) {
      MobiTail.down => const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12 + _BubblePainter.tailSize),
      MobiTail.left => const EdgeInsets.fromLTRB(MmSpace.s16 + _BubblePainter.tailSize, MmSpace.s12, MmSpace.s16, MmSpace.s12),
      MobiTail.right => const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16 + _BubblePainter.tailSize, MmSpace.s12),
    };

    final bubble = AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final seconds = _c.value * _total;
        final n = _visible(seconds);
        final land = _reduced ? 1.0 : Motion.emphasized.transform((seconds / 0.26).clamp(0.0, 1.0));
        return Opacity(
          opacity: land,
          child: Transform.scale(
            scale: 0.86 + 0.14 * land,
            alignment: switch (widget.tail) {
              MobiTail.down => Alignment.bottomCenter,
              MobiTail.left => Alignment.centerLeft,
              MobiTail.right => Alignment.centerRight,
            },
            child: CustomPaint(
              painter: _BubblePainter(
                fill: colors.isNight ? colors.raised2 : colors.raised,
                edge: colors.lineStrong.withValues(alpha: colors.isNight ? 0.7 : 0.55),
                lamp: colors.isNight ? colors.lamp.withValues(alpha: 0.35) : const Color(0x00000000),
                tail: widget.tail,
              ),
              child: Padding(
                padding: pad,
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: text.substring(0, n)),
                    TextSpan(text: text.substring(n), style: const TextStyle(color: Color(0x00000000))),
                  ]),
                  style: style,
                ),
              ),
            ),
          ),
        );
      },
    );

    return Semantics(
      container: true,
      liveRegion: widget.speech.live,
      label: text,
      child: ExcludeSemantics(
        child: ConstrainedBox(constraints: BoxConstraints(maxWidth: widget.maxWidth), child: RepaintBoundary(child: bubble)),
      ),
    );
  }
}

class _BubblePainter extends CustomPainter {
  const _BubblePainter({required this.fill, required this.edge, required this.lamp, required this.tail});

  static const double tailSize = 9;
  final Color fill;
  final Color edge;
  final Color lamp;
  final MobiTail tail;

  Path _shape(Size size) {
    const r = Radius.circular(18);
    final down = tail == MobiTail.down;
    final body = switch (tail) {
      MobiTail.down => Rect.fromLTWH(0, 0, size.width, size.height - _BubblePainter.tailSize),
      MobiTail.left => Rect.fromLTWH(_BubblePainter.tailSize, 0, size.width - _BubblePainter.tailSize, size.height),
      MobiTail.right => Rect.fromLTWH(0, 0, size.width - _BubblePainter.tailSize, size.height),
    };
    final path = Path()..addRRect(RRect.fromRectAndRadius(body, r));
    final tip = Path();
    if (down) {
      final x = size.width / 2;
      tip
        ..moveTo(x - 9, body.bottom - 1)
        ..quadraticBezierTo(x - 2, body.bottom + 2, x - 1, size.height)
        ..quadraticBezierTo(x + 3, body.bottom + 3, x + 10, body.bottom - 1)
        ..close();
    } else if (tail == MobiTail.right) {
      const y = 22.0;
      tip
        ..moveTo(body.right - 1, y - 8)
        ..quadraticBezierTo(body.right + 2, y - 1, size.width, y + 2)
        ..quadraticBezierTo(body.right + 2, y + 4, body.right - 1, y + 9)
        ..close();
    } else {
      const y = 22.0;
      tip
        ..moveTo(body.left + 1, y - 8)
        ..quadraticBezierTo(body.left - 2, y - 1, 0, y + 2)
        ..quadraticBezierTo(body.left - 2, y + 4, body.left + 1, y + 9)
        ..close();
    }
    return Path.combine(PathOperation.union, path, tip);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final shape = _shape(size);
    canvas.drawShadow(shape, const Color(0xFF000000), 6, false);
    canvas.drawPath(shape, Paint()..color = fill);
    canvas.drawPath(
      shape,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color.alphaBlend(lamp, edge), edge.withValues(alpha: edge.a * 0.5)],
        ).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_BubblePainter old) => old.fill != fill || old.edge != edge || old.tail != tail || old.lamp != lamp;
}
