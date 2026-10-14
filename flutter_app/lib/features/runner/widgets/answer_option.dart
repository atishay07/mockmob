import 'dart:math' as math;

import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'runner_motion.dart';

/// One answer option (spec 5.5, brief section 12, runner.md 3.3): a solid 60 dp row whose lettered
/// bubble inks from the point the finger touched when chosen, like filling the bubble on the
/// sheet. The row answers a press by sinking to 0.985 and darkening (transform only: nothing
/// reflows), and on selection the ink bleeds out of the bubble across the row as a flat volt wash
/// at 9%, the border goes ink, and the text takes weight. No correctness, ever, while answering.
class AnswerOption extends StatefulWidget {
  const AnswerOption({
    super.key,
    required this.letter,
    required this.text,
    required this.selected,
    required this.onSelect,
    this.quiet = false,
    this.onLock,
  });

  final String letter;
  final String text;
  final bool selected;

  /// Null when answering is closed (time up, submitting).
  final VoidCallback? onSelect;

  /// Another option is chosen: this one steps back to the second ink so the chosen row is the
  /// only one at full strength.
  final bool quiet;

  /// Called with the global centre of the bubble just before a not-yet-chosen option is chosen,
  /// so the layout can fly the lock-in dot from it.
  final ValueChanged<Offset>? onLock;

  @override
  State<AnswerOption> createState() => _AnswerOptionState();
}

class _AnswerOptionState extends State<AnswerOption> with TickerProviderStateMixin {
  static const double _minBubble = 32;

  /// The letter is 14 sp and grows with the system text size; the bubble grows with it.
  static const double _letterSize = 14;

  /// How far the row sinks under a finger.
  static const double _pressedScale = 0.985;

  late final MmPressSpring _press = MmPressSpring(this);
  late final AnimationController _wash = AnimationController(
    vsync: this,
    duration: RunnerMotion.wash,
    reverseDuration: RunnerMotion.washOut,
    value: widget.selected ? 1 : 0,
  );

  final GlobalKey _bubbleKey = GlobalKey();
  bool _pressed = false;
  bool _focused = false;
  Offset _inkOrigin = Offset.zero;
  Offset _downAt = Offset.zero;

  @override
  void didUpdateWidget(AnswerOption old) {
    super.didUpdateWidget(old);
    if (widget.selected == old.selected) return;
    if (RunnerMotion.reduced(context)) {
      _wash.value = widget.selected ? 1 : 0;
    } else if (widget.selected) {
      _wash.forward();
    } else {
      _wash.reverse();
    }
  }

  @override
  void dispose() {
    _press.dispose();
    _wash.dispose();
    super.dispose();
  }

  void _down(PointerDownEvent e) {
    if (widget.onSelect == null) return;
    _downAt = e.position;
    setState(() => _pressed = true);
    _press.to(_pressedScale, reduced: RunnerMotion.reduced(context));
    // Where the finger landed relative to the bubble, in its -1 to 1 space, so the ink spreads
    // from that side.
    final box = _bubbleKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final local = box.globalToLocal(e.position);
    final half = box.size.width / 2;
    _inkOrigin = Offset(((local.dx - half) / half).clamp(-1.0, 1.0), ((local.dy - half) / half).clamp(-1.0, 1.0));
  }

  void _up() {
    if (!_pressed) return;
    setState(() => _pressed = false);
    _press.to(1, reduced: RunnerMotion.reduced(context));
  }

  void _tap() {
    final select = widget.onSelect;
    if (select == null) return;
    final onLock = widget.onLock;
    if (onLock != null && !widget.selected) {
      final box = _bubbleKey.currentContext?.findRenderObject() as RenderBox?;
      if (box != null && box.hasSize) onLock(box.localToGlobal(box.size.center(Offset.zero)));
    }
    select();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = widget.onSelect != null;
    final selected = widget.selected;
    final letterHeight = MediaQuery.textScalerOf(context).scale(_letterSize);
    final bubbleSize = letterHeight + 12 > _minBubble ? letterHeight + 12 : _minBubble;

    final fill = selected || _pressed ? colors.raised2 : colors.raised;
    final border = selected ? colors.ink : colors.line;
    final textColor = !enabled ? colors.ink3 : (widget.quiet && !selected ? colors.ink2 : colors.ink);

    final bubble = SizedBox.square(
      key: _bubbleKey,
      dimension: bubbleSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: bubbleSize, inkOrigin: _inkOrigin),
          Text(
            widget.letter,
            style: type.label.copyWith(
              fontSize: _letterSize,
              height: 1,
              color: selected ? colors.voltInk : (enabled ? colors.ink2 : colors.ink3),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );

    final ringColor = _focused ? colors.focusRing : border;
    final ringWidth = selected || _focused ? 1.5 : 1.0;
    final shape = RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll);
    // Fill and wash are clipped to the row; the border is drawn over them so the ink never
    // covers its inner half.
    final Widget row = DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: ShapeDecoration(
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: ringColor, width: ringWidth)),
      ),
      child: ClipPath(
        clipper: ShapeBorderClipper(shape: shape),
        child: DecoratedBox(
          decoration: ShapeDecoration(color: fill, shape: shape),
          child: CustomPaint(
            painter: _WashPainter(
              progress: _wash,
              color: colors.isNight ? colors.volt.withValues(alpha: 0.09) : colors.volt.withValues(alpha: 0.26),
              bubbleCenter: const Offset(MmSpace.s12, 0) + Offset(bubbleSize / 2, 0),
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 60),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s16, MmSpace.s12),
                child: Row(
                  children: [
                    bubble,
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Text(
                        widget.text,
                        style: type.body.copyWith(color: textColor, fontWeight: selected ? FontWeight.w600 : FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );

    return Semantics(
      container: true,
      inMutuallyExclusiveGroup: true,
      selected: selected,
      enabled: enabled,
      label: RunnerCopy.optionSemantics(widget.letter, widget.text),
      onTap: widget.onSelect == null ? null : _tap,
      excludeSemantics: true,
      child: FocusableActionDetector(
        enabled: enabled,
        onShowFocusHighlight: (v) => setState(() => _focused = v),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              _tap();
              return null;
            },
          ),
        },
        child: Listener(
          onPointerDown: _down,
          onPointerMove: (e) {
            // A scroll that starts on an option lets its fill come back up.
            if (_pressed && (e.position - _downAt).distance > kTouchSlop) _up();
          },
          onPointerUp: (_) => _up(),
          onPointerCancel: (_) => _up(),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onSelect == null ? null : _tap,
            child: AnimatedBuilder(
              animation: _press.scale,
              child: RepaintBoundary(child: row),
              builder: (context, child) => Transform.scale(scale: _press.scale.value, child: child),
            ),
          ),
        ),
      ),
    );
  }
}

/// The ink bleeding out of the chosen option's bubble: one flat circle growing from the bubble's
/// centre until it covers the row. No gradient; it is the same ink as the bubble at low strength.
class _WashPainter extends CustomPainter {
  _WashPainter({required this.progress, required this.color, required this.bubbleCenter}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  /// The bubble's centre from the row's left edge; the row's vertical middle is used for y.
  final Offset bubbleCenter;

  @override
  void paint(Canvas canvas, Size size) {
    final t = Motion.emphasized.transform(progress.value.clamp(0.0, 1.0));
    if (t <= 0) return;
    final centre = Offset(bubbleCenter.dx, size.height / 2);
    // Far corner of the row from the bubble.
    final reach = math.sqrt(math.pow(size.width - centre.dx, 2) + math.pow(math.max(centre.dy, size.height - centre.dy), 2));
    canvas.drawCircle(centre, reach * t, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_WashPainter old) => old.color != color || old.bubbleCenter != bubbleCenter;
}
