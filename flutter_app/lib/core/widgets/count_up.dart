import 'dart:collection';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';

/// What each keyed number last showed, for this run of the app (memory only, never stored).
///
/// A number given a `memoryKey` (`MmCountUp`, `MonumentalNumber`) reads it when it mounts: the same
/// value is shown at once, with no roll, so a tab revisited or a list scrolled back never re-counts;
/// a different value rolls from the remembered one, because the truth moved. Keys are plain strings
/// that name the figure and whose it is ("today.score", "chapters.accountancy.right").
abstract final class MmNumberMemory {
  /// The most keys kept; the oldest go first.
  static const int capacity = 256;

  static final LinkedHashMap<String, Object> _values = LinkedHashMap<String, Object>();

  /// The value [key] last showed, or null.
  static Object? recall(String key) => _values[key];

  /// Records that [key] now shows [value].
  static void remember(String key, Object value) {
    _values.remove(key);
    _values[key] = value;
    while (_values.length > capacity) {
      _values.remove(_values.keys.first);
    }
  }

  /// Forgets every number (sign-out, tests).
  static void clear() => _values.clear();

  /// Which way a remembered number moved from [from] to [to]: 1 up, -1 down, 0 unknown or level.
  static int direction(Object? from, Object? to) {
    final a = _numeric(from);
    final b = _numeric(to);
    if (a == null || b == null || a == b) return 0;
    return b > a ? 1 : -1;
  }

  static num? _numeric(Object? v) {
    if (v is num) return v;
    if (v is String) return num.tryParse(v.replaceAll(RegExp(r'[^0-9.\-]'), ''));
    return null;
  }
}

/// The tint a remembered number wears while its truth moves: volt as text ([MmColors.accentText])
/// on a rise, dimmed ([MmColors.ink3], still 4.5:1) on a fall; null when it did not move.
Color? mmNumberInk(BuildContext context, int direction) => switch (direction) {
      > 0 => context.mmColors.accentText,
      < 0 => context.mmColors.ink3,
      _ => null,
    };

/// An inline figure that counts up to [value] ("36 right", "4 min 12 s"): from [from] on its
/// first appearance (default 0), and from the value it showed whenever [value] changes. Tabular
/// figures, so the width never jitters; Emphasized, 720 ms. TalkBack hears the final value only.
/// Under reduced motion, or with [animate] false, it shows the final value.
///
/// With a [memoryKey] it remembers ([MmNumberMemory]): mounting again with the value it last
/// showed draws that value at once, and mounting with a new one counts from the remembered value.
/// A remembered change that rises wears volt while it counts and for [Motion.numberInk] after it
/// lands; a fall wears the dim ink; then it settles back to its own colour.
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
    this.memoryKey,
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

  /// Remembers the value across remounts ([MmNumberMemory]); null forgets, as before.
  final String? memoryKey;

  @override
  State<MmCountUp> createState() => _MmCountUpState();
}

class _MmCountUpState extends State<MmCountUp> with TickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this)..addStatusListener(_status);

  /// 1 while a remembered change wears its tint, easing to 0 after it lands.
  late final AnimationController _ink = AnimationController(vsync: this);
  late num _start = widget.from;
  late num _target = widget.value;
  bool _counting = false;
  bool _begun = false;

  /// 1 up, -1 down, 0 no tint.
  int _inkDirection = 0;

  void _status(AnimationStatus status) {
    if (status == AnimationStatus.completed && _counting) {
      _counting = false;
      _fadeInk();
      widget.onLanded?.call();
    }
  }

  bool get _still => !widget.animate || !widget.roll || Motion.reduced(context);

  void _run() {
    if (_still || _start == _target) {
      _counting = false;
      _t.value = 1;
      _ink.value = 0;
      return;
    }
    _t.duration = widget.delay + widget.duration;
    _counting = true;
    _t.forward(from: 0);
  }

  /// Puts on the tint for a remembered change from [from] to the target.
  void _inkFor(Object? from) {
    _inkDirection = widget.memoryKey == null ? 0 : MmNumberMemory.direction(from, _target);
    if (_inkDirection == 0 || _still) {
      _ink.value = 0;
      return;
    }
    _ink.animateTo(1, duration: Motion.press, curve: Motion.glide);
  }

  /// Holds the tint for [Motion.numberInk] after landing, then eases it off.
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

  /// The first value: remembered, from [MmCountUp.from], or as it is.
  void _mount() {
    final key = widget.memoryKey;
    final remembered = key == null ? null : MmNumberMemory.recall(key);
    if (remembered is num) {
      _start = remembered;
      _inkFor(remembered);
    } else if (!widget.fromZeroOnFirstBuild) {
      _start = _target;
    }
    if (key != null) MmNumberMemory.remember(key, _target);
    _run();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_begun) return;
    _begun = true;
    _mount();
  }

  @override
  void didUpdateWidget(MmCountUp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.memoryKey != widget.memoryKey && widget.memoryKey != null) {
      // A different figure in the same place: it starts from its own memory.
      _target = widget.value;
      _start = widget.from;
      _mount();
      return;
    }
    if (oldWidget.value == widget.value) return;
    final shown = _t.value >= 1 ? _target : _current;
    _start = shown;
    _target = widget.value;
    final key = widget.memoryKey;
    if (key != null) MmNumberMemory.remember(key, _target);
    _inkFor(shown);
    _run();
  }

  @override
  void dispose() {
    _t.dispose();
    _ink.dispose();
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
    final tint = mmNumberInk(context, _inkDirection);
    return Semantics(
      label: widget.semanticsLabel ?? _format(widget.value),
      excludeSemantics: true,
      child: AnimatedBuilder(
        animation: Listenable.merge([_t, _ink]),
        builder: (context, _) {
          final own = style.color ?? DefaultTextStyle.of(context).style.color;
          final inked = tint == null || own == null || _ink.value == 0
              ? style
              : style.copyWith(color: Color.lerp(own, tint, _ink.value));
          return Text(_format(_t.value >= 1 ? _target : _current), style: inked, textAlign: widget.textAlign);
        },
      ),
    );
  }
}
