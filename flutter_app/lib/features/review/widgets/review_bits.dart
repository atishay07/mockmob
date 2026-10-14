import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'review_layout.dart';

/// A section heading on Review: the title in the Bricolage title cut, an optional quiet count
/// on the right. With [rule] the section opens the way every later section does: a 1 dp hairline,
/// 16 dp of air, then the heading (the gap above the rule belongs to the caller).
class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.trailing, this.caption, this.rule = false});

  final String title;
  final String? trailing;

  /// A hairline above the heading.
  final bool rule;

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
          if (rule) ...[
            Divider(height: 1, thickness: 1, color: context.mmColors.line),
            const SizedBox(height: MmSpace.s16),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Semantics(header: true, child: Text(title, style: type.title)),
              ),
              if (trailing != null) Text(trailing!, style: type.caption.copyWith(color: context.mmColors.ink2)),
            ],
          ),
          if (caption != null) ...[const SizedBox(height: MmSpace.s2), Text(caption!, style: type.small.copyWith(color: context.mmColors.ink2))],
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

/// A quiet text key whose label starts on the screen's gutter (E0), in line with the headings
/// above it. The key keeps its full 48 dp target; only its 16 dp of side padding hangs out into
/// the gutter.
class FlushKey extends StatelessWidget {
  const FlushKey({super.key, required this.label, required this.onPressed, this.semanticsLabel});

  final String label;
  final VoidCallback? onPressed;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Transform.translate(
      offset: const Offset(-ReviewSpace.gutter, 0),
      child: KeyButton.quiet(label: label, onPressed: onPressed, semanticsLabel: semanticsLabel),
    ),
  );
}
