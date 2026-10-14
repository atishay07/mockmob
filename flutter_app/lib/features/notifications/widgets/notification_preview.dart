import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// One example of a notification: a round glyph, the channel name and the exact words. It is
/// drawn, not a screenshot. It has no box of its own: examples sit on the sheet in a list
/// divided by hairlines (see [PreviewList]).
class NotificationPreview extends StatelessWidget {
  const NotificationPreview({
    super.key,
    required this.icon,
    required this.channel,
    required this.body,
  });

  final IconData icon;
  final String channel;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '$channel. $body',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 36,
              height: 36,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.ink,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: colors.ground),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(channel, style: type.label.copyWith(color: colors.ink3)),
                  const SizedBox(height: 2),
                  Text(body, style: type.small.copyWith(color: colors.ink)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Examples in a flat list: a hairline above, between and below, straight on the sheet. No well,
/// no card, so the sheet does not hold a box inside a box.
class PreviewList extends StatelessWidget {
  const PreviewList({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rule = SizedBox(height: 1, child: ColoredBox(color: context.mmColors.line));
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        rule,
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) rule,
          children[i],
        ],
        rule,
      ],
    );
  }
}
