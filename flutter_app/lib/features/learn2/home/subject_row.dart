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
    // The subject is the page's heading (C-LEARN-CALM 2.1), not a third outlined box: the object, the name in display type and the
    // chevron, on the ground. The whole row is still the 56 dp key that opens the sheet.
    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          SizedBox.square(dimension: 44, child: SubjectEmblem(subject: now.id, size: 44, framed: false)),
          const SizedBox(width: MmSpace.s12),
          Flexible(
            child: Text(
              shortName(now.name),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              softWrap: false,
              style: type.title.copyWith(fontSize: 24, height: 1.15, letterSpacing: -0.025 * 24, color: colors.ink),
            ),
          ),
          if (many) ...[
            const SizedBox(width: MmSpace.s8),
            DecoratedBox(
              decoration: ShapeDecoration(color: colors.ink.withValues(alpha: colors.isNight ? 0.08 : 0.06), shape: const CircleBorder()),
              child: Padding(padding: const EdgeInsets.all(5), child: Icon(LucideIcons.chevronDown, size: 18, color: colors.ink2)),
            ),
          ],
        ],
      ),
    );
    if (!many) return Semantics(key: const ValueKey('lh-picker'), container: true, label: HomeCopy.pickerLabel(HomeModel.displayTitle(now.name), many: false), child: ExcludeSemantics(child: row));
    return MmPressable(
      key: const ValueKey('lh-picker'),
      semanticsLabel: HomeCopy.pickerLabel(HomeModel.displayTitle(now.name), many: many),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      onTap: () => _open(context),
      builder: (context, pressed, _) => Align(alignment: Alignment.centerLeft, widthFactor: 1, child: row),
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
