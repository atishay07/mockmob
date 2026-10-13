import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';
import 'copy.dart';

const int kCodeLength = 8;

/// The eight-digit code entry. One real text field (so the keyboard, one-time-code autofill
/// and paste from the keyboard all work) sits invisibly over eight boxes. The next box to fill
/// carries the volt edge; a typed digit settles in. A wrong code gives the row one short
/// sideways nudge (never under reduced motion).
class CodeSlots extends StatefulWidget {
  const CodeSlots({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onCompleted,
    this.enabled = true,
    this.hasError = false,
    this.errorSerial = 0,
    this.autofocus = true,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onCompleted;
  final bool enabled;
  final bool hasError;

  /// A new value replays the nudge.
  final int errorSerial;
  final bool autofocus;

  @override
  State<CodeSlots> createState() => _CodeSlotsState();
}

class _CodeSlotsState extends State<CodeSlots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _nudge = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
  );

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_rebuild);
    widget.focusNode.addListener(_rebuild);
  }

  @override
  void didUpdateWidget(CodeSlots old) {
    super.didUpdateWidget(old);
    if (widget.errorSerial != old.errorSerial &&
        widget.hasError &&
        !Motion.reduced(context)) {
      _nudge.forward(from: 0);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    widget.focusNode.removeListener(_rebuild);
    _nudge.dispose();
    super.dispose();
  }

  void _rebuild() => setState(() {});

  void _changed(String value) {
    widget.onChanged(value);
    if (value.length == kCodeLength) widget.onCompleted(value);
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    final focused = widget.focusNode.hasFocus && widget.enabled;

    return Semantics(
      label: AuthCopy.codeFieldLabel,
      container: true,
      child: AnimatedBuilder(
        animation: _nudge,
        builder: (context, child) {
          // Two quick swings that settle: sin over a decaying envelope, 7 dp at most.
          final t = _nudge.value;
          final dx = math.sin(t * math.pi * 4) * 7 * (1 - t);
          return Transform.translate(offset: Offset(dx, 0), child: child);
        },
        child: SizedBox(
          height: _slotFace,
          child: Stack(
            children: [
              ExcludeSemantics(
                child: Row(
                  children: [
                    for (var i = 0; i < kCodeLength; i++) ...[
                      if (i > 0) const SizedBox(width: _gap),
                      Expanded(
                        child: _Slot(
                          digit: i < text.length ? text[i] : null,
                          current:
                              focused &&
                              i == math.min(text.length, kCodeLength - 1),
                          hasError: widget.hasError && i < text.length,
                          dimmed: !widget.enabled,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Positioned.fill(
                // The app theme styles every field (fill, borders); this one draws nothing.
                child: Theme(
                  data: Theme.of(context).copyWith(
                    inputDecorationTheme: const InputDecorationTheme(),
                  ),
                  child: TextField(
                    controller: widget.controller,
                    focusNode: widget.focusNode,
                    enabled: widget.enabled,
                    autofocus: widget.autofocus,
                    onChanged: _changed,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    autocorrect: false,
                    enableSuggestions: false,
                    enableInteractiveSelection: false,
                    showCursor: false,
                    contextMenuBuilder: (context, state) =>
                        const SizedBox.shrink(),
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(kCodeLength),
                    ],
                    // The slots draw the digits; the field stays invisible but real.
                    style: const TextStyle(
                      color: Colors.transparent,
                      fontSize: 1,
                    ),
                    cursorColor: Colors.transparent,
                    decoration: const InputDecoration.collapsed(hintText: null),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

const double _slotFace = 60;
const double _gap = 6;

/// One digit's box. Empty: a quiet well. The next box to fill: a volt edge and a short volt
/// caret (still, never blinking). A typed digit settles in from 0.9 in condensed figures.
class _Slot extends StatelessWidget {
  const _Slot({
    required this.digit,
    required this.current,
    required this.hasError,
    required this.dimmed,
  });

  final String? digit;
  final bool current;
  final bool hasError;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final filled = digit != null;
    final borderColor = hasError
        ? colors.badText
        : (current ? colors.focusRing : (filled ? colors.lineStrong : colors.line));
    final borderWidth = hasError || current ? 1.5 : 1.0;

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: dimmed ? colors.sunken : (filled ? colors.raised2 : colors.raised),
        shape: RoundedSuperellipseBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: borderColor, width: borderWidth),
        ),
      ),
      child: SizedBox(
        height: _slotFace,
        child: Center(
          child: filled
              ? TweenAnimationBuilder<double>(
                  key: ValueKey(digit),
                  tween: Tween<double>(begin: 0, end: 1),
                  duration: Motion.of(context, Motion.press),
                  curve: Motion.out,
                  builder: (context, t, child) => Opacity(
                    opacity: t,
                    child: Transform.scale(scale: 0.9 + 0.1 * t, child: child),
                  ),
                  child: Text(
                    digit!,
                    style: type.figureCompact.copyWith(fontSize: 30, height: 1, color: dimmed ? colors.ink3 : colors.ink),
                  ),
                )
              : (current
                  ? Container(width: 2, height: 26, decoration: BoxDecoration(color: colors.focusRing, borderRadius: MmRadius.pillAll))
                  : null),
        ),
      ),
    );
  }
}
