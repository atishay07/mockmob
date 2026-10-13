// Today's top row (brief 12): the avatar that opens You, the date and a greeting by first name,
// and the week as seven small bubbles that open the week sheet. A quiet time line appears under
// it when Today is showing what it last loaded.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

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
          trailing: week == null ? null : _WeekButton(days: week, label: header.weekLabel, onTap: onWeek),
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
      ],
    );
  }
}

class _WeekButton extends StatelessWidget {
  const _WeekButton({required this.days, this.label, this.onTap});

  final List<WeekBubbleDay> days;
  final String? label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bubbles = WeekBubbles(days: days, bubbleSize: 8, gap: 3.5, initials: false);
    final description = [?label, bubbles.describe(), 'Opens your week'].join('. ');
    return MmPressable(
      semanticsLabel: description,
      onTap: onTap,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => SizedBox(
        height: 48,
        child: Center(child: ExcludeSemantics(child: bubbles)),
      ),
    );
  }
}
