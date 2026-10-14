import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// The measured time of the warm-up on a line from nothing to two minutes, with a tick at exam
/// pace (about a minute a question). The mark travels out to the student's time once, on the
/// glide (500 ms, the number roll's length), and the line behind it inks as it goes. Under
/// reduced motion it is drawn where it lands. Its meaning is read out by the caller.
class PaceLine extends StatefulWidget {
  const PaceLine({super.key, required this.seconds});

  final double seconds;

  /// The line's far end, and exam pace on it.
  static const double span = 120;
  static const double pace = 60;

  @override
  State<PaceLine> createState() => _PaceLineState();
}

class _PaceLineState extends State<PaceLine> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: Motion.numberRoll);
  late final Animation<double> _eased = CurvedAnimation(parent: _t, curve: Motion.glide);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _t.value = 1;
    } else {
      _t.forward();
    }
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final at = (widget.seconds / PaceLine.span).clamp(0.0, 1.0);
    final tickLabel = Text(OnboardingCopy.examPace, maxLines: 1, style: type.caption.copyWith(color: colors.ink3));
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          RepaintBoundary(
            child: CustomPaint(
              size: const Size(double.infinity, 18),
              painter: _PacePainter(
                progress: _eased,
                at: at,
                tick: PaceLine.pace / PaceLine.span,
                track: colors.lineStrong,
                ink: colors.accentText,
                mark: colors.volt,
                markRim: colors.isNight ? colors.ground : colors.ink,
                tickColor: colors.ink3,
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          // The tick's words sit under the tick, centred on it.
          Align(alignment: Alignment((PaceLine.pace / PaceLine.span) * 2 - 1, 0), child: tickLabel),
        ],
      ),
    );
  }
}

class _PacePainter extends CustomPainter {
  _PacePainter({
    required this.progress,
    required this.at,
    required this.tick,
    required this.track,
    required this.ink,
    required this.mark,
    required this.markRim,
    required this.tickColor,
  }) : super(repaint: progress);

  final Animation<double> progress;
  final double at;
  final double tick;
  final Color track;
  final Color ink;
  final Color mark;
  final Color markRim;
  final Color tickColor;

  static const double _r = 7;

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height / 2;
    final left = _r;
    final right = size.width - _r;
    final w = right - left;
    final line = Paint()
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(left, y), Offset(right, y), line..color = track);
    final tx = left + w * tick;
    canvas.drawLine(Offset(tx, y - 7), Offset(tx, y + 7), Paint()
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..color = tickColor);
    final x = left + w * at * progress.value;
    canvas.drawLine(Offset(left, y), Offset(x, y), line..color = ink);
    canvas.drawCircle(Offset(x, y), _r + 1.5, Paint()..color = markRim);
    canvas.drawCircle(Offset(x, y), _r, Paint()..color = mark);
  }

  @override
  bool shouldRepaint(_PacePainter old) =>
      old.at != at || old.tick != tick || old.track != track || old.ink != ink || old.mark != mark || old.progress != progress;
}
