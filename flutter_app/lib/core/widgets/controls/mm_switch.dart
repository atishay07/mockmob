import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../hit_slop.dart';

/// The one on/off switch: a 52 x 32 track with a 24 dp thumb.
///
/// - Press: the thumb stretches to 28 dp wide toward where it will go (a finger squeezing it).
/// - Toggle: the thumb springs to its end on [Springs.toggle] (240 ms, a slight overshoot), the
///   track fills with volt in Night and the accent text colour in Day, and an ink tick draws itself
///   inside the thumb as it arrives. Android's `TOGGLE_ON` or `TOGGLE_OFF` on each change (a
///   selection click on phones before Android 14).
/// - Drag: the thumb follows a sideways finger and lands on the nearer end (or the flung one).
/// - Keyboard: focusable; Enter and Space toggle; a focus ring around the track.
///
/// 52 x 32 in layout with a 48 dp touch target (the band is [MmHitSlop], not layout). TalkBack hears
/// a switch with its [semanticsLabel] and on or off. Under reduced motion the thumb jumps and the
/// tick is simply there. Painted on its own layer; nothing lays out per frame.
class MmSwitch extends StatefulWidget {
  const MmSwitch({super.key, required this.value, required this.onChanged, this.semanticsLabel, this.autofocus = false});

  final bool value;

  /// Null disables the switch.
  final ValueChanged<bool>? onChanged;
  final String? semanticsLabel;
  final bool autofocus;

  static const Size trackSize = Size(52, 32);
  static const double thumb = 24;
  static const double thumbPressed = 28;
  static const double inset = 4;

  /// The thumb's left edge in the track for [position] (0 off, 1 on, may overshoot) and [press]
  /// (0 to 1): it stretches toward its far end, so a pressed thumb at rest keeps its near edge.
  static Rect thumbRect(double position, double press) {
    final w = thumb + (thumbPressed - thumb) * press.clamp(0.0, 1.0);
    final travel = trackSize.width - 2 * inset - w;
    final left = inset + travel * position;
    return Rect.fromLTWH(left, inset, w, thumb);
  }

  @override
  State<MmSwitch> createState() => _MmSwitchState();
}

class _MmSwitchState extends State<MmSwitch> with TickerProviderStateMixin {
  late final AnimationController _pos = AnimationController.unbounded(vsync: this, value: widget.value ? 1 : 0);
  late final AnimationController _press = AnimationController.unbounded(vsync: this, value: 0);
  bool _focused = false;
  bool _dragging = false;
  double _dragStart = 0;
  double _dragDx = 0;

  bool get _enabled => widget.onChanged != null;

  @override
  void didUpdateWidget(MmSwitch old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value && !_dragging) _settle(widget.value ? 1 : 0);
  }

  @override
  void dispose() {
    _pos.dispose();
    _press.dispose();
    super.dispose();
  }

  void _settle(double target, {double velocity = 0}) {
    if (Motion.reduced(context)) {
      _pos.value = target;
      return;
    }
    _pos.animateWith(Motion.spring(Springs.toggle, _pos.value, target, velocity: velocity));
  }

  void _squeeze(bool down) {
    final target = down ? 1.0 : 0.0;
    if (Motion.reduced(context)) {
      _press.value = target;
      return;
    }
    _press.animateWith(Motion.spring(Springs.snappy, _press.value, target, velocity: _press.velocity));
  }

  void _commit(bool next) {
    if (!_enabled) return;
    if (next != widget.value) {
      hapticsOf(context)?.toggle(next);
      widget.onChanged!(next);
    }
    _settle(next ? 1 : 0);
    // A parent that refuses the change (it does not rebuild with the new value) gets the thumb
    // back where its value is, after the frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_dragging && widget.value != next) _settle(widget.value ? 1 : 0);
    });
  }

  void _toggle() => _commit(!widget.value);

  void _dragBegin(DragStartDetails d) {
    if (!_enabled) return;
    _dragging = true;
    _dragStart = _pos.value;
    _dragDx = 0;
    _pos.stop();
    _squeeze(true);
  }

  void _dragUpdate(DragUpdateDetails d) {
    if (!_dragging) return;
    _dragDx += d.delta.dx;
    final travel = MmSwitch.trackSize.width - 2 * MmSwitch.inset - MmSwitch.thumbPressed;
    _pos.value = (_dragStart + _dragDx / travel).clamp(-0.08, 1.08);
  }

  void _dragEnd(DragEndDetails d) {
    if (!_dragging) return;
    _dragging = false;
    _squeeze(false);
    final v = d.primaryVelocity ?? 0;
    final bool next;
    if (v.abs() > 300) {
      next = v > 0;
    } else if (_dragDx.abs() < kTouchSlop) {
      next = !widget.value;
    } else {
      next = _pos.value >= 0.5;
    }
    _commit(next);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final night = colors.isNight;
    final painter = _SwitchPainter(
      position: _pos,
      press: _press,
      on: night ? colors.volt : colors.accentText,
      off: colors.sunken,
      offEdge: colors.lineStrong,
      thumbOn: night ? colors.ink : const Color(0xFFFFFFFF),
      thumbOff: night ? colors.ink2 : const Color(0xFFFFFFFF),
      tick: night ? colors.voltInk : colors.accentText,
      shadow: night ? const Color(0x66000000) : const Color(0x33000000),
      enabled: _enabled,
    );

    Widget track = CustomPaint(size: MmSwitch.trackSize, painter: painter);
    if (_focused) {
      track = DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          borderRadius: MmRadius.pillAll,
          border: Border.all(color: colors.focusRing, width: 2, strokeAlign: BorderSide.strokeAlignOutside),
        ),
        child: track,
      );
    }

    return Semantics(
      container: true,
      toggled: widget.value,
      enabled: _enabled,
      label: widget.semanticsLabel,
      onTap: _enabled ? _toggle : null,
      excludeSemantics: true,
      child: FocusableActionDetector(
        enabled: _enabled,
        autofocus: widget.autofocus,
        mouseCursor: _enabled ? SystemMouseCursors.click : MouseCursor.defer,
        onShowFocusHighlight: (v) => setState(() => _focused = v),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
            _toggle();
            return null;
          }),
        },
        child: MmHitSlop(
          slop: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: _enabled ? (_) => _squeeze(true) : null,
            onTapCancel: _enabled ? () => _squeeze(false) : null,
            onTapUp: _enabled ? (_) => _squeeze(false) : null,
            onTap: _enabled ? _toggle : null,
            onHorizontalDragStart: _enabled ? _dragBegin : null,
            onHorizontalDragUpdate: _enabled ? _dragUpdate : null,
            onHorizontalDragEnd: _enabled ? _dragEnd : null,
            onHorizontalDragCancel: _enabled
                ? () {
                    _dragging = false;
                    _squeeze(false);
                    _settle(widget.value ? 1 : 0);
                  }
                : null,
            child: RepaintBoundary(child: track),
          ),
        ),
      ),
    );
  }
}

class _SwitchPainter extends CustomPainter {
  _SwitchPainter({
    required this.position,
    required this.press,
    required this.on,
    required this.off,
    required this.offEdge,
    required this.thumbOn,
    required this.thumbOff,
    required this.tick,
    required this.shadow,
    required this.enabled,
  }) : super(repaint: Listenable.merge([position, press]));

  final Animation<double> position;
  final Animation<double> press;
  final Color on;
  final Color off;
  final Color offEdge;
  final Color thumbOn;
  final Color thumbOff;
  final Color tick;
  final Color shadow;
  final bool enabled;

  @override
  void paint(Canvas canvas, Size size) {
    final p = position.value;
    final fill = p.clamp(0.0, 1.0);
    final track = RRect.fromRectAndRadius(Offset.zero & MmSwitch.trackSize, const Radius.circular(16));
    final dim = enabled ? 1.0 : 0.45;

    canvas.drawRRect(track, Paint()..color = Color.lerp(off, on, fill)!.withValues(alpha: dim));
    final edge = offEdge.withValues(alpha: offEdge.a * (1 - fill) * dim);
    if (edge.a > 0) {
      canvas.drawRRect(
        track.deflate(0.75),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = edge,
      );
    }

    final r = MmSwitch.thumbRect(p, press.value);
    final thumb = RRect.fromRectAndRadius(r, const Radius.circular(MmSwitch.thumb / 2));
    canvas.drawRRect(
      thumb.shift(const Offset(0, 1)),
      Paint()
        ..color = shadow.withValues(alpha: shadow.a * dim)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5),
    );
    canvas.drawRRect(thumb, Paint()..color = Color.lerp(thumbOff, thumbOn, fill)!.withValues(alpha: enabled ? 1 : 0.7));

    // The tick draws itself over the last stretch of the thumb's travel, so it lands as the thumb
    // does; it shrinks back out the same way when the switch turns off.
    final k = ((fill - 0.45) / 0.55).clamp(0.0, 1.0);
    if (k > 0) {
      final box = Rect.fromCenter(center: r.center, width: 14, height: 14);
      canvas.drawPath(
        mmPathPrefix(MmPaths.check(box), Motion.out.transform(k)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = tick.withValues(alpha: dim),
      );
    }
  }

  @override
  bool shouldRepaint(_SwitchPainter old) =>
      old.position != position ||
      old.press != press ||
      old.on != on ||
      old.off != off ||
      old.offEdge != offEdge ||
      old.thumbOn != thumbOn ||
      old.thumbOff != thumbOff ||
      old.tick != tick ||
      old.shadow != shadow ||
      old.enabled != enabled;
}

