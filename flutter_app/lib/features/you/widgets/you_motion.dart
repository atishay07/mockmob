import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/settings/changed_row.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

// Motion pieces the You screens share (UI phase 2). Everything here animates transform and
// opacity only, inside a RepaintBoundary, answers a student action or shows a state, and gives
// way to the same words under reduced motion.

/// Text that cross-fades when its words change (a note that states a state, a security row's
/// status). 200 ms; instant under reduced motion. The box is as large as the longer of the two
/// words while they trade places, so the row never jumps.
class YouNote extends StatelessWidget {
  const YouNote(this.text, {super.key, this.style, this.maxLines, this.textAlign});

  final String text;
  final TextStyle? style;
  final int? maxLines;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.crossFade),
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(
        alignment: AlignmentDirectional.topStart,
        children: [...previous, ?current],
      ),
      child: Text(text, key: ValueKey(text), style: style, maxLines: maxLines, textAlign: textAlign, overflow: maxLines == null ? null : TextOverflow.ellipsis),
    );
  }
}

/// A short value on the right of a row ("Night", "4 credits") that slides up and fades when it
/// changes: the new word rises 8 dp into place as the old one lifts away.
class YouSlideValue extends StatelessWidget {
  const YouSlideValue(this.text, {super.key, this.style, this.textAlign = TextAlign.end});

  final String text;
  final TextStyle? style;
  final TextAlign textAlign;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.card),
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(
        alignment: AlignmentDirectional.centerEnd,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) {
        final incoming = child.key == ValueKey(text);
        final offset = Tween<Offset>(begin: incoming ? const Offset(0, 0.5) : const Offset(0, -0.5), end: Offset.zero).animate(animation);
        return FadeTransition(opacity: animation, child: SlideTransition(position: offset, child: child));
      },
      child: Text(text, key: ValueKey(text), style: style, textAlign: textAlign),
    );
  }
}

/// Draws a 600 ms volt hairline along the foot of its child when the student returns to a hub
/// row whose setting just changed. It listens to [changedSettingsRowProvider] and plays once, only
/// while the route is on top, so it is seen. Under reduced motion the hairline simply shows for
/// the same time without travelling.
class YouChangedHairline extends ConsumerStatefulWidget {
  const YouChangedHairline({super.key, required this.id, required this.child, this.inset = 0});

  final String id;
  final Widget child;

  /// Where the hairline starts from the left (the row's text edge).
  final double inset;

  static const Duration duration = Duration(milliseconds: 600);

  @override
  ConsumerState<YouChangedHairline> createState() => _YouChangedHairlineState();
}

class _YouChangedHairlineState extends ConsumerState<YouChangedHairline> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: YouChangedHairline.duration);
  bool _scheduled = false;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _maybePlay() {
    if (_scheduled) return;
    final pending = ref.read(changedSettingsRowProvider) == widget.id;
    final onTop = ModalRoute.of(context)?.isCurrent ?? true;
    if (!pending || !onTop) return;
    _scheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scheduled = false;
      if (!mounted) return;
      ref.read(changedSettingsRowProvider.notifier).clear(widget.id);
      _c.forward(from: 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(changedSettingsRowProvider);
    _maybePlay();
    final colors = context.mmColors;
    final reduced = Motion.reduced(context);
    return Stack(
      children: [
        widget.child,
        Positioned(
          left: widget.inset,
          right: 0,
          bottom: 0,
          height: 2,
          child: IgnorePointer(
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: _c,
                builder: (context, _) {
                  final v = _c.value;
                  if (v == 0 || v == 1) return const SizedBox.shrink();
                  final grow = reduced ? 1.0 : Motion.glide.transform((v / 0.55).clamp(0.0, 1.0));
                  final fade = v < 0.6 ? 1.0 : 1 - (v - 0.6) / 0.4;
                  return Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: FractionallySizedBox(
                      widthFactor: grow,
                      child: Opacity(
                        opacity: fade,
                        child: DecoratedBox(
                          decoration: BoxDecoration(color: colors.isNight ? colors.volt : colors.accentText, borderRadius: BorderRadius.circular(1)),
                          child: const SizedBox(height: 1.5),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// How a settings row's icon answers a press. Transforms and one overlay only.
enum YouIconMotion {
  none,

  /// The bell swings from its top.
  swing,

  /// The shield's tick draws itself.
  tick,

  /// The life buoy turns a quarter (it is symmetrical, so it lands where it began).
  turn,

  /// A ring pings out of the target.
  ping,

  /// A small tilt (the moon settling).
  tilt,

  /// A small hop.
  hop,
}

/// An icon that plays its [motion] each time [pressed] goes true. 500 ms, once per press; still
/// under reduced motion.
class YouMovingIcon extends StatefulWidget {
  const YouMovingIcon({super.key, required this.icon, required this.size, required this.color, required this.pressed, this.motion = YouIconMotion.none, this.tickIcon});

  final IconData icon;
  final double size;
  final Color color;
  final bool pressed;
  final YouIconMotion motion;

  /// For [YouIconMotion.tick]: the bare glyph (a shield) the tick is drawn over.
  final IconData? tickIcon;

  @override
  State<YouMovingIcon> createState() => _YouMovingIconState();
}

class _YouMovingIconState extends State<YouMovingIcon> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));

  @override
  void initState() {
    super.initState();
    // Created now, not lazily in dispose (a state that never moves would build its ticker there).
    _c;
  }

  @override
  void didUpdateWidget(YouMovingIcon old) {
    super.didUpdateWidget(old);
    if (widget.pressed && !old.pressed && widget.motion != YouIconMotion.none && !Motion.reduced(context)) {
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final glyph = Icon(widget.icon, size: widget.size, color: widget.color);
    if (widget.motion == YouIconMotion.none) return glyph;
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        child: glyph,
        builder: (context, child) {
          final t = _c.value;
          if (t == 0 || t == 1) return child!;
          switch (widget.motion) {
            case YouIconMotion.swing:
              // A damped swing about the bell's hanging point.
              final angle = math.sin(t * math.pi * 3) * 0.42 * (1 - t);
              return Transform.rotate(angle: angle, alignment: const Alignment(0, -0.8), child: child);
            case YouIconMotion.turn:
              return Transform.rotate(angle: Motion.glide.transform(t) * math.pi / 2, child: child);
            case YouIconMotion.tilt:
              return Transform.rotate(angle: math.sin(t * math.pi * 2) * 0.25 * (1 - t), child: child);
            case YouIconMotion.hop:
              return Transform.translate(offset: Offset(0, -math.sin(t * math.pi) * 3), child: child);
            case YouIconMotion.ping:
              final ring = Motion.glide.transform(t);
              return Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Opacity(
                    opacity: (1 - ring) * 0.7,
                    child: Transform.scale(
                      scale: 0.6 + ring * 0.9,
                      child: DecoratedBox(
                        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: widget.color, width: 1.2)),
                        child: SizedBox.square(dimension: widget.size),
                      ),
                    ),
                  ),
                  child!,
                ],
              );
            case YouIconMotion.tick:
              final shield = widget.tickIcon;
              if (shield == null) return child!;
              return CustomPaint(
                foregroundPainter: _TickPainter(progress: Motion.glide.transform(((t - 0.1) / 0.7).clamp(0.0, 1.0)), color: widget.color, size: widget.size),
                child: Icon(shield, size: widget.size, color: widget.color),
              );
            case YouIconMotion.none:
              return child!;
          }
        },
      ),
    );
  }
}

/// The check inside a shield, drawn on over [progress] in the icon's own 24-unit grid.
class _TickPainter extends CustomPainter {
  const _TickPainter({required this.progress, required this.color, required this.size});

  final double progress;
  final Color color;
  final double size;

  @override
  void paint(Canvas canvas, Size box) {
    final k = size / 24;
    final dx = (box.width - size) / 2;
    final dy = (box.height - size) / 2;
    Offset p(double x, double y) => Offset(dx + x * k, dy + y * k);
    final path = Path()
      ..moveTo(p(9, 12).dx, p(9, 12).dy)
      ..lineTo(p(11, 14).dx, p(11, 14).dy)
      ..lineTo(p(15, 10).dx, p(15, 10).dy);
    final metric = path.computeMetrics().first;
    canvas.drawPath(
      metric.extractPath(0, metric.length * progress),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 * k
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_TickPainter old) => old.progress != progress || old.color != color || old.size != size;
}

/// A Mobi whose taps cycle through a few small acts (a wave, a nod, a hop) instead of one boop:
/// he answers every tap, never twice the same in a row. Drive him further through [controller].
///
/// He is decorative to TalkBack (the screen's words carry the meaning). Under reduced motion the
/// acts show as key poses and the cycle still advances.
class YouMobi extends ConsumerStatefulWidget {
  const YouMobi({
    super.key,
    required this.size,
    this.controller,
    this.entrance,
    this.pose = MobiPose.idle,
    this.cycle = const [MobiAct.hello, MobiAct.correct, MobiAct.cheer],
  });

  final double size;
  final MobiController? controller;
  final MobiAct? entrance;
  final MobiPose pose;
  final List<MobiAct> cycle;

  @override
  ConsumerState<YouMobi> createState() => _YouMobiState();
}

class _YouMobiState extends ConsumerState<YouMobi> {
  MobiController? _own;
  MobiController get _controller => widget.controller ?? (_own ??= MobiController());
  int _taps = 0;

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  void _tap() {
    unawaited(ref.read(hapticsProvider).tick().catchError((Object _) {}));
    if (widget.cycle.isEmpty) return;
    _controller.play(widget.cycle[_taps % widget.cycle.length]);
    _taps++;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _tap,
      child: Mobi(pose: widget.pose, size: widget.size, controller: _controller, entrance: widget.entrance),
    );
  }
}

/// Shakes its child sideways once each time [trigger] changes: a damped 360 ms wobble of at most
/// 6 dp, the answer to "no, that is not allowed" (a sixth subject). Transform only. Still under
/// reduced motion (the words carry the message).
class YouShake extends StatefulWidget {
  const YouShake({super.key, required this.trigger, required this.child});

  final int trigger;
  final Widget child;

  @override
  State<YouShake> createState() => _YouShakeState();
}

class _YouShakeState extends State<YouShake> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 360));

  @override
  void didUpdateWidget(YouShake old) {
    super.didUpdateWidget(old);
    if (old.trigger != widget.trigger && !Motion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = _c.value;
        final dx = t == 0 || t == 1 ? 0.0 : math.sin(t * math.pi * 6) * 6 * (1 - t);
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
    );
  }
}
