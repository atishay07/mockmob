import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'runner_controls.dart';

/// The runner's top bar (spec 5.5): leave, "12 of 50", the timer and the Questions key. The
/// count and the timer are the only condensed type on the screen; neither moves.
class RunnerTopBar extends StatelessWidget {
  const RunnerTopBar({
    super.key,
    required this.current,
    required this.total,
    required this.isMock,
    required this.remaining,
    required this.onLeave,
    required this.onQuestions,
  });

  /// One-based.
  final int current;
  final int total;
  final bool isMock;

  /// Null hides the timer (the practice skin).
  final ValueListenable<Duration>? remaining;
  final VoidCallback onLeave;
  final VoidCallback onQuestions;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final figure = type.figureCompact.copyWith(fontSize: 30, height: 1);
    // Chrome, like the dock: text grows to 1.3x here, the question below grows fully.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: SizedBox(
        height: 60,
        child: Row(
          children: [
            RoundIconKey(icon: LucideIcons.x, semanticsLabel: RunnerCopy.leaveSemantics(isMock), onTap: onLeave),
            const SizedBox(width: MmSpace.s12),
            // On a narrow phone with large text the count gives way first; it never pushes the
            // timer or the Questions key off the bar.
            Expanded(
              child: Align(
                alignment: Alignment.centerLeft,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: MonumentalNumber(
                    value: '$current',
                    unit: 'of $total',
                    roll: false,
                    style: figure,
                    unitColor: colors.ink3,
                    semanticsLabel: RunnerCopy.countSemantics(current, total),
                  ),
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            if (remaining != null) ...[RunnerTimer(remaining: remaining!, style: figure), const SizedBox(width: MmSpace.s12)],
            SheetKey(onTap: onQuestions),
          ],
        ),
      ),
    );
  }
}

/// The clock: one Text repainted once a second inside its own boundary, so nothing else
/// rebuilds. Under five minutes it takes the warning colour; the words come from the banner.
class RunnerTimer extends StatelessWidget {
  const RunnerTimer({super.key, required this.remaining, required this.style});

  final ValueListenable<Duration> remaining;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return RepaintBoundary(
      child: ValueListenableBuilder<Duration>(
        valueListenable: remaining,
        builder: (context, left, _) {
          final low = left.inSeconds <= 5 * 60;
          return Semantics(
            label: RunnerCopy.timerSemantics(left),
            excludeSemantics: true,
            child: Text(
              formatTimer(left),
              style: style.copyWith(color: low ? colors.warnText : colors.ink),
              textScaler: TextScaler.noScaling,
            ),
          );
        },
      ),
    );
  }
}
