import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// The order a step builds in (MOTION.md 4.2): the headline lifts, the support line follows at
/// 120 ms, the answers at 180 ms, 45 ms apart, the key at 300 ms. Only Welcome and the plan
/// headline rise word by word ([RiseHeadline]); a step's question just lifts. One controller per
/// step drives all of it, so a step costs one ticker for at most 800 ms.
abstract final class Entrance {
  /// The whole entrance, long enough for the last answer to land (MOTION.md 1.1: 800 ms or less).
  static const Duration total = Duration(milliseconds: 800);

  /// Headline words: rise 0.45 em, turned 6 degrees, with a small overshoot.
  static const Cubic rise = Cubic(0.3, 1.35, 0.46, 1);
  static const Duration riseDuration = Duration(milliseconds: 520);
  static const Duration riseStart = Duration(milliseconds: 40);
  static const Duration wordStagger = Duration(milliseconds: 30);

  /// The headline, support, answers and the key: 14 dp up and 0.97 to 1 on the glide curve.
  static const Duration liftDuration = Duration(milliseconds: 340);
  static const Duration headline = Duration.zero;
  static const Duration support = Duration(milliseconds: 120);
  static const Duration key = Duration(milliseconds: 300);

  /// When answer [i] lifts: from 180 ms, 45 ms apart, capped so a long list never waits and the
  /// last one lands inside [total].
  static Duration answer(int i) => Duration(milliseconds: 180 + 45 * math.min(i, 6));
}

/// Runs a step's entrance once, when it first appears. Under reduced motion (and in goldens) it
/// starts finished. Children read it through [StepEntrance.of].
class StepEntrance extends StatefulWidget {
  const StepEntrance({super.key, required this.child, this.delay = Duration.zero});

  final Widget child;

  /// Shifts the whole entrance later (Welcome waits for Mobi's wave to start).
  final Duration delay;

  /// The step's entrance clock (0 to 1 over [Entrance.total] plus the delay), or null when there
  /// is none or it has finished: callers then draw their end state.
  static EntranceClock? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_EntranceScope>()?.clock;

  @override
  State<StepEntrance> createState() => _StepEntranceState();
}

/// The entrance's progress and its length, so an item can place its own interval on it.
class EntranceClock {
  const EntranceClock(this.animation, this.length);

  final Animation<double> animation;
  final Duration length;

  /// Progress of an item that starts at [at] and runs for [duration], eased by [curve].
  double at(Duration at, Duration duration, Curve curve) {
    final now = animation.value * length.inMicroseconds;
    final t = ((now - at.inMicroseconds) / duration.inMicroseconds).clamp(0.0, 1.0);
    return curve.transform(t);
  }

  bool get done => animation.isCompleted;
}

class _StepEntranceState extends State<StepEntrance> with SingleTickerProviderStateMixin {
  late final Duration _length = Entrance.total + widget.delay;
  late final AnimationController _t = AnimationController(vsync: this, duration: _length);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _t.value = 1;
    } else {
      _t.forward();
    }
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _EntranceScope(clock: EntranceClock(_t, _length), child: widget.child);
}

class _EntranceScope extends InheritedWidget {
  const _EntranceScope({required this.clock, required super.child});

  final EntranceClock clock;

  @override
  bool updateShouldNotify(_EntranceScope old) => old.clock.animation != clock.animation;
}

/// Lifts [child] into place at [at] on the step's entrance: 14 dp up, 0.97 to 1, faded in.
/// Outside a [StepEntrance], or once it has run, it is just [child].
class EntranceItem extends StatelessWidget {
  const EntranceItem({
    super.key,
    required this.at,
    required this.child,
    this.rise = 14,
    this.scale = true,
    this.duration = Entrance.liftDuration,
  });

  /// An answer in a list, lifting after the one before it.
  EntranceItem.answer(int index, {Key? key, required Widget child})
      : this(key: key, at: Entrance.answer(index), child: child);

  final Duration at;
  final Duration duration;
  final double rise;

  /// Grow from 0.97 as it lifts. Off for something another widget measures (an aim target).
  final bool scale;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final clock = StepEntrance.of(context);
    if (clock == null) return child;
    // The same three wrappers on every frame, at rest once landed (an identity transform and
    // full opacity paint straight through), so the child's state is never remounted.
    return AnimatedBuilder(
      animation: clock.animation,
      child: child,
      builder: (context, child) {
        final e = clock.at(at, duration, Motion.glide);
        return Opacity(
          opacity: e,
          child: Transform.translate(
            offset: Offset(0, rise * (1 - e)),
            child: Transform.scale(scale: scale ? 0.97 + 0.03 * e : 1, child: child),
          ),
        );
      },
    );
  }
}

/// A headline whose words rise into place one after another from behind their line (the
/// moment-type reveal), laid out exactly as the plain [Text] it becomes once it has landed. The
/// words are painted from one cached layout, clipped to their line, so it never relayouts per
/// frame and needs no opacity layers.
class RiseHeadline extends StatelessWidget {
  const RiseHeadline(this.text, {super.key, required this.style, this.textScaler, this.at = Entrance.riseStart});

  final String text;
  final TextStyle style;
  final TextScaler? textScaler;
  final Duration at;

  @override
  Widget build(BuildContext context) {
    final clock = StepEntrance.of(context);
    final scaler = textScaler ?? MediaQuery.textScalerOf(context);
    final plain = Text(text, style: style, textScaler: scaler);
    if (clock == null || clock.done) return plain;
    final resolved = DefaultTextStyle.of(context).style.merge(style);
    return Semantics(
      label: text,
      header: true,
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, box) {
          final words = _WordLayout.of(text, resolved, scaler, box.maxWidth, Directionality.of(context));
          return AnimatedBuilder(
            animation: clock.animation,
            builder: (context, _) {
              final last = clock.at(at + Entrance.wordStagger * (words.words.length - 1), Entrance.riseDuration, Curves.linear);
              if (last >= 1) return plain;
              return CustomPaint(
                size: words.size,
                painter: _RisePainter(words: words, clock: clock, at: at),
              );
            },
          );
        },
      ),
    );
  }
}

class _Word {
  _Word(this.painter, this.offset, this.line);

  final TextPainter painter;
  final Offset offset;
  final Rect line;
}

/// The words of a headline placed where a single paragraph puts them. Cached per text, style,
/// scale and width, so a rebuild during the rise does not lay anything out again.
class _WordLayout {
  _WordLayout(this.words, this.size);

  final List<_Word> words;
  final Size size;

  static final Map<Object, _WordLayout> _cache = {};

  static _WordLayout of(String text, TextStyle style, TextScaler scaler, double width, TextDirection dir) {
    final key = Object.hash(text, style, scaler, width, dir);
    final hit = _cache[key];
    if (hit != null) return hit;
    if (_cache.length > 24) _cache.clear();

    final whole = TextPainter(text: TextSpan(text: text, style: style), textDirection: dir, textScaler: scaler)
      ..layout(maxWidth: width.isFinite ? width : double.infinity);
    final lines = whole.computeLineMetrics();
    final words = <_Word>[];
    for (final m in RegExp(r'\S+').allMatches(text)) {
      final boxes = whole.getBoxesForSelection(TextSelection(baseOffset: m.start, extentOffset: m.end));
      if (boxes.isEmpty) continue;
      final b = boxes.first;
      final cy = (b.top + b.bottom) / 2;
      var line = lines.first;
      for (final l in lines) {
        if (cy >= l.baseline - l.ascent - 1 && cy <= l.baseline + l.descent + 1) {
          line = l;
          break;
        }
      }
      final word = TextPainter(text: TextSpan(text: m.group(0), style: style), textDirection: dir, textScaler: scaler)..layout();
      final wordBaseline = word.computeDistanceToActualBaseline(TextBaseline.alphabetic);
      final lineTop = line.baseline - line.ascent;
      words.add(
        _Word(
          word,
          Offset(b.left, line.baseline - wordBaseline),
          Rect.fromLTRB(-4, lineTop - 6, whole.width + 8, line.baseline + line.descent + 2),
        ),
      );
    }
    final layout = _WordLayout(words, whole.size);
    whole.dispose();
    _cache[key] = layout;
    return layout;
  }
}

class _RisePainter extends CustomPainter {
  _RisePainter({required this.words, required this.clock, required this.at});

  final _WordLayout words;
  final EntranceClock clock;
  final Duration at;

  static const double _turn = 6 * math.pi / 180;

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < words.words.length; i++) {
      final w = words.words[i];
      final e = clock.at(at + Entrance.wordStagger * i, Entrance.riseDuration, Entrance.rise);
      if (e <= 0) continue;
      final h = w.painter.height;
      canvas.save();
      canvas.clipRect(w.line);
      // From a full line below, turned about its lower left corner, into place.
      canvas.translate(w.offset.dx, w.offset.dy + h * 0.9 * (1 - e));
      canvas.translate(0, h);
      canvas.rotate(_turn * (1 - e));
      canvas.translate(0, -h);
      w.painter.paint(canvas, Offset.zero);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_RisePainter old) => true;
}
