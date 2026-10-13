// Tonight's move: the subject's object in lamp light (or Mobi at a human moment), one
// monumental number and what it means, the evidence one tap away, a duration chooser when the
// task can change size, and the screen's one volt pill. The number sits beside the object, so
// the card reads top to bottom without a hole; changing the duration rolls the number and
// reshapes the task in place without moving the pill.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'mobi_moment.dart';
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
    this.mobiController,
  });

  final MoveHero move;
  final void Function(TodayAction action) onAction;
  final ValueChanged<int>? onMinutes;
  final VoidCallback? onShowMe;
  final bool offline;

  /// Lets the screen make Mobi react later (a tap on a chip, coming back to the tab).
  final MobiController? mobiController;

  /// Mobi's line for a mood when the move did not set one.
  static String? moodLine(MoveHero m) =>
      m.mobiLine ??
      switch (m.mood) {
        TodayMood.returning => TodayCopy.mobiWelcomeBack,
        TodayMood.lateNight => TodayCopy.lateNight,
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = move;
    final mobi = m.art.isMobi;
    final blocked = offline && m.primary.startsSession;
    // Beside the object: the overline, the subject and the number. Under Mobi: the full width.
    final besideArt = mobi ? 0.0 : heroArtWidth - MmSpace.cardPadding + 4;

    final top = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _OneLine(m.overline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
        if (m.subjectLine != null) ...[
          const SizedBox(height: 2),
          _OneLine(m.subjectLine!, style: type.title.copyWith(fontSize: 20, height: 24 / 20)),
        ],
      ],
    );
    final lines = Padding(
      padding: EdgeInsets.only(right: besideArt),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (mobi)
            MobiMoment(pose: HeroArtView.poseFor(m.art.art), say: moodLine(m), controller: mobiController, lines: top)
          else
            top,
          if (m.headline != null) ...[
            const SizedBox(height: MmSpace.s8),
            Semantics(header: true, child: Text(m.headline!, style: type.labelLarge.copyWith(color: colors.ink, fontSize: 16, height: 22 / 16))),
          ],
          if (m.number != null) ...[
            const SizedBox(height: MmSpace.s12),
            NumberBlock(number: m.number!, label: m.numberLabel),
          ],
        ],
      ),
    );

    final evidence = m.evidenceId != null && onShowMe != null;
    final content = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          lines,
          const SizedBox(height: MmSpace.s12),
          AnimatedSwitcher(
            duration: Motion.of(context, Motion.crossFade),
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
            child: Text(m.meaning, key: ValueKey(m.meaning), style: type.body.copyWith(color: colors.ink2)),
          ),
          if (m.basisLine != null || evidence) ...[
            const SizedBox(height: MmSpace.s8),
            Row(
              children: [
                if (evidence) ...[ShowMeTag(onTap: onShowMe!, marks: m.evidence), const SizedBox(width: MmSpace.s12)],
                if (m.basisLine != null) Expanded(child: Text(m.basisLine!, style: type.caption.copyWith(color: colors.ink3))),
              ],
            ),
          ],
          // Whenever the move can change size the chips are here, and the key says the same
          // length the chip does: a repair in minutes, practice in questions.
          if (m.durations.length > 1) ...[
            const SizedBox(height: MmSpace.s16),
            if (m.durationPrompt != null) ...[
              Text(m.durationPrompt!, style: type.labelLarge),
              const SizedBox(height: MmSpace.s8),
            ],
            MmSegmented<int>(
              semanticsLabel: m.durationPrompt ?? (m.durations.first.questions == null ? TodayCopy.repairLength : TodayCopy.practiceLength),
              segments: [for (final d in m.durations) MmSegment(d.minutes, d.label)],
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
      art: mobi ? null : HeroArtView(art: m.art),
      child: content,
    );
  }
}

/// A short label kept to one line: it scales down to fit instead of wrapping mid-word.
class _OneLine extends StatelessWidget {
  const _OneLine(this.text, {required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) => FittedBox(
    fit: BoxFit.scaleDown,
    alignment: Alignment.centerLeft,
    child: Text(text, style: style, maxLines: 1, softWrap: false),
  );
}
