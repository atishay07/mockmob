import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/domain/domain.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
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
    this.leadLine,
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

  /// "Repair Q12 first. 26 of 31 other students got it right.": why the run starts where it does,
  /// in the server's words. Null when the repair order is the paper's own.
  final String? leadLine;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final m = model;
    final n = m.candidates.length;
    // Some of the paper's wrong answers may not be ready (repaired already, or their key is being
    // checked): the line then says "13 of 15" and names the rest, so it never contradicts the
    // wrong count on card 3.
    final partial = n > 0 && n < m.wrong;
    final rows = <Widget>[
      _Row(
        state: n > 0 ? BubbleState.wrong : BubbleState.filled,
        text: n == 0 ? ResultCopy.noMistakes : (partial ? ResultCopy.readyToRepairOf(n, m.wrong) : ResultCopy.readyToRepair(n, null)),
        strong: true,
      ),
      if (partial) _Row(state: BubbleState.hollow, text: ResultCopy.readyToRepairRest(m.wrong - n)),
      // Which chapter the run opens, and how much of it, is said once, above the key (the key's own
      // count follows the length chosen), so the card never says one number twice.
      if (leadLine != null) _Row(state: BubbleState.hollow, text: leadLine!),
      // "They are in Review" only when Review really holds this paper's blanks.
      if (m.blankCount > 0)
        _Row(state: BubbleState.blank, text: blanksInReview ? ResultCopy.blanksInReview(m.blankCount) : ResultCopy.blanksCount(m.blankCount)),
    ];
    // No box: the repair is rows on the card itself, one hairline between what is recorded and
    // the length to choose. The lit key below is the card's one lit element.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++) ...[if (i > 0) const SizedBox(height: MmSpace.s12), rows[i]],
        // The two news items open and close instead of cutting in: a wallet that falls short at a
        // longer length, and the keys arriving or not.
        KeyReveal(
          show: shortfall != null,
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12),
            child: _Row(state: null, text: shortfall == null ? '' : ResultCopy.walletShort(shortfall!.needed, shortfall!.balance)),
          ),
        ),
        KeyReveal(
          show: m.keysUnavailable,
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: InlineBanner(
              message: ResultCopy.keysUnavailable,
              tone: BannerTone.warning,
              actionLabel: ResultCopy.tryAgain,
              onAction: onRetryKeys,
            ),
          ),
        ),
        if (options.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s20),
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s16),
          Semantics(
            container: true,
            label: ResultCopy.chipLabel(minutes, mistakes),
            child: _LengthRow(options: options, minutes: minutes, onMinutes: onMinutes),
          ),
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
                        // One selected treatment: the chosen length is filled in the accent's wash
                        // and set heavier. No second rule under it.
                        color: on ? colors.volt.withValues(alpha: 0.18) : (pressed ? colors.raised : const Color(0x00000000)),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                          child: Text(
                            ResultCopy.chip(options[i].minutes),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: type.labelLarge.copyWith(color: on ? colors.ink : colors.ink2, fontWeight: on ? FontWeight.w700 : FontWeight.w500),
                          ),
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
          // A line whose words change (the count a different length opens) cross-fades.
          child: AnimatedSwitcher(
            duration: Motion.of(context, Motion.ui),
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
            child: Text(
              text,
              key: ValueKey(text),
              style: strong ? type.body.copyWith(fontWeight: FontWeight.w600) : type.small.copyWith(color: colors.ink2),
            ),
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
/// it is due. One line of words, an outlined 48 dp yes and a plain 48 dp no on the card itself, no
/// box: the answer is a tap, not a decision to weigh.
class ReminderRow extends StatelessWidget {
  const ReminderRow({super.key, required this.text, required this.onSet, required this.onNotNow});

  /// What it asks, from [reminderRowLine].
  final String text;
  final VoidCallback onSet;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text, style: type.body),
        const SizedBox(height: MmSpace.s8),
        // The yes is a real (quiet) key, outlined so it reads as a button and not as a line of text,
        // and never lit: the card's one volt key is the repair. The no is a plain text action.
        Wrap(
          spacing: MmSpace.s16,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _OutlineAction(label: ResultCopy.setReminder, onTap: onSet),
            _InlineAction(label: ResultCopy.notNow, onTap: onNotNow, color: colors.ink2),
          ],
        ),
      ],
    );
  }
}

/// An outlined pill key, 48 dp tall: the reminder's yes.
class _OutlineAction extends StatelessWidget {
  const _OutlineAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised : const Color(0x00000000),
          shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20),
            child: Center(
              child: Text(label, style: context.mmType.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
      ),
    );
  }
}

/// A plain text action, flush with the text above it and 48 dp tall.
class _InlineAction extends StatelessWidget {
  const _InlineAction({required this.label, required this.onTap, required this.color});

  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          child: Text(
            label,
            style: context.mmType.labelLarge.copyWith(color: pressed ? color.withValues(alpha: 0.7) : color, fontWeight: FontWeight.w500),
          ),
        ),
      ),
    );
  }
}

/// The card's one quiet key, "Choose something else". When "Finish for now" is not the primary
/// key it is rare, so it waits in the sheet this opens (with the way to the other options) instead
/// of a second control or a bare overflow mark beside the words. With [onFinish] null the key
/// goes straight to the options.
class ChooseElseKey extends StatelessWidget {
  const ChooseElseKey({super.key, required this.onChoose, this.onFinish});

  final VoidCallback onChoose;
  final VoidCallback? onFinish;

  @override
  Widget build(BuildContext context) {
    final finish = onFinish;
    return KeyButton.quiet(
      label: ResultCopy.chooseElse,
      onPressed: finish == null
          ? onChoose
          : () => showMmSheet<void>(
              context: context,
              title: ResultCopy.somethingElse,
              builder: (sheet) => Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    KeyButton.secondary(
                      label: ResultCopy.otherOptions,
                      onPressed: () {
                        Navigator.of(sheet).pop();
                        onChoose();
                      },
                    ),
                    const SizedBox(height: MmSpace.s8),
                    Align(
                      child: KeyButton.quiet(
                        label: ResultCopy.finishForNow,
                        onPressed: () {
                          Navigator.of(sheet).pop();
                          finish();
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

/// The line above the repair key: which chapter the run opens, how much of it the length chosen
/// holds, the time, and what waits in Review. At the normal text size it has a fixed height (three
/// lines, set from the bottom, so a short one leaves room above it), so choosing another length
/// changes the words and never moves the key below; at large text it takes the room it needs. The
/// words cross-fade. The key says the same words to a screen reader, so this line is left out of
/// the reading order.
class RepairScopeLine extends StatelessWidget {
  const RepairScopeLine({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(color: colors.ink2);
    final scaler = MediaQuery.textScalerOf(context);
    final lineHeight = scaler.scale(style.fontSize ?? 12) * (style.height ?? 1.3);
    final fixed = scaler.scale(14) / 14 <= 1.15;
    final room = (lineHeight * 3).ceilToDouble();
    return ExcludeSemantics(
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: room, maxHeight: fixed ? room : double.infinity),
        child: AnimatedSwitcher(
          duration: Motion.of(context, Motion.ui),
          layoutBuilder: (current, previous) => Stack(alignment: Alignment.bottomCenter, children: [...previous, ?current]),
          child: Align(
            key: ValueKey(text),
            alignment: Alignment.bottomCenter,
            child: Text(text, style: style, textAlign: TextAlign.center, maxLines: fixed ? 3 : null, overflow: fixed ? TextOverflow.ellipsis : TextOverflow.clip),
          ),
        ),
      ),
    );
  }
}
