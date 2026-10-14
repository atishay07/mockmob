import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// Phones at least this tall (in dp, status bars included) have air to spare, so the sign-in
/// screens reserve the room a message needs before it exists. On a shorter phone the room is
/// asked for only when the message comes, because the page already scrolls there.
const double kRoomyScreenHeight = 820;

bool roomyScreen(BuildContext context) =>
    MediaQuery.sizeOf(context).height >= kRoomyScreenHeight;

/// The swap every message uses: a fade and an 8 dp rise, as one transform and one opacity.
Widget fadeRise(Widget child, Animation<double> animation) => FadeTransition(
  opacity: animation,
  child: AnimatedBuilder(
    animation: animation,
    builder: (context, child) => Transform.translate(
      offset: Offset(0, 8 * (1 - animation.value)),
      child: child,
    ),
    child: child,
  ),
);

/// The line or two under a field where a message lives: what is wrong, a calm note, or the quiet
/// help that sits there at rest. Its height is reserved (two lines of small text on a roomy
/// phone, one on a short one), so a message arriving or leaving never moves the field above it
/// or the key below it. A longer message than the reservation grows it, once, because the
/// student's own tap caused it.
///
/// The message swaps with a 200 ms cross-fade and an 8 dp rise (instant under reduced motion).
/// Give each distinct message its own [messageKey] so the swap is seen.
class ProblemSlot extends StatelessWidget {
  const ProblemSlot({
    super.key,
    required this.child,
    this.messageKey,
    this.alignment = Alignment.topLeft,
    this.lines,
  });

  /// What is shown now: a problem line, a note, or the resting help.
  final Widget child;

  /// Identity of the message; a change plays the swap.
  final Object? messageKey;
  final AlignmentGeometry alignment;

  /// Lines of height to reserve; 0 reserves nothing (the slot is as tall as its message).
  /// Defaults to two on a roomy phone and one otherwise.
  final int? lines;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final reserved = lines ?? (roomyScreen(context) ? 2 : 1);
    final reduced = Motion.reduced(context);
    return Stack(
      alignment: alignment,
      children: [
        // The reservation: invisible lines in the same style, so large text scales it too.
        ExcludeSemantics(
          child: Visibility(
            visible: false,
            maintainSize: true,
            maintainAnimation: true,
            maintainState: true,
            child: Text(
              List.filled(reserved, 'A').join('\n'),
              style: type.small,
            ),
          ),
        ),
        AnimatedSwitcher(
          duration: reduced ? Duration.zero : Motion.ui,
          switchInCurve: Motion.out,
          switchOutCurve: Motion.out,
          layoutBuilder: (current, previous) => Stack(
            alignment: alignment,
            children: [...previous, ?current],
          ),
          transitionBuilder: fadeRise,
          child: KeyedSubtree(
            key: ValueKey<Object?>(messageKey),
            child: SizedBox(width: double.infinity, child: child),
          ),
        ),
      ],
    );
  }
}

/// Runs [builder] with `true` once [active] has stayed true for [after] (12 seconds by default):
/// the moment an indeterminate wait should say so in words. It resets when [active] goes false.
class StillWorking extends StatefulWidget {
  const StillWorking({
    super.key,
    required this.active,
    required this.builder,
    this.after = const Duration(seconds: 12),
  });

  final bool active;
  final Duration after;

  /// Gets true once the wait has run long.
  final Widget Function(BuildContext context, bool longWait) builder;

  @override
  State<StillWorking> createState() => _StillWorkingState();
}

class _StillWorkingState extends State<StillWorking> {
  Timer? _timer;
  bool _long = false;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(StillWorking old) {
    super.didUpdateWidget(old);
    if (old.active != widget.active || old.after != widget.after) _sync();
  }

  void _sync() {
    _timer?.cancel();
    _timer = null;
    if (!widget.active) {
      _long = false;
      return;
    }
    _long = false;
    _timer = Timer(widget.after, () {
      if (mounted) setState(() => _long = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      widget.builder(context, widget.active && _long);
}
