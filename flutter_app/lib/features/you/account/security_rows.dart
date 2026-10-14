import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../account_access/access_copy.dart';
import '../../account_access/access_gateway.dart';
import '../../account_access/state/password_hints.dart';
import '../edit_copy.dart';
import '../widgets/you_page.dart' show youText;
import '../widgets/you_row.dart';

/// "Set a password for faster sign-in" as a row of the Security list, with a quiet "Not now" under
/// it. It is a row, not a card: the credit balance owns the top of Account, and Security is a
/// plain list. "Not now" hides the offer for this account for good (the same rule as the card the
/// sign-in sheet shows).
class PasswordNudgeRow extends ConsumerWidget {
  const PasswordNudgeRow({super.key, required this.onSetPassword});

  final VoidCallback onSetPassword;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        YouRow(
          flat: true,
          icon: LucideIcons.keyRound,
          title: AccessCopy.nudgeAction,
          note: AccessCopy.nudgeTitle,
          onTap: onSetPassword,
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.only(left: 30),
            child: KeyButton.quiet(label: AccessCopy.notNow, onPressed: () => ref.read(passwordHintsProvider).dismissNudge()),
          ),
        ),
      ],
    );
  }
}

/// "Sign out of other devices" as a row: it ends the account's sessions on the website and other
/// phones and keeps this one. The row says what it is doing, then what happened.
class SignOutOthersRow extends ConsumerStatefulWidget {
  const SignOutOthersRow({super.key});

  @override
  ConsumerState<SignOutOthersRow> createState() => _SignOutOthersRowState();
}

class _SignOutOthersRowState extends ConsumerState<SignOutOthersRow> {
  bool _working = false;
  bool _done = false;
  String? _problem;

  Future<void> _run() async {
    if (_working) return;
    setState(() {
      _working = true;
      _done = false;
      _problem = null;
    });
    try {
      await ref.read(accountAccessGatewayProvider).signOutOtherDevices();
      if (!mounted) return;
      setState(() {
        _working = false;
        _done = true;
      });
    } on AccessException catch (e) {
      if (!mounted) return;
      setState(() {
        _working = false;
        _problem = AccessCopy.problem(e.failure);
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _working = false;
        _problem = AccessCopy.problem(AccessFailure.unknown);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final note = _working
        ? AccessCopy.signingOutOthers
        : _done
            ? AccessCopy.signOutOthersDone
            : EditCopy.otherDevicesNote;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        YouRow(
          flat: true,
          icon: LucideIcons.monitorSmartphone,
          title: AccessCopy.signOutOthersTitle,
          note: note,
          onTap: _working ? () {} : _run,
        ),
        if (_problem != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, MmSpace.s12),
            child: Semantics(
              liveRegion: true,
              container: true,
              child: Text(_problem!, style: type.small.copyWith(color: colors.ink)),
            ),
          ),
      ],
    );
  }
}

/// The note under the Profile list: what the email is for.
class ProfileFootnote extends StatelessWidget {
  const ProfileFootnote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
      child: Text(text, style: context.mmType.caption.copyWith(color: context.mmColors.ink3)),
    );
  }
}
