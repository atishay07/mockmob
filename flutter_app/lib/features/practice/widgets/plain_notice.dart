import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A notice that sits in the page without a box: a small glyph, one plain line and, when there is
/// something to do, a text key. It replaces the banner card in practice, where a tinted card with
/// a chip and an outlined button inside it was three layers around one sentence. The glyph and
/// the words carry the tone; colour is only a second signal.
class PlainNotice extends StatelessWidget {
  const PlainNotice({super.key, required this.message, this.tone = BannerTone.info, this.actionLabel, this.onAction});

  final String message;
  final BannerTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;

  IconData get _icon => switch (tone) {
    BannerTone.info => LucideIcons.info,
    BannerTone.warning => LucideIcons.triangleAlert,
    BannerTone.error => LucideIcons.circleAlert,
    BannerTone.offline => LucideIcons.wifiOff,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = switch (tone) {
      BannerTone.info || BannerTone.offline => colors.ink2,
      BannerTone.warning => colors.warnText,
      BannerTone.error => colors.badText,
    };
    return Semantics(
      container: true,
      liveRegion: tone == BannerTone.error,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(_icon, size: 20, color: accent),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(message, style: type.small.copyWith(color: colors.ink)),
                  // The text key carries 16 dp of padding of its own; pulled back so its label lines up with the
                  // sentence above it (the touch target stays 48 dp).
                  if (actionLabel != null && onAction != null)
                    Transform.translate(
                      offset: const Offset(-MmSpace.s16, 0),
                      child: KeyButton.quiet(label: actionLabel!, onPressed: onAction),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
