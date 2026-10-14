import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/domain/domain.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
// The sheet's own wording, so the row rotates with the same ask count. The notifications module
// does not export it yet: it is one pure file (copy and an index), no providers.
import '../../notifications/logic/pre_prompt_variants.dart' show prePromptVariantFor, prePromptVariantIndex;
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
    // No box: the repair is rows on the card itself, one hairline between what is recorded and
    // the length to choose. The lit key below is the card's one lit element.
    return Column(
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
          const SizedBox(height: MmSpace.s20),
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s16),
          Semantics(
            container: true,
            label: ResultCopy.chipLabel(minutes, mistakes),
            child: _LengthRow(options: options, minutes: minutes, onMinutes: onMinutes),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(ResultCopy.chipLabel(minutes, mistakes), style: type.caption.copyWith(color: colors.ink3)),
        ],
      ],
    );
  }
}

/// The repair lengths as one connected strip of equal segments (5, 10, 15 minutes), the chosen
/// one lit with a volt rule under it. 48 dp tall; each segment is its own target.
class _LengthRow extends ConsumerWidget {
  const _LengthRow({required this.options, required this.minutes, required this.onMinutes});

  final List<RepairDurationOption> options;
  final int minutes;
  final ValueChanged<int> onMinutes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(
        shape: RoundedRectangleBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.lineStrong)),
      ),
      child: ClipRRect(
        borderRadius: MmRadius.smallAll,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < options.length; i++) ...[
                if (i > 0) VerticalDivider(width: 1, thickness: 1, color: colors.line),
                Expanded(
                  child: MmPressable(
                    semanticsLabel: ResultCopy.chip(options[i].minutes),
                    selected: options[i].minutes == minutes,
                    onTap: () {
                      ref.read(hapticsProvider).selection();
                      onMinutes(options[i].minutes);
                    },
                    builder: (context, pressed, _) {
                      final on = options[i].minutes == minutes;
                      return Container(
                        constraints: const BoxConstraints(minHeight: MmTarget.min),
                        alignment: Alignment.center,
                        color: on ? colors.raised2 : (pressed ? colors.raised : const Color(0x00000000)),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                              child: Text(
                                ResultCopy.chip(options[i].minutes),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: type.labelLarge.copyWith(color: on ? colors.ink : colors.ink2, fontWeight: on ? FontWeight.w700 : FontWeight.w500),
                              ),
                            ),
                            if (on)
                              Positioned(
                                left: 0,
                                right: 0,
                                bottom: 0,
                                child: ColoredBox(color: colors.volt, child: const SizedBox(height: 3)),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
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

/// The row's wording after [asks] earlier asks. The first wording is the result's own line; the
/// others are the sheet's own lines for the same ask count (`prePromptVariantFor`), so the row
/// and the sheet ask the same way each time and never repeat themselves.
String reminderRowLine(int asks) => prePromptVariantIndex(asks) == 0 ? ResultCopy.reminderAsk : prePromptVariantFor(asks).line;

/// Inline (never a system dialog first): the reminder offer, when the notifications policy says
/// it is due.
class ReminderRow extends StatelessWidget {
  const ReminderRow({super.key, required this.text, required this.onSet, required this.onNotNow});

  /// What it asks, from [reminderRowLine].
  final String text;
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
              child: Text(text, style: type.body),
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
