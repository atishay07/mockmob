// Today's top row (brief 12): the avatar that opens You, the date and a greeting by first name,
// then the week as its own row of seven bubbles with day initials, which opens the week sheet.
// A quiet time line appears under it when Today is showing what it last loaded.
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
        TabRootHeader(avatar: avatar, overline: header.dateLine, title: header.greeting),
        if (week != null) ...[
          const SizedBox(height: MmSpace.s12),
          _WeekRow(days: week, label: header.weekLabel, onTap: onWeek),
        ],
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

/// The signature week row: seven 18 dp bubbles, 10 dp apart, initials beneath. Done study days
/// are inked, today is ringed in paper white, rest days are dashed. The whole row opens the week.
class _WeekRow extends StatelessWidget {
  const _WeekRow({required this.days, this.label, this.onTap});

  final List<WeekBubbleDay> days;
  final String? label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final bubbles = WeekBubbles(days: days, bubbleSize: 18, gap: 10);
    final description = [?label, bubbles.describe(), 'Opens your week'].join('. ');
    return MmPressable(
      semanticsLabel: description,
      onTap: onTap,
      pressedScale: 0.98,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Row(
          children: [
            Transform.translate(offset: const Offset(-5, 0), child: ExcludeSemantics(child: bubbles)),
            if (label != null) ...[
              const SizedBox(width: MmSpace.s8),
              Expanded(
                child: Text(label!, style: type.caption.copyWith(color: colors.ink2), textAlign: TextAlign.right),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
