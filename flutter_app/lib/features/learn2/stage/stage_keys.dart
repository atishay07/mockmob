/// The stage's keys (the web's `RailKey`, `StepKey`, `SkipKey`, `.st-textkey`, `.st-iconkey`; A1 3.6, BUILD-1101 B7):
///
///   StageSideKey   a 48 dp round glyph with a 12 sp label under it (Revise later or Save on the left of the action bar,
///                  Chapter on the right); on = the glyph takes the select colour (a bookmark fills); it swells to 1.15
///                  when it turns on; busy = a spinner in the glyph
///   StageCardStack the card-stack glyph of Revise later (three cards, the front one whole), the web's `CardStack`
///   StageStepKey   the one volt key of the screen (Turn over, Next, See how it went, Keep going), 52 dp, radius 14,
///                  sitting on a 3 dp volt lip it sinks into when pressed; `tone: line` is the quiet line key
///   StageSkipKey   "Skip", a line key in ink-2
///   StageTextKey   an underlined text key (Turn back, See Pro, Back to it)
///   StageIconKey   a 44 dp round-cornered icon key (a sheet's close) with a 48 dp target
///   StageCloseKey  the X and the word "Close": the one close control of the bar, the ends and the refusal
///
/// Exactly one volt key is on screen at a time: the screen passes `tone: StageTone.line` to every other key.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/hit_slop.dart';
import '../../../core/widgets/key_button.dart' show KeyButton;
import '../../../core/widgets/materials/shape.dart';
import '../../../core/widgets/mm_spinner.dart';
import 'stage_balance.dart';
import 'stage_motion.dart';

/// The two looks of a stage key.
enum StageTone { volt, line }

/// The select colour of the stage (the web's `--a-select`): volt on Night, the darker volt that keeps 3:1 on
/// Day's paper. It marks the current tick, the kept glyph and the key option.
Color stageSelect(MmColors colors) => colors.isNight ? colors.volt : colors.accentText;

/// Lucide's bookmark (`m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z`), filled or outlined, so the kept
/// count, the stamp line and the Keep key share one glyph (the icon font cannot fill).
class StageBookmark extends StatelessWidget {
  const StageBookmark({super.key, this.size = 14, required this.color, this.filled = true, this.stroke = 2});

  final double size;
  final Color color;
  final bool filled;

  /// The stroke width in the glyph's 24-unit box.
  final double stroke;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _BookmarkPainter(color: color, filled: filled, stroke: stroke)),
    );
  }
}

class _BookmarkPainter extends CustomPainter {
  const _BookmarkPainter({required this.color, required this.filled, required this.stroke});

  final Color color;
  final bool filled;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.shortestSide / 24;
    canvas.scale(k);
    final path = Path()
      ..moveTo(19, 21)
      ..lineTo(12, 17)
      ..lineTo(5, 21)
      ..lineTo(5, 5)
      ..arcToPoint(const Offset(7, 3), radius: const Radius.circular(2))
      ..lineTo(17, 3)
      ..arcToPoint(const Offset(19, 5), radius: const Radius.circular(2))
      ..close();
    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    if (filled) canvas.drawPath(path, Paint()..color = color);
    canvas.drawPath(path, line);
  }

  @override
  bool shouldRepaint(_BookmarkPainter old) => old.color != color || old.filled != filled || old.stroke != stroke;
}

/// The card-stack glyph of Revise later and of the Revise pile (the web's `CardStack`): three cards, the front one whole
/// (`rect 4.5 8 15 x 13 rx 2.4`, `M6.5 5h11`, `M8.5 2.2h7` in a 24-unit box), stroked in [color]. Questions keep the bookmark
/// of Save; a Key card goes to Revise, so it gets its own mark.
class StageCardStack extends StatelessWidget {
  const StageCardStack({super.key, this.size = 22, required this.color, this.stroke = 1.9});

  final double size;
  final Color color;

  /// The stroke width in the glyph's 24-unit box.
  final double stroke;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: CustomPaint(painter: _CardStackPainter(color: color, stroke: stroke)),
  );
}

class _CardStackPainter extends CustomPainter {
  const _CardStackPainter({required this.color, required this.stroke});

  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.shortestSide / 24;
    canvas.scale(k);
    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    canvas
      ..drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(4.5, 8, 15, 13), const Radius.circular(2.4)), line)
      ..drawLine(const Offset(6.5, 5), const Offset(17.5, 5), line)
      ..drawLine(const Offset(8.5, 2.2), const Offset(15.5, 2.2), line);
  }

  @override
  bool shouldRepaint(_CardStackPainter old) => old.color != color || old.stroke != stroke;
}

/// A focus ring drawn [gap] dp outside its child in the [radius] shape.
class _FocusRing extends StatelessWidget {
  const _FocusRing({required this.show, required this.radius, required this.child, this.gap = 2});

  final bool show;
  final BorderRadius radius;
  final double gap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!show) return child;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        Positioned(
          left: -gap - 2,
          right: -gap - 2,
          top: -gap - 2,
          bottom: -gap - 2,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: radius + BorderRadius.circular(gap + 2),
                border: Border.all(color: context.mmColors.focusRing, width: 2),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The press of a stage key: down the moment a finger lands, back on release or when the finger slides away,
/// over [duration] on `Motion.out` (none under reduced motion). Taps and Enter or Space commit.
class _StagePress extends StatefulWidget {
  const _StagePress({
    required this.onTap,
    required this.builder,
    this.tapLock = Duration.zero,
    this.haptic = false,
  });

  final VoidCallback? onTap;
  final Widget Function(BuildContext context, double depth, bool focused) builder;
  final Duration tapLock;

  /// The app's commit haptic (`settle`, lightImpact) on a tap.
  final bool haptic;

  @override
  State<_StagePress> createState() => _StagePressState();
}

class _StagePressState extends State<_StagePress> with SingleTickerProviderStateMixin {
  late final AnimationController _depth = AnimationController(vsync: this, duration: const Duration(milliseconds: 100));
  bool _focused = false;
  Offset _downAt = Offset.zero;
  Timer? _lock;

  bool get _live => widget.onTap != null;

  void _to(double v) {
    if (Motion.reduced(context)) {
      _depth.value = v;
    } else {
      _depth.animateTo(v, curve: Motion.out);
    }
  }

  void _commit() {
    final tap = widget.onTap;
    if (tap == null) return;
    if (_lock?.isActive ?? false) return;
    if (widget.tapLock > Duration.zero) _lock = Timer(widget.tapLock, () {});
    if (widget.haptic) hapticsOf(context)?.settle();
    tap();
  }

  @override
  void didUpdateWidget(_StagePress old) {
    super.didUpdateWidget(old);
    if (!_live && _depth.value != 0) _depth.value = 0;
  }

  @override
  void dispose() {
    _lock?.cancel();
    _depth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FocusableActionDetector(
      enabled: _live,
      mouseCursor: _live ? SystemMouseCursors.click : MouseCursor.defer,
      onShowFocusHighlight: (v) => setState(() => _focused = v),
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
          _commit();
          return null;
        }),
      },
      child: Listener(
        onPointerDown: (e) {
          _downAt = e.position;
          if (_live) _to(1);
        },
        onPointerMove: (e) {
          if ((e.position - _downAt).distance > 18) _to(0);
        },
        onPointerUp: (_) => _to(0),
        onPointerCancel: (_) => _to(0),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _live ? _commit : null,
          child: AnimatedBuilder(animation: _depth, builder: (context, _) => widget.builder(context, _depth.value, _focused)),
        ),
      ),
    );
  }
}

/// The action bar's side key (the web's `RailKey`): a 48 dp round glyph on the raised surface with a 1 dp line, a
/// 22 dp icon, and a 12 sp label 4 dp under it. [on]: the icon fills in the select colour and the label turns ink
/// (Kept, Saved, In Revise); [pop]: it swells to 1.15 in 180 ms when it turns true; [busy]: a spinner in the glyph
/// and taps wait; [disabled]: taps do nothing. The glyph sinks to 0.94 under a finger (100 ms). No haptic of its
/// own: a Keep confirms after the server's answer.
class StageSideKey extends StatelessWidget {
  const StageSideKey({
    super.key,
    this.icon,
    this.mark,
    required this.label,
    this.on = false,
    this.busy = false,
    this.pop = false,
    this.disabled = false,
    this.onTap,
    this.semanticsLabel,
    this.glyphKey,
  });

  /// A Lucide icon; [LucideIcons.bookmark] is drawn by [StageBookmark] so it can fill.
  final IconData? icon;

  /// A glyph of its own in the colour the key wants (the card stack): used in place of [icon].
  final Widget Function(Color color)? mark;
  final String label;
  final bool on;
  final bool busy;
  final bool pop;
  final bool disabled;
  final VoidCallback? onTap;
  final String? semanticsLabel;

  /// On the glyph, for a flight that starts or lands there.
  final Key? glyphKey;

  static const double glyph = 48;
  static const double slot = 56;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final live = onTap != null && !busy && !disabled;
    final iconColor = on ? stageSelect(colors) : colors.ink;
    final glyphMark = busy
        ? MmSpinner(color: colors.ink2, size: 20, strokeWidth: 2)
        : mark != null
            ? mark!(iconColor)
            : icon == LucideIcons.bookmark
                ? StageBookmark(size: 22, color: iconColor, filled: on, stroke: 1.9)
                : Icon(icon, size: 22, color: iconColor);
    return Semantics(
      container: true,
      button: true,
      enabled: live,
      label: semanticsLabel ?? label,
      excludeSemantics: true,
      onTap: live ? onTap : null,
      child: SizedBox(
        width: slot,
        child: _StagePress(
          onTap: live ? onTap : null,
          builder: (context, depth, focused) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _FocusRing(
                show: focused,
                radius: BorderRadius.circular(glyph / 2),
                child: StagePop(
                  on: pop,
                  child: Transform.scale(
                    scale: 1 - 0.06 * depth,
                    child: Container(
                      key: glyphKey,
                      width: glyph,
                      height: glyph,
                      alignment: Alignment.center,
                      decoration: ShapeDecoration(
                        color: colors.raised,
                        shape: CircleBorder(side: BorderSide(color: colors.line)),
                      ),
                      child: glyphMark,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: MmSpace.s4),
              // The label may run past the 56 dp slot into the bar's gaps (large text), never onto the step key.
              SizedBox(
                width: slot,
                height: MediaQuery.textScalerOf(context).scale(12) * 1.2,
                child: OverflowBox(
                  maxWidth: slot + 2 * MmSpace.s12,
                  child: Text(
                    label,
                    maxLines: 1,
                    softWrap: false,
                    textAlign: TextAlign.center,
                    style: type.navLabel.copyWith(fontSize: 12, height: 1.2, color: on ? colors.ink : colors.ink2),
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

/// The step key (the web's `StepKey`): the screen's one volt key, or a line key with [tone] line. 52 dp tall,
/// radius 14, Hanken 16 semibold, as wide as its slot. The volt face sits 1 dp up on a 3 dp lip in the darker volt
/// and sinks into it under a finger, as the web's key does; the line key sinks to 0.98. [later]: it fades in 160 ms
/// after 260 ms (a Next that appears after an answer). A label that changes cross-fades in 120 ms. Like
/// `KeyButton` it ignores a second commit for 300 ms and gives the commit haptic ([haptic]; Turn over passes false,
/// the card's turn gives its own).
class StageStepKey extends StatelessWidget {
  const StageStepKey({
    super.key,
    required this.label,
    required this.onTap,
    this.tone = StageTone.volt,
    this.later = false,
    this.haptic = true,
    this.semanticsLabel,
    this.quiet = false,
    this.minHeight = 52,
    this.sub,
    this.subLines = 1,
    this.subSize = 13,
    this.padX = 18,
  });

  final String label;

  /// A second line inside the key (13 medium, the key's ink at 70%): the end's next chapter name, or a rating key's "back tomorrow".
  final String? sub;

  /// The second line wraps on its words up to this many lines (a rating key's "back in this run, then tomorrow" takes two).
  final int subLines;
  final double subSize;

  /// The key's own side padding (a rating key is a third of the width, so it keeps 8).
  final double padX;

  /// Null disables the key (opacity 0.55, no lip).
  final VoidCallback? onTap;
  final StageTone tone;
  final bool later;
  final bool haptic;
  final String? semanticsLabel;

  /// Ink-2 words on a line key (Skip).
  final bool quiet;
  final double minHeight;

  static const double radius = 14;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final disabled = onTap == null;
    final volt = tone == StageTone.volt;
    final r = BorderRadius.circular(radius);
    final style = type.button.copyWith(
      fontSize: 16,
      height: 1.25,
      fontWeight: FontWeight.w600,
      color: volt ? colors.voltInk : (quiet ? colors.ink2 : colors.ink),
    );
    // A long key ("Next chapter: Retirement and Death of a Partner") wraps in even lines, as the web's balance does.
    final words = MmOverlapSwitcher.fade(
      duration: const Duration(milliseconds: 120),
      alignment: Alignment.center,
      child: StageBalancedText(TextSpan(text: label, style: style), key: ValueKey<String>(label), textAlign: TextAlign.center),
    );
    final key = Semantics(
      container: true,
      button: true,
      enabled: !disabled,
      label: semanticsLabel ?? label,
      excludeSemantics: true,
      onTap: onTap,
      child: Opacity(
        opacity: disabled ? 0.55 : 1,
        child: _StagePress(
          onTap: onTap,
          haptic: haptic,
          tapLock: KeyButton.defaultTapLock,
          builder: (context, depth, focused) {
            final Widget face;
            if (volt) {
              final lip = disabled ? 0.0 : 3 * (1 - depth);
              face = Transform.translate(
                offset: Offset(0, disabled ? 0 : -1 + 3 * depth),
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    color: colors.volt,
                    shape: mmShapeBorder(r, side: BorderSide(color: Color.lerp(colors.volt, colors.voltEdge, 0.6)!)),
                    shadows: [if (lip > 0) BoxShadow(color: colors.voltEdge, offset: Offset(0, lip))],
                  ),
                  child: _body(words),
                ),
              );
            } else {
              face = Transform.scale(
                scale: 1 - 0.02 * depth,
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    color: colors.raised,
                    shape: mmShapeBorder(r, side: BorderSide(color: colors.lineStrong)),
                  ),
                  child: _body(words),
                ),
              );
            }
            return _FocusRing(show: focused, radius: r, gap: 3, child: face);
          },
        ),
      ),
    );
    if (!later) return key;
    return StageIn(delay: const Duration(milliseconds: 260), duration: const Duration(milliseconds: 160), child: key);
  }

  Widget _body(Widget words) => Builder(
    builder: (context) {
      final colors = context.mmColors;
      final second = sub;
      return ConstrainedBox(
        constraints: BoxConstraints(minHeight: minHeight, minWidth: double.infinity),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: padX, vertical: MmSpace.s8),
          child: Center(
            child: second == null
                ? words
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      words,
                      const SizedBox(height: 2),
                      Text(
                        second,
                        maxLines: subLines,
                        softWrap: subLines > 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: context.mmType.body.copyWith(
                          fontSize: subSize,
                          height: 1.3,
                          fontWeight: FontWeight.w500,
                          color: tone == StageTone.volt ? colors.voltInk.withValues(alpha: 0.7) : colors.ink2,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      );
    },
  );
}

/// "Skip" (the web's `SkipKey`): a line key with ink-2 words, until the question is answered. A skip is never a
/// mistake. [disabled] while an answer is on its way.
class StageSkipKey extends StatelessWidget {
  const StageSkipKey({super.key, required this.onTap, this.disabled = false, this.label = 'Skip'});

  final VoidCallback? onTap;
  final bool disabled;
  final String label;

  @override
  Widget build(BuildContext context) =>
      StageStepKey(label: label, onTap: disabled ? null : onTap, tone: StageTone.line, quiet: true, haptic: false);
}

/// An underlined text key (the web's `.st-textkey`): 14.5 semibold ink by default (Turn back is 13.5 in ink-2),
/// underlined in the strong line colour, a 48 dp target.
class StageTextKey extends StatelessWidget {
  const StageTextKey({
    super.key,
    required this.label,
    required this.onTap,
    this.size = 14.5,
    this.quiet = false,
    this.semanticsLabel,
    this.underlined = true,
    this.minHeight = 44,
  });

  final String label;
  final VoidCallback? onTap;
  final double size;

  /// Ink-2 words.
  final bool quiet;
  final String? semanticsLabel;

  /// False: no underline (the stop sheet's "Back to it").
  final bool underlined;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 44,
      child: Semantics(
        container: true,
        button: true,
        enabled: onTap != null,
        label: semanticsLabel ?? label,
        excludeSemantics: true,
        onTap: onTap,
        child: _StagePress(
          onTap: onTap,
          builder: (context, depth, focused) => _FocusRing(
            show: focused,
            radius: BorderRadius.circular(6),
            child: ConstrainedBox(
              // At least 48 dp wide too: a short word ("Skip") is still a thumb's target.
              constraints: BoxConstraints(minWidth: 48, minHeight: minHeight),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s6),
                child: Center(
                  widthFactor: 1,
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: type.labelLarge.copyWith(
                      fontSize: size,
                      height: 1.2,
                      color: (quiet ? colors.ink2 : colors.ink).withValues(alpha: 1 - 0.25 * depth),
                      decoration: underlined ? TextDecoration.underline : TextDecoration.none,
                      decorationColor: colors.lineStrong,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A round-cornered icon key (the web's `.st-iconkey`): [icon] at [size] in ink-2 inside a 44 dp square, a press
/// veil, a 48 dp target. Close in the top bar and in a sheet's head.
class StageIconKey extends StatelessWidget {
  const StageIconKey({super.key, required this.icon, required this.semanticsLabel, required this.onTap, this.size = 22});

  final IconData icon;
  final String semanticsLabel;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmHitSlop(
      slop: const EdgeInsets.all(2),
      child: Semantics(
        container: true,
        button: true,
        enabled: onTap != null,
        label: semanticsLabel,
        excludeSemantics: true,
        onTap: onTap,
        child: _StagePress(
          onTap: onTap,
          builder: (context, depth, focused) => _FocusRing(
            show: focused,
            radius: BorderRadius.circular(12),
            gap: 0,
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colors.ink.withValues(alpha: (colors.isNight ? 0.08 : 0.06) * depth),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: size, color: colors.ink2),
            ),
          ),
        ),
      ),
    );
  }
}

/// The one close control (R4 first-timer#17; the web's `.st-closekey` and `.st-iconkey--word`): an X and the word "Close", 15
/// semibold ink-2, 44 dp tall, on the feed, the run, the ends and the refusal. [inBar] is the top bar's: a 22 dp X, 6 dp from
/// the word, 10 dp in on the left and 12 on the right; the end's has a 20 dp X, 8 dp from the word and 14 on the right.
class StageCloseKey extends StatelessWidget {
  const StageCloseKey({super.key, required this.onTap, this.label = 'Close', this.semanticsLabel, this.inBar = false});

  final VoidCallback? onTap;
  final String label;
  final String? semanticsLabel;
  final bool inBar;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 44,
      child: Semantics(
        container: true,
        button: true,
        enabled: onTap != null,
        label: semanticsLabel ?? label,
        excludeSemantics: true,
        onTap: onTap,
        child: _StagePress(
          onTap: onTap,
          builder: (context, depth, focused) => _FocusRing(
            show: focused,
            radius: BorderRadius.circular(12),
            gap: 0,
            child: Container(
              height: 44,
              padding: EdgeInsets.fromLTRB(10, 0, inBar ? 12 : 14, 0),
              decoration: BoxDecoration(
                color: colors.ink.withValues(alpha: (colors.isNight ? 0.08 : 0.06) * depth),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.x, size: inBar ? 22 : 20, color: colors.ink2),
                  SizedBox(width: inBar ? MmSpace.s6 : MmSpace.s8),
                  Text(label, style: type.labelLarge.copyWith(fontSize: 15, height: 1, color: colors.ink2)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Options below" (the web's `BelowChip`, M10): a quiet 36 dp chip, ink-2 words and a chevron, over the foot of a long
/// question while its first option waits below the fold. A tap brings option A up.
class StageBelowChip extends StatelessWidget {
  const StageBelowChip({super.key, required this.onTap, this.label = 'Options below'});

  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 36,
      child: Semantics(
        container: true,
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: _StagePress(
          onTap: onTap,
          builder: (context, depth, focused) => _FocusRing(
            show: focused,
            radius: BorderRadius.circular(18),
            child: Transform.scale(
              scale: 1 - 0.03 * depth,
              child: Container(
                height: 36,
                padding: const EdgeInsets.fromLTRB(16, 0, 12, 0),
                decoration: BoxDecoration(
                  color: colors.raised,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: colors.lineStrong),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(label, maxLines: 1, softWrap: false, style: type.label.copyWith(fontSize: 13.5, height: 1, color: colors.ink2)),
                    const SizedBox(width: MmSpace.s6),
                    Icon(LucideIcons.chevronDown, size: 16, color: colors.ink2),
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
