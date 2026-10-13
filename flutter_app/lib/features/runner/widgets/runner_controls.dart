import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Small solid controls of the work layer. They answer a press with a fill change only: the
/// runner keeps everything still while the student thinks.
class _SolidKey extends StatefulWidget {
  const _SolidKey({required this.builder, required this.onTap, required this.semanticsLabel, this.toggled});

  final Widget Function(BuildContext context, bool pressed) builder;
  final VoidCallback? onTap;
  final String semanticsLabel;
  final bool? toggled;

  @override
  State<_SolidKey> createState() => _SolidKeyState();
}

class _SolidKeyState extends State<_SolidKey> {
  bool _pressed = false;
  bool _focused = false;

  void _set(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget body = widget.builder(context, _pressed);
    if (_focused) {
      body = DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          borderRadius: MmRadius.pillAll,
          border: Border.all(color: colors.focusRing, width: 2),
        ),
        child: body,
      );
    }
    return Semantics(
      container: true,
      button: true,
      toggled: widget.toggled,
      label: widget.semanticsLabel,
      excludeSemantics: true,
      onTap: widget.onTap,
      child: FocusableActionDetector(
        enabled: widget.onTap != null,
        onShowFocusHighlight: (v) => setState(() => _focused = v),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              widget.onTap?.call();
              return null;
            },
          ),
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => _set(true),
          onTapUp: (_) => _set(false),
          onTapCancel: () => _set(false),
          onTap: widget.onTap,
          child: body,
        ),
      ),
    );
  }
}

/// A 44 dp round key with a 20 dp outline icon (leave, back).
class RoundIconKey extends StatelessWidget {
  const RoundIconKey({super.key, required this.icon, required this.semanticsLabel, required this.onTap});

  final IconData icon;
  final String semanticsLabel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return _SolidKey(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      builder: (context, pressed) => SizedBox.square(
        dimension: 44,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? colors.raised2 : colors.raised,
            shape: CircleBorder(side: BorderSide(color: colors.line)),
          ),
          child: Icon(icon, size: 20, color: colors.ink2),
        ),
      ),
    );
  }
}

/// The Questions key: a pill with a small 2 by 2 answer-sheet glyph, the brand mark's own
/// geometry, so it reads as "your sheet".
class SheetKey extends StatelessWidget {
  const SheetKey({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return _SolidKey(
      onTap: onTap,
      semanticsLabel: RunnerCopy.questionsKey,
      builder: (context, pressed) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.raised,
          shape: StadiumBorder(side: BorderSide(color: colors.line)),
        ),
        child: SizedBox(
          height: 44,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s12, 0, MmSpace.s16, 0),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _SheetGlyph(),
                const SizedBox(width: MmSpace.s8),
                Text(RunnerCopy.questionsKey, style: type.labelLarge.copyWith(color: colors.ink)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SheetGlyph extends StatelessWidget {
  const _SheetGlyph();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return CustomPaint(size: const Size.square(18), painter: _SheetGlyphPainter(colors));
  }
}

class _SheetGlyphPainter extends CustomPainter {
  const _SheetGlyphPainter(this.colors);

  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final bubbles = BubblePaint(colors);
    final r = size.width * 0.21;
    final a = size.width * 0.25;
    final b = size.width * 0.75;
    bubbles.paint(canvas, Offset(a, a), r, BubbleState.filled);
    bubbles.paint(canvas, Offset(b, a), r, BubbleState.hollow);
    bubbles.paint(canvas, Offset(a, b), r, BubbleState.hollow);
    bubbles.paint(canvas, Offset(b, b), r, BubbleState.hollow);
  }

  @override
  bool shouldRepaint(_SheetGlyphPainter old) => old.colors != colors;
}

/// "Mark for review" as a toggle in words: a flag outline at rest, an inked ring with the flag
/// and "Marked for review" when on, so the state never rests on colour.
class MarkToggle extends StatelessWidget {
  const MarkToggle({super.key, required this.marked, required this.onChanged});

  final bool marked;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return _SolidKey(
      onTap: onChanged == null ? null : () => onChanged!(!marked),
      semanticsLabel: RunnerCopy.mark,
      toggled: marked,
      builder: (context, pressed) => SizedBox(
        height: 48,
        child: Align(
          alignment: Alignment.centerRight,
          widthFactor: 1,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: marked ? colors.raised2 : (pressed ? colors.raised2 : colors.ground),
              shape: StadiumBorder(
                side: BorderSide(color: marked ? colors.ink2 : colors.line, width: marked ? 1.5 : 1),
              ),
            ),
            child: SizedBox(
              height: 36,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s12, 0, MmSpace.s12 + 2, 0),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.flag, size: 15, color: marked ? colors.ink : colors.ink3),
                    const SizedBox(width: MmSpace.s6),
                    Text(
                      marked ? RunnerCopy.marked : RunnerCopy.mark,
                      style: type.label.copyWith(color: marked ? colors.ink : colors.ink2),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
