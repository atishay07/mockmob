import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Small solid controls of the work layer. They answer a press on the next frame: the fill
/// changes and the key sinks on the app's one press spring ([MmPressSpring]), then rises on
/// release. Nothing around them moves: the press is a transform of the key alone.
class _SolidKey extends StatefulWidget {
  const _SolidKey({required this.builder, required this.onTap, required this.semanticsLabel, this.toggled, this.pressedScale = Springs.pressedScale});

  final Widget Function(BuildContext context, bool pressed) builder;
  final VoidCallback? onTap;
  final String semanticsLabel;
  final bool? toggled;

  /// How far the key sinks. A wide key sinks less, so it never drops more than a few dp.
  final double pressedScale;

  @override
  State<_SolidKey> createState() => _SolidKeyState();
}

class _SolidKeyState extends State<_SolidKey> with SingleTickerProviderStateMixin {
  late final MmPressSpring _spring = MmPressSpring(this);
  bool _pressed = false;
  bool _focused = false;

  void _set(bool v) {
    if (_pressed == v) return;
    setState(() => _pressed = v);
    _spring.to(v ? widget.pressedScale : 1, reduced: Motion.reduced(context));
  }

  @override
  void dispose() {
    _spring.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget body = AnimatedBuilder(
      animation: _spring.scale,
      child: widget.builder(context, _pressed),
      builder: (context, child) => Transform.scale(scale: _spring.scale.value, child: child),
    );
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
          // The face stays 44 dp; the touch target is 48.
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: MmTarget.min),
            child: Center(widthFactor: 1, heightFactor: 1, child: body),
          ),
        ),
      ),
    );
  }
}

/// The flag of the mark toggle. When the question becomes marked it pops from 0.8 to full size
/// (180 ms, emphasized); unmarking, and every rebuild, is still.
class _FlagGlyph extends StatefulWidget {
  const _FlagGlyph({required this.marked, required this.color});

  final bool marked;
  final Color color;

  @override
  State<_FlagGlyph> createState() => _FlagGlyphState();
}

class _FlagGlyphState extends State<_FlagGlyph> with SingleTickerProviderStateMixin {
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 180), value: 1);

  @override
  void didUpdateWidget(_FlagGlyph old) {
    super.didUpdateWidget(old);
    if (widget.marked && !old.marked && !Motion.reduced(context)) _pop.forward(from: 0);
  }

  @override
  void dispose() {
    _pop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pop,
      child: Icon(LucideIcons.flag, size: 15, color: widget.color),
      builder: (context, child) => Transform.scale(scale: 0.8 + 0.2 * Motion.emphasized.transform(_pop.value), child: child),
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
/// geometry, so it reads as "your sheet". At large text ([compact]) it keeps the glyph alone in
/// a 44 dp round key (the label stays as its screen-reader name), so the top bar's count and
/// clock keep their size.
class SheetKey extends StatelessWidget {
  const SheetKey({super.key, required this.onTap, this.compact = false});

  final VoidCallback onTap;
  final bool compact;

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
          shape: compact ? CircleBorder(side: BorderSide(color: colors.line)) : StadiumBorder(side: BorderSide(color: colors.line)),
        ),
        child: compact
            ? const SizedBox.square(dimension: 44, child: Center(child: _SheetGlyph()))
            : SizedBox(
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
      pressedScale: 0.97,
      builder: (context, pressed) => SizedBox(
        height: 48,
        child: Align(
          alignment: Alignment.centerRight,
          widthFactor: 1,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              // Selected is the strongest thing in both themes: a selected surface (Night lighter than
              // the page, Day white, never Day's darker raised2) with a 2 dp ink ring.
              color: marked ? colors.selectedSurface : (pressed ? colors.raised2 : colors.ground),
              shape: StadiumBorder(
                side: BorderSide(color: marked ? colors.ink : colors.line, width: marked ? 2 : 1),
              ),
            ),
            child: SizedBox(
              height: 36,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _FlagGlyph(marked: marked, color: marked ? colors.ink : colors.ink3),
                    const SizedBox(width: MmSpace.s8),
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
