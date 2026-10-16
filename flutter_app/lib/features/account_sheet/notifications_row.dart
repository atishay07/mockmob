// The Notifications row of the Account sheet (owner, 16 Oct: keep inviting people until reminders
// are on). It states the setting and, while reminders are off, carries the key that turns them on:
//
// - off:      "Off" and a volt Turn on pill. The pill asks Android (or only switches the setting on
//             when Android already allows it). The row itself still opens the settings page.
// - blocked:  "Blocked in Android settings" and an Open settings pill.
// - on:       the next reminder's time ("Next: tonight 8:30 PM") and the chevron.
//
// The row and the pill are two separate 48 dp targets that never overlap, and while the pill is
// there the row shows no chevron.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/settings/changed_row.dart';
import '../../core/theme/theme.dart';
import '../notifications/copy.dart';
import '../notifications/services/reminder_invite.dart';
import '../notifications/widgets/invite_pill.dart';
import '../you/widgets/you_motion.dart' show YouIconMotion, YouMovingIcon, YouNote;
import '../you/widgets/you_row.dart' show RowFrame, YouRow;
import 'account_copy.dart';

class AccountNotificationsRow extends ConsumerStatefulWidget {
  const AccountNotificationsRow({super.key, required this.onOpen});

  /// Opens the notifications page (the sheet closes first and pushes it).
  final VoidCallback onOpen;

  @override
  ConsumerState<AccountNotificationsRow> createState() => _AccountNotificationsRowState();
}

class _AccountNotificationsRowState extends ConsumerState<AccountNotificationsRow> {
  bool _asking = false;

  Future<void> _turnOn() async {
    if (_asking) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    setState(() => _asking = true);
    final result = await ref.read(reminderInviteProvider).turnOn();
    if (!mounted) return;
    setState(() => _asking = false);
    if (result == TurnOnResult.refused) {
      messenger?.showSnackBar(const SnackBar(content: Text(NotificationsCopy.inviteRefused)));
    }
  }

  Future<void> _openSettings() async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final done = await ref.read(reminderInviteProvider).openSettings();
    if (!done) {
      messenger?.showSnackBar(const SnackBar(content: Text(NotificationsCopy.settingsDidNotOpen)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reminderRowStateProvider);
    final colors = context.mmColors;
    final type = context.mmType;

    // On, or nothing to say yet: an ordinary navigation row with the chevron.
    if (state.kind != ReminderRowKind.off && state.kind != ReminderRowKind.blocked) {
      final when = state.nextWhen;
      return YouRow(
        flat: true,
        icon: LucideIcons.bell,
        motion: YouIconMotion.swing,
        changeKey: ChangedRowKeys.notifications,
        title: AccountCopy.rowNotifications,
        note: switch (state.kind) {
          ReminderRowKind.on => when == null ? NotificationsCopy.rowOn : NotificationsCopy.rowNext(when),
          _ => null,
        },
        onTap: widget.onOpen,
      );
    }

    final blocked = state.kind == ReminderRowKind.blocked;
    final note = blocked ? NotificationsCopy.rowBlocked : null;
    final spoken = blocked
        ? '${AccountCopy.rowNotifications}. ${NotificationsCopy.rowBlocked}'
        : '${AccountCopy.rowNotifications}. ${NotificationsCopy.rowOff}';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: RowFrame(
            onTap: widget.onOpen,
            semanticsLabel: spoken,
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            child: const SizedBox.shrink(),
            pressedBuilder: (context, pressed) => Row(
              children: [
                SizedBox.square(
                  dimension: 28,
                  child: Center(
                    child: YouMovingIcon(
                      icon: LucideIcons.bell,
                      size: 22,
                      color: colors.ink,
                      pressed: pressed,
                      motion: YouIconMotion.swing,
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s16),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(AccountCopy.rowNotifications, style: type.labelLarge.copyWith(fontSize: 16, color: colors.ink)),
                      if (note != null) ...[
                        const SizedBox(height: 2),
                        YouNote(note, style: type.caption.copyWith(color: colors.ink2)),
                      ],
                    ],
                  ),
                ),
                if (!blocked) ...[
                  const SizedBox(width: MmSpace.s8),
                  ExcludeSemantics(
                    child: Text(NotificationsCopy.rowOff, style: type.small.copyWith(color: colors.ink2)),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(width: MmSpace.s8),
        if (blocked)
          InvitePill(label: NotificationsCopy.inviteOpenSettings, onPressed: () => unawaited(_openSettings()))
        else
          InvitePill(
            label: NotificationsCopy.inviteTurnOn,
            semanticsLabel: NotificationsCopy.inviteTurnOnLabel,
            loading: _asking,
            onPressed: () => unawaited(_turnOn()),
          ),
      ],
    );
  }
}
