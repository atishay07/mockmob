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
                // Said once for the whole timeline, so no row has to repeat it.
                Text(ToolsCopy.guideBasis, style: context.mmType.caption.copyWith(color: context.mmColors.ink2)),
                const SizedBox(height: MmSpace.s20),
                for (var i = 0; i < guideTimeline.length; i++)
                  _TimelineRow(
                    milestone: guideTimeline[i],
                    now: now,
                    last: i == guideTimeline.length - 1,
                    // The rail below this node is volt while the next stop has already begun.
                    reached: i + 1 < guideTimeline.length && !now.isBefore(guideTimeline[i + 1].start),
                  ),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(child: _Section(section: guidePattern)),
        SliverToBoxAdapter(child: _Section(section: guideSubjects)),
        // One flat list of where to go next (the planner, Compass, past papers), not three cards.
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: MmRhythm.group),
            child: ToolsFlatList(
              children: [
                ToolsLinkRow(flat: true, icon: LucideIcons.layoutGrid, title: ToolsCopy.comboTitle, note: ToolsCopy.comboNote, onTap: () => context.push(ToolsPaths.combo)),
                ToolsLinkRow(flat: true, icon: LucideIcons.compass, title: ToolsCopy.compassTitle, note: ToolsCopy.compassQuestion, onTap: () => context.push(ToolsPaths.compass)),
                ToolsLinkRow(
                  flat: true,
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
        const SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.guideCommonQuestions)),
        SliverToBoxAdapter(child: ToolsPanel(children: [for (final (q, a) in guideFaqs) _Faq(question: q, answer: a)])),
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.milestone, required this.now, required this.last, required this.reached});

  final GuideMilestone milestone;
  final DateTime now;
  final bool last;

  /// The next stop has begun, so the rail under this node is the volt one.
  final bool reached;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = milestone;
    final passed = !now.isBefore(m.end);
    final current = !passed && !now.isBefore(m.start);
    final state = passed ? ToolsCopy.guidePassed : current ? ToolsCopy.guideNow : (m.expected ? ToolsCopy.guideExpected : ToolsCopy.guideComingUp);
    final volt = colors.isNight ? colors.volt : colors.accentText;
    return MergeSemantics(
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 28,
              child: Column(
                children: [
                  Semantics(label: state, child: _Node(passed: passed, current: current, volt: volt)),
                  if (!last)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: MmSpace.s4),
                        child: SizedBox(
                          width: 2.5,
                          height: double.infinity,
                          child: DecoratedBox(decoration: BoxDecoration(color: reached ? volt : colors.ink3, borderRadius: BorderRadius.circular(2))),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: last ? 0 : MmSpace.s24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The date is the spine of a timeline: heavier than the words under it.
                    Text(m.when, style: type.labelLarge.copyWith(fontSize: 15, color: current ? colors.accentText : colors.ink)),
                    const SizedBox(height: MmSpace.s4),
                    Row(
                      children: [
                        Flexible(child: Text(m.title, style: type.cardTitle)),
                        if (m.expected) ...[const SizedBox(width: MmSpace.s8), const _ExpectedTag()],
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

/// A node of the rail: a checked disc once passed, a lit disc with a halo for now, a clear ring
/// for what is still to come. All 20 dp, so the rail reads at a glance.
class _Node extends StatelessWidget {
  const _Node({required this.passed, required this.current, required this.volt});

  final bool passed;
  final bool current;
  final Color volt;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // A node is a filled mark: volt on both themes (the dark accent text colour is for strokes and
    // words on the ground), with the 1 dp dark volt edge on Daylight so it reads on cream.
    final fill = colors.volt;
    final edge = colors.isNight ? null : Border.all(color: colors.voltEdge);
    if (passed) {
      return DecoratedBox(
        decoration: BoxDecoration(shape: BoxShape.circle, color: fill, border: edge),
        child: SizedBox.square(dimension: 20, child: Icon(LucideIcons.check, size: 13, color: colors.voltInk)),
      );
    }
    if (current) {
      return DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: fill,
          border: Border.all(color: colors.isNight ? colors.raised : colors.voltEdge, width: colors.isNight ? 3 : 2),
          // The halo is light on Night; on Daylight the heavier edge carries "now" (no glows).
          boxShadow: colors.isNight ? [BoxShadow(color: fill.withValues(alpha: 0.55), blurRadius: 12, spreadRadius: 1)] : null,
        ),
        child: const SizedBox.square(dimension: 20),
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(shape: BoxShape.circle, color: colors.raised, border: Border.all(color: colors.ink3, width: 2)),
      child: const SizedBox.square(dimension: 20),
    );
  }
}

/// "Expected": an outline, not a fill, in readable ink: a date that is a forecast says so plainly.
class _ExpectedTag extends StatelessWidget {
  const _ExpectedTag();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: MmRadius.pillAll, border: Border.all(color: colors.ink3)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Text(ToolsCopy.guideExpected, style: context.mmType.caption.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
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
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
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
          child: ToolsRowFrame(
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
                  padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, MmSpace.s16),
                  child: Text(widget.answer, style: type.small.copyWith(color: colors.ink2)),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
