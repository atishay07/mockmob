import 'package:flutter/material.dart';

import '../motion/motion.dart';

/// An inline figure that counts up to [value] ("36 right", "4 min 12 s"): from [from] on its
/// first appearance (default 0), and from the value it showed whenever [value] changes. Tabular
/// figures, so the width never jitters; Emphasized, 720 ms. TalkBack hears the final value only.
/// Under reduced motion, or with [animate] false, it shows the final value.
///
/// For the big numbers use `MonumentalNumber`, which rolls digits in slots.
class MmCountUp extends StatefulWidget {
  const MmCountUp({
    super.key,
    required this.value,
    this.from = 0,
    this.format,
    this.style,
    this.duration = Motion.countUp,
    this.delay = Duration.zero,
    this.animate = true,
    this.roll = true,
    this.fromZeroOnFirstBuild = true,
    this.onLanded,
    this.semanticsLabel,
    this.textAlign,
  });

  final num value;

  /// Where the first count starts.
  final num from;

  /// Turns the running number into text. Defaults to a whole number, or one decimal place when
  /// [value] has a fraction.
  final String Function(num value)? format;
  final TextStyle? style;
  final Duration duration;
  final Duration delay;
  final bool animate;

  /// False shows each value as it is, never counting (the same as [animate] false; kept to match
  /// `MonumentalNumber.roll`).
  final bool roll;

  /// True (the default) counts from [from] when the figure first appears. False shows the first
  /// value as it is and counts only on changes, from the value shown.
  final bool fromZeroOnFirstBuild;

  /// Called once a count has landed (not when the value is shown at once).
  final VoidCallback? onLanded;
  final String? semanticsLabel;
  final TextAlign? textAlign;

  @override
  State<MmCountUp> createState() => _MmCountUpState();
}

class _MmCountUpState extends State<MmCountUp> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this)..addStatusListener(_status);
  late num _start = widget.from;
  late num _target = widget.value;
  bool _counting = false;
  bool _begun = false;

  void _status(AnimationStatus status) {
    if (status == AnimationStatus.completed && _counting) {
      _counting = false;
      widget.onLanded?.call();
    }
  }

  void _run() {
    if (!widget.animate || !widget.roll || Motion.reduced(context) || _start == _target) {
      _counting = false;
      _t.value = 1;
      return;
    }
    _t.duration = widget.delay + widget.duration;
    _counting = true;
    _t.forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_begun) return;
    _begun = true;
    if (!widget.fromZeroOnFirstBuild) _start = _target;
    _run();
  }

  @override
  void didUpdateWidget(MmCountUp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value == widget.value) return;
    _start = _t.value >= 1 ? _target : _current;
    _target = widget.value;
    _run();
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  num get _current {
    final total = _t.duration ?? widget.duration;
    final lead = total.inMicroseconds == 0 ? 0.0 : widget.delay.inMicroseconds / total.inMicroseconds;
    final raw = _t.value <= lead ? 0.0 : (_t.value - lead) / (1 - lead);
    final e = Motion.emphasized.transform(raw.clamp(0.0, 1.0));
    final v = _start + (_target - _start) * e;
    return _target is int ? v.round() : v;
  }

  String _format(num v) {
    final f = widget.format;
    if (f != null) return f(v);
    if (widget.value is int || widget.value == widget.value.roundToDouble()) return v.round().toString();
    return v.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.style ?? DefaultTextStyle.of(context).style;
    final style = base.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
    return Semantics(
      label: widget.semanticsLabel ?? _format(widget.value),
      excludeSemantics: true,
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, _) => Text(_format(_t.value >= 1 ? _target : _current), style: style, textAlign: widget.textAlign),
      ),
    );
  }
}
