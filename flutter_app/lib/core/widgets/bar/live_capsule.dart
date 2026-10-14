import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'bar_glass.dart';
import 'bar_live.dart';

/// The live capsule (DOCK.md sections 3.2 and 5.3): a 44 dp glass capsule that rises from
/// behind the bar only while something is in progress, and says it in words: "Accountancy
/// mock, 23 of 50, 41 min left  Resume". One target (48 dp with its slop); a horizontal swipe
/// dismisses it for this app session; TalkBack gets a "Dismiss" action instead.
class LiveCapsule extends ConsumerStatefulWidget {
  const LiveCapsule({
    super.key,
    required this.live,
    required this.width,
    required this.collapse,
    this.onAction,
    this.onDismiss,
    this.quality,
  });

  /// What to say, or null to leave.
  final BarLive? live;
  final double width;

  /// The bar's collapse (0 to 1): the capsule sinks 8 dp and fades out with it.
  final Animation<double> collapse;
  final ValueChanged<BarLive>? onAction;
  final ValueChanged<BarLive>? onDismiss;
  final GlassQuality? quality;

  /// The capsule's box: 44 dp tall plus 2 dp of invisible slop above and below.
  static const double boxHeight = MmBar.capsuleHeight + 4;

  @override
  ConsumerState<LiveCapsule> createState() => _LiveCapsuleState();
}

class _LiveCapsuleState extends ConsumerState<LiveCapsule> with TickerProviderStateMixin {
  late final AnimationController _present = AnimationController(vsync: this, value: widget.live == null ? 0 : 1);
  late final AnimationController _swipe = AnimationController.unbounded(vsync: this);
  BarLive? _shown;
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _shown = widget.live;
  }

  @override
  void didUpdateWidget(LiveCapsule oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.live;
    final reduced = Motion.reduced(context);
    if (next != null) {
      final wasHidden = _shown == null || _leaving || _present.value == 0;
      _shown = next;
      _leaving = false;
      if (wasHidden) {
        _swipe.value = 0;
        _present.duration = reduced ? Motion.reducedFade : Motion.emphasizedDuration;
        _present.forward(from: reduced ? _present.value : 0);
      }
    } else if (_shown != null && !_leaving) {
      _leaving = true;
      _present.reverseDuration = reduced ? Motion.reducedFade : Motion.exitDuration;
      _present.reverse().whenCompleteOrCancel(() {
        if (mounted && _leaving) setState(() => _shown = null);
      });
    }
  }

  @override
  void dispose() {
    _present.dispose();
    _swipe.dispose();
    super.dispose();
  }

  void _tap() {
    final live = _shown;
    if (live == null || live.action == null || _leaving) return;
    ref.read(hapticsProvider).light();
    widget.onAction?.call(live);
  }

  void _dismiss({double direction = 1}) {
    final live = _shown;
    if (live == null || _leaving) return;
    ref.read(hapticsProvider).selection();
    if (Motion.reduced(context)) {
      widget.onDismiss?.call(live);
      return;
    }
    _swipe
        .animateTo(direction.sign * widget.width * 1.2, duration: Motion.exitDuration, curve: Motion.exit)
        .whenCompleteOrCancel(() => widget.onDismiss?.call(live));
  }

  void _dragUpdate(DragUpdateDetails d) {
    if (_leaving) return;
    _swipe.stop();
    _swipe.value += d.delta.dx;
  }

  void _dragEnd(DragEndDetails d) {
    if (_leaving) return;
    final v = d.primaryVelocity ?? 0;
    if (_swipe.value.abs() > widget.width * 0.35 || v.abs() > 600) {
      _dismiss(direction: _swipe.value == 0 ? v : _swipe.value);
      return;
    }
    if (Motion.reduced(context)) {
      _swipe.value = 0;
    } else {
      _swipe.animateWith(Motion.spring(Springs.smooth, _swipe.value, 0, velocity: v));
    }
  }

  @override
  Widget build(BuildContext context) {
    final live = _shown;
    if (live == null) return const SizedBox.shrink();
    final reduced = Motion.reduced(context);
    final width = widget.width;

    final content = _CapsuleContent(live: live, present: _present, reduced: reduced);
    Widget capsule = SizedBox(
      width: width,
      height: LiveCapsule.boxHeight,
      child: BarGlass(
        quality: widget.quality,
        repaint: _present,
        shape: (size) => RRect.fromRectAndRadius(
          Rect.fromLTWH(0, 2, size.width, MmBar.capsuleHeight),
          const Radius.circular(MmBar.capsuleHeight / 2),
        ),
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: content),
      ),
    );

    capsule = Semantics(
      container: true,
      button: live.action != null,
      label: live.action == null ? live.semanticsLabel : '${live.semanticsLabel}. ${live.action}',
      onTap: live.action == null ? null : _tap,
      customSemanticsActions: {const CustomSemanticsAction(label: 'Dismiss'): () => _dismiss()},
      child: ExcludeSemantics(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _tap,
          onHorizontalDragUpdate: _dragUpdate,
          onHorizontalDragEnd: _dragEnd,
          onHorizontalDragCancel: () => _dragEnd(DragEndDetails(primaryVelocity: 0)),
          child: capsule,
        ),
      ),
    );

    return AnimatedBuilder(
      animation: Listenable.merge([_present, _swipe, widget.collapse]),
      builder: (context, child) {
        final p = _present.value;
        final entering = _present.status != AnimationStatus.reverse;
        // In: 16 dp up, 0.92 to 1, fading in on emphasized. Out: 12 dp down, fading on exit.
        final e = reduced ? p : (entering ? Motion.emphasized.transform(p) : p);
        final dy = reduced ? 0.0 : (entering ? 16 * (1 - e) : 12 * (1 - p));
        final scale = reduced || !entering ? 1.0 : 0.92 + 0.08 * e;
        // Sinks 8 dp and fades as the bar collapses (over its first 150 ms).
        final c = (widget.collapse.value / 0.625).clamp(0.0, 1.0);
        final swipe = _swipe.value;
        final swipeFade = 1 - (swipe.abs() / (width * 0.9)).clamp(0.0, 1.0);
        final opacity = (entering ? Interval(0, 0.6).transform(p) : p) * (1 - c) * swipeFade;
        return IgnorePointer(
          ignoring: c > 0.5 || _leaving,
          child: Opacity(
            opacity: opacity.clamp(0.0, 1.0),
            child: Transform.translate(
              offset: Offset(swipe, dy + (reduced ? 0 : 8 * c)),
              child: Transform.scale(scale: scale, child: child),
            ),
          ),
        );
      },
      child: RepaintBoundary(child: capsule),
    );
  }
}

/// The capsule's one line: glyph, title and detail, action word. Between states the content
/// cross-fades over 200 ms and the shape stays. On arrival the glyph, text and action come in
/// 40 ms apart.
class _CapsuleContent extends StatelessWidget {
  const _CapsuleContent({required this.live, required this.present, required this.reduced});

  final BarLive live;
  final Animation<double> present;
  final bool reduced;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final text = MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.2,
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(text: live.title, style: type.body.copyWith(fontSize: 14, height: 18 / 14, fontWeight: FontWeight.w600, color: colors.ink)),
            if (live.detail != null)
              TextSpan(text: ', ${live.detail}', style: type.body.copyWith(fontSize: 14, height: 18 / 14, fontWeight: FontWeight.w400, color: colors.ink2)),
          ],
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        softWrap: false,
      ),
    );
    final action = live.action;

    Widget stagger(int i, Widget child) {
      if (reduced) return child;
      final start = (i * 40) / Motion.emphasizedDuration.inMilliseconds;
      final fade = CurvedAnimation(parent: present, curve: Interval(start, math.min(1, start + 0.6), curve: Motion.glide));
      return FadeTransition(opacity: fade, child: child);
    }

    final row = Row(
      key: ValueKey(live.kind),
      children: [
        const SizedBox(width: 14),
        stagger(0, SizedBox.square(dimension: 24, child: _CapsuleGlyph(live: live, accent: accent))),
        const SizedBox(width: 10),
        Expanded(child: stagger(1, text)),
        if (action != null) ...[
          const SizedBox(width: 12),
          stagger(
            2,
            MediaQuery.withClampedTextScaling(
              maxScaleFactor: 1.2,
              child: Text(action, style: type.body.copyWith(fontSize: 14, height: 18 / 14, fontWeight: FontWeight.w700, color: accent)),
            ),
          ),
        ],
        const SizedBox(width: 16),
      ],
    );
    return AnimatedSwitcher(
      duration: reduced ? Motion.reducedFade : Motion.crossFade,
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.center, children: [...previous, ?current]),
      child: row,
    );
  }
}

/// The capsule's 24 dp glyph per state.
class _CapsuleGlyph extends StatefulWidget {
  const _CapsuleGlyph({required this.live, required this.accent});

  final BarLive live;
  final Color accent;

  @override
  State<_CapsuleGlyph> createState() => _CapsuleGlyphState();
}

class _CapsuleGlyphState extends State<_CapsuleGlyph> with SingleTickerProviderStateMixin {
  /// Sending's one pass of the three bubbles inking in turn (never a loop).
  late final AnimationController _pass = AnimationController(vsync: this, duration: const Duration(milliseconds: 900), value: 1);

  @override
  void initState() {
    super.initState();
    if (widget.live.kind == BarLiveKind.sending) _start();
  }

  @override
  void didUpdateWidget(_CapsuleGlyph oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.live.kind == BarLiveKind.sending && oldWidget.live.kind != BarLiveKind.sending) _start();
  }

  void _start() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || Motion.reduced(context)) return;
      _pass.forward(from: 0);
    });
  }

  @override
  void dispose() {
    _pass.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return CustomPaint(
      painter: _GlyphPainter(live: widget.live, accent: widget.accent, ink: colors.ink2, onAccent: colors.isNight ? colors.voltInk : colors.raised, pass: _pass),
    );
  }
}

class _GlyphPainter extends CustomPainter {
  _GlyphPainter({required this.live, required this.accent, required this.ink, required this.onAccent, required this.pass}) : super(repaint: pass);

  final BarLive live;
  final Color accent;
  final Color ink;
  final Color onAccent;
  final Animation<double> pass;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.75
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = ink;
    switch (live) {
      case BarSending():
        // Three 5 dp bubbles, inking left to right once.
        for (var i = 0; i < 3; i++) {
          final c = Offset(5 + 7.0 * i, 12);
          final t = ((pass.value * 3) - i).clamp(0.0, 1.0);
          canvas.drawCircle(c, 2.5, Paint.from(line)..strokeWidth = 1.25);
          if (t > 0) canvas.drawCircle(c, 3.1 * Motion.glide.transform(t), Paint()..color = accent);
        }
      case BarSaved() || BarSynced():
        final c = const Offset(12, 12);
        canvas.drawCircle(c, 9, Paint()..color = accent);
        final tick = Path()
          ..moveTo(7.8, 12.3)
          ..lineTo(10.6, 15)
          ..lineTo(16.4, 9.2);
        canvas.drawPath(tick, Paint.from(line)..color = onAccent..strokeWidth = 2);
      case BarMarked():
        // A folded answer sheet with a volt foil dot.
        final sheet = Path()
          ..moveTo(6, 3.5)
          ..lineTo(14.5, 3.5)
          ..lineTo(18.5, 7.5)
          ..lineTo(18.5, 20.5)
          ..lineTo(6, 20.5)
          ..close();
        canvas.drawPath(sheet, line);
        canvas.drawPath(
          Path()
            ..moveTo(14.5, 3.5)
            ..lineTo(14.5, 7.5)
            ..lineTo(18.5, 7.5),
          line,
        );
        canvas.drawLine(const Offset(9, 11.5), const Offset(15.5, 11.5), line);
        canvas.drawCircle(const Offset(12.25, 16.25), 2.75, Paint()..color = accent);
      case BarResume(:final answered, :final total):
        // A 20 dp ring, the volt arc for the share answered.
        const c = Offset(12, 12);
        canvas.drawCircle(c, 9, Paint.from(line)..strokeWidth = 2..color = ink.withValues(alpha: 0.45));
        final share = answered == null || total <= 0 ? 0.0 : (answered / total).clamp(0.0, 1.0);
        if (share > 0) {
          canvas.drawArc(
            Rect.fromCircle(center: c, radius: 9),
            -math.pi / 2,
            2 * math.pi * share,
            false,
            Paint.from(line)
              ..strokeWidth = 2
              ..color = accent,
          );
        }
      case BarOffline():
        // A cloud with a slash.
        final cloud = Path()
          ..moveTo(7, 18)
          ..arcToPoint(const Offset(7.6, 10.4), radius: const Radius.circular(3.8), largeArc: true)
          ..arcToPoint(const Offset(17.2, 10.6), radius: const Radius.circular(5.2))
          ..arcToPoint(const Offset(17, 18), radius: const Radius.circular(3.7), largeArc: false)
          ..close();
        canvas.drawPath(cloud, line);
        canvas.drawLine(const Offset(4, 4), const Offset(20, 20), Paint.from(line)..color = accent);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlyphPainter old) => old.live != live || old.accent != accent || old.ink != ink || old.onAccent != onAccent || old.pass != pass;
}
