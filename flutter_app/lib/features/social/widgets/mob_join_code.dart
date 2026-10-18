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
Future<void> showJoinWithCodeSheet(BuildContext context) => showMmSheet<void>(
  context: context,
  title: MobCopy.joinCodeTitle,
  builder: (sheet) => JoinWithCodeSheet(
    onCode: (code) {
      Navigator.of(sheet).pop();
      unawaited(openMobJoin(context, code));
    },
  ),
);

class JoinWithCodeSheet extends StatefulWidget {
  const JoinWithCodeSheet({super.key, required this.onCode});

  /// Called with the code (normalised) once it reads right.
  final ValueChanged<String> onCode;

  @override
  State<JoinWithCodeSheet> createState() => _JoinWithCodeSheetState();
}

class _JoinWithCodeSheetState extends State<JoinWithCodeSheet> {
  final TextEditingController _field = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _field.dispose();
    super.dispose();
  }

  void _submit() {
    final code = inviteCodeFromLink(_field.text);
    if (code == null) {
      setState(() => _error = MobCopy.joinCodeWrong);
      return;
    }
    widget.onCode(code);
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.sheetSide, MmSpace.s4, MmSpace.sheetSide, MmSpace.s20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(MobCopy.joinCodeNote, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          TextField(
            key: const ValueKey('mob-join-code-field'),
            controller: _field,
            autofocus: true,
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.go,
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
            onSubmitted: (_) => _submit(),
            style: type.body.copyWith(color: colors.ink),
            decoration: InputDecoration(labelText: MobCopy.joinCodeLabel, hintText: MobCopy.joinCodeHint, errorText: _error, errorMaxLines: 3),
          ),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: MobCopy.joinCodeKey, onPressed: _submit),
        ],
      ),
    );
  }
}
