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
  const TodayHeader({super.key, required this.header, this.onWeek, this.avatar = const YouAvatarButton()});

  final HeaderModel header;
  final VoidCallback? onWeek;
  final Widget avatar;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final week = header.week;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        TabRootHeader(
          avatar: avatar,
          overline: header.dateLine,
          title: header.greeting,
          trailing: header.mobi == null ? null : HeaderMobi(cue: header.mobi!),
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
                    Expanded(child: Text(week.count, style: type.labelLarge.copyWith(color: colors.ink))),
                    if (week.outlook != null) ...[
                      const SizedBox(width: MmSpace.s8),
                      Flexible(
                        child: Text(
                          week.outlook!,
                          textAlign: TextAlign.right,
                          style: type.caption.copyWith(color: week.met ? colors.accentText : colors.ink2, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
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
