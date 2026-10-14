import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/session_draft_repository.dart' show sessionDraftRepositoryProvider;
import '../../../core/sync/outbox_repository.dart' show outboxRepositoryProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/sync/pending_work.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// What is only on this phone, and whether it could be read.
class PendingRead {
  const PendingRead(this.count, {this.unknown = false});

  /// A read that failed: nothing is known, which is not the same as nothing waiting.
  static const failed = PendingRead(PendingWorkCount.none, unknown: true);

  final PendingWorkCount count;

  /// The phone's database could not be read, so unsent work cannot be ruled out.
  final bool unknown;
}

/// What is only on this phone: unsent session answers and queued study writes. A part that
/// cannot be read makes the whole read [PendingRead.unknown], so the sheets warn instead of
/// saying nothing is waiting.
Future<PendingRead> pendingWork(WidgetRef ref) async {
  try {
    final answers = await ref.read(sessionDraftRepositoryProvider).unsentAnswerCount();
    final writes = (await ref.read(outboxRepositoryProvider).pending()).length;
    return PendingRead(PendingWorkCount(unsentAnswers: answers, queuedWrites: writes));
  } on Object {
    return PendingRead.failed;
  }
}

/// Asks before signing out, and warns first when work is only on this phone ("3 answers are on
/// this phone and not sent. Sign out anyway?", "2 study updates are waiting to send"). The safe
/// key (Stay signed in) is always the dominant one; signing out is the quiet glass key. Returns true when the student confirmed.
Future<bool> confirmSignOut(BuildContext context, {required PendingWorkCount pending, bool unknown = false}) async {
  final choice = await showMmSheet<bool>(
    context: context,
    title: YouCopy.signOutTitle,
    builder: (context) => _SignOutSheet(pending: pending, unknown: unknown),
  );
  return choice ?? false;
}

class _SignOutSheet extends ConsumerWidget {
  const _SignOutSheet({required this.pending, required this.unknown});

  final PendingWorkCount pending;
  final bool unknown;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final answers = pending.unsentAnswers;
    final queued = pending.queuedWrites;
    final warn = !pending.isEmpty || unknown;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!warn)
          Text(YouCopy.signOutPlain, style: type.body)
        else if (unknown) ...[
          Text(YouCopy.signOutUnknown, style: type.body),
          const SizedBox(height: MmSpace.s8),
          Text(YouCopy.signOutUnknownNote, style: type.small.copyWith(color: colors.ink2)),
        ] else ...[
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
        // Staying is the dominant key whether or not work is at risk; signing out is the quiet
        // glass key, never the volt primary (device walk-through P3-30).
        KeyButton(label: YouCopy.signOutStay, onPressed: () => Navigator.of(context).pop(false)),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(
          label: warn ? YouCopy.signOutAnyway : YouCopy.signOut,
          hapticOnCommit: !warn,
          onPressed: () {
            if (warn) ref.read(hapticsProvider).warn();
            Navigator.of(context).pop(true);
          },
        ),
      ],
    );
  }
}

/// Signs out through the auth controller, which clears tokens, local drafts and the usage-data
/// queue. Queued study writes stay for the same account to send ([keepQueuedWork]); account
/// deletion drops them. Throws on failure so the caller can say so.
Future<void> performSignOut(WidgetRef ref, {bool keepQueuedWork = true}) =>
    ref.read(authSnapshotProvider.notifier).signOut(keepQueuedWork: keepQueuedWork);
