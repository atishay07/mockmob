import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_eligibility.dart';

/// The Bulletin's combinations for one programme, each written out in full beside an answer
/// bubble: inked when the student's subjects meet it, an empty ring when they do not, with what
/// is missing in words. Nothing is hidden or summarised away.
class RulesList extends StatelessWidget {
  const RulesList({super.key, required this.rows});

  final List<DuRuleCheck> rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++)
          () {
            final r = rows[i];
            final status = r.ok ? (r.secondary ? ToolsCopy.youMeetSecondary : ToolsCopy.youMeetThis) : r.missing.join(', ');
            return MergeSemantics(
              child: Padding(
                padding: EdgeInsets.only(top: i == 0 ? 0 : MmSpace.s16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Bubble(
                        state: r.ok ? BubbleState.filled : BubbleState.hollow,
                        animate: false,
                        semanticsLabel: r.ok ? 'Met' : 'Not met',
                      ),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(r.label, style: type.label.copyWith(color: r.ok ? colors.ink : colors.ink2)),
                          const SizedBox(height: 2),
                          Text(r.text, style: type.small.copyWith(color: colors.ink)),
                          if (status.isNotEmpty) ...[
                            const SizedBox(height: MmSpace.s4),
                            Text(status, style: type.caption.copyWith(color: r.ok ? colors.goodText : colors.warnText)),
                          ],
                          if (r.extraLanguage) ...[
                            const SizedBox(height: 2),
                            Text(ToolsCopy.extraLanguage, style: type.caption.copyWith(color: colors.ink2)),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }(),
      ],
    );
  }
}
