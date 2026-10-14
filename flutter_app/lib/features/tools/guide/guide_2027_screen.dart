import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../tools_paths.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import '../widgets/web_link.dart';
import 'guide_content.dart';

/// The CUET 2027 guide (`/tools/guide-2027`): the expected timeline as a column of answer
/// bubbles (inked once a window has passed, ringed for the one you are in), what is known about
/// the pattern, how to choose subjects (into Combo and Compass), and the common questions.
class Guide2027Screen extends ConsumerWidget {
  const Guide2027Screen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(nowProvider)();
    return ToolsPage(
      title: ToolsCopy.guidePageTitle,
      lead: guideIntro,
      slivers: [
        SliverToBoxAdapter(
          child: ToolsCard(
            lit: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < guideTimeline.length; i++)
                  _TimelineRow(milestone: guideTimeline[i], now: now, last: i == guideTimeline.length - 1),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(child: _Section(section: guidePattern)),
        SliverToBoxAdapter(child: _Section(section: guideSubjects)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12),
            child: YouPanel(
              children: [
                YouRow(icon: LucideIcons.layoutGrid, title: ToolsCopy.comboTitle, note: ToolsCopy.comboNote, onTap: () => context.push(ToolsPaths.combo)),
                YouRow(icon: LucideIcons.compass, title: ToolsCopy.compassTitle, note: ToolsCopy.compassQuestion, onTap: () => context.push(ToolsPaths.compass)),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.guideCommonQuestions)),
        SliverToBoxAdapter(child: YouPanel(children: [for (final (q, a) in guideFaqs) _Faq(question: q, answer: a)])),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s24),
            child: YouPanel(
              children: [
                YouRow(
                  icon: LucideIcons.bookOpen,
                  title: ToolsCopy.pyqTitle,
                  note: ToolsCopy.pyqNote,
                  external: true,
                  onTap: () => openWebPage(ref, ToolsPaths.pyqGuideWebPath),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.milestone, required this.now, required this.last});

  final GuideMilestone milestone;
  final DateTime now;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = milestone;
    final passed = !now.isBefore(m.end);
    final current = !passed && !now.isBefore(m.start);
    final state = passed ? ToolsCopy.guidePassed : current ? ToolsCopy.guideNow : (m.expected ? ToolsCopy.guideExpected : ToolsCopy.guideComingUp);
    return MergeSemantics(
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 28,
              child: Column(
                children: [
                  Bubble(
                    state: passed || current ? BubbleState.filled : BubbleState.hollow,
                    emphasis: current,
                    size: 16,
                    animate: false,
                    semanticsLabel: state,
                  ),
                  if (!last)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: MmSpace.s4),
                        child: SizedBox(width: 1.5, height: double.infinity, child: ColoredBox(color: colors.ink4)),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: last ? 0 : MmSpace.s20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(m.when, style: type.caption.copyWith(color: current ? colors.accentText : colors.ink3, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(child: Text(m.title, style: type.cardTitle)),
                        if (m.expected) ...[const SizedBox(width: MmSpace.s8), const ToolTag(ToolsCopy.guideExpected)],
                        if (current) ...[const SizedBox(width: MmSpace.s8), const ToolTag(ToolsCopy.guideNow, tone: ToolTone.good)],
                      ],
                    ),
                    const SizedBox(height: MmSpace.s4),
                    Text(m.body, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.section});

  final GuideSection section;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsHeading(section.heading),
        for (final p in section.body)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, 0, MmSpace.gutter + 4, MmSpace.s12),
            child: Text(p, style: type.body.copyWith(color: context.mmColors.ink2)),
          ),
      ],
    );
  }
}

/// A question that opens to its answer in place (200 ms; instant under reduced motion).
class _Faq extends StatefulWidget {
  const _Faq({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  State<_Faq> createState() => _FaqState();
}

class _FaqState extends State<_Faq> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final duration = Motion.reduced(context) ? Duration.zero : Motion.ui;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          expanded: _open,
          child: RowFrame(
            onTap: () => setState(() => _open = !_open),
            semanticsLabel: widget.question,
            child: Row(
              children: [
                Expanded(child: Text(widget.question, style: type.labelLarge)),
                const SizedBox(width: MmSpace.s8),
                AnimatedRotation(
                  turns: _open ? 0.5 : 0,
                  duration: duration,
                  child: Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                ),
              ],
            ),
          ),
        ),
        AnimatedSize(
          duration: duration,
          curve: Motion.glide,
          alignment: Alignment.topCenter,
          child: _open
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s16),
                  child: Text(widget.answer, style: type.small.copyWith(color: colors.ink2)),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
