import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'sign_out_flow.dart';

/// The Sign out key with the existing flow behind it: a warning when work is only on this phone,
/// then the auth controller. A failed sign out says so under the key and the key comes back.
/// Used on You and in the Account sheet.
class SignOutKey extends ConsumerStatefulWidget {
  const SignOutKey({super.key});

  @override
  ConsumerState<SignOutKey> createState() => _SignOutKeyState();
}

class _SignOutKeyState extends ConsumerState<SignOutKey> {
  bool _signingOut = false;
  bool _failed = false;

  Future<void> _signOut() async {
    if (_signingOut) return;
    // Busy from the first tap, so a second tap cannot open a second sheet while the phone is read.
    setState(() {
      _signingOut = true;
      _failed = false;
    });
    final pending = await pendingWork(ref);
    if (!mounted) return;
    final confirmed = await confirmSignOut(context, pending: pending.count, unknown: pending.unknown);
    if (!mounted) return;
    if (!confirmed) {
      setState(() => _signingOut = false);
      return;
    }
    try {
      await performSignOut(ref);
    } on Object {
      if (mounted) {
        setState(() {
          _signingOut = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        KeyButton.secondary(label: YouCopy.signOut, loading: _signingOut, onPressed: _signingOut ? null : _signOut),
        if (_failed) ...[
          const SizedBox(height: MmSpace.s8),
          Semantics(
            liveRegion: true,
            child: Text(YouCopy.signOutFailed, style: context.mmType.small.copyWith(color: colors.badText), textAlign: TextAlign.center),
          ),
        ],
      ],
    );
  }
}
