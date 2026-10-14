import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A section heading on Review: the title in the Bricolage title cut, an optional quiet count
/// on the right.
class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.trailing, this.caption});

  final String title;
  final String? trailing;

  /// A quiet line under the title ("7 mistakes across 4 chapters").
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Semantics(header: true, child: Text(title, style: type.title)),
              ),
              if (trailing != null) Text(trailing!, style: type.caption.copyWith(color: context.mmColors.ink2)),
            ],
          ),
          if (caption != null) ...[const SizedBox(height: 2), Text(caption!, style: type.small.copyWith(color: context.mmColors.ink2))],
        ],
      ),
    );
  }
}

/// "Show me": the evidence behind a claim (brief 12.1). A small glass tag with a few bubbles,
/// opening the exact questions.
class ShowMeTag extends StatelessWidget {
  const ShowMeTag({super.key, required this.count, required this.onTap, this.semanticsLabel});

  final int count;
  final VoidCallback onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final wrong = count.clamp(1, 3);
    return ShowMePill(
      onTap: onTap,
      semanticsLabel: semanticsLabel ?? 'Show me, the questions behind this',
      marks: [for (var i = 0; i < 3; i++) i < wrong ? BubbleState.wrong : BubbleState.hollow],
    );
  }
}
