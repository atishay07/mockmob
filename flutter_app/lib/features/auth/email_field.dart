import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/theme.dart';
import 'copy.dart';

/// The 52 dp email field. The label sits above it (not floating), so it stays readable while
/// typing and under large text.
class EmailField extends StatelessWidget {
  const EmailField({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
    this.focusNode,
    this.hasError = false,
    this.enabled = true,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmitted;
  final FocusNode? focusNode;
  final bool hasError;
  final bool enabled;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    OutlineInputBorder border(Color color, double width) => OutlineInputBorder(
      borderRadius: MmRadius.keyAll,
      borderSide: BorderSide(color: color, width: width),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          AuthCopy.emailLabel,
          style: type.label.copyWith(color: colors.ink2),
        ),
        const SizedBox(height: MmSpace.s8),
        AutofillGroup(
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            enabled: enabled,
            autofocus: autofocus,
            onChanged: onChanged,
            onSubmitted: (_) => onSubmitted(),
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.send,
            autofillHints: const [AutofillHints.email],
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.none,
            inputFormatters: [FilteringTextInputFormatter.deny(RegExp(r'\s'))],
            cursorColor: colors.ink,
            style: type.body.copyWith(color: colors.ink),
            decoration: InputDecoration(
              hintText: AuthCopy.emailHint,
              hintStyle: type.body.copyWith(color: colors.ink3),
              filled: true,
              fillColor: colors.raised,
              isDense: true,
              constraints: const BoxConstraints(minHeight: 52),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: MmSpace.s16,
                vertical: 14,
              ),
              enabledBorder: border(
                hasError ? colors.badText : colors.lineStrong,
                hasError ? 2 : 1,
              ),
              disabledBorder: border(colors.line, 1),
              focusedBorder: border(hasError ? colors.badText : colors.ink, 2),
            ),
          ),
        ),
      ],
    );
  }
}
