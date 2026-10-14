import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';

/// A monumental number (brief sections 4 and 7): condensed Bricolage with its unit beside it at
/// 55% of the number's size, top-aligned on the cap height ("183 of 250"). When it first appears
/// each digit rolls up into its own fixed-width slot over 500 ms, left to right, the last digit
/// landing last. When the value changes each slot rolls on from the digit it showed (171 to 183
/// moves three slots a little, never from 000). Under reduced motion it shows the final value.
/// After landing it never moves.
///
/// [delay] holds the roll until its card has arrived; [onLanded] fires once the last digit
/// lands (a `selectionClick` there makes the number feel set in place).
class MonumentalNumber extends StatefulWidget {
  const MonumentalNumber({
    super.key,
    required this.value,
    this.unit,
    this.style,
    this.color,
    this.unitColor,
    this.roll = true,
    this.semanticsLabel,
    this.delay = Duration.zero,
    this.onLanded,
  });

  /// The number as it should read ("183", "23", "4.5"). Non-digits are drawn as they are.
  final String value;

  /// "of 250", "weeks", "%". Drawn at 55% of the number, top-aligned.
  final String? unit;

  /// Defaults to `mmType.hero` (112 sp condensed).
  final TextStyle? style;
  final Color? color;

  /// Defaults to ink 2.
  final Color? unitColor;

  /// False shows the final value without rolling.
  final bool roll;
  final String? semanticsLabel;

  /// Waits this long before rolling (the first roll and every change).
  final Duration delay;

  /// Called when a roll has landed (not when the value is shown without rolling).
  final VoidCallback? onLanded;

  /// Bricolage metrics (units per em 1000): ascender 930, descender 270, cap height 660.
  static const double _ascent = 0.93;
  static const double _descent = 0.27;
  static const double _cap = 0.66;

  @override
  State<MonumentalNumber> createState() => _MonumentalNumberState();
}

class _MonumentalNumberState extends State<MonumentalNumber> with SingleTickerProviderStateMixin {
  late final AnimationController _roll = AnimationController(vsync: this, duration: _total)..addStatusListener(_status);
  bool _started = false;

  /// The digits shown before the current roll, right-aligned to the new ones (null: from 0).
  String? _previous;

  Duration get _total => widget.delay + Motion.numberRoll;

  void _status(AnimationStatus status) {
    if (status == AnimationStatus.completed && _rolling) {
      _rolling = false;
      widget.onLanded?.call();
    }
  }

  bool _rolling = false;

  void _start() {
    _roll.duration = _total;
    if (!widget.roll || Motion.reduced(context)) {
      _rolling = false;
      _roll.value = 1;
      return;
    }
    _rolling = true;
    _roll.forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _start();
  }

  @override
  void didUpdateWidget(MonumentalNumber oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value == widget.value) return;
    _previous = oldWidget.value;
    _start();
  }

  @override
  void dispose() {
    _roll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final base = widget.style ?? context.mmType.hero;
    final size = MediaQuery.textScalerOf(context).scale(base.fontSize ?? 112);
    final ratio = base.height ?? 1;
    final style = base.copyWith(
      fontSize: size,
      color: widget.color ?? base.color ?? colors.ink,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    final probe = TextPainter(
      text: TextSpan(text: '0', style: style),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    final slot = Size(probe.width, probe.height);
    probe.dispose();

    final chars = widget.value.characters.toList();
    final digits = chars.where(_isDigit).length;
    // The previous value's digits, right-aligned to these: a slot rolls on from what it showed.
    final before = (_previous ?? '').characters.where(_isDigit).map(int.parse).toList();
    int? fromFor(int i) {
      if (_previous == null) return null;
      final j = before.length - (digits - i);
      return j >= 0 ? before[j] : null;
    }

    var index = 0;
    final number = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final ch in chars)
          if (_isDigit(ch))
            _DigitSlot(
              digit: int.parse(ch),
              from: fromFor(index),
              slot: slot,
              style: style,
              roll: _roll,
              interval: _interval(index++, digits),
            )
          else
            Text(ch, style: style, textScaler: TextScaler.noScaling),
      ],
    );

    final unit = widget.unit;
    Widget content = number;
    if (unit != null) {
      final unitSize = size * 0.55;
      // Both lines share the same height ratio, so the cap tops differ by k * (size - unitSize).
      final k = ratio / 2 - (MonumentalNumber._ascent + MonumentalNumber._descent) / 2 + MonumentalNumber._ascent - MonumentalNumber._cap;
      content = Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          number,
          SizedBox(width: size * 0.07),
          Padding(
            padding: EdgeInsets.only(top: k * (size - unitSize)),
            child: Text(
              unit,
              textScaler: TextScaler.noScaling,
              style: style.copyWith(
                fontSize: unitSize,
                letterSpacing: unitSize * -0.005,
                color: widget.unitColor ?? colors.ink2,
              ),
            ),
          ),
        ],
      );
    }

    return Semantics(
      label: widget.semanticsLabel ?? (unit == null ? widget.value : '${widget.value} $unit'),
      excludeSemantics: true,
      // At large text sizes "183 of 250" is wider than a phone: shrink to the width given
      // instead of clipping, so no caller needs its own FittedBox.
      child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: RepaintBoundary(child: content)),
    );
  }

  /// Digit [i] of [n] starts 40 ms after the previous one; all land by 500 ms after [delay].
  Interval _interval(int i, int n) {
    final total = _total.inMicroseconds.toDouble();
    final lead = widget.delay.inMicroseconds / total;
    final share = 1 - lead;
    final start = n <= 1 ? 0.0 : (i * 0.08).clamp(0.0, 0.4);
    return Interval((lead + start * share).clamp(0.0, 1.0), 1, curve: Motion.emphasized);
  }

  static bool _isDigit(String ch) => ch.length == 1 && ch.codeUnitAt(0) >= 48 && ch.codeUnitAt(0) <= 57;
}

/// One fixed-width slot that rolls a column of digits up to [digit]: from [from] when the value
/// changed (wrapping through 9 to 0), else from 0 (0 itself arrives from 9 below, so every slot
/// moves on the first roll). An unchanged digit stays still.
class _DigitSlot extends StatelessWidget {
  const _DigitSlot({required this.digit, required this.from, required this.slot, required this.style, required this.roll, required this.interval});

  final int digit;
  final int? from;
  final Size slot;
  final TextStyle style;
  final AnimationController roll;
  final Interval interval;

  List<int> get _cells {
    final start = from;
    if (start == null) return digit == 0 ? const [9, 0] : [for (var i = 0; i <= digit; i++) i];
    if (start == digit) return [digit];
    final steps = (digit - start) % 10;
    return [for (var i = 0; i <= steps; i++) (start + i) % 10];
  }

  @override
  Widget build(BuildContext context) {
    final cells = _cells;
    final travel = slot.height * (cells.length - 1);
    final column = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final c in cells)
          SizedBox.fromSize(
            size: slot,
            child: Text('$c', style: style, textAlign: TextAlign.center, textScaler: TextScaler.noScaling),
          ),
      ],
    );
    return SizedBox.fromSize(
      size: slot,
      child: ClipRect(
        child: OverflowBox(
          alignment: Alignment.topCenter,
          minHeight: 0,
          maxHeight: double.infinity,
          child: AnimatedBuilder(
            animation: roll,
            builder: (context, child) {
              final t = roll.value >= 1 ? 1.0 : interval.transform(roll.value);
              return Transform.translate(offset: Offset(0, -travel * t), child: child);
            },
            child: column,
          ),
        ),
      ),
    );
  }
}
