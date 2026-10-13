// Tonight's move: the subject's object in lamp light, one monumental number and what it means,
// the evidence one tap away, a duration chooser when the task can change size, and the screen's
// one volt pill. Changing the duration rolls the number and reshapes the task in place; the
// card's height does not jump.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'number_block.dart';
import 'show_me_tag.dart';

class MoveHeroCard extends StatelessWidget {
  const MoveHeroCard({
    super.key,
    required this.move,
    required this.onAction,
    this.onMinutes,
    this.onShowMe,
    this.offline = false,
  });

  final MoveHero move;
  final void Function(TodayAction action) onAction;
  final ValueChanged<int>? onMinutes;
  final VoidCallback? onShowMe;
  final bool offline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = move;
    final blocked = offline && m.primary.startsSession;

    final top = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: heroArtHeight - MmSpace.cardPadding + 4),
      child: Padding(
        padding: EdgeInsets.only(right: m.art.isMobi ? 128 : 196),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(m.overline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
            if (m.subjectLine != null) ...[
              const SizedBox(height: 2),
              Text(m.subjectLine!, style: type.labelLarge.copyWith(color: colors.ink)),
            ],
            if (m.headline != null) ...[
              const SizedBox(height: MmSpace.s12),
              Semantics(header: true, child: Text(m.headline!, style: type.title.copyWith(fontSize: 20, height: 24 / 20))),
            ],
          ],
        ),
      ),
    );

    final content = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          top,
          if (m.number != null) ...[
            const SizedBox(height: MmSpace.s8),
            NumberBlock(number: m.number!, label: m.numberLabel),
          ],
          const SizedBox(height: MmSpace.s12),
          // Two lines are always reserved while the duration can reshape the task, so changing
          // the chip never moves the pill under the student's thumb.
          ConstrainedBox(
            constraints: BoxConstraints(minHeight: m.durations.length > 1 ? 48 : 0),
            child: AnimatedSwitcher(
              duration: Motion.of(context, Motion.crossFade),
              layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
              child: Text(m.meaning, key: ValueKey(m.meaning), style: type.body.copyWith(color: colors.ink2)),
            ),
          ),
          if (m.basisLine != null || (m.evidenceId != null && onShowMe != null))
            Row(
              children: [
                Expanded(
                  child: m.basisLine == null ? const SizedBox.shrink() : Text(m.basisLine!, style: type.caption.copyWith(color: colors.ink3)),
                ),
                if (m.evidenceId != null && onShowMe != null) ...[const SizedBox(width: MmSpace.s8), ShowMeTag(onTap: onShowMe!)],
              ],
            ),
          if (m.durations.length > 1) ...[
            SizedBox(height: m.evidenceId != null ? MmSpace.s4 : MmSpace.s16),
            if (m.durationPrompt != null) ...[
              Text(m.durationPrompt!, style: type.labelLarge),
              const SizedBox(height: MmSpace.s8),
            ],
            MmSegmented<int>(
              semanticsLabel: m.durationPrompt ?? 'Time for this',
              segments: [for (final d in m.durations) MmSegment(d.minutes, '${d.minutes} min')],
              value: m.selectedMinutes ?? m.durations.first.minutes,
              onChanged: onMinutes,
            ),
          ],
          const SizedBox(height: MmSpace.s20),
          KeyButton(
            label: m.primary.label,
            onPressed: blocked ? null : () => onAction(m.primary),
            disabledReason: blocked ? TodayCopy.connectToStart : null,
          ),
          if (m.secondary != null)
            Center(
              child: KeyButton.quiet(
                label: m.secondary!.label,
                onPressed: offline && m.secondary!.startsSession ? null : () => onAction(m.secondary!),
              ),
            ),
          if (m.caption != null || m.dismissedLine != null) ...[
            const SizedBox(height: MmSpace.s4),
            Text(
              m.dismissedLine ?? m.caption!,
              textAlign: TextAlign.center,
              style: type.caption.copyWith(color: colors.ink3),
            ),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
    );

    return HeroStage(
      subjectId: m.subjectId,
      art: HeroArtView(art: m.art, mobiLine: m.headline == null ? m.mobiLine : null),
      child: content,
    );
  }
}
