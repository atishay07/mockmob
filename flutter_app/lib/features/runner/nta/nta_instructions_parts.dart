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
  static const String declare = 'I have read the instructions and I am ready to begin.';
  static const String start = 'Start NTA mode';
  static String preparingTitle(String subject) => 'Building your $subject paper.';
  static const String preparingBody = 'The clock starts once your questions are ready. This can take up to 30 seconds.';
  static const List<String> steps = ['Checking your access', 'Selecting 50 questions and creating your session', 'Opening the exam'];
}

/// One of the three facts at the top: "50 questions", "60 minutes", "+5 −1 0 marking".
class NtaFactTile extends StatelessWidget {
  const NtaFactTile({super.key, required this.value, required this.unit});

  final String value;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Container(
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s8, MmSpace.s12),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: NtaSkin.radiusAll,
        border: Border.all(color: colors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(value, maxLines: 1, style: type.figureCompact.copyWith(fontSize: 30, height: 1)),
          ),
          const SizedBox(height: MmSpace.s4),
          Text(unit, style: type.caption.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

/// The marking as three short lines: "+5 right", "−1 wrong", "0 blank".
class NtaMarkingTile extends StatelessWidget {
  const NtaMarkingTile({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = type.label.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: colors.ink, height: 1.3);
    return Semantics(
      label: 'Marking: plus 5 for right, minus 1 for wrong, 0 for blank',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s8, MmSpace.s8),
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: NtaSkin.radiusAll,
          border: Border.all(color: colors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final (v, w) in NtaStartCopy.markingLines)
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: v, style: figure),
                    TextSpan(
                      text: ' $w',
                      style: figure.copyWith(fontWeight: FontWeight.w400, color: colors.ink2),
                    ),
                  ],
                ),
                maxLines: 1,
              ),
          ],
        ),
      ),
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
    final skin = NtaSkin.of(context);
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
                decoration: BoxDecoration(
                  color: value ? skin.radio : colors.raised,
                  borderRadius: const BorderRadius.all(Radius.circular(5)),
                  border: Border.all(color: value ? skin.radio : colors.ink3, width: 1.5),
                ),
                child: value ? Icon(LucideIcons.check, size: 15, color: colors.raised) : null,
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
          Semantics(header: true, child: Text(NtaStartCopy.preparingTitle(subject), style: NtaSkin.of(context).type.headline)),
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
