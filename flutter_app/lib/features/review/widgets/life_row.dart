import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';

/// The life of one mistake as four bubbles on a thread: Found, Repaired, Checked, Holds
/// (directions A.4). Found is the wrong bubble; Repaired inks when the server acknowledged a
/// repair; Checked and Holds stay dashed while fresh checks are not available.
///
/// When [stage] changes to repaired (and [animate] is on) the stage completes in view: the line
/// from Found draws in volt over 420 ms on the emphasized curve, and as it arrives the Repaired
/// bubble inks from its left, as if the thread had carried the ink. Under reduced motion, or when
/// the widget first appears already repaired, it shows the finished thread at once.
class LifeRow extends StatefulWidget {
  const LifeRow({super.key, required this.stage, this.bubbleSize = 18, this.showLabels = true, this.animate = true});

  final MistakeStage stage;
  final double bubbleSize;
  final bool showLabels;
  final bool animate;

  static const _labels = [ReviewCopy.found, ReviewCopy.repaired, ReviewCopy.checked, ReviewCopy.holds];

  @override
  State<LifeRow> createState() => _LifeRowState();
}

class _LifeRowState extends State<LifeRow> with SingleTickerProviderStateMixin {
  static const Duration _draw = Duration(milliseconds: 420);

  late final AnimationController _thread = AnimationController(vsync: this, duration: _draw, value: _repaired ? 1 : 0);
  late final CurvedAnimation _curve = CurvedAnimation(parent: _thread, curve: Motion.emphasized);

  /// Whether the Repaired bubble shows as inked: it follows the line, so the ink arrives with it.
  late bool _inked = _repaired;

  bool get _repaired => widget.stage == MistakeStage.repaired;

  @override
  void initState() {
    super.initState();
    _thread.addListener(_followLine);
  }

  void _followLine() {
    if (_repaired && !_inked && _thread.value >= 0.72) setState(() => _inked = true);
  }

  @override
  void didUpdateWidget(LifeRow old) {
    super.didUpdateWidget(old);
    if (widget.stage == old.stage) return;
    if (_repaired) {
      if (widget.animate && !Motion.reduced(context)) {
        _thread.forward(from: 0);
      } else {
        _thread.value = 1;
        _inked = true;
      }
    } else {
      _thread.value = 0;
      _inked = false;
    }
  }

  @override
  void dispose() {
    _curve.dispose();
    _thread.dispose();
    super.dispose();
  }

  String get _semantics {
    final repaired = switch (widget.stage) {
      MistakeStage.repaired => 'repaired',
      MistakeStage.reviewed => 'reviewed, not repaired yet',
      MistakeStage.setAside => 'set aside while the key is checked',
      MistakeStage.found => 'not repaired yet',
    };
    return 'Found, $repaired. Checked and holds: not available yet.';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final size = widget.bubbleSize;
    final states = [BubbleState.wrong, _inked ? BubbleState.filled : BubbleState.hollow, BubbleState.blank, BubbleState.blank];
    return Semantics(
      container: true,
      label: _semantics,
      excludeSemantics: true,
      child: CustomPaint(
        painter: _ThreadPainter(
          bubble: size,
          progress: _curve,
          dashed: colors.line,
          done: colors.isNight ? colors.volt : colors.accentText,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < 4; i++)
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Bubble(state: states[i], size: size, animate: widget.animate, inkOrigin: const Offset(-1, 0)),
                    if (widget.showLabels) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(
                        LifeRow._labels[i],
                        style: type.caption.copyWith(
                          color: i == 0 || (i == 1 && _inked) ? colors.ink : colors.ink3,
                          fontWeight: i == 0 || (i == 1 && _inked) ? FontWeight.w600 : FontWeight.w500,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Hairlines between the bubble centres. Found to Repaired is a dashed hairline that a volt line
/// draws over as [progress] runs 0 to 1; the segments to Checked and Holds stay dashed.
class _ThreadPainter extends CustomPainter {
  _ThreadPainter({required this.bubble, required this.progress, required this.dashed, required this.done}) : super(repaint: progress);

  final double bubble;
  final Animation<double> progress;
  final Color dashed;
  final Color done;

  @override
  void paint(Canvas canvas, Size size) {
    final col = size.width / 4;
    final y = bubble / 2;
    final faint = Paint()
      ..color = dashed
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 3; i++) {
      final from = Offset(col * i + col / 2 + bubble / 2 + 4, y);
      final to = Offset(col * (i + 1) + col / 2 - bubble / 2 - 4, y);
      if (to.dx <= from.dx) continue;
      final p = i == 0 ? progress.value.clamp(0.0, 1.0) : 0.0;
      // The dashes the line has not reached yet.
      const dash = 3.0, gap = 4.0;
      final reachedX = from.dx + (to.dx - from.dx) * p;
      var x = from.dx;
      while (x < to.dx) {
        final end = (x + dash).clamp(from.dx, to.dx);
        if (end > reachedX) canvas.drawLine(Offset(x.clamp(reachedX, to.dx), y), Offset(end, y), faint);
        x += dash + gap;
      }
      if (p > 0) {
        canvas.drawLine(
          from,
          Offset(reachedX, y),
          Paint()
            ..color = done
            ..strokeWidth = 2
            ..strokeCap = StrokeCap.round,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_ThreadPainter old) => old.bubble != bubble || old.progress != progress || old.dashed != dashed || old.done != done;
}
