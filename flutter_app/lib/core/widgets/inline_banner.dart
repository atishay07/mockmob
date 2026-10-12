import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/theme.dart';
import 'key_button.dart';

enum BannerTone { info, warning, error, offline }

/// A non-floating banner: it sits in the layout, never over content. Tone is carried by the
/// icon and the words, with colour as a second signal only.
class InlineBanner extends StatelessWidget {
  const InlineBanner({
    super.key,
    required this.message,
    this.tone = BannerTone.info,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  /// The 32 dp strip used for the offline cache-time banner (spec 10).
  const InlineBanner.offlineStrip({super.key, this.message = 'Offline. Showing what was last loaded.'})
      : tone = BannerTone.offline,
        actionLabel = null,
        onAction = null,
        compact = true;

  final String message;
  final BannerTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// A single-line, 32 dp strip with no action.
  final bool compact;

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
    final iconColor = switch (tone) {
      BannerTone.info || BannerTone.offline => colors.ink2,
      BannerTone.warning => colors.warnText,
      BannerTone.error => colors.badText,
    };

    final text = Text(message, style: (compact ? type.small : type.body).copyWith(color: colors.ink));

    return Semantics(
      container: true,
      liveRegion: tone == BannerTone.error,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.sunken,
          border: Border.symmetric(horizontal: BorderSide(color: colors.line)),
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: compact ? 32 : 48),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: compact ? MmSpace.s4 : MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                ExcludeSemantics(child: Icon(_icon, size: compact ? 16 : 20, color: iconColor)),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      text,
                      if (actionLabel != null && onAction != null)
                        // The quiet key carries 16 dp of inner padding; pull it back so its
                        // label lines up with the message above.
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
        ),
      ),
    );
  }
}
