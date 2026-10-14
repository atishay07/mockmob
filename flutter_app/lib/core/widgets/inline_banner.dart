import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/theme.dart';
import '../haptics/haptics.dart';
import 'pressable.dart';
import 'materials/shape.dart';

enum BannerTone { info, warning, error, offline }

/// A banner that sits in the layout, never over content: a quiet card with a small glyph in a
/// tinted well. Tone is carried by the glyph and the words, colour is a second signal only.
/// [InlineBanner.offlineStrip] is the slim full-width strip for "showing what was last loaded".
class InlineBanner extends StatelessWidget {
  const InlineBanner({
    super.key,
    required this.message,
    this.tone = BannerTone.info,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  /// The 32 dp strip used for the offline cache-time banner.
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
    final accent = switch (tone) {
      BannerTone.info || BannerTone.offline => colors.ink2,
      BannerTone.warning => colors.warnText,
      BannerTone.error => colors.badText,
    };

    if (compact) {
      return Semantics(
        container: true,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.isNight ? colors.raised : colors.sunken,
            border: Border(bottom: BorderSide(color: colors.line)),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 32),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s6),
              child: Row(
                children: [
                  ExcludeSemantics(child: Icon(_icon, size: 14, color: accent)),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(child: Text(message, style: type.caption.copyWith(color: colors.ink2))),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final surface = tone == BannerTone.error ? colors.wrongSurface : colors.raised;
    final rim = tone == BannerTone.error ? colors.wrongBorder : colors.line;

    return Semantics(
      container: true,
      liveRegion: tone == BannerTone.error,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: surface,
          shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: rim)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s16, MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: tone == BannerTone.error ? colors.wrongBorder.withValues(alpha: 0.35) : colors.raised2,
                    shape: BoxShape.circle,
                  ),
                  child: SizedBox.square(dimension: 32, child: Icon(_icon, size: 16, color: tone == BannerTone.error ? colors.wrongText : accent)),
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: MmSpace.s6),
                      child: Text(
                        message,
                        style: type.small.copyWith(color: tone == BannerTone.error ? colors.wrongText : colors.ink),
                      ),
                    ),
                    if (actionLabel != null && onAction != null)
                      // A pill, so the action reads as a button. The visible pill is 36 dp tall
                      // inside a 48 dp touch target; it starts at the message's left edge.
                      Row(children: [_BannerAction(label: actionLabel!, onTap: onAction!)]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The banner's action: a 36 dp outlined pill with a small chevron, in a 48 dp touch target.
class _BannerAction extends ConsumerWidget {
  const _BannerAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: label,
      onTap: () {
        ref.read(hapticsProvider).settle();
        onTap();
      },
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
        child: Center(
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : colors.raised2.withValues(alpha: colors.isNight ? 0.6 : 0.5),
              shape: mmShapeBorder(MmRadius.pillAll, side: BorderSide(color: colors.lineStrong)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s16, 0, MmSpace.s12, 0),
              child: SizedBox(
                height: 36,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(child: Text(label, style: type.button.copyWith(color: colors.ink))),
                    const SizedBox(width: MmSpace.s4),
                    ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: 16, color: colors.ink2)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
