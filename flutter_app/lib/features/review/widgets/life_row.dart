import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';

/// The life of one mistake as four bubbles on a thread: Found, Repaired, Checked, Holds
/// (directions A.4). Found is the wrong bubble; Repaired inks when the server acknowledged a
/// repair; Checked and Holds stay dashed while fresh checks are not available. When [stage]
/// changes to repaired, the Repaired bubble inks from its left, as if the thread carried it.
class LifeRow extends StatelessWidget {
  const LifeRow({super.key, required this.stage, this.bubbleSize = 18, this.showLabels = true, this.animate = true});

  final MistakeStage stage;
  final double bubbleSize;
  final bool showLabels;
  final bool animate;

  static const _labels = [ReviewCopy.found, ReviewCopy.repaired, ReviewCopy.checked, ReviewCopy.holds];

  List<BubbleState> get _states => [
    BubbleState.wrong,
    // A key review is not a repair: Repaired stays open until the server acknowledges one.
    stage == MistakeStage.repaired ? BubbleState.filled : BubbleState.hollow,
    BubbleState.blank,
    BubbleState.blank,
  ];

  String get _semantics {
    final repaired = switch (stage) {
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
    final states = _states;
    return Semantics(
      container: true,
      label: _semantics,
      excludeSemantics: true,
      child: CustomPaint(
        painter: _ThreadPainter(
          bubble: bubbleSize,
          reached: stage == MistakeStage.repaired ? 1 : 0,
          solid: colors.ink3,
          faint: colors.line,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < 4; i++)
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Bubble(state: states[i], size: bubbleSize, animate: animate, inkOrigin: const Offset(-1, 0)),
                    if (showLabels) ...[
                      const SizedBox(height: 6),
                      Text(
                        _labels[i],
                        style: type.caption.copyWith(color: i <= 1 ? colors.ink2 : colors.ink3),
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

/// Hairlines between the bubble centres: solid up to the last stage reached, dashed after.
class _ThreadPainter extends CustomPainter {
  const _ThreadPainter({required this.bubble, required this.reached, required this.solid, required this.faint});

  final double bubble;

  /// Index of the last segment drawn solid (0: Found to Repaired solid only after repair).
  final int reached;
  final Color solid;
  final Color faint;

  @override
  void paint(Canvas canvas, Size size) {
    final col = size.width / 4;
    final y = bubble / 2;
    for (var i = 0; i < 3; i++) {
      final from = Offset(col * i + col / 2 + bubble / 2 + 4, y);
      final to = Offset(col * (i + 1) + col / 2 - bubble / 2 - 4, y);
      if (to.dx <= from.dx) continue;
      final done = i < reached;
      final paint = Paint()
        ..color = done ? solid : faint
        ..strokeWidth = done ? 1.5 : 1.2
        ..strokeCap = StrokeCap.round;
      if (done) {
        canvas.drawLine(from, to, paint);
      } else {
        const dash = 3.0, gap = 4.0;
        var x = from.dx;
        while (x < to.dx) {
          canvas.drawLine(Offset(x, y), Offset((x + dash).clamp(from.dx, to.dx), y), paint);
          x += dash + gap;
        }
      }
    }
  }

  @override
  bool shouldRepaint(_ThreadPainter old) => old.bubble != bubble || old.reached != reached || old.solid != solid || old.faint != faint;
}
