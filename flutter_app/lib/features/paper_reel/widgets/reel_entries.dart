import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The Today card after a fresh submission (D29): "Play your paper back, 20 s". Shown once per
/// attempt: Today keys it on the reel's own flag (`reelSeenProvider`), marked when the reel plays or
/// the card is dismissed. No marking wait, no receipt: the paper is already marked.
class PaperReelTodayCard extends StatelessWidget {
  const PaperReelTodayCard({super.key, required this.subject, required this.onPlay, required this.onDismiss, this.seconds = 20});

  /// The subject's display name ("Accountancy").
  final String subject;
  final VoidCallback onPlay;
  final VoidCallback onDismiss;

  /// The reel's own length ([PaperReelModel.seconds]).
  final int seconds;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Container(
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s16),
      decoration: BoxDecoration(color: colors.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: colors.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _PlayDot(size: 32),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(ReelCopy.todayTitle(seconds), style: type.subhead.copyWith(color: colors.ink))),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          Text(ReelCopy.todayLine(subject), style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          KeyButton(key: const ValueKey('reel-today-play'), label: ReelCopy.todayKey, onPressed: onPlay),
          const SizedBox(height: MmSpace.s4),
          Center(child: KeyButton.quiet(key: const ValueKey('reel-today-later'), label: ReelCopy.todayLater, onPressed: onDismiss)),
        ],
      ),
    );
  }
}

/// "Play it back" on the result: one quiet row, the reel's length beside it.
class PaperReelResultEntry extends StatelessWidget {
  const PaperReelResultEntry({super.key, required this.onPlay, this.seconds = 20});

  final VoidCallback onPlay;
  final int seconds;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      label: '${ReelCopy.resultEntry}. ${ReelCopy.resultEntrySub(seconds)}',
      excludeSemantics: true,
      child: Material(
        color: colors.raised,
        borderRadius: MmRadius.keyAll,
        child: InkWell(
          key: const ValueKey('reel-result-entry'),
          borderRadius: MmRadius.keyAll,
          onTap: onPlay,
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
            decoration: BoxDecoration(borderRadius: MmRadius.keyAll, border: Border.all(color: colors.line)),
            child: Row(
              children: [
                _PlayDot(size: 28),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(ReelCopy.resultEntry, style: type.subhead.copyWith(color: colors.ink)),
                      Text(ReelCopy.resultEntrySub(seconds), style: type.small.copyWith(color: colors.ink3)),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PlayDot extends StatelessWidget {
  const _PlayDot({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: colors.volt),
      alignment: Alignment.center,
      child: Padding(
        padding: EdgeInsets.only(left: size * 0.06),
        child: Icon(LucideIcons.play, size: size * 0.46, color: colors.voltInk),
      ),
    );
  }
}
