import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'referral_data.dart';

/// What the invite areas say when the server's answer could not be read (after the one retry). Kept apart from
/// ReferralCopy, which holds the words about the invite itself.
abstract final class InviteLoadCopy {
  static const String failed = 'Could not load invites. Try again';
}

/// One quiet row in place of silence: the invites could not be read, and a tap reads them again. While the read runs the
/// owner of this row draws nothing (never partial data).
class InviteLoadFailedRow extends ConsumerWidget {
  const InviteLoadFailedRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Transform.translate(
          offset: const Offset(-MmSpace.s16, 0),
          child: KeyButton.quiet(label: InviteLoadCopy.failed, onPressed: () => ref.invalidate(referralStatusProvider)),
        ),
      ),
    );
  }
}

/// True when the read failed for good and is not running again: the moment to show [InviteLoadFailedRow].
extension ReferralStatusLoad on AsyncValue<ReferralStatus> {
  bool get invitesFailed => value == null && hasError && !isLoading;
}
