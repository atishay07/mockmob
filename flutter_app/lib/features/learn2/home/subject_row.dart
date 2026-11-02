import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/learn_models.dart';
import 'home_copy.dart';
import 'home_model.dart';

/// Learn home's phone subject picker (the web's SubjectPicker.jsx, ruling R1): one 56 dp row with the subject's object, its name
/// and a chevron; a tap opens the student's subjects as a bottom sheet ("Choose a subject"). It replaces the sideways loop of
/// objects, which broke a name inside a word at 384 dp: the name here is one line and ends in an ellipsis, never broken. With one
/// subject the row is plain (no chevron, not a key). No due count: due cards are the offer's Revise row (ruling R6).
/// Choosing writes the shared practice subject (the caller does it in [onPick]).
class LearnSubjectPicker extends StatelessWidget {
  const LearnSubjectPicker({super.key, required this.subjects, required this.current, required this.onPick, this.busy = false});

  final List<LearnSubjectRef> subjects;
  final String current;
  final ValueChanged<String> onPick;

  /// The body under the row is still loading.
  final bool busy;

  /// "Economics / Business Economics" reads "Economics" in a row (the whole name is the sheet row's label); a slash between two words is
  /// "and".
  static String shortName(String name) => HomeModel.displayTitle(name.split(' / ').first);

  Future<void> _open(BuildContext context) async {
    final picked = await showMmSheet<String>(
      context: context,
      title: HomeCopy.pickerTitle,
      builder: (sheet) => _PickerList(subjects: subjects, current: current, onChoose: (id) => Navigator.of(sheet).pop(id)),
    );
    if (picked != null && picked != current) onPick(picked);
  }

  @override
  Widget build(BuildContext context) {
    if (subjects.isEmpty) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final now = subjects.firstWhere((s) => s.id == current, orElse: () => subjects.first);
    final many = subjects.length > 1;
    return MmSurface.plain(
      key: const ValueKey('lh-picker'),
      radius: 16,
      padding: const EdgeInsets.fromLTRB(10, 6, 14, 6),
      onTap: many ? () => _open(context) : null,
      semanticsLabel: HomeCopy.pickerLabel(HomeModel.displayTitle(now.name), many: many),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Row(
          children: [
            SizedBox.square(dimension: 40, child: SubjectEmblem(subject: now.id, size: 40, framed: false)),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Text(
                shortName(now.name),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                softWrap: false,
                style: type.title.copyWith(fontSize: 17, height: 1.2, letterSpacing: -0.01 * 17, color: colors.ink),
              ),
            ),
            if (many) Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2),
          ],
        ),
      ),
    );
  }
}

/// The sheet's rows: the object (40), the name (16 w600, w800 on the chosen one) and a check on the chosen one, hairlines between.
class _PickerList extends StatelessWidget {
  const _PickerList({required this.subjects, required this.current, required this.onChoose});

  final List<LearnSubjectRef> subjects;
  final String current;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, 0, MmSpace.s16, MmSpace.s16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final s in subjects)
            DecoratedBox(
              decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
              child: MmPressable(
                key: ValueKey('lh-picker-${s.id}'),
                semanticsLabel: HomeModel.displayTitle(s.name),
                selected: s.id == current,
                focusRadius: MmRadius.smallAll,
                pressedScale: 0.99,
                haptic: MmPressHaptic.selection,
                onTap: () => onChoose(s.id),
                builder: (context, pressed, _) => ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 60),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s8),
                    child: Row(
                      children: [
                        SizedBox.square(dimension: 40, child: SubjectEmblem(subject: s.id, size: 40, framed: false)),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            LearnSubjectPicker.shortName(s.name),
                            style: type.body.copyWith(fontSize: 16, height: 1.3, fontWeight: s.id == current ? FontWeight.w800 : FontWeight.w600, color: colors.ink),
                          ),
                        ),
                        if (s.id == current) Icon(LucideIcons.check, size: 20, color: colors.accentText),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
