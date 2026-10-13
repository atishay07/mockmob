import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import '../state/password_hints.dart';
import 'access_field.dart';

/// Sets or changes the signed-in student's password: one field with Show, the rule beside it,
/// "Save password" with a working state, and "Password saved" only after Supabase said yes.
/// The phone's password manager is then asked to save it.
class SetPasswordForm extends ConsumerStatefulWidget {
  const SetPasswordForm({
    super.key,
    required this.email,
    this.onDone,
    this.onSkip,
    this.autofocus = true,
    this.endOtherSessions = false,
  });

  /// The signed-in account's email, shown and offered to the password manager.
  final String? email;

  /// After the acknowledged success, "Done".
  final VoidCallback? onDone;

  /// "Not now". Hidden when null.
  final VoidCallback? onSkip;
  final bool autofocus;

  /// After "Forgot password": once the new password is saved, sign out every other device,
  /// so someone who knew the old password or held a stolen session loses access.
  final bool endOtherSessions;

  @override
  ConsumerState<SetPasswordForm> createState() => _SetPasswordFormState();
}

class _SetPasswordFormState extends ConsumerState<SetPasswordForm> {
  final TextEditingController _password = TextEditingController();
  bool _working = false;
  bool _saved = false;
  bool _tried = false;
  String? _problem;

  /// Set after a reset: whether the other devices were signed out.
  bool? _othersSignedOut;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  bool get _longEnough => _password.text.length >= minPasswordLength;

  Future<void> _save() async {
    if (_working) return;
    setState(() => _tried = true);
    if (!_longEnough) {
      setState(() => _problem = AccessCopy.problem(AccessFailure.weakPassword));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _working = true;
      _problem = null;
    });
    try {
      final gateway = ref.read(accountAccessGatewayProvider);
      await gateway.setPassword(_password.text);
      await ref.read(passwordHintsProvider).markPasswordSet();
      TextInput.finishAutofillContext();
      bool? othersSignedOut;
      if (widget.endOtherSessions) {
        try {
          await gateway.signOutOtherDevices();
          othersSignedOut = true;
        } on Object {
          // The password is saved either way; the done screen says what is left to do.
          othersSignedOut = false;
        }
      }
      if (!mounted) return;
      setState(() {
        _working = false;
        _saved = true;
        _othersSignedOut = othersSignedOut;
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
    final colors = context.mmColors;
    final type = context.mmType;

    if (_saved) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AccessDoneLine(title: AccessCopy.passwordSaved, body: AccessCopy.passwordSavedFor(widget.email)),
          if (_othersSignedOut == true) ...[
            const SizedBox(height: MmSpace.s12),
            Text(AccessCopy.otherDevicesSignedOut, style: type.body.copyWith(color: colors.ink2)),
          ],
          if (_othersSignedOut == false) ...[
            const SizedBox(height: MmSpace.s12),
            const AccessProblemLine(message: AccessCopy.otherDevicesStillIn),
          ],
          const SizedBox(height: MmSpace.s24),
          KeyButton(label: AccessCopy.done, onPressed: widget.onDone, autofocus: true),
        ],
      );
    }

    final ruleMet = _longEnough;
    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AccessField(
            kind: AccessFieldKind.newPassword,
            label: AccessCopy.newPasswordLabel,
            controller: _password,
            autofocus: widget.autofocus,
            enabled: !_working,
            hasError: _problem != null,
            onSubmitted: _save,
            onChanged: (_) => setState(() {
              if (_problem != null && _longEnough) _problem = null;
            }),
          ),
          const SizedBox(height: MmSpace.s8),
          Row(
            children: [
              ExcludeSemantics(
                child: Icon(
                  ruleMet ? LucideIcons.circleCheck : LucideIcons.circle,
                  size: 14,
                  color: ruleMet ? colors.goodText : (_tried ? colors.badText : colors.ink3),
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              Text(AccessCopy.passwordRule, style: type.small.copyWith(color: colors.ink2)),
            ],
          ),
          if (_problem != null) ...[
            const SizedBox(height: MmSpace.s12),
            AccessProblemLine(message: _problem!),
          ],
          const SizedBox(height: MmSpace.s20),
          KeyButton(
            label: _working ? AccessCopy.savingPassword : AccessCopy.savePassword,
            loading: _working,
            onPressed: _working ? null : _save,
          ),
          if (widget.onSkip != null) ...[
            const SizedBox(height: MmSpace.s8),
            Align(child: KeyButton.quiet(label: AccessCopy.notNow, onPressed: _working ? null : widget.onSkip)),
          ],
        ],
      ),
    );
  }
}
