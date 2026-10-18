import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'mobi_controller.dart';

/// Which way the bubble's tail points (toward Mobi).
/// Where the bubble's tail points: down at Mobi below it, up at Mobi above it, or sideways at Mobi
/// beside it.
enum MobiTail { down, up, left, right }

/// Mobi's speech bubble. The line types in character by character (laid out in full from the
/// start, so nothing reflows), the bubble grows out of its tail, and TalkBack reads the whole
/// line once. Under reduced motion the line is simply there.
class MobiBubble extends StatefulWidget {
  const MobiBubble({super.key, required this.speech, this.tail = MobiTail.down, this.maxWidth = 260, this.delay = 0.18, this.boxed = true, this.tailInset, this.large = false});

  final MobiSpeech speech;
  final MobiTail tail;
  final double maxWidth;

  /// Seconds before typing starts (lets the bubble land first).
  final double delay;

  /// Draw the card (fill, edge, tail and a soft shadow). When false the line sits on the screen
  /// as plain text with no box, for threads (Ask) where a card per line is too heavy.
  final bool boxed;

  /// For [MobiTail.up] and [MobiTail.down]: how far the tail's tip sits from the bubble's right
  /// edge, so it can point at a Mobi who is not centred under the bubble. Null centres it.
  final double? tailInset;

  /// One type step up (17/23 in place of 15/20): for a tall phone where the bubble has the
  /// content width and the line should read at arm's length (onboarding, D44).
  final bool large;

  @override
  State<MobiBubble> createState() => _MobiBubbleState();
}

class _MobiBubbleState extends State<MobiBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  late List<double> _schedule;
  bool _reduced = false;
  bool _begun = false;

  @override
  void initState() {
    super.initState();
    _schedule = MobiTyping.schedule(widget.speech.text);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = Motion.reduced(context);
    // Only the first build starts the line. A later change of the theme, the text scale or the
    // keyboard insets must never retype a line the student has already read.
    if (_begun && reduced == _reduced) return;
    _reduced = reduced;
    if (!_begun) {
      _begun = true;
      _start();
    } else if (reduced) {
      _c.stop();
      _c.value = 1;
    }
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
    final style = widget.large
        ? type.labelLarge.copyWith(fontSize: 17, height: 23 / 17, color: colors.ink)
        : type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, color: colors.ink);
    final text = widget.speech.text;
    final pad = !widget.boxed
        ? EdgeInsets.zero
        : switch (widget.tail) {
            MobiTail.down => const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12 + _BubblePainter.tailSize),
            MobiTail.up => const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12 + _BubblePainter.tailSize, MmSpace.s16, MmSpace.s12),
            MobiTail.left => const EdgeInsets.fromLTRB(MmSpace.s16 + _BubblePainter.tailSize, MmSpace.s12, MmSpace.s16, MmSpace.s12),
            MobiTail.right => const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16 + _BubblePainter.tailSize, MmSpace.s12),
          };

    final bubble = AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final seconds = _c.value * _total;
        // Once the line has finished typing, show all of it: float error in the
        // schedule must never drop the last character (often the full stop).
        final n = _c.value >= 1.0 ? text.length : _visible(seconds).clamp(0, text.length);
        final land = _reduced ? 1.0 : Motion.emphasized.transform((seconds / 0.26).clamp(0.0, 1.0));
        final line = Text.rich(
          TextSpan(
            children: [
              TextSpan(text: text.substring(0, n)),
              TextSpan(
                text: text.substring(n),
                style: const TextStyle(color: Color(0x00000000)),
              ),
            ],
          ),
          style: style,
        );
        return Opacity(
          opacity: land,
          child: Transform.scale(
            scale: 0.86 + 0.14 * land,
            alignment: switch (widget.tail) {
              MobiTail.down => Alignment.bottomCenter,
              MobiTail.up => Alignment.topRight,
              MobiTail.left => Alignment.centerLeft,
              MobiTail.right => Alignment.centerRight,
            },
            child: widget.boxed
                ? CustomPaint(
                    painter: _BubblePainter(
                      fill: colors.isNight ? colors.raised2 : colors.raised,
                      edge: colors.lineStrong.withValues(alpha: colors.isNight ? 0.7 : 0.55),
                      lamp: colors.isNight ? colors.lamp.withValues(alpha: 0.35) : const Color(0x00000000),
                      shadow: colors.isNight ? const Color(0x4D000000) : const Color(0x1A3B2A12),
                      tail: widget.tail,
                      tailInset: widget.tailInset,
                    ),
                    child: Padding(padding: pad, child: line),
                  )
                : line,
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
  const _BubblePainter({required this.fill, required this.edge, required this.lamp, required this.shadow, required this.tail, this.tailInset});

  static const double tailSize = 9;
  final Color fill;
  final Color edge;
  final Color lamp;
  final Color shadow;
  final MobiTail tail;
  final double? tailInset;

  Path _shape(Size size) {
    const r = Radius.circular(18);
    final vertical = tail == MobiTail.down || tail == MobiTail.up;
    final body = switch (tail) {
      MobiTail.down => Rect.fromLTWH(0, 0, size.width, size.height - _BubblePainter.tailSize),
      MobiTail.up => Rect.fromLTWH(0, _BubblePainter.tailSize, size.width, size.height - _BubblePainter.tailSize),
      MobiTail.left => Rect.fromLTWH(_BubblePainter.tailSize, 0, size.width - _BubblePainter.tailSize, size.height),
      MobiTail.right => Rect.fromLTWH(0, 0, size.width - _BubblePainter.tailSize, size.height),
    };
    final path = Path()..addRRect(RRect.fromRectAndRadius(body, r));
    final tip = Path();
    if (vertical) {
      final x = tailInset == null ? size.width / 2 : (size.width - tailInset!).clamp(20.0, size.width - 20);
      if (tail == MobiTail.up) {
        tip
          ..moveTo(x - 9, body.top + 1)
          ..quadraticBezierTo(x - 2, body.top - 2, x - 1, 0)
          ..quadraticBezierTo(x + 3, body.top - 3, x + 10, body.top + 1)
          ..close();
      } else {
        tip
          ..moveTo(x - 9, body.bottom - 1)
          ..quadraticBezierTo(x - 2, body.bottom + 2, x - 1, size.height)
          ..quadraticBezierTo(x + 3, body.bottom + 3, x + 10, body.bottom - 1)
          ..close();
      }
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
    // A soft, low shadow: felt more than seen.
    canvas.drawPath(
      shape.shift(const Offset(0, 2)),
      Paint()
        ..color = shadow
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawPath(shape, Paint()..color = fill);
    // A sheen across the upper half, like light on a glass edge.
    canvas.drawPath(
      shape,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.center,
          colors: [const Color(0xFFFFFFFF).withValues(alpha: 0.06), const Color(0x00FFFFFF)],
        ).createShader(Offset.zero & size),
    );
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
  bool shouldRepaint(_BubblePainter old) =>
      old.fill != fill || old.edge != edge || old.tail != tail || old.tailInset != tailInset || old.lamp != lamp || old.shadow != shadow;
}
