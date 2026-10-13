import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// One answer option (spec 5.5, brief section 12): a solid 56 dp row whose lettered bubble inks
/// from the point the finger touched when chosen, like filling the bubble on the sheet. No
/// correctness, ever, while answering. The row itself never moves: a press only darkens the
/// fill, and the selection shows on the first frame after the journal write.
class AnswerOption extends StatefulWidget {
  const AnswerOption({super.key, required this.letter, required this.text, required this.selected, required this.onSelect});

  final String letter;
  final String text;
  final bool selected;

  /// Null when answering is closed (time up, submitting).
  final VoidCallback? onSelect;

  @override
  State<AnswerOption> createState() => _AnswerOptionState();
}

class _AnswerOptionState extends State<AnswerOption> {
  static const double _minBubble = 30;

  /// The letter is 13.5 sp and grows with the system text size; the bubble grows with it.
  static const double _letterSize = 13.5;

  final GlobalKey _bubbleKey = GlobalKey();
  bool _pressed = false;
  bool _focused = false;
  Offset _inkOrigin = Offset.zero;
  Offset _downAt = Offset.zero;

  void _down(PointerDownEvent e) {
    if (widget.onSelect == null) return;
    _downAt = e.position;
    setState(() => _pressed = true);
    // Where the finger landed relative to the bubble, in its -1 to 1 space, so the ink spreads
    // from that side.
    final box = _bubbleKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final local = box.globalToLocal(e.position);
    final half = box.size.width / 2;
    _inkOrigin = Offset(((local.dx - half) / half).clamp(-1.0, 1.0), ((local.dy - half) / half).clamp(-1.0, 1.0));
  }

  void _up() {
    if (_pressed) setState(() => _pressed = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = widget.onSelect != null;
    final selected = widget.selected;
    final letterHeight = MediaQuery.textScalerOf(context).scale(_letterSize);
    final bubbleSize = letterHeight + 10 > _minBubble ? letterHeight + 10 : _minBubble;

    final fill = selected || _pressed ? colors.raised2 : colors.raised;
    final border = selected ? colors.ink : colors.line;

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

    Widget row = DecoratedBox(
      decoration: ShapeDecoration(
        color: fill,
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.keyAll,
          side: BorderSide(color: _focused ? colors.focusRing : border, width: selected || _focused ? 1.5 : 1),
        ),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.option),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s16, MmSpace.s12),
          child: Row(
            children: [
              bubble,
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Text(
                  widget.text,
                  style: type.body.copyWith(color: enabled ? colors.ink : colors.ink3, fontWeight: selected ? FontWeight.w600 : FontWeight.w500),
                ),
              ),
            ],
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
      onTap: widget.onSelect,
      excludeSemantics: true,
      child: FocusableActionDetector(
        enabled: enabled,
        onShowFocusHighlight: (v) => setState(() => _focused = v),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              widget.onSelect?.call();
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
            onTap: widget.onSelect,
            child: RepaintBoundary(child: row),
          ),
        ),
      ),
    );
  }
}
