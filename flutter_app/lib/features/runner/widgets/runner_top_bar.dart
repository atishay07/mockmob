import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'drain_bar.dart';
import 'runner_controls.dart';
import 'runner_count.dart';

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
                  child: RunnerCount(
                    current: current,
                    total: total,
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

  /// Under this the timer takes the warning colour and its drain bar (five minutes).
  static const int lowSeconds = 5 * 60;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return RepaintBoundary(
      child: ValueListenableBuilder<Duration>(
        valueListenable: remaining,
        builder: (context, left, _) {
          final low = left.inSeconds <= RunnerTimer.lowSeconds;
          final text = Text(formatTimer(left), style: style.copyWith(color: low ? colors.warnText : colors.ink));
          return Semantics(
            label: RunnerCopy.timerSemantics(left),
            excludeSemantics: true,
            // The last five minutes are a span of known length, so a thin bar under the digits
            // drains across exactly that span. It hangs below the text and takes no room.
            child: !low
                ? text
                : Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      text,
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: -5,
                        height: 3,
                        child: DrainBar(
                          fraction: left.inSeconds / RunnerTimer.lowSeconds,
                          track: colors.line,
                          fill: left.inSeconds <= 60 ? colors.badText : colors.warnText,
                        ),
                      ),
                    ],
                  ),
          );
        },
      ),
    );
  }
}
