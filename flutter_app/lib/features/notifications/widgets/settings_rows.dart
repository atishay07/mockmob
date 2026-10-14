import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show MmPressHaptic, MmPressable, MmRhythm, Skeleton, SkeletonGroup;
import '../copy.dart';

/// A group heading in the Bricolage title cut, with the group gap above and the item gap
/// below, so the page reads as a few clear groups and not one long list.
class SectionHeading extends StatelessWidget {
  const SectionHeading(this.text, {super.key, this.topGap = MmRhythm.group});

  final String text;
  final double topGap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: topGap, bottom: MmRhythm.item, left: 4),
      child: Semantics(
        header: true,
        child: Text(text, style: context.mmType.title),
      ),
    );
  }
}

/// A line of quiet explanation under a heading or a row.
class QuietNote extends StatelessWidget {
  const QuietNote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 4, top: MmSpace.s8),
    child: Text(
      text,
      style: context.mmType.caption.copyWith(color: context.mmColors.ink2),
    ),
  );
}

/// A row with a label and a time or value in a tappable pill (a picker opens). The whole row is
/// the target, at least 60 dp tall: it presses edge to edge with the veil and a selection tick.
class ValueRow extends StatelessWidget {
  const ValueRow({
    super.key,
    required this.label,
    required this.value,
    required this.onTap,
    this.semanticsHint,
  });

  final String label;
  final String value;
  final VoidCallback? onTap;
  final String? semanticsHint;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onTap != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: '$label, $value',
      hint: semanticsHint ?? 'Changes the time',
      onTap: onTap,
      excludeSemantics: true,
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        highlight: true,
        pressedScale: 0.985,
        focusRadius: BorderRadius.zero,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20, vertical: MmSpace.s6),
            child: Row(
              children: [
                Expanded(
                  child: Text(label, style: type.labelLarge.copyWith(fontSize: 16, color: colors.ink)),
                ),
                const SizedBox(width: MmSpace.s12),
                // The time sits on the row as plain type with a quiet chevron: the whole row is
                // the key, so it needs no pill (a pill in a card is a box in a box).
                Text(
                  value,
                  style: type.button.copyWith(fontSize: 16, fontWeight: FontWeight.w700, color: colors.ink),
                ),
                const SizedBox(width: MmSpace.s8),
                ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A quiet action that lives inside a group of rows (Remove study window): a full-width row of
/// plain text, edge to edge, in a danger or muted tone. It has no fill, so a destructive action
/// never weighs the same as the screen's primary key.
class ActionRow extends StatelessWidget {
  const ActionRow({super.key, required this.label, required this.onTap, this.danger = true});

  final String label;
  final VoidCallback? onTap;

  /// Danger tone for a removal; muted otherwise.
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      onTap: onTap,
      excludeSemantics: true,
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        highlight: true,
        pressedScale: 0.985,
        focusRadius: BorderRadius.zero,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20, vertical: MmSpace.s6),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                label,
                style: type.labelLarge.copyWith(fontSize: 16, color: danger ? colors.badText : colors.ink2),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A channel row: a title, one line saying what it is for, and a switch. The whole row toggles
/// and presses edge to edge. [note] adds a warning or status line under the explanation.
class ChannelRow extends ConsumerWidget {
  const ChannelRow({
    super.key,
    required this.title,
    required this.body,
    required this.value,
    required this.onChanged,
    this.note,
    this.noteIsWarning = false,
    this.dimmed = false,
    this.blocked = false,
  });

  final String title;
  final String body;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? note;
  final bool noteIsWarning;

  /// Android blocks notifications: the choice is kept and can change, but reads as on hold.
  final bool dimmed;

  /// Android blocks notifications: nothing will arrive, so the switch gives way to a plain word
  /// (Blocked where the choice is on, Off where it is off) and the row is not a toggle. A grey
  /// switch left on would read as working.
  final bool blocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onChanged != null && !blocked;

    void toggle() {
      ref.read(hapticsProvider).tick();
      onChanged?.call(!value);
    }

    return Semantics(
      container: true,
      toggled: value,
      enabled: enabled,
      label: title,
      value: blocked ? (value ? NotificationsCopy.channelBlockedState : NotificationsCopy.channelOffState) : null,
      hint: note == null ? body : '$body $note',
      onTap: enabled ? toggle : null,
      excludeSemantics: true,
      // The toggle gives its own tick, so the press adds the veil and the give, no second haptic.
      child: MmPressable(
        onTap: enabled ? toggle : null,
        highlight: true,
        pressedScale: 0.985,
        focusRadius: BorderRadius.zero,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20, vertical: MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: type.labelLarge.copyWith(fontSize: 16, color: dimmed ? colors.ink2 : colors.ink)),
                      const SizedBox(height: 2),
                      Text(body, style: type.caption.copyWith(color: dimmed ? colors.ink3 : colors.ink2)),
                      if (note != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (noteIsWarning)
                              Padding(
                                padding: const EdgeInsets.only(top: 2, right: MmSpace.s8),
                                child: Icon(LucideIcons.triangleAlert, size: 16, color: colors.warnText),
                              ),
                            Expanded(
                              child: Text(
                                note!,
                                style: type.small.copyWith(color: noteIsWarning ? colors.warnText : colors.ink3),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                // The row handles the tap, so the switch sits outside the semantics tree.
                if (blocked)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      value ? NotificationsCopy.channelBlockedState : NotificationsCopy.channelOffState,
                      style: type.labelLarge.copyWith(color: colors.ink3),
                    ),
                  )
                else
                  IgnorePointer(
                    child: Switch(value: value, onChanged: enabled && !dimmed ? (_) {} : null),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A one-pixel hairline between rows.
class Hairline extends StatelessWidget {
  const Hairline({super.key});

  @override
  Widget build(BuildContext context) =>
      SizedBox(height: 1, child: ColoredBox(color: context.mmColors.line));
}

/// The settings list while the first read is in flight, in the real layout: a status block, the
/// day bar with its hours, then four rows each with a title, a line and a switch. On the ground
/// with the warm light sweeping across it (it sweeps a few times, then rests; still under
/// reduced motion).
class LoadingRows extends StatelessWidget {
  const LoadingRows({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget row(int i) => Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Skeleton.line(width: 120 + 24.0 * (i % 3), height: 16),
                const SizedBox(height: MmSpace.s8),
                Skeleton.line(width: 200 - 28.0 * (i % 2), height: 12),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s16),
          const Skeleton(width: 52, height: 32, radius: 16),
        ],
      ),
    );

    return SkeletonGroup(
      shimmer: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // The status pane: a round mark, two lines, and the key.
          const Row(
            children: [
              Skeleton.circle(size: 40),
              SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Skeleton.line(width: 160, height: 16),
                    SizedBox(height: MmSpace.s8),
                    Skeleton.line(height: 12),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s16),
          const Skeleton(height: 52, radius: 26),
          const SizedBox(height: MmRhythm.section),
          const Skeleton.line(width: 84, height: 18),
          const SizedBox(height: MmRhythm.item),
          const Skeleton(height: 36, radius: 18),
          const SizedBox(height: MmSpace.s12),
          const Skeleton.line(width: 200, height: 12),
          const SizedBox(height: MmRhythm.section),
          const Skeleton.line(width: 190, height: 18),
          const SizedBox(height: MmSpace.s8),
          for (var i = 0; i < 4; i++) ...[
            if (i > 0) SizedBox(height: 1, child: ColoredBox(color: colors.line.withValues(alpha: 0.8))),
            row(i),
          ],
        ],
      ),
    );
  }
}
