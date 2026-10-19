// The code boxes of J1 (spec 5.3): six boxes shown "K7P 2M9", growing to eight (shown "K7P2 M9XY") when
// an old 8-character code is typed or pasted. Paste takes a bare code, a code with spaces or hyphens,
// a whole link, or the whole message a friend sent: the code is found and normalised the way the
// server reads it (Crockford: uppercase, O to 0, I and L to 1).
//
// One hidden text field holds the characters (so the keyboard, paste and the system's own selection
// all work); the boxes only draw them. Nothing here talks to the server.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';

/// What the boxes draw around the characters.
enum CodeBoxState {
  /// Typing.
  idle,

  /// The server is being asked.
  checking,

  /// The server knows the code.
  ok,

  /// The server does not (invalid, expired, full or paused): the boxes keep the code, with a quiet
  /// red edge, so the student can fix a character.
  bad,
}

final RegExp _crockford = RegExp(r'[^0-9A-HJKMNP-TV-Z]');
final RegExp _joinLink = RegExp(r'/join/([0-9A-Za-z\-]+)');

/// The code inside whatever was typed or pasted: normalised, only code characters, at most 8.
String joinCodeFromInput(String raw) {
  final link = _joinLink.firstMatch(raw);
  final source = link != null ? link.group(1)! : raw;
  final code = normalizeJoinCode(source).replaceAll(_crockford, '');
  return code.length > 8 ? code.substring(0, 8) : code;
}

/// Keeps a text field to the characters of a join code (see [joinCodeFromInput]).
class JoinCodeFormatter extends TextInputFormatter {
  const JoinCodeFormatter();

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final text = joinCodeFromInput(newValue.text);
    if (text == newValue.text) return newValue;
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

class CodeBoxes extends StatelessWidget {
  const CodeBoxes({
    super.key,
    required this.controller,
    required this.focusNode,
    this.onChanged,
    this.state = CodeBoxState.idle,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final FocusNode focusNode;

  /// The normalised code after every change.
  final ValueChanged<String>? onChanged;
  final CodeBoxState state;
  final bool autofocus;

  /// 6 boxes for a code of up to 6 characters, else 8.
  static int boxCount(int length) => length > 6 ? 8 : 6;

  /// "K7P 2M9" for six, "K7P2 M9XY" for eight, with the characters typed so far.
  static String shown(String code) {
    final n = boxCount(code.length);
    final half = n ~/ 2;
    if (code.length <= half) return code;
    return '${code.substring(0, half)} ${code.substring(half)}';
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final code = value.text;
        final n = boxCount(code.length);
        return Semantics(
          container: true,
          textField: true,
          label: MobV3Copy.joinCodeLabel,
          value: shown(code),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              focusNode.requestFocus();
              SystemChannels.textInput.invokeMethod<void>('TextInput.show').catchError((Object _) {});
            },
            child: Stack(
              alignment: Alignment.center,
              children: [
                ExcludeSemantics(child: IgnorePointer(child: _Row(code: code, n: n, focused: focusNode, state: state))),
                // The real field: invisible, one pixel of text, but it owns the keyboard and paste.
                Positioned.fill(
                  child: Opacity(
                    opacity: 0.0,
                    child: TextField(
                      controller: controller,
                      focusNode: focusNode,
                      autofocus: autofocus,
                      autocorrect: false,
                      enableSuggestions: false,
                      textCapitalization: TextCapitalization.characters,
                      keyboardType: TextInputType.text,
                      textInputAction: TextInputAction.done,
                      inputFormatters: const [JoinCodeFormatter()],
                      showCursor: false,
                      cursorWidth: 0,
                      style: const TextStyle(fontSize: 1, height: 1),
                      decoration: const InputDecoration(border: InputBorder.none, enabledBorder: InputBorder.none, focusedBorder: InputBorder.none, contentPadding: EdgeInsets.zero, isDense: true, counterText: ''),
                      onChanged: (v) => onChanged?.call(joinCodeFromInput(v)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.code, required this.n, required this.focused, required this.state});

  final String code;
  final int n;
  final FocusNode focused;
  final CodeBoxState state;

  static const double height = 64;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return ListenableBuilder(
      listenable: focused,
      builder: (context, _) {
        final active = focused.hasFocus ? (code.length >= n ? n - 1 : code.length) : -1;
        return LayoutBuilder(
          builder: (context, box) {
            const gap = 8.0;
            const mid = 20.0;
            final room = box.maxWidth - gap * (n - 2) - mid;
            final w = (room / n).clamp(24.0, 48.0);
            final half = n ~/ 2;
            return SizedBox(
              height: height,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < n; i++) ...[
                    if (i == half) const SizedBox(width: mid) else if (i > 0) const SizedBox(width: gap),
                    // The width is not animated: going from six boxes to eight must never be wider than the room.
                    SizedBox(
                      width: w,
                      height: height,
                      child: AnimatedContainer(
                        duration: Motion.reduced(context) ? Motion.reducedFade : Motion.ui,
                        curve: Motion.out,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: c.raised,
                          borderRadius: MmRadius.keyAll,
                          border: Border.all(
                            color: state == CodeBoxState.bad
                                ? c.wrongBorder
                                : i == active
                                    ? c.ink
                                    : (state == CodeBoxState.ok ? c.lineStrong : c.line),
                            width: i == active ? 2 : 1,
                          ),
                        ),
                        child: Text(
                          i < code.length ? code[i] : '',
                          style: type.figureCompact.copyWith(fontSize: 30, height: 1, color: c.ink),
                          textHeightBehavior: MmType.figureHeightBehavior,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }
}
