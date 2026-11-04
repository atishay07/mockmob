import 'package:flutter/material.dart';

import '../../../core/domain/subject_options.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A subject's one choice (owner, 5 Nov, LK94), asked right where the subject is picked: the question ("Which Part B does your
/// school teach?"), the two options as answer-sheet bubbles with one line each on what they cover, and "You can change this
/// later in Learn." Shared by the onboarding's subjects step and You > Subjects.
///
/// No box of its own: it sits in the subject's own space under its name (the onboarding's lamp wash, the editor's row), so
/// nothing is a card inside a card. Each option is a 48 dp target in a radio group ("Analysis of Financial Statements. Company
/// statements, ratios and cash flow., selected"); the chosen bubble inks, its name is set heavier, so the choice never rests
/// on colour alone. [value] null draws neither ticked (an account whose choice is not saved yet).
class SubjectOptionPicker extends StatelessWidget {
  const SubjectOptionPicker({super.key, required this.options, required this.subjectName, required this.value, required this.onChanged, this.note = kSubjectOptionLater});

  final SubjectOptionSet options;

  /// "Accountancy": the radio group is read as "Accountancy, Which Part B does your school teach?".
  final String subjectName;

  /// The ticked option's id, or null for none.
  final String? value;

  /// Null while a save is out: the options stay readable but do not answer.
  final ValueChanged<String>? onChanged;

  /// The line under the options.
  final String? note;

  /// The question line's key, for tests: `subject-option-<subject>`.
  static Key keyFor(String subject) => ValueKey('subject-option-$subject');

  /// One option's key: `subject-option-<subject>-<id>`.
  static Key choiceKey(String subject, String id) => ValueKey('subject-option-$subject-$id');

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chosen = normalizeSubjectOption(options.subject, value);
    return Semantics(
      container: true,
      label: '$subjectName, ${options.question}',
      child: Column(
        key: keyFor(options.subject),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s4, bottom: 2),
            child: ExcludeSemantics(
              child: Text(options.question, style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
            ),
          ),
          for (final c in options.choices)
            _OptionLine(
              key: choiceKey(options.subject, c.id),
              choice: c,
              selected: c.id == chosen,
              onTap: onChanged == null
                  ? null
                  : () {
                      if (c.id != chosen) onChanged!(c.id);
                    },
            ),
          if (note != null)
            Padding(
              padding: const EdgeInsets.only(top: 2, bottom: MmSpace.s8),
              child: Text(note!, style: type.caption.copyWith(color: colors.ink3)),
            ),
        ],
      ),
    );
  }
}

/// One option: the bubble, the name and its one line. The whole line is the target.
class _OptionLine extends StatelessWidget {
  const _OptionLine({super.key, required this.choice, required this.selected, required this.onTap});

  final SubjectOptionChoice choice;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: '${choice.label}. ${choice.note}',
      selected: selected,
      inMutuallyExclusiveGroup: true,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                // The bubble sits on the name's line.
                padding: const EdgeInsets.only(top: 1),
                child: Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: 20, inkOrigin: const Offset(-0.5, 0.2)),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      choice.label,
                      style: type.body.copyWith(
                        fontSize: 15,
                        height: 1.3,
                        color: onTap == null ? colors.ink2 : colors.ink,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(choice.note, style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
