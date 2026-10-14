import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'nta_chip.dart';
import 'nta_skin.dart';

/// Words of the instructions page and its preparing stage.
abstract final class NtaStartCopy {
  static const String heading = 'Read before you start';
  static const String intro = 'Meet the exam before exam day.';
  static const String questionsUnit = 'questions';
  static const String minutesUnit = 'minutes';
  static const String marking = 'marking';
  static const List<(String, String)> markingLines = [('+5', 'right'), ('−1', 'wrong'), ('0', 'blank')];

  /// The three marks on one line, in the order of [markingLines].
  static const String markingFigure = '+5  −1  0';
  static const String clockTitle = 'The clock';
  static const String clockBody =
      'The timer starts when you tap Start. The server sets it, and it keeps running if you leave. At zero your answers are submitted for you. You will see a 5 minute and a 1 minute warning.';
  static const String scoringTitle = 'Marking';
  static const String scoringBody =
      '5 marks for a correct answer, minus 1 for a wrong one, 0 for a question left blank. An answered question that is marked for review is still scored.';
  static const String paletteTitle = 'The question palette';
  static const List<String> paletteMeanings = [
    'You chose an answer.',
    'You opened it and left it blank.',
    'You have not opened it yet.',
    'Flagged to look at again, no answer yet.',
    'Flagged, and your answer is scored.',
  ];
  static const String keysTitle = 'The keys';
  static const List<(String, String)> keys = [
    ('Save & Next', 'Keeps your answer and opens the next question.'),
    ('Mark for Review & Next', 'Flags this question and moves on. Your answer stays.'),
    ('Clear response', 'Removes your answer to this question.'),
    ('Previous', 'Goes back one question. The palette jumps anywhere.'),
  ];
  static const String screenTitle = 'Stay on the exam screen';
  static const String declare = 'I have read the instructions and I am ready.';
  static const String start = 'Start NTA mode';
  static const String startHint = 'Tick the declaration to start.';
  static const String preparingTitle = 'Building your paper.';
  static const String preparingBody = 'The clock starts once your questions are ready. This can take up to 30 seconds.';
  static const List<String> steps = ['Checking your access', 'Picking your 50 questions', 'Opening the exam'];
}

/// One of the three facts at the top: "50 questions", "60 minutes", "+5 -1 0 marking". All three
/// have the same shape, a figure over its unit, so the row reads as one row.
class NtaFactTile extends StatelessWidget {
  const NtaFactTile({super.key, required this.value, required this.unit, this.semanticsLabel});

  final String value;
  final String unit;

  /// What a screen reader says when the figure alone would not make sense ("+5 -1 0").
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: semanticsLabel,
      excludeSemantics: semanticsLabel != null,
      child: Container(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s8, MmSpace.s12),
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: NtaSkin.radiusAll,
          border: Border.all(color: colors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The figure scales down to the tile's width rather than wrapping or losing a digit.
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text(value, maxLines: 1, softWrap: false, style: type.figureCompact.copyWith(fontSize: 30, height: 1)),
            ),
            const SizedBox(height: MmSpace.s4),
            Text(unit, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

/// The marking as a fact tile: "+5 -1 0" over "marking" (right, wrong, blank; the Marking block
/// below spells it out). Same shape as the questions and minutes tiles beside it.
class NtaMarkingTile extends StatelessWidget {
  const NtaMarkingTile({super.key});

  @override
  Widget build(BuildContext context) {
    return const NtaFactTile(
      value: NtaStartCopy.markingFigure,
      unit: NtaStartCopy.marking,
      semanticsLabel: 'Marking: plus 5 for right, minus 1 for wrong, 0 for blank',
    );
  }
}

/// A titled block of the instructions.
class NtaInstructionBlock extends StatelessWidget {
  const NtaInstructionBlock({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(title, style: context.mmType.subhead)),
          const SizedBox(height: MmSpace.s8),
          ...children,
        ],
      ),
    );
  }
}

/// A legend state, a key or a rule: a leading glyph and a line or two.
class NtaInstructionRow extends StatelessWidget {
  const NtaInstructionRow({super.key, required this.leading, required this.title, this.body, this.leadingWidth = 44});

  final double leadingWidth;

  final Widget leading;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: leadingWidth,
            child: Align(alignment: Alignment.topLeft, child: leading),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.label.copyWith(color: colors.ink)),
                if (body != null) Text(body!, style: type.small.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A key as it looks in the exam, with its meaning under it.
class NtaKeyRow extends StatelessWidget {
  const NtaKeyRow({super.key, required this.label, required this.meaning});

  final String label;
  final String meaning;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (fill, edge, ink) = switch (label) {
      'Save & Next' => (NtaSkin.green, NtaSkin.greenEdge, NtaSkin.onBar),
      'Mark for Review & Next' => (NtaSkin.purple, NtaSkin.purpleEdge, NtaSkin.onBar),
      _ => (colors.raised, colors.lineStrong, colors.ink),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s6),
              decoration: BoxDecoration(
                color: fill,
                borderRadius: const BorderRadius.all(Radius.circular(8)),
                border: Border.all(color: edge),
              ),
              child: Text(
                label,
                style: type.label.copyWith(color: ink, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s6),
          Semantics(
            label: '$label. $meaning',
            excludeSemantics: true,
            child: Text(meaning, style: type.small.copyWith(color: colors.ink2)),
          ),
        ],
      ),
    );
  }
}

/// The legend chip for the instructions.
Widget ntaLegendGlyph(NtaChipState s) => NtaChip(state: s, label: '', size: const Size(32, 28));

/// "I have read the instructions": the exam's declaration, a 48 dp row with a square check.
class NtaDeclaration extends StatelessWidget {
  const NtaDeclaration({super.key, required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      checked: value,
      label: NtaStartCopy.declare,
      excludeSemantics: true,
      onTap: onChanged == null ? null : () => onChanged!(!value),
      child: InkWell(
        onTap: onChanged == null ? null : () => onChanged!(!value),
        borderRadius: NtaSkin.keyRadius,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 22,
                height: 22,
                // The app's own volt box with a dark tick, like the Start key it unlocks (not the
                // exam's blue radio): ticked is volt, unticked an ink outline.
                decoration: BoxDecoration(
                  color: value ? colors.volt : colors.raised,
                  borderRadius: const BorderRadius.all(Radius.circular(5)),
                  border: Border.all(color: value ? colors.ink : colors.ink3, width: 1.5),
                ),
                child: value ? Icon(LucideIcons.check, size: 15, color: colors.voltInk) : null,
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(NtaStartCopy.declare, style: type.labelLarge)),
            ],
          ),
        ),
      ),
    );
  }
}

enum NtaPrepPhase { checking, starting, opening }

/// The page body while the paper is prepared: [NtaPreparing] in the middle of the room, not at the
/// top of an empty page. It scrolls only when the room is smaller than the block (large text).
class NtaPreparingStage extends StatelessWidget {
  const NtaPreparingStage({super.key, required this.subject, required this.phase});

  final String subject;
  final NtaPrepPhase phase;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s20, MmSpace.gutter, MmSpace.s24),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: (box.maxHeight - MmSpace.s20 - MmSpace.s24).clamp(0.0, double.infinity)),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: NtaPreparing(subject: subject, phase: phase),
            ),
          ),
        ),
      ),
    );
  }
}

/// The preparing stage: three steps, each lit only by a real call (the quote, the start
/// request, opening the runner on the draft it wrote).
class NtaPreparing extends StatelessWidget {
  const NtaPreparing({super.key, required this.subject, required this.phase});

  final String subject;
  final NtaPrepPhase phase;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Mobi follows the real steps: thinking while access is checked, reading the paper
          // while it is built, waving as the exam opens.
          Center(
            child: ExcludeSemantics(
              child: MobiCharacter(
                size: 120,
                entrance: switch (phase) {
                  NtaPrepPhase.checking => MobiAct.think,
                  NtaPrepPhase.starting => MobiAct.read,
                  NtaPrepPhase.opening => MobiAct.hello,
                },
                seed: 13,
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          Semantics(header: true, child: Text(NtaStartCopy.preparingTitle, style: NtaSkin.of(context).type.headline)),
          const SizedBox(height: MmSpace.s12),
          Text(NtaStartCopy.preparingBody, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s24),
          for (var i = 0; i < NtaStartCopy.steps.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
              child: Row(
                children: [
                  SizedBox.square(
                    dimension: 24,
                    child: Center(
                      child: i < phase.index
                          ? Icon(LucideIcons.circleCheck, size: 20, color: colors.goodText)
                          : i == phase.index
                          ? MmSpinner(color: colors.ink, size: 18, strokeWidth: 2)
                          : Icon(LucideIcons.circle, size: 18, color: colors.ink4),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Text(
                      NtaStartCopy.steps[i],
                      style: type.labelLarge.copyWith(color: i <= phase.index ? colors.ink : colors.ink3),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
