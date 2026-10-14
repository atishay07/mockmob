// What did not win the hero still shows, right under it, as one row each on the ground (no box
// under the stage; ui-blitz/today.md 2): a second open thing, another sealed result, or tonight's
// move while a mock is still open. A short ink tick ties the row to the stage above it.
// Secondary weight: a quiet glass key, never a second volt (unless the hero above only offers a
// way out, when the slot's key is the screen's one volt key).
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

class AlsoSlots extends StatelessWidget {
  const AlsoSlots({super.key, required this.slots, required this.onAction, this.offline = false, this.retrying = false});

  final List<AlsoSlot> slots;
  final void Function(TodayAction action) onAction;
  final bool offline;

  /// A Try again read is running: a slot key that retries shows it is working.
  final bool retrying;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final s in slots) ...[
          const SizedBox(height: MmSpace.s12),
          _Slot(slot: s, onAction: onAction, offline: offline, retrying: retrying),
        ],
      ],
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({required this.slot, required this.onAction, required this.offline, required this.retrying});

  final AlsoSlot slot;
  final void Function(TodayAction action) onAction;
  final bool offline;
  final bool retrying;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final blocked = offline && slot.action.startsSession;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, 0, MmSpace.s4),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The tick: a short ink rule at the row's left edge.
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Container(width: 2, decoration: BoxDecoration(color: colors.lineStrong, borderRadius: MmRadius.pillAll)),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(slot.title, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(slot.line, style: type.labelLarge, maxLines: 3, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Center(
              child: slot.lead
                  ? KeyButton(
                      label: slot.action.label,
                      expanded: false,
                      minHeight: MmTarget.min,
                      loading: retrying && slot.action.target is RetryLoad,
                      onPressed: blocked ? null : () => onAction(slot.action),
                    )
                  : KeyButton.secondary(
                      label: slot.action.label,
                      expanded: false,
                      minHeight: MmTarget.min,
                      loading: retrying && slot.action.target is RetryLoad,
                      onPressed: blocked ? null : () => onAction(slot.action),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
