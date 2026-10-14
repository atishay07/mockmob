import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'runner_controls.dart';
import 'runner_count.dart';

/// The runner's top bar (spec 5.5): leave, "12 of 50", the timer and the Questions key. The
/// count and the timer are the only condensed type on the screen; neither moves, and both grow
/// with the same text scale (chrome: up to 1.3x), so neither ever shrinks against the other.
///
/// In a mock the timer sits in the middle of the bar, in a slot of its own with equal room on
/// either side. From [compactScale] (or on a phone too narrow for the labelled key) the Questions
/// key gives up its word and keeps the sheet glyph, so the count and the timer keep their size.
class RunnerTopBar extends StatelessWidget {
  const RunnerTopBar({
    super.key,
    required this.current,
    required this.total,
    required this.isMock,
    required this.remaining,
    this.openUntil,
    required this.onLeave,
    required this.onQuestions,
  });

  /// One-based.
  final int current;
  final int total;
  final bool isMock;

  /// Null hides the timer (the practice skin).
  final ValueListenable<Duration>? remaining;

  /// "Open until 11:42 PM": the one fact a practice has instead of a clock, quiet text in the slot
  /// the mock's timer has. Null in a mock.
  final String? openUntil;
  final VoidCallback onLeave;
  final VoidCallback onQuestions;

  /// From this text scale the Questions key is the glyph alone.
  static const double compactScale = 1.1;

  /// Below this bar width (a phone under about 340 dp) the timer's middle slot leaves too little
  /// room either side for the labelled key.
  static const double narrowWidth = 312;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final figure = type.figureCompact.copyWith(fontSize: 30, height: 1);
    // Chrome, like the dock: text grows to 1.3x here, the question below grows fully.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: LayoutBuilder(
        builder: (context, box) {
          final scale = MediaQuery.textScalerOf(context).scale(1);
          final timed = remaining != null;
          final compact = scale >= compactScale || ((timed || openUntil != null) && box.maxWidth < narrowWidth);
          final leave = RoundIconKey(icon: LucideIcons.x, semanticsLabel: RunnerCopy.leaveSemantics(isMock), onTap: onLeave);
          final count = RunnerCount(
            current: current,
            total: total,
            style: figure,
            unitColor: colors.ink2,
            semanticsLabel: RunnerCopy.countSemantics(current, total),
          );
          final key = SheetKey(onTap: onQuestions, compact: compact);
          final Widget row;
          if (timed && !compact) {
            // Three slots: the timer in the middle with equal room either side of it. Each side
            // slot scales down as a whole if a long clock ("2:59:59") ever crowds it.
            row = Row(
              children: [
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Row(
                      children: [
                        leave,
                        const SizedBox(width: MmSpace.s12),
                        count,
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                RunnerTimer(remaining: remaining!, style: figure),
                const SizedBox(width: MmSpace.s8),
                Expanded(
                  child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerRight, child: key),
                ),
              ],
            );
          } else {
            // Compact, or a practice (no clock): the count takes the room that is left.
            row = Row(
              children: [
                leave,
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: count),
                  ),
                ),
                if (timed) ...[
                  const SizedBox(width: MmSpace.s8),
                  RunnerTimer(remaining: remaining!, style: figure),
                  const SizedBox(width: MmSpace.s12),
                ],
                if (openUntil != null) ...[
                  const SizedBox(width: MmSpace.s8),
                  _OpenUntil(text: openUntil!),
                  const SizedBox(width: MmSpace.s12),
                ],
                key,
              ],
            );
          }
          return SizedBox(height: 60, child: row);
        },
      ),
    );
  }
}

/// The clock: one Text repainted once a second inside its own boundary, so nothing else
/// rebuilds. Under five minutes it takes the warning colour (the words come from the meta line,
/// so the warning is never colour alone), under one minute the alert colour. One treatment only.
class RunnerTimer extends StatelessWidget {
  const RunnerTimer({super.key, required this.remaining, required this.style});

  final ValueListenable<Duration> remaining;
  final TextStyle style;

  /// Under this the timer takes the warning colour (five minutes).
  static const int lowSeconds = 5 * 60;

  /// Under this it takes the alert colour (one minute).
  static const int criticalSeconds = 60;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return RepaintBoundary(
      child: ValueListenableBuilder<Duration>(
        valueListenable: remaining,
        builder: (context, left, _) {
          final tone = left.inSeconds <= criticalSeconds
              ? colors.badText
              : left.inSeconds <= lowSeconds
              ? colors.warnText
              : colors.ink;
          return Semantics(
            label: RunnerCopy.timerSemantics(left),
            excludeSemantics: true,
            child: Text(formatTimer(left), style: style.copyWith(color: tone)),
          );
        },
      ),
    );
  }
}

/// "Open until 11:42 PM" on two short lines, right-aligned against the Questions key.
class _OpenUntil extends StatelessWidget {
  const _OpenUntil({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // "Open until" over the time, so the time is one unbroken piece.
    final at = text.lastIndexOf(' ', text.length - 4);
    final head = at < 0 ? text : text.substring(0, at);
    final tail = at < 0 ? '' : text.substring(at + 1);
    return Semantics(
      label: text,
      excludeSemantics: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(head, style: type.caption.copyWith(color: colors.ink3, height: 1.2), maxLines: 1, softWrap: false),
          if (tail.isNotEmpty)
            Text(
              tail,
              style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, height: 1.2),
              maxLines: 1,
              softWrap: false,
            ),
        ],
      ),
    );
  }
}
