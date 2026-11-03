import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'subject_hub_copy.dart';
import 'subject_hub_data.dart';

const List<FontFeature> _tabular = [FontFeature.tabularFigures()];

/// A section's heading with an optional line under it, on the gutter.
class HubHeading extends StatelessWidget {
  const HubHeading(this.title, {super.key, this.note});

  final String title;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.section, MmSpace.gutter, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(title, style: type.title)),
          if (note != null) ...[
            const SizedBox(height: MmSpace.s4),
            Text(note!, style: type.small.copyWith(color: colors.ink2)),
          ],
        ],
      ),
    );
  }
}

/// Paragraphs of running text on the gutter.
class HubProse extends StatelessWidget {
  const HubProse(this.paragraphs, {super.key, this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter)});

  final List<String> paragraphs;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < paragraphs.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s12),
            Text(paragraphs[i], style: context.mmType.body.copyWith(color: colors.ink2)),
          ],
        ],
      ),
    );
  }
}

/// The subject's own record, beside its object: what the student has answered here, in one line
/// with its denominator and the span it covers.
class HubRecordText extends StatelessWidget {
  const HubRecordText({super.key, required this.title, this.note, this.action});

  final String title;
  final String? note;

  /// A recovery key under the text (the read failed).
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(title, style: type.title.copyWith(fontFeatures: _tabular)),
        if (note != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(note!, style: type.small.copyWith(color: colors.ink2, fontFeatures: _tabular)),
        ],
        if (action != null) ...[const SizedBox(height: MmSpace.s8), action!],
      ],
    );
  }
}

/// The reading state of [HubRecordText]: three quiet lines in the shape of the text.
class HubRecordSkeleton extends StatelessWidget {
  const HubRecordSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: SubjectHubCopy.loadingRecord,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton.line(width: 150, height: 20),
          SizedBox(height: MmSpace.s8),
          Skeleton.line(width: 190, height: 14),
        ],
      ),
    );
  }
}

/// One chapter: the whole row is the way into practising it (48 dp or more, with a chevron). The
/// bar and the counts come from the student's own answers; a percentage is printed only from
/// [minAnswersForPercent] answers, and a chapter with none says so in words, never as zero.
class HubChapterRow extends StatelessWidget {
  const HubChapterRow({super.key, required this.chapter, required this.record, required this.showStanding, required this.onTap});

  final String chapter;
  final ChapterRecord? record;

  /// True when the attempts came with their questions, so "no answers" is a fact about the chapter.
  final bool showStanding;
  final VoidCallback onTap;

  /// The second line: counts and standing in words.
  static String? standing(ChapterRecord? r, {required bool showStanding}) {
    if (r == null || !showStanding) return null;
    if (r.answered > 0) {
      final counts = SubjectHubCopy.chapterCounts(r.correct, r.answered);
      return r.percent == null ? '$counts. ${SubjectHubCopy.chapterTooFew}' : counts;
    }
    return r.blank > 0 ? SubjectHubCopy.chapterBlankOnly(r.blank) : SubjectHubCopy.chapterNotPractised;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final line = standing(record, showStanding: showStanding);
    final percent = record?.percent;
    final fraction = record?.fraction;
    final spoken = [
      '${SubjectHubCopy.practiseChapter}: $chapter',
      ?line,
      if (percent != null) '$percent percent',
    ].join('. ');
    return MmPressable(
      onTap: onTap,
      semanticsLabel: spoken,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.99,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(chapter, style: type.labelLarge),
                    if (fraction != null) ...[
                      const SizedBox(height: MmSpace.s8),
                      HubBar(fraction: fraction),
                    ],
                    if (line != null) ...[
                      SizedBox(height: fraction != null ? MmSpace.s8 : MmSpace.s2),
                      Text(line, style: type.caption.copyWith(color: colors.ink2, fontFeatures: _tabular)),
                    ],
                  ],
                ),
              ),
              if (percent != null) ...[
                const SizedBox(width: MmSpace.s12),
                Text('$percent%', style: type.labelLarge.copyWith(fontFeatures: _tabular)),
              ],
              const SizedBox(width: MmSpace.s8),
              Padding(
                padding: const EdgeInsets.only(top: MmSpace.s2),
                child: Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A thin bar of the share right. Neutral ink on a hairline track: the figure beside it carries
/// the meaning, so the bar never depends on colour.
class HubBar extends StatelessWidget {
  const HubBar({super.key, required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox(
        height: 4,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: colors.line),
              FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: fraction.clamp(0.0, 1.0),
                child: ColoredBox(color: colors.ink2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A hairline between rows of a list, inset to the gutter.
class HubRule extends StatelessWidget {
  const HubRule({super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
    child: SizedBox(height: 1, child: ColoredBox(color: context.mmColors.line)),
  );
}

/// A heading that opens to its text in place (a guide section, a question and its answer). The
/// whole row is the target, the chevron turns, the text grows over [Motion.ui] and is simply
/// there under reduced motion.
class HubDisclosure extends StatefulWidget {
  const HubDisclosure({super.key, required this.title, required this.paragraphs});

  final String title;
  final List<String> paragraphs;

  @override
  State<HubDisclosure> createState() => _HubDisclosureState();
}

class _HubDisclosureState extends State<HubDisclosure> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final duration = Motion.of(context, Motion.ui);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          expanded: _open,
          child: MmPressable(
            onTap: () => setState(() => _open = !_open),
            semanticsLabel: widget.title,
            focusRadius: MmRadius.smallAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            pressedScale: 0.99,
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
                child: Row(
                  children: [
                    Expanded(child: Text(widget.title, style: type.labelLarge)),
                    const SizedBox(width: MmSpace.s12),
                    AnimatedRotation(
                      turns: _open ? 0.5 : 0,
                      duration: duration,
                      curve: Motion.glide,
                      child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        MmSizeEase(
          duration: Motion.ui,
          curve: Motion.glide,
          alignment: Alignment.topCenter,
          child: _open
              ? HubProse(widget.paragraphs, padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s16))
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
