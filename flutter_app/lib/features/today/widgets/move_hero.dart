// Tonight's move: the subject's object in lamp light (or Mobi at a human moment), one
// monumental number and what it means, the evidence one tap away, a duration chooser when the
// task can change size, and the screen's one volt pill. The number sits beside the object, so
// the card reads top to bottom without a hole; changing the duration rolls the number and
// reshapes the task in place without moving the pill.
import 'package:flutter/material.dart';

import '../../../core/domain/next_move.dart' show NextMoveState;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'mobi_moment.dart';
import 'move_keys.dart';
import 'number_block.dart';
import 'show_me_tag.dart';
import 'today_entrance.dart';

class MoveHeroCard extends StatelessWidget {
  const MoveHeroCard({
    super.key,
    required this.move,
    required this.onAction,
    this.onMinutes,
    this.onShowMe,
    this.offline = false,
    this.retrying = false,
    this.mobiController,
    this.primaryKey,
  });

  final MoveHero move;
  final void Function(TodayAction action) onAction;
  final ValueChanged<int>? onMinutes;
  final VoidCallback? onShowMe;
  final bool offline;

  /// A Try again read is running: a key that retries shows it is working.
  final bool retrying;

  /// Lets the screen make Mobi react later (a tap on a chip, coming back to the tab).
  final MobiController? mobiController;

  /// On the primary key, so the screen can tell whether it is in view (see [StickyMoveBar]).
  final GlobalKey? primaryKey;

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
    // A scheduled first check ("Your check is set for 8:00 PM.") is supporting detail: it sits
    // under the body copy, not between the title and the number.
    final headlineBelow = m.state == NextMoveState.newUser && m.headline != null;
    // A failed read says so in full contrast; every other body is the quieter second ink.
    final bodyColor = m.state == NextMoveState.historyUnavailable ? colors.ink : colors.ink2;
    // Beside the object: the overline, the subject and the number. Under Mobi: the full width.
    final besideArt = mobi ? 0.0 : heroArtClear - MmSpace.cardPadding;

    final top = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _OneLine(m.overline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
        if (m.subjectLine != null) ...[
          const SizedBox(height: 2),
          // The subject is the stage's title: headline size, one line.
          _OneLine(m.subjectLine!, style: mobi ? type.title.copyWith(fontSize: 22, height: 26 / 22) : type.headline),
        ],
      ],
    );
    final lines = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(right: besideArt),
          child: mobi ? MobiMoment(pose: HeroArtView.poseFor(m.art.art), say: moodLine(m), controller: mobiController, lines: top) : top,
        ),
        if (m.headline != null && !headlineBelow) ...[
          const SizedBox(height: MmSpace.s8),
          Padding(
            padding: EdgeInsets.only(right: besideArt),
            child: Semantics(header: true, child: Text(m.headline!, style: type.labelLarge.copyWith(color: colors.ink, fontSize: 16, height: 22 / 16))),
          ),
        ],
        if (m.number != null) ...[
          SizedBox(height: mobi ? MmSpace.s12 : MmSpace.s8),
          // The number stands clear of the object; its meaning goes beside it only when both
          // fit that column, otherwise under it on one line (where the object has ended).
          LayoutBuilder(
            builder: (context, box) => NumberBlock(number: m.number!, label: m.numberLabel, besideWidth: box.maxWidth - besideArt),
          ),
        ],
      ],
    );

    final evidence = m.evidenceId != null && onShowMe != null;
    final content = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          lines,
          SizedBox(height: mobi ? MmSpace.s16 : MmSpace.s12),
          // First the number, then the details (Revolut's staging): the evidence rises in after.
          TodayEnter(
            delay: const Duration(milliseconds: 260),
            rise: 8,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AnimatedSwitcher(
                  duration: Motion.of(context, Motion.crossFade),
                  layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
                  child: Text(m.meaning, key: ValueKey(m.meaning), style: type.body.copyWith(color: bodyColor)),
                ),
                if (headlineBelow) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(m.headline!, style: type.caption.copyWith(color: colors.ink2)),
                ],
                if (m.basisLine != null || evidence) ...[
                  const SizedBox(height: MmSpace.s12),
                  Row(
                    children: [
                      if (evidence) ...[ShowMeTag(onTap: onShowMe!, marks: m.evidence), const SizedBox(width: MmSpace.s12)],
                      if (m.basisLine != null) Expanded(child: Text(m.basisLine!, style: type.caption.copyWith(color: colors.ink3))),
                    ],
                  ),
                ],
              ],
            ),
          ),
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
          LayoutBuilder(
            key: primaryKey,
            builder: (context, box) => KeyButton(
              label: fitKeyLabel(context, m.primary, box.maxWidth),
              semanticsLabel: m.primary.label,
              onPressed: blocked ? null : () => onAction(m.primary),
              loading: retrying && m.primary.target is RetryLoad,
              disabledReason: blocked ? TodayCopy.connectToStart : null,
            ),
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
