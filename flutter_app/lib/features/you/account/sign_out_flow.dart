import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Answers waiting on this phone that the server has not acknowledged. Zero when it cannot be
/// read (signed out, or the database is not ready).
Future<int> unsentAnswers(WidgetRef ref) async {
  try {
    return await ref.read(sessionDraftRepositoryProvider).unsentAnswerCount();
  } on Object {
    return 0;
  }
}

/// Asks before signing out, and warns first when answers are only on this phone ("3 answers are
/// on this phone and not sent. Sign out anyway?"). The safe key is the dominant one. Returns
/// true when the student confirmed.
Future<bool> confirmSignOut(BuildContext context, {required int unsent}) async {
  final choice = await showMmSheet<bool>(
    context: context,
    title: YouCopy.signOutTitle,
    builder: (context) => _SignOutSheet(unsent: unsent),
  );
  return choice ?? false;
}

class _SignOutSheet extends ConsumerWidget {
  const _SignOutSheet({required this.unsent});

  final int unsent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final warn = unsent > 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(warn ? YouCopy.signOutUnsent(unsent) : YouCopy.signOutPlain, style: type.body),
        if (warn) ...[
          const SizedBox(height: MmSpace.s8),
          Text(YouCopy.signOutUnsentNote, style: type.small.copyWith(color: colors.ink2)),
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
/// queue. Throws on failure so the caller can say so.
Future<void> performSignOut(WidgetRef ref) => ref.read(authSnapshotProvider.notifier).signOut();
