import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/attempt.dart';
import '../../../core/motion/flight.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'answer_sheet.dart';
import 'collapsible.dart';

/// The quiet group of skipped questions (spec 5.8): never a repair key, only the answer and a
/// try that is not recorded. One collapsed panel with the count: skipped questions are not
/// mistakes, so 47 of them never push the repair record and the past results off the tab.
class NotAttemptedGroup extends ConsumerStatefulWidget {
  const NotAttemptedGroup({super.key, required this.group, this.initiallyExpanded = false});

  final BlankGroup group;
  final bool initiallyExpanded;

  @override
  ConsumerState<NotAttemptedGroup> createState() => _NotAttemptedGroupState();
}

class _NotAttemptedGroupState extends ConsumerState<NotAttemptedGroup> {
  late bool _expanded = widget.initiallyExpanded;

  void _toggle() {
    ref.read(hapticsProvider).tick();
    setState(() => _expanded = !_expanded);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final group = widget.group;
    final heading = ReviewCopy.notAttemptedHeading(group.source, group.items.length);
    // The same family as a map row, and flatter: open on the ground between two hairlines, the
    // questions unfolding under it. No box when open or shut.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
          child: Divider(height: 1, thickness: 1, color: colors.line),
        ),
        MmPressable(
          onTap: _toggle,
          pressedScale: 0.985,
          focusRadius: MmRadius.keyAll,
          semanticsLabel: '$heading. ${ReviewCopy.notAttemptedNote} ${ReviewCopy.groupExpandHint(_expanded)}',
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(heading, style: type.cardTitle),
                        const SizedBox(height: MmSpace.s4),
                        Text(ReviewCopy.notAttemptedNote, style: type.caption.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: Motion.of(context, Motion.card),
                    curve: Motion.emphasized,
                    child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2),
                  ),
                ],
              ),
            ),
          ),
        ),
        MmCollapsible(
          expanded: _expanded,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [for (final item in group.items) _BlankRow(item: item), const SizedBox(height: MmSpace.s8)],
          ),
        ),
      ],
    );
  }
}

class _BlankRow extends StatelessWidget {
  const _BlankRow({required this.item});

  final BlankItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12), child: Divider(height: 1, color: colors.line)),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: MmSpace.s2),
                child: Bubble(state: BubbleState.blank, size: 16, animate: false),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: ReviewCopy.questionLabel(item.number), style: type.labelLarge),
                      TextSpan(text: '  ${item.chapter}', style: type.caption.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        Padding(
          // The keys line up under the question text (E2 of the row: its 12 dp, the 16 dp bubble, the gap).
          padding: const EdgeInsets.only(left: MmSpace.s12 + 16),
          child: Wrap(
            children: [
              KeyButton.quiet(
                label: ReviewCopy.seeAnswer,
                semanticsLabel: '${ReviewCopy.seeAnswer}, ${ReviewCopy.questionLabel(item.number)}',
                onPressed: () => showAnswerSheet(
                  context,
                  attemptId: item.attemptId,
                  questionId: item.questionId,
                  number: item.number,
                  tryFirst: false,
                ),
              ),
              KeyButton.quiet(
                label: ReviewCopy.tryAgain,
                semanticsLabel: '${ReviewCopy.tryAgain}, ${ReviewCopy.questionLabel(item.number)}',
                onPressed: () =>
                    showAnswerSheet(context, attemptId: item.attemptId, questionId: item.questionId, number: item.number, tryFirst: true),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// "Mock 7 was received. Your result is ready." First on the tab while a result is unopened:
/// a small folded sheet with its foil dot, in fake glass.
class UnopenedResultRow extends StatelessWidget {
  const UnopenedResultRow({super.key, required this.label, required this.onOpen});

  final String label;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onOpen,
      pressedScale: 0.985,
      focusRadius: MmRadius.panelAll,
      haptic: MmPressHaptic.selection,
      semanticsLabel: '${ReviewCopy.unopened(label)} ${ReviewCopy.openResult}',
      builder: (context, pressed, _) => FakeGlass(
        pressed: pressed,
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Row(
            children: [
              const _FoldedSheetGlyph(),
              const SizedBox(width: MmSpace.s16),
              Expanded(child: Text(ReviewCopy.unopened(label), style: type.labelLarge)),
              const SizedBox(width: MmSpace.s8),
              Text(ReviewCopy.openResult, style: type.label.copyWith(color: colors.accentText)),
            ],
          ),
        ),
      ),
    );
  }
}

/// A folded answer sheet, drawn: a dark paper rectangle with a crease and a volt foil dot.
class _FoldedSheetGlyph extends StatelessWidget {
  const _FoldedSheetGlyph();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox(
      width: 40,
      height: 48,
      child: CustomPaint(
        painter: _FoldPainter(paper: colors.isNight ? colors.raised2 : colors.ink, crease: colors.lineStrong, foil: colors.volt),
      ),
    );
  }
}

class _FoldPainter extends CustomPainter {
  const _FoldPainter({required this.paper, required this.crease, required this.foil});

  final Color paper;
  final Color crease;
  final Color foil;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(4));
    canvas.drawRRect(r, Paper.shadow);
    canvas.drawRRect(r, Paint()..color = paper);
    final y = size.height * 0.45;
    canvas.drawLine(
      Offset(2, y),
      Offset(size.width - 2, y),
      Paint()
        ..color = crease
        ..strokeWidth = 1,
    );
    canvas.drawCircle(Offset(size.width / 2, y), 7, Paint()..color = foil);
  }

  @override
  bool shouldRepaint(_FoldPainter old) => old.paper != paper || old.crease != crease || old.foil != foil;
}

abstract final class Paper {
  static final Paint shadow = Paint()
    ..color = const Color(0x40000000)
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
}

/// One past mock with its marks and "Replay recap".
class PastResultRow extends StatelessWidget {
  const PastResultRow({
    super.key,
    required this.attempt,
    required this.label,
    required this.clock,
    required this.onOpen,
    required this.onReplay,
  });

  final Attempt attempt;
  final String label;
  final ReviewClock clock;
  final VoidCallback onOpen;
  final VoidCallback onReplay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final line = ReviewCopy.pastLine(formatDayMonth(clock.local(attempt.completedAt)), attempt.marks, attempt.maxMarks);
    return Row(
      children: [
        Expanded(
          child: MmPressable(
            onTap: () {
              // The paper's object flies on into the result's summary (M2).
              MmFlight.launch(context, attempt.subject);
              onOpen();
            },
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: '$label, ${subjectName(attempt.subject)}. $line',
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 60),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
                child: Row(
                  children: [
                    // The paper's subject, not a wrong-answer bubble: the row is a result.
                    SubjectEmblem(subject: attempt.subject, size: EmblemSizes.chip, framed: false),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('$label, ${subjectName(attempt.subject)}', style: type.labelLarge),
                          Text(line, style: type.caption.copyWith(color: colors.ink2)),
                          // The marks over the maximum, drawn under the line that says them.
                          if (attempt.maxMarks > 0) ...[
                            const SizedBox(height: MmSpace.s8),
                            _MarksBar(fraction: attempt.marks / attempt.maxMarks),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: MmSpace.s8),
                    Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The paper's marks over its maximum as a hairline bar: the same number the line says, drawn.
class _MarksBar extends StatelessWidget {
  const _MarksBar({required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final f = fraction.isNaN ? 0.0 : fraction.clamp(0.0, 1.0);
    return ExcludeSemantics(
      child: SizedBox(
        width: double.infinity,
        height: 6,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: colors.line),
              Align(alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: f, heightFactor: 1, child: ColoredBox(color: colors.ink))),
            ],
          ),
        ),
      ),
    );
  }
}

/// The evidence behind tonight's repair: the exact questions, in full, each opening its repair.
class EvidenceList extends StatelessWidget {
  const EvidenceList({super.key, required this.items, required this.questionText, required this.onOpen});

  final List<MistakeItem> items;
  final String Function(MistakeItem) questionText;
  final ValueChanged<MistakeItem> onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final item in items)
          MmPressable(
            onTap: () => onOpen(item),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: '${ReviewCopy.questionLabel(item.number)}, ${item.source}. ${questionText(item)}',
            builder: (context, pressed, _) => Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: MmSpace.s2),
                    child: Bubble(state: BubbleState.wrong, size: 16, animate: false),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${ReviewCopy.questionLabel(item.number)}, ${item.source}', style: type.label.copyWith(color: colors.ink2)),
                        const SizedBox(height: MmSpace.s4),
                        Text(questionText(item), style: type.body),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
