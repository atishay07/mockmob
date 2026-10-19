import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/domain/cuet_rules.dart' show kCuetMaxSubjects;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../../you/data/profile_editor.dart' show profileEditorProvider;
import '../data/practice_catalog.dart';

/// Opens the remaining supported subjects. Returns the chosen public subject id.
Future<String?> showOtherSubjects(BuildContext context, List<SubjectChoice> subjects) {
  return showMmSheet<String>(
    context: context,
    title: PracticeCopy.otherSubjectsTitle,
    builder: (context) => OtherSubjectsList(subjects: subjects, onPick: (id) => Navigator.of(context).pop(id)),
  );
}

/// How a sixth subject was taken (I5).
enum SubjectSwap {
  /// It replaced the last of the five on the profile (saved and acknowledged by the server).
  swapped,

  /// Practised once: it takes the last tile's place on Practice; the profile keeps its five.
  once,
}

/// "More subjects" for Practice, held to five (I5, owner 19 Oct: "if I go to edit subjects, five are
/// chosen at most, but if I, in the practice section, add more subjects, I can add up to six ...
/// restrict it to five only. It can just change the last subject"). With fewer than five on the
/// profile, or a subject already on it, the pick is simply the subject. With five, one sheet asks
/// whether to swap the last one for it (saved to the profile, so Edit subjects agrees) or practise it
/// just this once. Returns the subject to practise, or null when the student backed out.
Future<String?> pickOtherSubject(BuildContext context, WidgetRef ref, List<SubjectChoice> others) async {
  final id = await showOtherSubjects(context, others);
  if (id == null || !context.mounted) return null;
  final chosen = ref.read(authSnapshotProvider).subjects;
  if (chosen.length < kCuetMaxSubjects || chosen.contains(id)) return id;
  final catalog = ref.read(practiceSubjectsProvider).value;
  final last = chosen[kCuetMaxSubjects - 1];
  final editor = ref.read(profileEditorProvider);
  final choice = await showSubjectSwap(
    context,
    last: subjectNameFor(last, catalog),
    next: subjectNameFor(id, catalog),
    onSwap: () => editor.saveSubjects([...chosen.take(kCuetMaxSubjects - 1), id]),
  );
  return choice == null ? null : id;
}

/// The swap sheet: the student's last subject for the new one, or the new one just this once.
Future<SubjectSwap?> showSubjectSwap(BuildContext context, {required String last, required String next, required Future<void> Function() onSwap}) =>
    showMmSheet<SubjectSwap>(
      context: context,
      title: PracticeCopy.swapTitle,
      builder: (context) => SubjectSwapBody(last: last, next: next, onSwap: onSwap),
    );

class SubjectSwapBody extends StatefulWidget {
  const SubjectSwapBody({super.key, required this.last, required this.next, required this.onSwap});

  final String last;
  final String next;

  /// Saves the swap; completes once the server has acknowledged it, throws when it has not.
  final Future<void> Function() onSwap;

  @override
  State<SubjectSwapBody> createState() => _SubjectSwapBodyState();
}

class _SubjectSwapBodyState extends State<SubjectSwapBody> {
  bool _saving = false;
  bool _failed = false;

  Future<void> _swap() async {
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await widget.onSwap();
      if (mounted) Navigator.of(context).pop(SubjectSwap.swapped);
    } on Object {
      if (mounted) {
        setState(() {
          _saving = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(PracticeCopy.swapBody(widget.last, widget.next), style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s20),
        KeyButton(label: PracticeCopy.swapKey(widget.last, widget.next), loading: _saving, onPressed: _saving ? null : _swap),
        const SizedBox(height: MmSpace.s8),
        KeyButton.secondary(label: PracticeCopy.swapOnce, onPressed: _saving ? null : () => Navigator.of(context).pop(SubjectSwap.once)),
        if (_failed) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(PracticeCopy.swapFailed, style: type.small.copyWith(color: colors.warnText))),
        ],
      ],
    );
  }
}

class OtherSubjectsList extends StatelessWidget {
  const OtherSubjectsList({super.key, required this.subjects, required this.onPick});

  final List<SubjectChoice> subjects;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (subjects.isEmpty) {
      return Text(PracticeCopy.otherSubjectsEmpty, style: type.body.copyWith(color: colors.ink2));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final s in subjects)
          MmPressable(
            onTap: () => onPick(s.id),
            semanticsLabel: s.name,
            focusRadius: MmRadius.keyAll,
            pressedScale: 0.985,
            haptic: MmPressHaptic.selection,
            highlight: true,
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s8),
                child: Row(
                  children: [
                    SubjectEmblem(subject: s.id, size: EmblemSizes.chip, framed: false),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(child: Text(s.name, style: type.labelLarge)),
                    Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
