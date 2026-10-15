// A Today section's heading on the ground (ui-blitz/today.md 2): a hairline rule across the
// column, then the title in the Bricolage title cut with a quiet caption or a quiet key on the
// right. Sections are typeset, not boxed: the rule and the space do the grouping.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

class TodaySectionHeading extends StatelessWidget {
  const TodaySectionHeading({super.key, required this.title, this.caption, this.trailing, this.rule = true});

  final String title;

  /// One quiet line on the right ("Newest 4 of 8").
  final String? caption;

  /// A quiet key on the right ("Change"), instead of [caption].
  final Widget? trailing;
  final bool rule;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (rule) ...[
          DecoratedBox(
            decoration: BoxDecoration(color: colors.line),
            child: const SizedBox(height: 1, width: double.infinity),
          ),
          const SizedBox(height: MmSpace.s16),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: Semantics(header: true, child: Text(title, style: type.title))),
            if (trailing != null)
              trailing!
            else if (caption != null)
              Text(caption!, style: type.caption.copyWith(color: colors.ink3)),
          ],
        ),
      ],
    );
  }
}
