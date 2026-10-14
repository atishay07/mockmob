import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/repair.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/retry.dart';
import '../data/review_providers.dart';
import 'review_bits.dart' show FlushKey;

/// A labelled block of the worked explanation. The body never moves once shown.
class ExplanationBlock extends StatelessWidget {
  const ExplanationBlock({super.key, required this.label, required this.paragraphs});

  final String label;
  final List<String> paragraphs;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = [
      for (final p in paragraphs)
        if (p.trim().isNotEmpty) p.trim(),
    ];
    if (shown.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(label, style: type.label.copyWith(color: colors.ink2)),
          ),
          const SizedBox(height: MmSpace.s8),
          for (var i = 0; i < shown.length; i++) ...[if (i > 0) const SizedBox(height: MmSpace.s8), Text(shown[i], style: type.body)],
        ],
      ),
    );
  }
}

/// The worked explanation of an `explained` or `stored` repair. Observed patterns about the
/// option, never a statement about the student.
///
/// A v2 repair leads with the trap's name, then "Why B looked right" and "Where it breaks",
/// "Another way to see it" with its worked contrast pulled out, the rule as a raised card to keep,
/// and the next step. A v1 repair (stored before v2) keeps its three blocks. The blocks rise
/// 60 ms apart as the explanation lands; the rule's rail draws last. Under reduced motion every
/// block is simply there.
class WorkedExplanation extends StatelessWidget {
  const WorkedExplanation({super.key, required this.explanation, this.chosenLetter});

  final RepairExplanation explanation;

  /// The letter of the option the student picked ("B"), for "Why B looked right".
  final String? chosenLetter;

  /// The beat between blocks.
  static const step = Duration(milliseconds: 60);

  @override
  Widget build(BuildContext context) {
    final e = explanation;
    if (!e.isV2) {
      final blocks = <Widget>[
        ExplanationBlock(label: ReviewCopy.whatHappened, paragraphs: [e.whyTempting ?? '', e.whyWrong ?? '']),
        ExplanationBlock(label: ReviewCopy.theIdea, paragraphs: [e.keyIdea]),
        ExplanationBlock(label: ReviewCopy.nextTime, paragraphs: [e.nextStep ?? '']),
      ];
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [for (var i = 0; i < blocks.length; i++) MmEntrance(delay: step * i, child: blocks[i])],
      );
    }
    final colors = context.mmColors;
    final type = context.mmType;
    final blocks = <Widget>[
      Padding(
        padding: const EdgeInsets.only(top: MmSpace.s24),
        child: Semantics(header: true, child: Text(e.trapHeading!, style: type.cardTitle)),
      ),
      if (e.whyTempting != null) ExplanationBlock(label: ReviewCopy.whyLookedRight(chosenLetter), paragraphs: [e.whyTempting!]),
      if (e.whyWrong != null) ExplanationBlock(label: ReviewCopy.whereItBreaks, paragraphs: [e.whyWrong!]),
      if (e.anotherWay != null || e.contrast != null)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ExplanationBlock(label: ReviewCopy.anotherWay, paragraphs: [e.anotherWay ?? '']),
            if (e.contrast != null) _ContrastPull(text: e.contrast!, colors: colors, type: type),
          ],
        ),
    ];
    final ruleDelay = step * (blocks.length + 1);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < blocks.length; i++) MmEntrance(delay: step * i, child: blocks[i]),
        MmEntrance(delay: step * blocks.length, child: RuleCard(rule: e.rule!, railDelay: ruleDelay + Motion.enterDuration ~/ 2)),
        if (e.nextStep != null)
          MmEntrance(
            delay: step * (blocks.length + 1),
            child: ExplanationBlock(label: ReviewCopy.nextTime, paragraphs: [e.nextStep!]),
          ),
      ],
    );
  }
}

/// The worked contrast, pulled out of the paragraph on a sunken ground with a hairline at its
/// leading edge, so "if X then B; here Y, so C" reads as its own small proof.
class _ContrastPull extends StatelessWidget {
  const _ContrastPull({required this.text, required this.colors, required this.type});

  final String text;
  final MmColors colors;
  final MmType type;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s12),
      child: DecoratedBox(
        decoration: ShapeDecoration(color: colors.sunken, shape: mmShapeBorder(MmRadius.smallAll)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
          child: Text(text, style: type.body.copyWith(color: colors.ink)),
        ),
      ),
    );
  }
}

/// The rule to keep, given weight: a raised card, "Keep this" over the rule, and Copy. Its leading
/// rail draws in last, after the blocks above have landed. The rule never moves once shown.
class RuleCard extends StatefulWidget {
  const RuleCard({super.key, required this.rule, this.railDelay = Duration.zero});

  final String rule;
  final Duration railDelay;

  @override
  State<RuleCard> createState() => _RuleCardState();
}

class _RuleCardState extends State<RuleCard> {
  bool _copied = false;

  static Path _rail(Size size) => Path()
    ..moveTo(size.width / 2, 0)
    ..lineTo(size.width / 2, size.height);

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.rule));
    if (!mounted) return;
    setState(() => _copied = true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s16, MmSpace.s4, MmSpace.s8),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 4,
                  child: RepaintBoundary(
                    child: MmStrokeDraw(path: _rail, color: colors.volt, strokeWidth: 3, delay: widget.railDelay),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(header: true, child: Text(ReviewCopy.keepThis, style: type.label.copyWith(color: colors.ink2))),
                      const SizedBox(height: MmSpace.s8),
                      Padding(
                        padding: const EdgeInsets.only(right: MmSpace.s12),
                        child: Text(widget.rule, style: type.cardTitle),
                      ),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: KeyButton.quiet(
                          label: _copied ? ReviewCopy.copiedRule : ReviewCopy.copyRule,
                          semanticsLabel: _copied ? ReviewCopy.copiedRule : ReviewCopy.copyRuleSpoken,
                          onPressed: _copy,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A calm notice inside the work layer, as one line of text on the ground: a small glyph and the
/// plain sentence, then up to two quiet text actions. No box, no border, no tint: a notice is a
/// sentence, not a second card under the question.
class NoticePanel extends StatelessWidget {
  const NoticePanel({super.key, required this.message, this.detail, this.primary, this.secondary, this.icon = LucideIcons.info});

  final String message;
  final String? detail;
  final StateAction? primary;
  final StateAction? secondary;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            liveRegion: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Icon(icon, size: 16, color: colors.ink2),
                ),
                const SizedBox(width: MmSpace.s8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(message, style: type.small.copyWith(color: colors.ink)),
                      if (detail != null) ...[
                        const SizedBox(height: MmSpace.s2),
                        Text(detail!, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (primary != null) FlushKey(label: primary!.label, onPressed: primary!.onPressed),
          if (secondary != null) FlushKey(label: secondary!.label, onPressed: secondary!.onPressed),
        ],
      ),
    );
  }
}

/// The concept that explains this chapter, through the Learn routes. Hidden while study
/// content is off or no lesson matches.
class ConceptRow extends ConsumerWidget {
  const ConceptRow({super.key, required this.chapter});

  final String chapter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final link = ref.watch(conceptLinkProvider(chapter));
    if (link == null) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Divider(height: 1, color: colors.line),
          MmPressable(
            onTap: () => context.push(AppRoutes.learnUnit(link.unitId)),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: '${ReviewCopy.concept}: ${link.title}',
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 64),
              child: Row(
                children: [
                  Icon(LucideIcons.bookOpen, size: 20, color: colors.ink2),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ReviewCopy.concept, style: type.caption.copyWith(color: colors.ink2)),
                        Text(link.title, style: type.labelLarge),
                      ],
                    ),
                  ),
                  Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The optional retry: a separate 5-question practice in the chapter, with its own cost.
class RetryCard extends ConsumerWidget {
  const RetryCard({super.key, required this.subjectId, required this.chapter});

  /// Internal subject id.
  final String subjectId;
  final String chapter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offer = ref.watch(retryOfferProvider(subjectId)).value;
    final colors = context.mmColors;
    final type = context.mmType;
    return switch (offer) {
      RetryAvailable(:final subjectId, :final cost, :final free) => Padding(
        padding: const EdgeInsets.only(top: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Divider(height: 1, color: colors.line),
            const SizedBox(height: MmSpace.s16),
            Text(ReviewCopy.retryTitle(chapter), style: type.cardTitle),
            const SizedBox(height: MmSpace.s4),
            Text(ReviewCopy.retryLine(cost, free), style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: ReviewCopy.retryKey, onPressed: () => context.push(retryRoute(subjectId, chapter))),
          ],
        ),
      ),
      RetryShortOfCredits() => Padding(
        padding: const EdgeInsets.only(top: MmSpace.s24),
        child: Text(ReviewCopy.retryShort, style: type.small.copyWith(color: colors.ink2)),
      ),
      _ => const SizedBox.shrink(),
    };
  }
}
