// What did not win the hero still shows, as one compact glass row each: a second open thing,
// another sealed result, or tonight's move while a mock is still open. Secondary weight: a glass
// pill, never a second volt.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

class AlsoSlots extends StatelessWidget {
  const AlsoSlots({super.key, required this.slots, required this.onAction, this.offline = false});

  final List<AlsoSlot> slots;
  final void Function(TodayAction action) onAction;
  final bool offline;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final s in slots) ...[
          const SizedBox(height: MmSpace.s12),
          _Slot(slot: s, onAction: onAction, offline: offline),
        ],
      ],
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({required this.slot, required this.onAction, required this.offline});

  final AlsoSlot slot;
  final void Function(TodayAction action) onAction;
  final bool offline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final blocked = offline && slot.action.startsSession;
    return FakeGlass(
      borderRadius: MmRadius.panelAll,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(slot.title, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(slot.line, style: type.labelLarge, maxLines: 3, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            KeyButton.secondary(
              label: slot.action.label,
              expanded: false,
              minHeight: 44,
              onPressed: blocked ? null : () => onAction(slot.action),
            ),
          ],
        ),
      ),
    );
  }
}
