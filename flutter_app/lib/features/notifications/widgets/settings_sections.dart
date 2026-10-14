import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/permissions/permission_requester.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_row.dart' show IconWell;
import '../copy.dart';
import 'select_chip.dart';
import 'settings_rows.dart';

/// The permission pane while Android is still being asked: its shape only, so a student whose
/// notifications are on never sees a blocked pane flash first.
class PermissionPanelSkeleton extends StatelessWidget {
  const PermissionPanelSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: NotificationsCopy.permissionReading,
      child: MmSkeletonRows(rows: 1),
    );
  }
}

/// The system permission, as one honest panel: on, off with a way to turn it on, or blocked
/// with how to change it in Android settings.
class PermissionPanel extends StatelessWidget {
  const PermissionPanel({
    super.key,
    required this.permission,
    required this.onTurnOn,
    this.onOpenSettings,
  });

  final NotificationPermission permission;
  final VoidCallback onTurnOn;

  /// Opens Android's notification settings for MockMob, when blocked.
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    final (icon, title, body) = switch (permission) {
      NotificationPermission.granted => (
        LucideIcons.bellRing,
        NotificationsCopy.permissionOn,
        NotificationsCopy.permissionOnBody,
      ),
      NotificationPermission.notAsked => (
        LucideIcons.bellOff,
        NotificationsCopy.permissionOff,
        NotificationsCopy.permissionOffBody,
      ),
      NotificationPermission.denied || NotificationPermission.unavailable => (
        LucideIcons.bellOff,
        NotificationsCopy.permissionBlocked,
        NotificationsCopy.permissionBlockedBody,
      ),
    };
    final canAsk = permission == NotificationPermission.notAsked;
    final blocked = permission == NotificationPermission.denied || permission == NotificationPermission.unavailable;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: IconWell(icon, color: permission == NotificationPermission.granted ? colors.ink : colors.ink2),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(title, style: type.labelLarge.copyWith(fontSize: 16))),
                  const SizedBox(height: MmSpace.s4),
                  Text(body, style: type.small.copyWith(color: colors.ink2)),
                ],
              ),
            ),
          ],
        ),
        if (canAsk) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: NotificationsCopy.permissionTurnOn, onPressed: onTurnOn),
        ],
        if (blocked && onOpenSettings != null) ...[
          const SizedBox(height: MmSpace.s16),
          // The one thing to fix, so it is the volt key (as Turn on is when notifications are off).
          KeyButton(label: NotificationsCopy.openAndroidSettings, onPressed: onOpenSettings),
        ],
      ],
    );
    // The only boxed status on the screen is the one with something to do: lit (volt edge) when
    // reminders can be turned on, a hero without the edge when Android blocks them. When all is
    // well it is a plain row on the ground (no box) and the day below takes the eye.
    final pane = canAsk || blocked
        ? MmSurface.hero(lit: canAsk, padding: const EdgeInsets.all(MmSpace.s20), child: content)
        : content;
    return Semantics(container: true, child: pane);
  }
}

/// The inline line shown when a study window starts inside quiet hours. It never overrides
/// anything silently: it only says what to move.
class ConflictLine extends StatelessWidget {
  const ConflictLine({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      container: true,
      liveRegion: true,
      label: text,
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(
              LucideIcons.triangleAlert,
              size: 16,
              color: colors.warnText,
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(
            child: Text(
              text,
              style: context.mmType.small.copyWith(color: colors.warnText),
            ),
          ),
        ],
      ),
    );
  }
}

/// The weekly cap as four choice keys.
class CapChips extends StatelessWidget {
  const CapChips({super.key, required this.value, required this.onChanged});

  static const options = [1, 2, 3, 5];

  final int value;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: MmSpace.s8,
      runSpacing: MmSpace.s8,
      children: [
        for (final n in options)
          SelectChip(
            label: '$n',
            semanticsLabel: NotificationsCopy.capSemantics(n),
            selected: n == value,
            onSelected: onChanged == null ? null : () => onChanged!(n),
          ),
      ],
    );
  }
}

/// Mute for 7 days, or the calm statement that reminders are muted with a way to undo it.
class MuteSection extends StatelessWidget {
  const MuteSection({
    super.key,
    required this.mutedUntil,
    required this.onMute,
    required this.onUnmute,
  });

  final DateTime? mutedUntil;
  final VoidCallback onMute;
  final VoidCallback onUnmute;

  @override
  Widget build(BuildContext context) {
    final until = mutedUntil;
    if (until != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            container: true,
            liveRegion: true,
            child: Text(
              NotificationsCopy.muted(until),
              style: context.mmType.body,
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          KeyButton.secondary(
            label: NotificationsCopy.unmute,
            onPressed: onUnmute,
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const QuietNote(NotificationsCopy.muteBody, afterHeading: true),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(
          label: NotificationsCopy.muteKey,
          onPressed: onMute,
        ),
      ],
    );
  }
}

/// Reminders are muted: one slim row on the ground, the end date on one line and a plain
/// Unmute beside it. It is a state, not a card, so it never competes with the one boxed status
/// above the day (Turn on, Open Android settings).
class MutedRow extends StatelessWidget {
  const MutedRow({super.key, required this.message, required this.onUnmute});

  final String message;
  final VoidCallback onUnmute;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      liveRegion: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          children: [
            ExcludeSemantics(child: Icon(LucideIcons.bellOff, size: 18, color: colors.ink2)),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Text(message, style: type.labelLarge.copyWith(color: colors.ink)),
            ),
            const SizedBox(width: MmSpace.s8),
            Semantics(
              button: true,
              label: NotificationsCopy.unmute,
              onTap: onUnmute,
              excludeSemantics: true,
              child: MmPressable(
                onTap: onUnmute,
                haptic: MmPressHaptic.selection,
                builder: (context, pressed, _) => ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
                  // Text ends on the gutter: the 48 dp target reaches left, not past the edge.
                  child: Padding(
                    padding: const EdgeInsets.only(left: MmSpace.s12),
                    child: Center(
                      widthFactor: 1,
                      child: Text(
                        NotificationsCopy.unmute,
                        style: type.button.copyWith(
                          fontWeight: FontWeight.w700,
                          color: colors.accentText.withValues(alpha: pressed ? 0.7 : 1),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
