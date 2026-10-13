import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/sync/pending_work.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// What is only on this phone: unsent session answers and queued study writes. Zero when it
/// cannot be read (signed out, or the database is not ready).
Future<PendingWorkCount> pendingWork(WidgetRef ref) async {
  try {
    return await ref.refresh(pendingWorkCountProvider.future);
  } on Object {
    return PendingWorkCount.none;
  }
}

/// Asks before signing out, and warns first when work is only on this phone ("3 answers are on
/// this phone and not sent. Sign out anyway?", "2 study updates are waiting to send"). The safe
/// key is the dominant one. Returns true when the student confirmed.
Future<bool> confirmSignOut(BuildContext context, {required PendingWorkCount pending}) async {
  final choice = await showMmSheet<bool>(
    context: context,
    title: YouCopy.signOutTitle,
    builder: (context) => _SignOutSheet(pending: pending),
  );
  return choice ?? false;
}

class _SignOutSheet extends ConsumerWidget {
  const _SignOutSheet({required this.pending});

  final PendingWorkCount pending;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final answers = pending.unsentAnswers;
    final queued = pending.queuedWrites;
    final warn = !pending.isEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!warn)
          Text(YouCopy.signOutPlain, style: type.body)
        else ...[
          if (answers > 0) ...[
            Text(YouCopy.signOutUnsent(answers), style: type.body),
            const SizedBox(height: MmSpace.s8),
            Text(YouCopy.signOutUnsentNote, style: type.small.copyWith(color: colors.ink2)),
          ],
          if (queued > 0) ...[
            if (answers > 0) const SizedBox(height: MmSpace.s16),
            Text(answers > 0 ? YouCopy.signOutQueued(queued) : YouCopy.signOutQueuedAsk(queued), style: type.body),
            const SizedBox(height: MmSpace.s8),
            Text(YouCopy.signOutQueuedNote, style: type.small.copyWith(color: colors.ink2)),
          ],
        ],
        const SizedBox(height: MmSpace.s24),
        if (warn) ...[
          KeyButton(label: YouCopy.signOutStay, onPressed: () => Navigator.of(context).pop(false)),
          const SizedBox(height: MmSpace.s12),
          KeyButton.secondary(
            label: YouCopy.signOutAnyway,
            hapticOnCommit: false,
            onPressed: () {
              ref.read(hapticsProvider).warn();
              Navigator.of(context).pop(true);
            },
          ),
        ] else ...[
          KeyButton(label: YouCopy.signOut, onPressed: () => Navigator.of(context).pop(true)),
          const SizedBox(height: MmSpace.s8),
          Align(child: KeyButton.quiet(label: YouCopy.cancel, onPressed: () => Navigator.of(context).pop(false))),
        ],
      ],
    );
  }
}

/// Signs out through the auth controller, which clears tokens, local drafts and the usage-data
/// queue. Queued study writes stay for the same account to send ([keepQueuedWork]); account
/// deletion drops them. Throws on failure so the caller can say so.
Future<void> performSignOut(WidgetRef ref, {bool keepQueuedWork = true}) =>
    ref.read(authSnapshotProvider.notifier).signOut(keepQueuedWork: keepQueuedWork);
