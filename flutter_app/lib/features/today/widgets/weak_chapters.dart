// Weak chapters on Today (TODAY-1018 section 3 row 5 and 6.5; D18), as ordered bars (D52 item 4,
// TODAY-SWIPE-1018): where the marks go, chapter by chapter, over the last papers. Each row is the
// chapter, its misses and its marks open, with a bar sized to those marks against the top chapter's;
// the top bar is in the warning colour, the rest neutral. The whole row is the one target: it opens
// in place to a 10-question set on the chapter and its newest wrong answers with their full stems
// (never truncated), each with one action: Repair when open, See repair with "Repaired" when it
// already has one (F17: never a paid repair again). No "Practise" pill repeats on every row.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy_ahead.dart';
import '../copy_glance.dart';
import '../logic/today_model.dart';
import 'today_type.dart';
import 'glance_rows.dart' show GlanceHead, GlanceLink;

class WeakChaptersBlock extends StatefulWidget {
  const WeakChaptersBlock({super.key, required this.weak, this.onOpen, this.onRetry, this.initialOpen});

  final WeakChapters weak;
  final void Function(TodayTarget target)? onOpen;
  final VoidCallback? onRetry;

  /// A row open from the start (goldens and tests).
  final int? initialOpen;

  @override
  State<WeakChaptersBlock> createState() => _WeakChaptersBlockState();
}

class _WeakChaptersBlockState extends State<WeakChaptersBlock> {
  late int? _open = widget.initialOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = widget.weak;
    final Widget body;
    if (w.failed) {
      body = Row(
        children: [
          Expanded(child: Text(GlanceCopy.weakFailed, style: type.body.copyWith(color: colors.ink))),
          if (widget.onRetry != null) KeyButton.quiet(label: GlanceCopy.tryAgain, onPressed: widget.onRetry),
        ],
      );
    } else if (w.dayOne || w.rows.isEmpty) {
      final line = !w.dayOne
          ? GlanceCopy.weakNone
          : (w.startChapters.isEmpty ? GlanceCopy.weakDayOne : GlanceCopy.weakDayOneStart(w.startChapters));
      body = Text(line, style: type.body.copyWith(color: colors.ink2));
    } else {
      // The bars are sized against the top chapter's marks (the rows come ranked by them).
      final top = w.rows.map((r) => r.marks).fold<int>(0, (a, b) => b > a ? b : a);
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var k = 0; k < w.rows.length; k++) ...[
            Divider(height: 1, thickness: 1, color: colors.line),
            _Row(
              chapter: w.rows[k],
              share: top <= 0 ? 0 : w.rows[k].marks / top,
              lead: k == 0,
              open: _open == k,
              onToggle: () {
                HapticFeedback.selectionClick();
                setState(() => _open = _open == k ? null : k);
              },
              onOpen: widget.onOpen,
            ),
          ],
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s12),
          Text(AheadCopy.weakHint, style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink3)),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        GlanceHead(title: GlanceCopy.weakTitle, sub: w.rows.isEmpty ? null : GlanceCopy.weakSub(w.papers)),
        const SizedBox(height: MmSpace.s8),
        body,
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.chapter, required this.share, required this.lead, required this.open, required this.onToggle, this.onOpen});

  final WeakChapter chapter;

  /// This chapter's marks open over the top chapter's (0 to 1): the bar's length.
  final double share;

  /// The top chapter: its bar is in the warning colour.
  final bool lead;
  final bool open;
  final VoidCallback onToggle;
  final void Function(TodayTarget target)? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = chapter;
    final line = GlanceCopy.weakLine(c.subject, c.missed, c.asked);
    final head = MmPressable(
      onTap: onToggle,
      semanticsLabel: GlanceCopy.weakRowSemantics(c.chapter, line, c.marks, open),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      builder: (context, pressed, _) => Container(
        color: pressed ? colors.raised2.withValues(alpha: 0.5) : Colors.transparent,
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(c.chapter, style: type.labelLarge.copyWith(fontSize: 16, height: 21 / 16, fontWeight: FontWeight.w600, color: colors.ink)),
                      const SizedBox(height: 2),
                      Text(line, style: type.caption.copyWith(fontSize: 13.5, color: colors.ink2)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${c.marks}', style: type.scoreFigure.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                    const SizedBox(width: MmSpace.s4),
                    Text(GlanceCopy.marksLost, style: type.caption.copyWith(fontSize: 13, color: colors.ink3)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            _Bar(share: share, lead: lead),
          ],
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        head,
        MmSizeEase(
          duration: Motion.ui,
          curve: Motion.out,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.hardEdge,
          child: !open
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // The chapter's 10-question set leads the opened row; its mistakes follow.
                      Align(
                        alignment: Alignment.centerLeft,
                        child: _SmallKey(
                          label: AheadCopy.practiseSet,
                          icon: LucideIcons.play,
                          onTap: onOpen == null ? null : () => onOpen!(c.practise),
                        ),
                      ),
                      const SizedBox(height: MmSpace.s8),
                      for (final m in c.mistakes) ...[
                        _Mistake(mistake: m, onOpen: onOpen),
                        const SizedBox(height: MmSpace.s12),
                      ],
                      if (c.wrong > 0)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: GlanceLink(label: GlanceCopy.allInReview(c.wrong), onTap: onOpen == null ? null : () => onOpen!(c.review)),
                        ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}

/// The chapter's marks open as a bar on a sunken track: the top chapter in the warning colour,
/// the rest neutral ink.
class _Bar extends StatelessWidget {
  const _Bar({required this.share, required this.lead});

  final double share;
  final bool lead;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: SizedBox(
          height: 6,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: colors.sunken),
              FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: share.clamp(0.0, 1.0),
                child: DecoratedBox(
                  decoration: BoxDecoration(color: lead ? colors.badText : colors.ink2, borderRadius: BorderRadius.circular(3)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Mistake extends StatelessWidget {
  const _Mistake({required this.mistake, this.onOpen});

  final WeakMistake mistake;
  final void Function(TodayTarget target)? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = mistake;
    // Each mistake on a quiet raised wash (no coloured edge): its head, the full stem, one action.
    return Container(
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s4),
      decoration: BoxDecoration(
        color: colors.isNight ? colors.raised.withValues(alpha: 0.55) : colors.raised.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(m.head, style: type.micro.copyWith(fontSize: 12, color: colors.ink3, fontWeight: FontWeight.w600)),
          const SizedBox(height: MmSpace.s4),
          Text(m.stem, style: type.body.copyWith(fontSize: 14.5, height: 21 / 14.5, color: colors.ink)),
          const SizedBox(height: MmSpace.s6),
          Row(
            children: [
              if (m.repaired) ...[
                Icon(LucideIcons.check, size: 14, color: colors.goodText),
                const SizedBox(width: MmSpace.s4),
                Text(GlanceCopy.repaired, style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: colors.goodText)),
                const SizedBox(width: MmSpace.s12),
              ],
              GlanceLink(label: m.repaired ? GlanceCopy.seeRepair : GlanceCopy.repair, onTap: onOpen == null ? null : () => onOpen!(m.target)),
            ],
          ),
        ],
      ),
    );
  }
}

class _SmallKey extends StatelessWidget {
  const _SmallKey({required this.label, required this.icon, this.onTap});

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.96,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          widthFactor: 1,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 100),
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : Colors.transparent,
              shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 13, color: colors.ink),
                const SizedBox(width: MmSpace.s6),
                Text(label, style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
