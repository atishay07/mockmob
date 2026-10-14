import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// One example of a notification: a round glyph, the channel name and the exact words. It is
/// drawn, not a screenshot, and says plainly that it is an example.
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
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s8 + MmSpace.s2),
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
                  Text(body, style: type.body.copyWith(color: colors.ink)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
