import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../mob_routes.dart';

/// The Mob tab's second way in for a student with no Mob (D105): a friend's code or link. One line
/// that says what it is for, and an outlined key (the page's one volt key stays Start a Mob).
class JoinWithCodeRow extends StatelessWidget {
  const JoinWithCodeRow({super.key});

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(MobCopy.joinCodeLead, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(
          key: const ValueKey('mob-join-with-code'),
          label: MobCopy.joinWithCode,
          onPressed: () => showJoinWithCodeSheet(context),
        ),
      ],
    );
  }
}

/// The sheet: the code or the whole link, checked as it is typed, then the friend's Mob (the same
/// join page the link opens, where the student sees who invited them and joins).
///
/// The key is pinned under the body (the sheet's footer) and the sheet rises onto the keyboard, so the
/// code field and the "Find their Mob" key both stay above the keys, at any text size (walk H1, 19 Oct).
Future<void> showJoinWithCodeSheet(BuildContext context) {
  final form = JoinCodeForm();
  return showMmSheet<void>(
    context: context,
    title: MobCopy.joinCodeTitle,
    liftWithKeyboard: true,
    builder: (sheet) {
      form.onCode = (code) {
        Navigator.of(sheet).pop();
        unawaited(openMobJoin(context, code));
      };
      return JoinWithCodeSheet(onCode: form.onCode!, form: form, showKey: false);
    },
    footer: (_) => KeyButton(label: MobCopy.joinCodeKey, onPressed: form.submit),
  );
}

/// The sheet's field and its check, shared by the field (in the body) and the key (pinned in the footer).
class JoinCodeForm {
  final TextEditingController field = TextEditingController();
  final ValueNotifier<String?> error = ValueNotifier<String?>(null);
  ValueChanged<String>? onCode;

  void submit() {
    final code = inviteCodeFromLink(field.text);
    if (code == null) {
      error.value = MobCopy.joinCodeWrong;
      return;
    }
    onCode?.call(code);
  }

  void dispose() {
    field.dispose();
    error.dispose();
  }
}

class JoinWithCodeSheet extends StatefulWidget {
  const JoinWithCodeSheet({super.key, required this.onCode, this.form, this.showKey = true});

  /// Called with the code (normalised) once it reads right.
  final ValueChanged<String> onCode;

  /// The field and check when the key lives outside (the sheet's footer); null makes its own. The sheet disposes it.
  final JoinCodeForm? form;

  /// Whether the key is drawn here (the standalone sheet) or by the owner of [form].
  final bool showKey;

  @override
  State<JoinWithCodeSheet> createState() => _JoinWithCodeSheetState();
}

class _JoinWithCodeSheetState extends State<JoinWithCodeSheet> {
  late final JoinCodeForm _form;

  @override
  void initState() {
    super.initState();
    _form = widget.form ?? (JoinCodeForm()..onCode = widget.onCode);
  }

  // The sheet owns its form either way: it is disposed when the sheet has left, not when it starts to.
  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(MobCopy.joinCodeNote, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          ValueListenableBuilder<String?>(
            valueListenable: _form.error,
            builder: (context, error, _) => TextField(
              key: const ValueKey('mob-join-code-field'),
              controller: _form.field,
              autofocus: true,
              scrollPadding: const EdgeInsets.all(MmSpace.s24),
              autocorrect: false,
              enableSuggestions: false,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.go,
              onChanged: (_) {
                if (_form.error.value != null) _form.error.value = null;
              },
              onSubmitted: (_) => _form.submit(),
              style: type.body.copyWith(color: colors.ink),
              decoration: InputDecoration(labelText: MobCopy.joinCodeLabel, hintText: MobCopy.joinCodeHint, errorText: error, errorMaxLines: 3),
            ),
          ),
          if (widget.showKey) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton(label: MobCopy.joinCodeKey, onPressed: _form.submit),
          ],
        ],
      ),
    );
  }
}
