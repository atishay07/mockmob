import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../access_copy.dart';

enum AccessFieldKind { email, password, newPassword, phone, code }

/// The 56 dp field of the sign-in screens: a solid well with its label above (not floating),
/// so it stays readable while typing and under large text. Passwords get a Show key that is a
/// real 48 dp target. Autofill hints let the phone's password manager fill and save.
class AccessField extends StatefulWidget {
  const AccessField({
    super.key,
    required this.kind,
    required this.label,
    required this.controller,
    this.onSubmitted,
    this.onChanged,
    this.focusNode,
    this.hint,
    this.hasError = false,
    this.enabled = true,
    this.autofocus = false,
    this.codeLength = 8,
    this.prefix,
    this.textInputAction,
  });

  final AccessFieldKind kind;
  final String label;
  final TextEditingController controller;
  final VoidCallback? onSubmitted;
  final ValueChanged<String>? onChanged;
  final FocusNode? focusNode;
  final String? hint;
  final bool hasError;
  final bool enabled;
  final bool autofocus;

  /// Digits in a code field.
  final int codeLength;

  /// A fixed prefix shown inside the field (the +91 of a phone number).
  final String? prefix;
  final TextInputAction? textInputAction;

  @override
  State<AccessField> createState() => _AccessFieldState();
}

class _AccessFieldState extends State<AccessField> {
  bool _visible = false;

  bool get _secret => widget.kind == AccessFieldKind.password || widget.kind == AccessFieldKind.newPassword;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    OutlineInputBorder border(Color color, double width) => OutlineInputBorder(
          borderRadius: MmRadius.keyAll,
          borderSide: BorderSide(color: color, width: width),
        );

    final (keyboard, hints, formatters) = switch (widget.kind) {
      AccessFieldKind.email => (
          TextInputType.emailAddress,
          const [AutofillHints.email, AutofillHints.username],
          <TextInputFormatter>[FilteringTextInputFormatter.deny(RegExp(r'\s'))],
        ),
      AccessFieldKind.password => (TextInputType.visiblePassword, const [AutofillHints.password], <TextInputFormatter>[]),
      AccessFieldKind.newPassword => (TextInputType.visiblePassword, const [AutofillHints.newPassword], <TextInputFormatter>[]),
      AccessFieldKind.phone => (
          TextInputType.phone,
          const [AutofillHints.telephoneNumberNational],
          <TextInputFormatter>[FilteringTextInputFormatter.allow(RegExp(r'[0-9 ]')), LengthLimitingTextInputFormatter(12)],
        ),
      AccessFieldKind.code => (
          TextInputType.number,
          const [AutofillHints.oneTimeCode],
          <TextInputFormatter>[FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(widget.codeLength)],
        ),
    };

    final toggle = _secret
        ? Semantics(
            button: true,
            label: _visible ? AccessCopy.hidePassword : AccessCopy.showPassword,
            excludeSemantics: true,
            child: InkWell(
              onTap: widget.enabled ? () => setState(() => _visible = !_visible) : null,
              borderRadius: MmRadius.keyAll,
              child: SizedBox(
                width: 64,
                height: MmTarget.min,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(_visible ? LucideIcons.eyeOff : LucideIcons.eye, size: 16, color: colors.ink2),
                    const SizedBox(width: MmSpace.s4),
                    Text(_visible ? AccessCopy.hide : AccessCopy.show, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ),
          )
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: type.label.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        TextField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          enabled: widget.enabled,
          autofocus: widget.autofocus,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted == null ? null : (_) => widget.onSubmitted!(),
          keyboardType: keyboard,
          textInputAction: widget.textInputAction ?? TextInputAction.done,
          autofillHints: widget.enabled ? hints : null,
          obscureText: _secret && !_visible,
          autocorrect: false,
          enableSuggestions: false,
          textCapitalization: TextCapitalization.none,
          inputFormatters: formatters,
          cursorColor: colors.ink,
          style: (widget.kind == AccessFieldKind.code ? type.figureCompact : type.body).copyWith(color: colors.ink),
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: type.body.copyWith(color: colors.ink3),
            prefixText: widget.prefix == null ? null : '${widget.prefix} ',
            prefixStyle: type.body.copyWith(color: colors.ink2),
            suffixIcon: toggle,
            filled: true,
            fillColor: colors.raised,
            isDense: true,
            constraints: const BoxConstraints(minHeight: 56),
            contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: 16),
            enabledBorder: border(widget.hasError ? colors.badText : colors.line, widget.hasError ? 1.5 : 1),
            disabledBorder: border(colors.line, 1),
            focusedBorder: border(widget.hasError ? colors.badText : colors.focusRing, 1.5),
          ),
        ),
      ],
    );
  }
}

/// One plain line of what went wrong and what to do. The icon and the words carry it; colour is
/// the second signal. Read out when it appears.
class AccessProblemLine extends StatelessWidget {
  const AccessProblemLine({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: ExcludeSemantics(child: Icon(LucideIcons.circleAlert, size: 16, color: colors.badText)),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: Text(message, style: context.mmType.small.copyWith(color: colors.ink))),
        ],
      ),
    );
  }
}

/// A calm, acknowledged outcome: a check and what it means. Shown only after the server said yes.
class AccessDoneLine extends StatelessWidget {
  const AccessDoneLine({super.key, required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: ExcludeSemantics(child: Icon(LucideIcons.circleCheck, size: 20, color: colors.goodText)),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.title.copyWith(color: colors.ink)),
                const SizedBox(height: MmSpace.s4),
                Text(body, style: type.body.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
