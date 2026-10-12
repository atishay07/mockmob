// The weekly goal editor (spec 5.11): study days a week, 1 to 7. Shown in a sheet from the You
// rhythm screen; the You goal route can reuse `showGoalEditor` as it is.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/rhythm_providers.dart';

/// Opens the goal editor sheet. Saves through `RhythmActions.saveGoal` and closes when the
/// server acknowledged. Returns the saved number of days, or null when dismissed.
Future<int?> showGoalEditor(BuildContext context, {required int initialDays}) {
  return showMmSheet<int>(
    context: context,
    title: RhythmCopy.goalTitle,
    builder: (context) => GoalEditor(initialDays: initialDays),
  );
}

class GoalEditor extends ConsumerStatefulWidget {
  const GoalEditor({super.key, required this.initialDays, this.onSave});

  final int initialDays;

  /// Defaults to `RhythmActions.saveGoal`. Throws when the save fails.
  final Future<void> Function(int days)? onSave;

  @override
  ConsumerState<GoalEditor> createState() => _GoalEditorState();
}

class _GoalEditorState extends ConsumerState<GoalEditor> {
  late int _days = widget.initialDays.clamp(1, 7);
  bool _saving = false;
  bool _failed = false;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      final save = widget.onSave ?? ref.read(rhythmActionsProvider).saveGoal;
      await save(_days);
      if (mounted) Navigator.of(context).pop(_days);
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
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(RhythmCopy.goalPrompt, style: type.label.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        LayoutBuilder(
          builder: (context, constraints) {
            // Seven 44 dp targets in one row when they fit; two rows on a very narrow screen.
            final width = constraints.maxWidth;
            final spare = width - 7 * 44;
            return Wrap(
              spacing: spare >= 0 ? spare / 6 : ((width - 4 * 44) / 3).clamp(4.0, 48.0),
              runSpacing: MmSpace.s8,
              children: [
                for (var d = 1; d <= 7; d++)
                  _DayChoice(
                    value: d,
                    selected: d == _days,
                    onTap: _saving
                        ? null
                        : () {
                            ref.read(hapticsProvider).tick();
                            setState(() {
                              _days = d;
                              _failed = false;
                            });
                          },
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: MmSpace.s16),
        Text(RhythmCopy.goalSentence(_days), style: type.body.copyWith(color: colors.ink2)),
        if (_failed) ...[
          const SizedBox(height: MmSpace.s12),
          InlineBanner(message: RhythmCopy.goalSaveFailed, tone: BannerTone.error),
        ],
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: RhythmCopy.saveGoal, onPressed: _saving ? null : _save, loading: _saving),
      ],
    );
  }
}

class _DayChoice extends StatelessWidget {
  const _DayChoice({required this.value, required this.selected, required this.onTap});

  final int value;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      selected: selected,
      label: '$value ${value == 1 ? 'day' : 'days'} a week',
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? colors.ink : colors.raised,
              border: Border.all(color: selected ? colors.ink : colors.lineStrong, width: selected ? 2 : 1),
            ),
            child: Center(child: Text('$value', style: type.button.copyWith(color: selected ? colors.ground : colors.ink))),
          ),
        ),
      ),
    );
  }
}
