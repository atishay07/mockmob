import 'package:flutter/material.dart';

import '../../../core/domain/domain.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';

/// The brass first-mock token: only for the server's `first_full_mock` milestone, as a dated row
/// (spec 6.5), never tied to the score and never after a lower or held result.
class TokenRow extends StatelessWidget {
  const TokenRow({super.key, required this.at});

  final DateTime at;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Semantics(
      container: true,
      label: ResultCopy.firstMockToken(at),
      excludeSemantics: true,
      child: Row(
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: -20,
                  top: -20,
                  width: 104,
                  height: 104,
                  child: LightField(
                    pools: [LightPool(color: context.mmColors.lamp.withValues(alpha: 0.22), center: Alignment.center, radius: 0.5)],
                  ),
                ),
                const ArtImage(MmArt.tokenFirstMock, width: 64, height: 64),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s16),
          Expanded(child: Text(ResultCopy.firstMockToken(at), style: type.labelLarge)),
        ],
      ),
    );
  }
}

/// What is recorded and the next ask: the mistakes ready to repair, the blanks waiting in Review,
/// the fresh-check state, the wallet when it falls short, and the duration chips. The one lit
/// element of the card.
class RepairPanel extends StatelessWidget {
  const RepairPanel({
    super.key,
    required this.model,
    required this.mistakes,
    required this.minutes,
    required this.options,
    required this.onMinutes,
    required this.onRetryKeys,
    this.shortfall,
    this.blanksInReview = false,
  });

  final RecapModel model;
  final int mistakes;
  final int minutes;
  final List<RepairDurationOption> options;
  final ValueChanged<int> onMinutes;
  final VoidCallback onRetryKeys;
  final RepairWalletShortfall? shortfall;

  /// Review keeps the blanks of the newest paper that has any; true when that is this one.
  final bool blanksInReview;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = model;
    final n = m.candidates.length;
    final tonight = m.tonight;
    final rows = <Widget>[
      _Row(
        state: n > 0 ? BubbleState.wrong : BubbleState.filled,
        text: n > 0 ? ResultCopy.readyToRepair(n, null) : ResultCopy.noMistakes,
        strong: true,
      ),
      // A repair covers one chapter: say which, and how many of the wrong answers are in it.
      if (tonight != null && tonight.items.length < n)
        _Row(state: BubbleState.hollow, text: ResultCopy.startWithChapter(tonight.chapter, tonight.items.length)),
      // "They are in Review" only when Review really holds this paper's blanks.
      if (m.blankCount > 0)
        _Row(state: BubbleState.blank, text: blanksInReview ? ResultCopy.blanksInReview(m.blankCount) : ResultCopy.blanksCount(m.blankCount)),
      if (shortfall != null) _Row(state: null, text: ResultCopy.walletShort(shortfall!.needed, shortfall!.balance)),
    ];
    return LitEdge(
      child: Container(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.panelAll,
            side: BorderSide(color: colors.line),
          ),
          shadows: colors.cardShadow,
        ),
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s16, MmSpace.cardPadding, MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < rows.length; i++) ...[if (i > 0) const SizedBox(height: MmSpace.s12), rows[i]],
            if (m.keysUnavailable) ...[
              const SizedBox(height: MmSpace.s16),
              InlineBanner(
                message: ResultCopy.keysUnavailable,
                tone: BannerTone.warning,
                actionLabel: ResultCopy.tryAgain,
                onAction: onRetryKeys,
              ),
            ],
            if (options.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s16),
              Divider(height: 1, thickness: 1, color: colors.line),
              const SizedBox(height: MmSpace.s12),
              Semantics(
                container: true,
                label: ResultCopy.chipLabel(minutes, mistakes),
                child: Wrap(
                  spacing: MmSpace.s8,
                  children: [
                    for (final o in options)
                      MmChip(label: ResultCopy.chip(o.minutes), selected: o.minutes == minutes, onTap: () => onMinutes(o.minutes)),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s4),
              Text(ResultCopy.chipLabel(minutes, mistakes), style: type.caption.copyWith(color: colors.ink3)),
            ],
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.state, required this.text, this.strong = false});

  final BubbleState? state;
  final String text;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: state == null ? const SizedBox(width: 14) : Bubble(state: state!, size: 14, animate: false),
        ),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Text(
            text,
            style: strong ? type.body.copyWith(fontWeight: FontWeight.w600) : type.small.copyWith(color: colors.ink2),
          ),
        ),
      ],
    );
  }
}

/// First result only, inline (never a system dialog first): the reminder offer.
class ReminderRow extends StatelessWidget {
  const ReminderRow({super.key, required this.onSet, required this.onNotNow});

  final VoidCallback onSet;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return FakeGlass(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s8, MmSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: MmSpace.s8),
              child: Text(ResultCopy.reminderAsk, style: type.body),
            ),
            Row(
              children: [
                KeyButton.quiet(label: ResultCopy.setReminder, onPressed: onSet),
                KeyButton.quiet(label: ResultCopy.notNow, onPressed: onNotNow),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
