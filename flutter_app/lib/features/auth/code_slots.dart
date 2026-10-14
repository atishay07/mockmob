import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';
import 'copy.dart';

const int kCodeLength = 8;

/// The eight-digit code entry. One real text field (so the keyboard, one-time-code autofill
/// and paste from the keyboard all work) sits invisibly over eight boxes. The next box to fill
/// carries a volt ring with a dark inner edge (so it reads in both rooms); a typed digit
/// settles in. A wrong code gives the row one short sideways nudge, and while a code is being
/// checked a soft volt light sweeps across the boxes (neither moves under reduced motion).
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

class _CodeSlotsState extends State<CodeSlots> with TickerProviderStateMixin {
  late final AnimationController _nudge = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
  );

  /// The checking light: one band crossing the row, repeating only while the code is checked.
  late final AnimationController _sweep = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
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
    if (!widget.enabled && old.enabled && !Motion.reduced(context)) {
      _sweep.repeat();
    } else if (widget.enabled && !old.enabled) {
      _sweep.stop();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    widget.focusNode.removeListener(_rebuild);
    _nudge.dispose();
    _sweep.dispose();
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
          // Room above and below for the volt ring of the box in turn.
          height: _slotFace + 2 * _ringRoom,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              ExcludeSemantics(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: _ringRoom),
                  child: _Sweep(
                  active: !widget.enabled,
                  reduced: Motion.reduced(context),
                  animation: _sweep,
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
const double _ringRoom = 4;
const double _gap = 6;

/// A band of volt light crossing its child once per turn of [animation], painted only over what
/// the child has already drawn. Under reduced motion it rests mid-row, so the busy state still
/// reads without anything moving.
class _Sweep extends StatelessWidget {
  const _Sweep({
    required this.active,
    required this.reduced,
    required this.animation,
    required this.child,
  });

  final bool active;
  final bool reduced;
  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!active) return child;
    final colors = context.mmColors;
    final band = colors.volt.withValues(alpha: colors.isNight ? 0.5 : 0.42);
    Widget lit(double t) => ShaderMask(
      blendMode: BlendMode.srcATop,
      shaderCallback: (rect) => LinearGradient(
        colors: [band.withValues(alpha: 0), band, band.withValues(alpha: 0)],
        stops: const [0.3, 0.5, 0.7],
        transform: _Slide(t),
      ).createShader(rect),
      child: child,
    );
    if (reduced) return lit(0.5);
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) => lit(animation.value),
    );
  }
}

/// Moves a gradient sideways by its own width: 0 puts the band off the left edge, 1 off the right.
class _Slide extends GradientTransform {
  const _Slide(this.t);

  final double t;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * (2 * t - 1), 0, 0);
}

/// One digit's box. Empty: a quiet well. The next box to fill: a volt ring around a dark inner
/// edge and a short caret (still, never blinking). A typed digit settles in from 0.9 in
/// condensed figures and the box lifts off the page, so a filled box reads against an empty one
/// in both rooms.
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
    final night = colors.isNight;

    final Color fill = filled
        ? (night ? colors.raised2 : colors.raised)
        : (night ? colors.raised : colors.sunken);
    final Color edge = hasError
        ? colors.badText
        : current
        ? (night ? colors.sunken : colors.ink)
        : (filled ? (night ? colors.lineStrong : colors.ink3) : colors.line);
    final double edgeWidth = hasError || current || (filled && !night)
        ? 1.5
        : 1.0;

    // While the code is being checked the boxes keep their filled look at 0.7 opacity: still
    // readable, plainly busy, not switched off.
    return Opacity(
      opacity: dimmed ? 0.7 : 1,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (current && !hasError && night)
            // Night only: a soft volt glow under the box (it is covered by the box itself, so it
            // shows only around the ring).
            Positioned.fill(
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  shape: RoundedSuperellipseBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  shadows: [
                    BoxShadow(
                      color: colors.voltGlow,
                      blurRadius: 18,
                      spreadRadius: 1,
                    ),
                  ],
                ),
              ),
            ),
          DecoratedBox(
            decoration: ShapeDecoration(
              color: fill,
              shape: RoundedSuperellipseBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: edge, width: edgeWidth),
              ),
              shadows: filled && !night ? colors.cardShadow : null,
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
                          child: Transform.scale(
                            scale: 0.9 + 0.1 * t,
                            child: child,
                          ),
                        ),
                        child: Text(
                          digit!,
                          style: type.figureCompact.copyWith(
                            fontSize: 30,
                            height: 1,
                            color: colors.ink,
                          ),
                        ),
                      )
                    : (current
                          ? Container(
                              width: 2,
                              height: 26,
                              decoration: BoxDecoration(
                                color: colors.accentText,
                                borderRadius: MmRadius.pillAll,
                              ),
                            )
                          : null),
              ),
            ),
          ),
          if (current && !hasError)
            // The volt ring sits just outside the box, so nothing in the row moves.
            Positioned(
              left: -3.5,
              right: -3.5,
              top: -3.5,
              bottom: -3.5,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    shape: RoundedSuperellipseBorder(
                      borderRadius: BorderRadius.circular(17.5),
                      side: BorderSide(color: colors.volt, width: 2.5),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
