// Today's masthead (brief 12, ui-blitz/today.md 2.1): the date and a
// greeting by first name with the living Mobi beside it, then the week as a ledger on the
// ground (see WeekLedger). When Today shows what it last loaded, a quiet time line takes the date
// line's place, so a Wi-Fi flip never moves the page (audit T6).
import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../logic/today_model.dart';
import 'header_mobi.dart';
import 'today_entrance.dart';
import 'week_ledger.dart';

class TodayHeader extends StatefulWidget {
  const TodayHeader({super.key, required this.header, this.onWeek, this.aim});

  final HeaderModel header;
  final VoidCallback? onWeek;

  /// The move card's key, so the header Mobi can point at it.
  final GlobalKey? aim;

  @override
  State<TodayHeader> createState() => _TodayHeaderState();
}

class _TodayHeaderState extends State<TodayHeader> {
  /// True while the header Mobi's line is up: it floats over the greeting, so the greeting steps
  /// back for those seconds instead of being read through a bubble.
  final ValueNotifier<bool> _speaking = ValueNotifier<bool>(false);

  @override
  void dispose() {
    _speaking.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final header = widget.header;
    final onWeek = widget.onWeek;
    final aim = widget.aim;
    final week = header.week;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The greeting and date fade in over 200 ms with no rise (MOTION.md 4.3).
        TodayEnter(
          delay: Duration.zero,
          rise: 0,
          length: const Duration(milliseconds: 200),
          child: _GreetingRow(
            dateLine: header.dateLine,
            updatedLine: header.updatedLine,
            greeting: header.greeting,
            speaking: _speaking,
            trailing: header.mobi == null
                ? null
                : HeaderMobi(cue: header.mobi!, aim: aim, speaking: _speaking),
          ),
        ),
        if (week != null) ...[
          // Header to the week: 12 (SPACING.md 3.1, audit T3).
          const SizedBox(height: MmSpace.s12),
          TodayEnter(
            delay: const Duration(milliseconds: 60),
            child: WeekLedger(week: week, onTap: onWeek),
          ),
        ],
      ],
    );
  }
}

/// The tab-root top row (date line, title, trailing; You is a place on the bar) with one
/// difference: "Good evening, Asha" is a full sentence, so a long one scales down to fit beside
/// Mobi instead of ending in an ellipsis.
class _GreetingRow extends StatelessWidget {
  const _GreetingRow({
    required this.dateLine,
    required this.greeting,
    required this.speaking,
    this.updatedLine,
    this.trailing,
  });

  /// Mobi's line is up: the words beside him step back (never a bubble over readable text).
  final ValueListenable<bool> speaking;

  final String dateLine;

  /// "Updated 7:30 PM. You are offline." In the date line's place, on one line, so the row keeps
  /// its height whether or not it is shown.
  final String? updatedLine;
  final String greeting;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          Expanded(
            child: ValueListenableBuilder<bool>(
              valueListenable: speaking,
              builder: (context, hushed, child) => AnimatedOpacity(
                opacity: hushed ? 0 : 1,
                duration: Motion.of(context, Motion.crossFade),
                curve: Motion.out,
                child: child,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedSwitcher(
                    duration: Motion.of(context, Motion.crossFade),
                    layoutBuilder: (current, previous) => Stack(
                      alignment: Alignment.centerLeft,
                      children: [...previous, ?current],
                    ),
                    child: updatedLine == null
                        ? Text(
                            dateLine,
                            key: const ValueKey('date'),
                            style: type.caption.copyWith(color: colors.ink2),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          )
                        : Row(
                            key: const ValueKey('updated'),
                            children: [
                              Icon(
                                LucideIcons.cloudOff,
                                size: 14,
                                color: colors.ink2,
                              ),
                              const SizedBox(width: MmSpace.s6),
                              Flexible(
                                child: Text(
                                  updatedLine!,
                                  style: type.caption.copyWith(
                                    color: colors.ink2,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                  ),
                  Semantics(
                    header: true,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        greeting,
                        style: type.screenTitle,
                        maxLines: 1,
                        softWrap: false,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: MmSpace.s12),
            trailing!,
          ],
        ],
      ),
    );
  }
}
