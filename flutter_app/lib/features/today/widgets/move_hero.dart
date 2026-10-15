// Tonight's move: the subject's object in lamp light (or Mobi at a human moment), one
// monumental number and what it means, the evidence one tap away, a duration chooser when the
// task can change size, and the screen's one volt pill. The number sits beside the object, so
// the card reads top to bottom without a hole; changing the duration rolls the number and
// reshapes the task in place without moving the pill.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/next_move.dart' show NextMoveState;
import '../../../core/motion/flight.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
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

class MoveHeroCard extends StatefulWidget {
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
    this.controlsKey,
    this.keyPulse,
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

  /// On the length selector, so the screen knows where the card's other controls are.
  final GlobalKey? controlsKey;

  /// A short pulse (0 to 1 to 0 over 160 ms) the screen plays on the primary key when it comes
  /// back into view after the bar's capsule stood in for it.
  final Animation<double>? keyPulse;

  /// Mobi's line for a mood when the move did not set one.
  static String? moodLine(MoveHero m) =>
      m.mobiLine ??
      switch (m.mood) {
        TodayMood.returning => TodayCopy.mobiWelcomeBack,
        TodayMood.lateNight => TodayCopy.lateNight,
        _ => null,
      };

  @override
  State<MoveHeroCard> createState() => _MoveHeroCardState();
}

class _MoveHeroCardState extends State<MoveHeroCard> with SingleTickerProviderStateMixin {
  /// The hero object's answer to touch and to the duration chip, and the stage light that swells
  /// with it (full on a tap, 60% on a chip change, timed with the number's roll).
  late final HeroReact _react = HeroReact(vsync: this);

  @override
  void didUpdateWidget(MoveHeroCard old) {
    super.didUpdateWidget(old);
    final was = old.move.selectedMinutes;
    final now = widget.move.selectedMinutes;
    if (was != null && now != null && was != now && !Motion.reduced(context)) _react.fire(HeroReact.chipAmplitude);
  }

  @override
  void dispose() {
    _react.dispose();
    super.dispose();
  }

  void _touchObject() {
    // The object's own reaction gives the light tick; reduced motion keeps the tick, not the motion.
    _react.fire(1, animate: !Motion.reduced(context));
  }

  @override
  Widget build(BuildContext context) {
    final move = widget.move;
    final onAction = widget.onAction;
    final onMinutes = widget.onMinutes;
    final onShowMe = widget.onShowMe;
    final offline = widget.offline;
    final retrying = widget.retrying;
    final mobiController = widget.mobiController;
    final primaryKey = widget.primaryKey;
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
          child: mobi ? MobiMoment(pose: HeroArtView.poseFor(m.art.art), say: MoveHeroCard.moodLine(m), controller: mobiController, lines: top) : top,
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
            builder: (context, box) => NumberBlock(
              number: m.number!,
              label: m.numberLabel,
              besideWidth: box.maxWidth - besideArt,
              // One figure per state and subject: a rebuilt hero rolls on from the count it showed.
              memoryKey: 'today.hero.${m.state.name}.${m.subjectId ?? 'none'}',
            ),
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
                // The line under the number changes with the chip ("3 of the 4 open mistakes" to
                // "All 4"): the words overlap on the shared rule and the card's height eases with a
                // second line instead of jumping.
                MmSizeEase(
                  duration: Motion.ui,
                  curve: Motion.out,
                  alignment: Alignment.topLeft,
                  clipBehavior: Clip.none,
                  child: MmOverlapSwitcher.fade(
                    alignment: Alignment.topLeft,
                    child: Text(m.meaning, key: ValueKey(m.meaning), style: type.body.copyWith(color: bodyColor)),
                  ),
                ),
                if (headlineBelow) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(m.headline!, style: type.caption.copyWith(color: colors.ink2)),
                ],
                if (m.basisLine != null || evidence) ...[
                  const SizedBox(height: MmSpace.s8),
                  Row(
                    children: [
                      if (evidence) ...[ShowMeTag(onTap: onShowMe, marks: m.evidence), const SizedBox(width: MmSpace.s12)],
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
            KeyedSubtree(
              key: widget.controlsKey,
              child: MmSegmented<int>(
                semanticsLabel: m.durationPrompt ?? (m.durations.first.questions == null ? TodayCopy.repairLength : TodayCopy.practiceLength),
                segments: [for (final d in m.durations) MmSegment(d.minutes, d.label)],
                value: m.selectedMinutes ?? m.durations.first.minutes,
                onChanged: onMinutes,
              ),
            ),
          ],
          const SizedBox(height: MmSpace.s16),
          // Offline, the reason stands above the key where the eye is, not under it (that part
          // of the card sits behind the dock at rest).
          // It opens and closes with the connection instead of cutting in above the key.
          KeyReveal(show: blocked, child: const Padding(padding: EdgeInsets.only(bottom: MmSpace.s8), child: _NeedsConnection())),
          LayoutBuilder(
            key: primaryKey,
            builder: (context, box) => _Pulse(
              pulse: widget.keyPulse,
              child: KeyButton(
                label: fitKeyLabel(context, m.primary, box.maxWidth),
                semanticsLabel: m.primary.label,
                onPressed: blocked
                    ? null
                    : () {
                        // The card grows into the page it opens (MOTION.md C4): the router's
                        // container pages take this rect; any other page ignores it. Its object
                        // flies on into the page when that page shows the same subject (M2).
                        if (m.primary.target is GoTo) {
                          MmLaunchRect.capture(context);
                          if (!mobi && m.subjectId != null) MmFlight.launch(this.context, m.subjectId);
                        }
                        onAction(m.primary);
                      },
                loading: retrying && m.primary.target is RetryLoad,
              ),
            ),
          ),
          // What sits under the key (the quiet second action, the caption) eases in and out with the
          // move's state: a key that was retrying, or a dismissed line, never makes the card jump.
          MmSizeEase(
            duration: Motion.ui,
            curve: Motion.out,
            alignment: Alignment.topCenter,
            clipBehavior: Clip.none,
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
      react: _react,
      art: mobi ? null : HeroArtView(art: m.art, react: _react, onTap: _touchObject),
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

/// A short swell on its child (1 to 1.04 to 1), driven by [pulse]; the child when there is none.
class _Pulse extends StatelessWidget {
  const _Pulse({required this.pulse, required this.child});

  final Animation<double>? pulse;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final p = pulse;
    if (p == null) return child;
    return AnimatedBuilder(
      animation: p,
      child: child,
      builder: (context, child) => Transform.scale(scale: 1 + 0.04 * math.sin(math.pi * p.value), child: child),
    );
  }
}
