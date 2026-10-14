// Today's top row (brief 12): the avatar that opens You, the date and a greeting by first name,
// then the week as the student planned it on a quiet glass strip: seven days, each a state
// (counted, planned, rest, not yet), the count and what the rest of the week asks. The strip
// opens the week sheet. A quiet time line appears when Today shows what it last loaded.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/widgets/plan_week_strip.dart';
import '../logic/today_model.dart';
import 'header_mobi.dart';

class TodayHeader extends StatelessWidget {
  const TodayHeader({super.key, required this.header, this.onWeek, this.avatar = const YouAvatarButton(), this.aim});

  final HeaderModel header;
  final VoidCallback? onWeek;
  final Widget avatar;

  /// The move card's key, so the header Mobi can point at it.
  final GlobalKey? aim;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final week = header.week;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _GreetingRow(
          avatar: avatar,
          dateLine: header.dateLine,
          greeting: header.greeting,
          trailing: header.mobi == null ? null : HeaderMobi(cue: header.mobi!, aim: aim),
        ),
        if (header.updatedLine != null)
          Padding(
            padding: const EdgeInsets.only(left: 60, top: 2),
            child: Row(
              children: [
                Icon(LucideIcons.cloudOff, size: 14, color: colors.ink3),
                const SizedBox(width: MmSpace.s6),
                Flexible(child: Text(header.updatedLine!, style: type.caption.copyWith(color: colors.ink3))),
              ],
            ),
          ),
        if (week != null) ...[
          const SizedBox(height: MmSpace.s16),
          TodayWeekRow(week: week, onTap: onWeek),
        ],
      ],
    );
  }
}

/// The tab-root top row (avatar, date line, title, trailing) with one difference: "Good evening,
/// Asha" is a full sentence, so a long one scales down to fit beside Mobi instead of ending in
/// an ellipsis.
class _GreetingRow extends StatelessWidget {
  const _GreetingRow({required this.avatar, required this.dateLine, required this.greeting, this.trailing});

  final Widget avatar;
  final String dateLine;
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
          avatar,
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(dateLine, style: type.caption.copyWith(color: colors.ink2)),
                Semantics(
                  header: true,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(greeting, style: type.screenTitle, maxLines: 1, softWrap: false),
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
        ],
      ),
    );
  }
}

/// The week strip on Today.
class TodayWeekRow extends StatelessWidget {
  const TodayWeekRow({super.key, required this.week, this.onTap});

  final WeekModel week;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final strip = PlanWeekStrip(days: week.days);
    final description = [week.count, ?week.outlook, strip.describe(), if (onTap != null) 'Opens your week'].join('. ');
    return MmPressable(
      semanticsLabel: description,
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.panelAll,
      builder: (context, pressed, _) => FakeGlass(
        borderRadius: MmRadius.panelAll,
        pressed: pressed,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s4, MmSpace.s8, MmSpace.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              strip,
              const SizedBox(height: MmSpace.s4),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                child: Row(
                  children: [
                    // The count never breaks mid-phrase: when the outlook does not fit beside it
                    // (large text), the outlook drops to its own line.
                    Expanded(
                      child: Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: MmSpace.s8,
                        runSpacing: 2,
                        children: [
                          Text(week.count, style: type.labelLarge.copyWith(color: colors.ink)),
                          if (week.outlook != null)
                            Text(
                              week.outlook!,
                              style: type.caption.copyWith(color: week.met ? colors.accentText : colors.ink2, fontWeight: FontWeight.w600),
                            ),
                        ],
                      ),
                    ),
                    if (onTap != null) ...[
                      const SizedBox(width: MmSpace.s4),
                      Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
