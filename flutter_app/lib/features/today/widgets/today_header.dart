// Today's masthead (brief 12, ui-blitz/today.md 2.1): the date and a
// greeting by first name with the living Mobi beside it, then the week as a ledger on the
// ground (see WeekLedger). When Today shows what it last loaded, a quiet time line takes the date
// line's place, so a Wi-Fi flip never moves the page (audit T6).
import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/mascot/mascot.dart' show MobiBubble, MobiSpeech, MobiTail;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/account/account_avatar.dart' show AccountLeading;
import '../logic/today_model.dart';
import 'header_mobi.dart';
import 'today_entrance.dart';
import 'week_ledger.dart';
import 'week_ledger_skeleton.dart';

class TodayHeader extends StatefulWidget {
  const TodayHeader({super.key, required this.header, this.onWeek, this.aim, this.bleed = 0});

  /// How far the masthead's box reaches past the content edge on each side: the week rail's day
  /// columns use it to be 48 dp wide on a 360 dp phone (see [WeekLedger.bleed]). Everything drawn
  /// stays inset by it. The screen takes the same amount off its own gutter and pads every other
  /// block by it.
  final double bleed;

  /// What Today borrows from its 16 dp gutter for the week rail's touch columns.
  static const double gutterBleed = 8;

  final HeaderModel header;
  final VoidCallback? onWeek;

  /// The move card's key, so the header Mobi can point at it.
  final GlobalKey? aim;

  @override
  State<TodayHeader> createState() => _TodayHeaderState();
}

class _TodayHeaderState extends State<TodayHeader> {
  /// The header Mobi's line while it is up. It is set in its own room under the greeting row (never
  /// over the greeting or the date), growing from Mobi and closing when the line goes.
  final ValueNotifier<MobiSpeech?> _speech = ValueNotifier<MobiSpeech?>(null);

  @override
  void dispose() {
    _speech.dispose();
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
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: widget.bleed),
            child: AccountLeading(child: _GreetingRow(
              dateLine: header.dateLine,
              updatedLine: header.updatedLine,
              greeting: header.greeting,
              trailing: header.mobi == null
                  ? null
                  : HeaderMobi(cue: header.mobi!, aim: aim, speech: _speech),
            )),
          ),
        ),
        if (header.mobi != null) Padding(padding: EdgeInsets.symmetric(horizontal: widget.bleed), child: _SpeechRoom(speech: _speech)),
        if (week != null) ...[
          // Header to the week: 12 (SPACING.md 3.1, audit T3).
          const SizedBox(height: MmSpace.s12),
          TodayEnter(
            delay: const Duration(milliseconds: 60),
            child: WeekLedger(week: week, onTap: onWeek, bleed: widget.bleed),
          ),
        ] else if (header.weekLoading) ...[
          const SizedBox(height: MmSpace.s12),
          WeekLedgerSkeleton(bleed: widget.bleed),
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
    this.updatedLine,
    this.trailing,
  });

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
          if (trailing != null) ...[
            const SizedBox(width: MmSpace.s12),
            trailing!,
          ],
        ],
      ),
    );
  }
}

/// The room for Mobi's line, under the greeting row and below Mobi at the right: it opens while he
/// speaks and closes after, so the line never covers the greeting, the date or the week (MOTION.md
/// 1.3: a bubble never covers text). Under reduced motion it simply is or is not there.
class _SpeechRoom extends StatelessWidget {
  const _SpeechRoom({required this.speech});

  final ValueListenable<MobiSpeech?> speech;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<MobiSpeech?>(
      valueListenable: speech,
      builder: (context, line, _) => MmSizeEase(
        duration: Motion.of(context, Motion.crossFade),
        curve: Motion.out,
        alignment: Alignment.topRight,
        child: line == null
            ? const SizedBox(width: double.infinity)
            : Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s4),
                  child: MobiBubble(
                    key: ValueKey(line.id),
                    speech: line,
                    tail: MobiTail.up,
                    tailInset: HeaderMobi.tailInset,
                    maxWidth: 236,
                  ),
                ),
              ),
      ),
    );
  }
}
