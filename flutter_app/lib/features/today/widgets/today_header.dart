// Today's masthead (brief 12, ui-blitz/today.md 2.1): the avatar that opens You, the date and a
// greeting by first name with the living Mobi beside it, then the week as a ledger on the
// ground (see WeekLedger). A quiet time line appears when Today shows what it last loaded.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';
import 'header_mobi.dart';
import 'today_entrance.dart';
import 'week_ledger.dart';

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
        TodayEnter(
          delay: Duration.zero,
          child: _GreetingRow(
            avatar: avatar,
            dateLine: header.dateLine,
            greeting: header.greeting,
            trailing: header.mobi == null ? null : HeaderMobi(cue: header.mobi!, aim: aim),
          ),
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
          const SizedBox(height: MmSpace.s20),
          TodayEnter(delay: const Duration(milliseconds: 60), child: WeekLedger(week: week, onTap: onWeek)),
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
