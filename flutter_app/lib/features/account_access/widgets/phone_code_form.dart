import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import 'access_field.dart';
import 'form_message.dart';

/// What the phone form does with the number.
enum PhoneCodePurpose {
  /// Sign in with a phone already on an account (never creates an account).
  signIn,

  /// Add a phone to the signed-in account.
  addToAccount,
}

/// Two steps on one screen: the 10-digit number (with a fixed +91), then the 6-digit code.
/// Only shown when the build has PHONE_SIGN_IN on (docs/AUTH.md).
class PhoneCodeForm extends ConsumerStatefulWidget {
  const PhoneCodeForm({super.key, required this.purpose, this.onDone});

  final PhoneCodePurpose purpose;

  /// After the number was added (add-to-account). Sign-in hands over to the router instead.
  final VoidCallback? onDone;

  @override
  ConsumerState<PhoneCodeForm> createState() => _PhoneCodeFormState();
}

class _PhoneCodeFormState extends ConsumerState<PhoneCodeForm> {
  final _number = TextEditingController();
  final _code = TextEditingController();
  String? _sentTo;
  bool _working = false;
  bool _added = false;
  String? _problem;

  @override
  void dispose() {
    _number.dispose();
    _code.dispose();
    super.dispose();
  }

  AccountAccessGateway get _gateway => ref.read(accountAccessGatewayProvider);

  Future<void> _run(
    Future<void> Function() call, {
    VoidCallback? onOk,
    bool stayWorking = false,
  }) async {
    setState(() {
      _working = true;
      _problem = null;
    });
    try {
      await call();
      if (!mounted) return;
      setState(() {
        _working = stayWorking;
        onOk?.call();
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

  Future<void> _send() async {
    if (_working) return;
    final phone = indianMobileE164(_number.text);
    if (phone == null) {
      setState(() => _problem = AccessCopy.problem(AccessFailure.invalidPhone));
      return;
    }
    FocusScope.of(context).unfocus();
    await _run(
      () => widget.purpose == PhoneCodePurpose.signIn
          ? _gateway.sendPhoneCode(phone)
          : _gateway.addPhone(phone),
      onOk: () => _sentTo = phone,
    );
  }

  Future<void> _verify() async {
    final phone = _sentTo;
    if (_working || phone == null) return;
    if (_code.text.length != 6) {
      setState(() => _problem = AccessCopy.problem(AccessFailure.invalidCode));
      return;
    }
    FocusScope.of(context).unfocus();
    if (widget.purpose == PhoneCodePurpose.signIn) {
      // Signed in: the router replaces this screen, so the key keeps its working state.
      await _run(
        () => _gateway.verifyPhoneCode(phone, _code.text),
        stayWorking: true,
      );
    } else {
      await _run(
        () => _gateway.verifyPhoneChange(phone, _code.text),
        onOk: () => _added = true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    if (_added) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AccessDoneLine(
            title: AccessCopy.numberAdded,
            body: AccessCopy.numberAddedBody,
          ),
          const SizedBox(height: MmSpace.s24),
          KeyButton(label: AccessCopy.done, onPressed: widget.onDone),
        ],
      );
    }

    final sentTo = _sentTo;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (sentTo == null)
          AccessField(
            kind: AccessFieldKind.phone,
            label: AccessCopy.phoneLabel,
            hint: AccessCopy.phoneHint,
            prefix: AccessCopy.phonePrefix,
            controller: _number,
            autofocus: true,
            enabled: !_working,
            hasError: _problem != null,
            onSubmitted: _send,
          )
        else ...[
          Text(
            AccessCopy.smsSentTo(sentTo),
            style: type.body.copyWith(color: colors.ink2),
          ),
          const SizedBox(height: MmSpace.s16),
          AccessField(
            kind: AccessFieldKind.code,
            label: AccessCopy.smsCodeLabel,
            controller: _code,
            codeLength: 6,
            autofocus: true,
            enabled: !_working,
            hasError: _problem != null,
            onSubmitted: _verify,
          ),
        ],
        const SizedBox(height: MmSpace.s8),
        FormMessage(problem: _problem, working: _working),
        const SizedBox(height: MmSpace.s16),
        if (sentTo == null)
          KeyButton(
            label: _working ? AccessCopy.sendingCode : AccessCopy.textMeCode,
            loading: _working,
            onPressed: _working ? null : _send,
          )
        else ...[
          KeyButton(
            label: _working
                ? (widget.purpose == PhoneCodePurpose.signIn
                      ? AccessCopy.signingIn
                      : AccessCopy.checking)
                : (widget.purpose == PhoneCodePurpose.signIn
                      ? AccessCopy.signIn
                      : AccessCopy.addNumber),
            loading: _working,
            onPressed: _working ? null : _verify,
          ),
          const SizedBox(height: MmSpace.s4),
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(
              label: AccessCopy.differentNumber,
              onPressed: _working
                  ? null
                  : () => setState(() {
                      _sentTo = null;
                      _code.clear();
                      _problem = null;
                    }),
            ),
          ),
        ],
      ],
    );
  }
}
