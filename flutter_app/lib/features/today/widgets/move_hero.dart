// Tonight's move: the subject's object in lamp light (or Mobi at a human moment), one
// monumental number and what it means, the evidence one tap away, a duration chooser when the
// task can change size, and the screen's one volt pill. The number sits beside the object, so
// the card reads top to bottom without a hole; changing the duration rolls the number and
// reshapes the task in place without moving the pill.
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
import 'today_type.dart';

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
    this.keysCovered,
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

  /// On the primary key, so the screen can tell whether it is in view (when it is not, the bar's
  /// capsule carries tonight's move).
  final GlobalKey? primaryKey;

  /// True while the pinned bar stands in for the card's keys: what sits under the primary key
  /// (the quiet alternative and its caption) is then under the bar's ground, so it takes no
  /// touches and is not announced; the bar carries both keys.
  final ValueListenable<bool>? keysCovered;

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
        // A failed read has no overline: the bubble and the line under it already say so.
        if (m.overline.isNotEmpty)
          _OneLine(m.overline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
        if (m.subjectLine != null) ...[
          if (m.overline.isNotEmpty) const SizedBox(height: MmSpace.s4),
          // The subject is the stage's title: headline size, one line. Beside the object it keeps
          // the art's 12 dp of air (heroArtClear) and scales down rather than run into it.
          _OneLine(m.subjectLine!, style: mobi ? type.stageSubject : type.headline),
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
            child: Semantics(header: true, child: Text(m.headline!, style: type.stageLead.copyWith(color: colors.ink))),
          ),
        ],
        if (m.number != null) ...[
          const SizedBox(height: MmSpace.s12),
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
      // The card's own rhythm (SPACING.md 3.2): 20 at the top and 20 at the bottom.
      padding: const EdgeInsets.all(MmSpace.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          lines,
          SizedBox(height: mobi ? MmSpace.s12 : MmSpace.s8),
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
                  const SizedBox(height: MmSpace.s8),
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
          const SizedBox(height: MmSpace.s16),
          // Offline, the reason stands above the key where the eye is, not under it (that part
          // of the card sits behind the dock at rest).
          if (blocked) ...[const _NeedsConnection(), const SizedBox(height: MmSpace.s8)],
          LayoutBuilder(
            key: primaryKey,
            builder: (context, box) => KeyButton(
              label: fitKeyLabel(context, m.primary, box.maxWidth),
              semanticsLabel: m.primary.label,
              onPressed: blocked
                  ? null
                  : () {
                      // The card grows into the page it opens (MOTION.md C4): the router's
                      // container pages take this rect; any other page ignores it.
                      if (m.primary.target is GoTo) MmLaunchRect.capture(context);
                      onAction(m.primary);
                    },
              loading: retrying && m.primary.target is RetryLoad,
            ),
          ),
          _UnderBar(
            covered: keysCovered,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (m.secondary != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  Center(
                    child: KeyButton.quiet(
                      label: m.secondary!.label,
                      onPressed: offline && m.secondary!.startsSession ? null : () => onAction(m.secondary!),
                    ),
                  ),
                ],
                if (m.caption != null || m.dismissedLine != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  Text(
                    m.dismissedLine ?? m.caption!,
                    textAlign: TextAlign.center,
                    style: type.caption.copyWith(color: colors.ink3),
                  ),
                ],
              ],
            ),
          ),
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

/// Why the key is off while the phone is offline: one quiet line with the offline mark.
class _NeedsConnection extends StatelessWidget {
  const _NeedsConnection();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(LucideIcons.wifiOff, size: 14, color: colors.ink2),
        const SizedBox(width: MmSpace.s6),
        Flexible(child: Text(TodayCopy.connectToStart, style: context.mmType.small.copyWith(color: colors.ink2), textAlign: TextAlign.center)),
      ],
    );
  }
}

/// The part of the card under its primary key. While [covered] is true the pinned bar's ground
/// hides it: it ignores touches (a tap there scrolls nothing and opens nothing unseen) and leaves
/// the semantics tree, since the bar's own keys say the same.
class _UnderBar extends StatelessWidget {
  const _UnderBar({required this.covered, required this.child});

  final ValueListenable<bool>? covered;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final listenable = covered;
    if (listenable == null) return child;
    return ValueListenableBuilder<bool>(
      valueListenable: listenable,
      child: child,
      builder: (context, hidden, child) => IgnorePointer(
        ignoring: hidden,
        child: ExcludeSemantics(excluding: hidden, child: child!),
      ),
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
