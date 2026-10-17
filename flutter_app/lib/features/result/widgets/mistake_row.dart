import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../layers_copy.dart';
import '../model/move_inputs.dart' show keyHeld;
import '../model/next_move.dart';

/// Where one mistake stands, each from a real state (a server acknowledgement, never optimistic).
enum MistakeStatus {
  /// Not repaired, and the next move's target.
  repairFirst,

  /// Not repaired.
  repair,

  /// Repaired; its check not taken (or not known on this phone yet).
  check,

  /// The check came back right.
  held,

  /// The check came back wrong.
  slipped,

  /// The answer key is being re-checked: no repair, no charge.
  keyHeld,

  /// The answer key was corrected.
  corrected,
}

/// Layer 3's heading: "Your 12 mistakes" with "−72 marks" (or "3 of 12 repaired") at the right, and the order line.
class MistakesHead extends StatelessWidget {
  const MistakesHead({super.key, required this.count, this.repairedCount = 0, this.cohort = false, this.nothingAnswered = false});

  final int count;
  final int repairedCount;

  /// The rows follow the server's order by what other students answered.
  final bool cohort;
  final bool nothingAnswered;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final head = mistakesHead(count: count, repairedCount: repairedCount);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(count == 0 && nothingAnswered ? LayersCopy.noAnswersTitle : head.title, style: type.title.copyWith(fontSize: 20)),
              ),
            ),
            if (head.side != null)
              Text(head.side!, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
          ],
        ),
        // With nothing to repair the heading says it all; a second line would only repeat it.
        if (count > 0) ...[
          const SizedBox(height: MmSpace.s4),
          Text(cohort ? LayersCopy.inRepairOrder : LayersCopy.inPaperOrder, style: type.small.copyWith(color: colors.ink2)),
        ],
      ],
    );
  }
}

/// The closed face of one mistake row: the red-ringed number, the chapter, the stem on one line, the pick and the
/// answer as lettered rings with their words (colour is never alone), how many others got it right, the marks it
/// cost and its status chip. Used as the header of the practice and the mock rows, so both read the same.
class MistakeSummary extends StatelessWidget {
  const MistakeSummary({
    super.key,
    required this.number,
    required this.status,
    required this.expanded,
    this.chapter,
    this.stem,
    this.yours,
    this.answer,
    this.cohort,
    this.when,
  });

  final int number;
  final String? chapter;
  final String? stem;

  /// The paper and when it was attempted, in the student's own 12-hour time: "Mock 7, 12 Oct, 10:44 PM".
  final String? when;

  /// The student's letter, and the correct letter when the key may be shown.
  final String? yours;
  final String? answer;

  /// "18 of 22 got it right", when the server sent the cohort read.
  final String? cohort;
  final MistakeStatus status;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final facts = <Widget>[
      if (yours != null) _LetterFact(letter: yours!, word: LayersCopy.yours(yours!), ring: colors.wrongMark),
      if (answer != null) _LetterFact(letter: answer!, word: LayersCopy.answer(answer!), ring: colors.goodText),
      if (cohort != null) Text(cohort!, style: type.caption.copyWith(color: colors.ink2)),
    ];
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _NumberRing(number: number, held: status == MistakeStatus.keyHeld),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(chapter ?? 'Question $number', style: type.cardTitle.copyWith(fontSize: 15.5), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (when != null) ...[
                    const SizedBox(height: MmSpace.s2),
                    Text(when!, style: type.caption.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                  if (stem != null && stem!.isNotEmpty) ...[
                    const SizedBox(height: MmSpace.s2),
                    Text(stem!, style: type.small.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                  if (facts.isNotEmpty) ...[
                    const SizedBox(height: MmSpace.s8),
                    Wrap(spacing: MmSpace.s12, runSpacing: MmSpace.s6, crossAxisAlignment: WrapCrossAlignment.center, children: facts),
                  ],
                  const SizedBox(height: MmSpace.s8),
                  MistakeChip(status: status),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (status != MistakeStatus.keyHeld && status != MistakeStatus.corrected)
                  Text(
                    LayersCopy.marksLost,
                    style: type.cardTitle.copyWith(fontSize: 15, color: colors.wrongText, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                const SizedBox(height: MmSpace.s8),
                AnimatedRotation(
                  turns: expanded ? 0.5 : 0,
                  duration: Motion.of(context, const Duration(milliseconds: 200)),
                  curve: Motion.out,
                  child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// What a screen reader hears for the row.
  static String spoken({required int number, String? chapter, String? when, String? yours, String? answer, String? cohort, required MistakeStatus status}) => [
    'Question $number',
    ?chapter,
    ?when,
    if (yours != null) LayersCopy.yours(yours),
    if (answer != null) LayersCopy.answer(answer),
    ?cohort,
    if (status != MistakeStatus.keyHeld && status != MistakeStatus.corrected) LayersCopy.spokenCost(6),
    MistakeChip.label(status),
  ].join(', ');
}

class _NumberRing extends StatelessWidget {
  const _NumberRing({required this.number, required this.held});

  final int number;
  final bool held;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: held ? colors.ink3 : colors.wrongMark, width: 1.6),
        ),
        child: Text(
          '$number',
          style: context.mmType.small.copyWith(fontWeight: FontWeight.w700, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
      ),
    );
  }
}

class _LetterFact extends StatelessWidget {
  const _LetterFact({required this.letter, required this.word, required this.ring});

  final String letter;
  final String word;
  final Color ring;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final parts = word.split(' ');
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: ring, width: 1.4)),
          child: Text(letter, style: type.caption.copyWith(fontWeight: FontWeight.w700, color: colors.ink, height: 1)),
        ),
        const SizedBox(width: MmSpace.s4),
        Text(parts.skip(1).join(' '), style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// The status chip: words first, a hairline outline, the state's colour only as a second signal.
class MistakeChip extends StatelessWidget {
  const MistakeChip({super.key, required this.status});

  final MistakeStatus status;

  static String label(MistakeStatus s) => switch (s) {
    MistakeStatus.repairFirst || MistakeStatus.repair => LayersCopy.chipOpen,
    MistakeStatus.check => LayersCopy.chipCheck,
    MistakeStatus.held => LayersCopy.chipHeld,
    MistakeStatus.slipped => LayersCopy.chipSlipped,
    MistakeStatus.keyHeld => LayersCopy.chipKeyHeld,
    MistakeStatus.corrected => LayersCopy.chipCorrected,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final (Color edge, Color ink, IconData? icon) = switch (status) {
      // The volt's target wears the volt as a hairline, never a fill: the foot key is the screen's one volt.
      MistakeStatus.repairFirst => (colors.voltEdge, colors.ink, null),
      MistakeStatus.repair => (colors.lineStrong, colors.ink2, null),
      MistakeStatus.check => (colors.accentText, colors.accentText, null),
      MistakeStatus.held => (colors.goodText, colors.goodText, LucideIcons.check),
      MistakeStatus.slipped => (colors.warnText, colors.warnText, null),
      MistakeStatus.keyHeld => (colors.ink3, colors.ink2, null),
      MistakeStatus.corrected => (colors.ink3, colors.ink2, null),
    };
    return ExcludeSemantics(
      child: MmOverlapSwitcher(
        outDuration: Motion.of(context, const Duration(milliseconds: 120)),
        duration: Motion.of(context, const Duration(milliseconds: 200)),
        child: Container(
          key: ValueKey(status),
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 3),
          decoration: BoxDecoration(
            borderRadius: MmRadius.pillAll,
            border: Border.all(color: edge, width: status == MistakeStatus.repairFirst ? 1.6 : 1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 13, color: ink), const SizedBox(width: MmSpace.s4)],
              Text(label(status), style: context.mmType.caption.copyWith(color: ink, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

/// The repair entry inside an opened mistake, under the free part (the pick and the correct answer): what a repair
/// gives and its cost before paying, or for a repaired one the saved repair, which never costs again (F17).
class MistakeRepairEntry extends StatelessWidget {
  const MistakeRepairEntry({super.key, required this.number, required this.status, this.letter, this.cost, this.onRepair, this.onOpenSaved});

  final int number;
  final MistakeStatus status;
  final String? letter;

  /// "1 AI credit. You have 68. No charge if the repair cannot be written."
  final String? cost;
  final VoidCallback? onRepair;
  final VoidCallback? onOpenSaved;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final repaired = status == MistakeStatus.check || status == MistakeStatus.held || status == MistakeStatus.slipped;
    // One action per mistake, with the label it has everywhere on the screen (D15): a repaired mistake whose check is not
    // taken checks it ("Check Q12 held", the foot's words when the check is the next move); one already checked opens its
    // saved repair; an open one is repaired ("Repair Q12", the foot's own words when it is the next move).
    if (repaired) {
      final check = status == MistakeStatus.check;
      final label = check ? LayersCopy.checkKey(number) : LayersCopy.openRepair;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            switch (status) {
              MistakeStatus.held => LayersCopy.heldLine,
              MistakeStatus.slipped => LayersCopy.slippedLine,
              _ => onOpenSaved == null ? LayersCopy.repairedLine : LayersCopy.checkLine,
            },
            style: type.small.copyWith(color: colors.ink),
          ),
          if (onOpenSaved != null) ...[
            const SizedBox(height: MmSpace.s12),
            Align(alignment: Alignment.centerLeft, child: KeyButton.secondary(label: label, expanded: false, onPressed: onOpenSaved)),
          ],
        ],
      );
    }
    if (onRepair == null) return const SizedBox.shrink();
    // The next move's own mistake: the foot's volt key repairs it, with the cost under it, so the row names that key in
    // its own words instead of stacking a second key with the same label above it.
    if (status == MistakeStatus.repairFirst) {
      return Text('${LayersCopy.repairOffer(letter)} ${LayersCopy.repairBelow(number)}', style: type.small.copyWith(color: colors.ink));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(LayersCopy.repairOffer(letter), style: type.small.copyWith(color: colors.ink)),
        if (cost != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(cost!, style: type.caption.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s12),
        Align(
          alignment: Alignment.centerLeft,
          child: KeyButton.secondary(
            label: LayersCopy.repairKey(number),
            semanticsLabel: [LayersCopy.repairKey(number), ?cost].join('. '),
            expanded: false,
            onPressed: onRepair,
          ),
        ),
      ],
    );
  }
}

/// "Show all 12" under the first rows, and "Show fewer" once open.
class ShowAllRow extends StatelessWidget {
  const ShowAllRow({super.key, required this.count, required this.open, required this.onTap});

  final int count;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = open ? LayersCopy.showFewer : LayersCopy.showAll(count);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, thickness: 1, color: context.mmColors.line),
        MmPressable(
          onTap: onTap,
          pressedScale: 0.985,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          semanticsLabel: label,
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(label, style: context.mmType.cardTitle.copyWith(fontSize: 15)),
            ),
          ),
        ),
      ],
    );
  }
}

/// The folded row of blanks: "10 left blank, 50 marks not earned", opening the blank rows in place.
class LeftBlankRow extends StatelessWidget {
  const LeftBlankRow({super.key, required this.count, required this.open, required this.onTap, required this.children});

  final int count;
  final bool open;
  final VoidCallback onTap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, thickness: 1, color: colors.line),
        MmPressable(
          onTap: onTap,
          pressedScale: 0.985,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          selected: open,
          semanticsLabel: LayersCopy.leftBlankSpoken(count, open: open),
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Row(
              children: [
                const Bubble(state: BubbleState.blank, size: 22, animate: false),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(LayersCopy.leftBlank(count), style: context.mmType.cardTitle.copyWith(fontSize: 15))),
                AnimatedRotation(
                  turns: open ? 0.5 : 0,
                  duration: Motion.of(context, const Duration(milliseconds: 200)),
                  curve: Motion.out,
                  child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                ),
              ],
            ),
          ),
        ),
        MmSizeEase(
          duration: Motion.of(context, open ? const Duration(milliseconds: 260) : const Duration(milliseconds: 200)),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: open
              ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// The folded row of right answers under the mistakes: "28 answered right", opening the right rows in place (the
/// answers a student got right are still one tap away; they are not mistakes, so they do not lead).
class RightAnswersRow extends StatelessWidget {
  const RightAnswersRow({super.key, required this.count, required this.open, required this.onTap, required this.children});

  final int count;
  final bool open;
  final VoidCallback onTap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, thickness: 1, color: colors.line),
        MmPressable(
          onTap: onTap,
          pressedScale: 0.985,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          selected: open,
          semanticsLabel: LayersCopy.answeredRightSpoken(count, open: open),
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Row(
              children: [
                const Bubble(state: BubbleState.filled, size: 22, animate: false),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(LayersCopy.rightRow(count), style: context.mmType.cardTitle.copyWith(fontSize: 15))),
                AnimatedRotation(
                  turns: open ? 0.5 : 0,
                  duration: Motion.of(context, const Duration(milliseconds: 200)),
                  curve: Motion.out,
                  child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                ),
              ],
            ),
          ),
        ),
        MmSizeEase(
          duration: Motion.of(context, open ? const Duration(milliseconds: 260) : const Duration(milliseconds: 200)),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: open
              ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// One mistake's status, from what the server has acknowledged: the key's state first, then the repair and its
/// check, then whether the next move points at it.
MistakeStatus mistakeStatusOf({
  required String qid,
  required Map<String, String> reviews,
  required Set<String> repaired,
  required Map<String, bool> checks,
  ResultMove? move,
}) {
  if (reviews[qid] == 'corrected') return MistakeStatus.corrected;
  if (keyHeld(reviews, qid)) return MistakeStatus.keyHeld;
  if (repaired.contains(qid)) {
    final check = checks[qid];
    return check == null ? MistakeStatus.check : (check ? MistakeStatus.held : MistakeStatus.slipped);
  }
  if (move != null && move.kind == MoveKind.repair && move.qid == qid) return MistakeStatus.repairFirst;
  return MistakeStatus.repair;
}
