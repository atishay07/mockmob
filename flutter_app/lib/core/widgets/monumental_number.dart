import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'count_up.dart' show MmNumberMemory, mmNumberInk;

/// A monumental number (brief sections 4 and 7): condensed Bricolage with its unit beside it at
/// 55% of the number's size, top-aligned on the cap height ("183 of 250"). When it first appears
/// each digit rolls up into its own fixed-width slot over 500 ms, left to right, the last digit
/// landing last. When the value changes each slot rolls on from the digit it showed (171 to 183
/// moves three slots a little, never from 000). Under reduced motion it shows the final value.
/// After landing it never moves.
///
/// [delay] holds the roll until its card has arrived; [onLanded] fires once the last digit
/// lands (a `selectionClick` there makes the number feel set in place).
///
/// With a [memoryKey] it remembers ([MmNumberMemory]): mounting again with the value it last
/// showed draws it at once, with no roll; mounting with a new value rolls on from the remembered
/// one. A remembered change that rises inks the digits volt while they roll and for
/// [Motion.numberInk] after they land; a fall dims them; then they settle back to their colour
/// (a cross-fade of a tinted copy, opacity only).
class MonumentalNumber extends StatefulWidget {
  const MonumentalNumber({
    super.key,
    required this.value,
    this.unit,
    this.style,
    this.color,
    this.unitColor,
    this.roll = true,
    this.fromZeroOnFirstBuild = true,
    this.semanticsLabel,
    this.delay = Duration.zero,
    this.onLanded,
    this.memoryKey,
    this.reserve = const [],
  });

  /// Values this figure will pass through (a score adding up on a mark sheet): the number's box is as wide as the widest
  /// of them and the number sits at its right, so the unit beside it never moves while the value changes. Empty: the
  /// box is as wide as the value.
  final List<String> reserve;

  /// The number as it should read ("183", "23", "4.5"). Non-digits are drawn as they are.
  final String value;

  /// "of 250", "weeks", "%". Drawn at 55% of the number, top-aligned.
  final String? unit;

  /// Defaults to `mmType.hero` (112 sp condensed).
  final TextStyle? style;
  final Color? color;

  /// Defaults to ink 2.
  final Color? unitColor;

  /// False shows the final value without rolling, on first build and on every change.
  final bool roll;

  /// True (the default) rolls every slot up from 0 when the number first appears. False shows the
  /// first value as it is and rolls only on changes, from the value shown: for a number that was
  /// already on screen before a rebuild (a list row scrolled back into view, a tab revisited).
  final bool fromZeroOnFirstBuild;
  final String? semanticsLabel;

  /// Waits this long before rolling (the first roll and every change).
  final Duration delay;

  /// Called when a roll has landed (not when the value is shown without rolling).
  final VoidCallback? onLanded;

  /// Remembers the value across remounts ([MmNumberMemory]); null forgets, as before.
  final String? memoryKey;

  /// Bricolage metrics (units per em 1000): cap height 660 (the digits are cap height).
  static const double _cap = 0.66;

  /// Air above and below the ink, as a share of the font size. The box of a figure is its ink plus
  /// this, not the font's ascent and descent plus the line height: the 124 sp "4" on Today was
  /// 82 dp of ink in a 104 dp box, which made the visible gaps 25 and 29 dp against coded 8 and 12
  /// (SPACING.md 3.3, audit G8). About 3 dp at 124 sp, enough for the round digits' overshoot.
  static const double _air = 0.025;

  @override
  State<MonumentalNumber> createState() => _MonumentalNumberState();
}

class _MonumentalNumberState extends State<MonumentalNumber> with TickerProviderStateMixin {
  late final AnimationController _roll = AnimationController(vsync: this, duration: _total)..addStatusListener(_status);

  /// The tinted copy's strength while a remembered change shows which way it moved.
  late final AnimationController _ink = AnimationController(vsync: this)..addStatusListener(_inkStatus);

  /// 1 up, -1 down, 0 no tint.
  int _inkDirection = 0;
  bool _started = false;

  /// The digits shown before the current roll, right-aligned to the new ones (null: from 0).
  String? _previous;

  Duration get _total => widget.delay + Motion.numberRoll;

  void _status(AnimationStatus status) {
    if (status == AnimationStatus.completed && _rolling) {
      _rolling = false;
      _fadeInk();
      widget.onLanded?.call();
    }
  }

  void _inkStatus(AnimationStatus status) {
    if (status == AnimationStatus.dismissed && _inkDirection != 0 && mounted) setState(() => _inkDirection = 0);
  }

  bool get _still => !widget.roll || Motion.reduced(context);

  /// Puts the tint on for a remembered change from [from].
  void _inkFrom(String? from) {
    final direction = widget.memoryKey == null || _still ? 0 : MmNumberMemory.direction(from, widget.value);
    _inkDirection = direction;
    if (direction == 0) {
      _ink.value = 0;
      return;
    }
    _ink.animateTo(1, duration: Motion.press, curve: Motion.glide);
  }

  /// Holds the tint for [Motion.numberInk] after the digits land, then eases it off.
  void _fadeInk() {
    if (_ink.value == 0) return;
    final hold = Motion.numberInk;
    final total = hold + Motion.crossFade;
    _ink.animateBack(
      0,
      duration: total,
      curve: Interval(hold.inMicroseconds / total.inMicroseconds, 1, curve: Motion.glide),
    );
  }

  bool _rolling = false;

  void _start() {
    _roll.duration = _total;
    if (_still) {
      _rolling = false;
      _roll.value = 1;
      _ink.value = 0;
      return;
    }
    _rolling = true;
    _roll.forward(from: 0);
  }

  /// The first value: from memory, from 0, or as it is.
  void _mount() {
    final key = widget.memoryKey;
    final remembered = key == null ? null : MmNumberMemory.recall(key);
    if (key != null) MmNumberMemory.remember(key, widget.value);
    if (remembered is String) {
      if (remembered == widget.value) {
        // Seen before, unchanged: it is simply there.
        _previous = null;
        _roll.value = 1;
        return;
      }
      _previous = remembered;
      _inkFrom(remembered);
      _start();
      return;
    }
    _previous = null;
    if (!widget.fromZeroOnFirstBuild) {
      _roll.value = 1;
      return;
    }
    _start();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _mount();
  }

  @override
  void didUpdateWidget(MonumentalNumber oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.memoryKey != widget.memoryKey && widget.memoryKey != null) {
      // A different figure in the same place: it starts from its own memory.
      _mount();
      return;
    }
    if (oldWidget.value == widget.value) return;
    _previous = oldWidget.value;
    final key = widget.memoryKey;
    if (key != null) MmNumberMemory.remember(key, widget.value);
    _inkFrom(oldWidget.value);
    _start();
  }

  @override
  void dispose() {
    _roll.dispose();
    _ink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final base = widget.style ?? context.mmType.hero;
    final size = MediaQuery.textScalerOf(context).scale(base.fontSize ?? 112);
    final style = base.copyWith(
      fontSize: size,
      color: widget.color ?? base.color ?? colors.ink,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    final slot = _CapMetrics.of('0', style);

    final chars = widget.value.characters.toList();
    final digits = chars.where(_isDigit).length;
    // The previous value's digits, right-aligned to these: a slot rolls on from what it showed.
    final before = (_previous ?? '').characters.where(_isDigit).map(int.parse).toList();
    int? fromFor(int i) {
      if (_previous == null) return null;
      final j = before.length - (digits - i);
      return j >= 0 ? before[j] : null;
    }

    Widget row(TextStyle style) {
      var index = 0;
      return Row(
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
              _CapText(ch, style: style),
        ],
      );
    }

    Widget number = row(style);
    if (widget.reserve.isNotEmpty) {
      // Each digit is one slot wide; anything else (the minus sign) is its own width.
      double widthOf(String v) => v.characters.fold(0.0, (w, ch) => w + (_isDigit(ch) ? slot.width : _CapMetrics.of(ch, style).width));
      final reserved = [widget.value, ...widget.reserve].map(widthOf).reduce((a, b) => a > b ? a : b);
      number = SizedBox(width: reserved, child: Align(alignment: Alignment.topRight, child: number));
    }
    if (widget.memoryKey != null) {
      // A remembered number keeps one structure, so its digits never remount: the tinted copy
      // rolls in step on top and fades out once the change has been seen.
      final tint = mmNumberInk(context, _inkDirection);
      number = Stack(
        children: [
          number,
          if (tint != null)
            Positioned.fill(
              child: IgnorePointer(
                child: FadeTransition(opacity: _ink, child: row(style.copyWith(color: tint))),
              ),
            ),
        ],
      );
    }

    final unit = widget.unit;
    Widget content = number;
    if (unit != null) {
      final unitSize = size * 0.55;
      final unitStyle = style.copyWith(
        fontSize: unitSize,
        letterSpacing: unitSize * -0.005,
        color: widget.unitColor ?? colors.ink2,
      );
      // Both boxes start `_air` above their cap tops, so the cap tops line up when the smaller
      // box is pushed down by the difference of the two air bands.
      content = Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          number,
          SizedBox(width: size * 0.07),
          Padding(
            padding: EdgeInsets.only(top: MonumentalNumber._air * (size - unitSize)),
            child: _CapText(unit, style: unitStyle),
          ),
        ],
      );
    }

    return Semantics(
      label: widget.semanticsLabel ?? (unit == null ? widget.value : '${widget.value} $unit'),
      excludeSemantics: true,
      // At large text sizes "183 of 250" is wider than a phone: shrink to the width given
      // instead of clipping, so no caller needs its own FittedBox.
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: RepaintBoundary(child: content),
      ),
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
  const _DigitSlot({
    required this.digit,
    required this.from,
    required this.slot,
    required this.style,
    required this.roll,
    required this.interval,
  });

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
            child: _CapText('$c', style: style, width: slot.width),
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

/// Measures a figure's cap box: width of [text], and the height of its cap-tall ink band plus the
/// air above and below it, with where the baseline lands inside that box.
class _CapMetrics {
  const _CapMetrics(this.size, this.top, this.textHeight);

  /// The box: ink plus air.
  final Size size;

  /// Where the text's own line box starts, relative to the cap box (negative: it starts above).
  final double top;

  /// The text's own line-box height.
  final double textHeight;

  static Size of(String text, TextStyle style, {double? width}) => _measure(text, style, width: width).size;

  static _CapMetrics _measure(String text, TextStyle style, {double? width}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    final fontSize = style.fontSize ?? 112;
    final air = MonumentalNumber._air * fontSize;
    final cap = MonumentalNumber._cap * fontSize;
    final baseline = painter.computeDistanceToActualBaseline(TextBaseline.alphabetic);
    final metrics = _CapMetrics(Size(width ?? painter.width, cap + 2 * air), air + cap - baseline, painter.height);
    painter.dispose();
    return metrics;
  }
}

/// One figure character laid out in its cap box: the box is the ink plus a little air, and the
/// text's own taller line box overflows it without taking layout space.
class _CapText extends StatelessWidget {
  const _CapText(this.text, {required this.style, this.width});

  final String text;
  final TextStyle style;

  /// A fixed width (a digit slot); null measures the text.
  final double? width;

  @override
  Widget build(BuildContext context) {
    final m = _CapMetrics._measure(text, style, width: width);
    return SizedBox.fromSize(
      size: m.size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            right: width == null ? null : 0,
            top: m.top,
            height: m.textHeight,
            child: Text(
              text,
              style: style,
              textAlign: width == null ? TextAlign.start : TextAlign.center,
              softWrap: false,
              textScaler: TextScaler.noScaling,
            ),
          ),
        ],
      ),
    );
  }
}
