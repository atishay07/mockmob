// FoldPuppet (spec 5.2, technique C): one still per pose, moved around the still. Cheap by design:
// every move is a transform on its own RepaintBoundary, pivoted at the boots; the blink is a
// visor-coloured lid painted over each eye box from folds.json; a pose change cross-fades in 120 ms
// on the squash low point. No Rive, no image sequence.
//
// Loops (breathe in the den, sway in the lobby, blink everywhere) stop 10 s after the last touch
// (MobIdleScope), when the tab is hidden (TickerMode) and in reduced motion. Acts (nod, hop, cheer,
// tilt, land) are one-shots the caller fires by bumping [FoldPuppet.actId].

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';
import 'mob_fx.dart';

/// One-shot moves (spec 5.6). Durations are the spec's.
enum FoldAct {
  none,

  /// M4: a 3 degree nod, 240 ms.
  nod,

  /// M4 and M6b: a 6 dp hop with a squash on landing, 300 ms.
  hop,

  /// M5: a nod-hop to the cheer pose, 420 ms.
  cheer,

  /// M5b: a 6 degree tilt with the shrug pose, and back, 420 ms. Never sad.
  tilt,

  /// A landing after a drop the caller animated: squash 1.08/0.88 for 90 ms, then settle.
  land,

  /// A bigger celebratory hop (podium first, M6 friend finished): 22 dp, squash, settle.
  bigHop,
}

class FoldPuppet extends ConsumerStatefulWidget {
  const FoldPuppet({
    super.key,
    required this.fold,
    this.size = 72,
    this.pose = FoldPose.idle,
    this.breathe = false,
    this.sway = false,
    this.blink = true,
    this.phase = 0,
    this.locked = false,
    this.ghost = false,
    this.shadow = true,
    this.finish = FoldFinish.plain,
    this.act = FoldAct.none,
    this.actId = 0,
    this.large = false,
    this.mirror = false,
    this.fallbackName = '',
    this.fallbackColour = 0,
    this.semanticLabel,
    this.brightness = 1,
  });

  /// Null draws the member's initial disc (an old account with no Fold yet).
  final FoldKey? fold;

  /// The figure's height in dp (boots to top); the width follows the art.
  final double size;
  final FoldPose pose;

  /// Den only: scaleY 1 to 1.028 on a 3600 ms sweep, offset 120 ms per [phase].
  final bool breathe;

  /// Lobby only: plus or minus 2 degrees on 6400 ms.
  final bool sway;
  final bool blink;

  /// The member's index, for loop offsets and the seeded blink.
  final int phase;

  /// A locked Fold: the true silhouette in ink4 with a 1 dp paper edge.
  final bool locked;

  /// A ghost run: 55% opacity and a dashed shadow.
  final bool ghost;
  final bool shadow;
  final FoldFinish finish;
  final FoldAct act;

  /// Bump to fire [act] again.
  final int actId;

  /// Use the 512 still (reveal, podium first, shelf detail).
  final bool large;
  final bool mirror;
  final String fallbackName;
  final int fallbackColour;
  final String? semanticLabel;

  /// 1 normal; 0.7 for the Fold standing behind on a shared ruler number (spec 0.3).
  final double brightness;

  /// The figure width for [size], from the art's box (for layout before the manifest loads, 0.8).
  static double widthFor(FoldManifest? m, FoldKey? fold, double size, {FoldPose pose = FoldPose.idle}) {
    final s = m?[fold]?.still(pose);
    if (s == null) return size * 0.8;
    return s.box.width / s.box.height * size;
  }

  @override
  ConsumerState<FoldPuppet> createState() => _FoldPuppetState();
}

class _FoldPuppetState extends ConsumerState<FoldPuppet> with TickerProviderStateMixin {
  late final Ticker _loop = createTicker(_onLoop);
  late final AnimationController _act = AnimationController(vsync: this);
  late final AnimationController _blink = AnimationController(vsync: this, duration: const Duration(milliseconds: 120));
  final ValueNotifier<double> _loopT = ValueNotifier<double>(0);
  Timer? _blinkTimer;
  late math.Random _rng;
  ValueListenable<bool>? _awake;
  FoldAct _playing = FoldAct.none;
  FoldPose? _poseOverride;

  bool get _reduced => MobFx.reduced(context);

  @override
  void initState() {
    super.initState();
    _rng = math.Random(widget.phase * 7919 + (widget.fold?.index ?? 0) * 104729 + 17);
    _act.addListener(_onAct);
    if (widget.act != FoldAct.none && widget.actId > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fire(widget.act));
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final awake = MobIdleScope.awakeOf(context);
    if (!identical(awake, _awake)) {
      _awake?.removeListener(_syncLoops);
      _awake = awake..addListener(_syncLoops);
    }
    _syncLoops();
  }

  @override
  void didUpdateWidget(FoldPuppet old) {
    super.didUpdateWidget(old);
    if (widget.actId != old.actId && widget.act != FoldAct.none) _fire(widget.act);
    if (widget.breathe != old.breathe || widget.sway != old.sway || widget.blink != old.blink || widget.locked != old.locked) _syncLoops();
  }

  bool get _loopsWanted => !widget.locked && (widget.breathe || widget.sway || widget.blink) && !_reduced && (_awake?.value ?? true) && TickerMode.valuesOf(context).enabled;

  void _syncLoops() {
    if (!mounted) return;
    final on = _loopsWanted;
    if (on && (widget.breathe || widget.sway)) {
      if (!_loop.isActive) _loop.start();
    } else if (_loop.isActive) {
      _loop.stop();
    }
    if (on && widget.blink) {
      _blinkTimer ??= _scheduleBlink();
    } else {
      _blinkTimer?.cancel();
      _blinkTimer = null;
    }
  }

  Timer _scheduleBlink() => Timer(Duration(milliseconds: 4000 + _rng.nextInt(3000)), () {
        _blinkTimer = null;
        if (!mounted || !_loopsWanted) return;
        _blink.forward(from: 0).whenComplete(() {
          if (mounted) _blink.value = 0;
        });
        _blinkTimer = _scheduleBlink();
      });

  void _onLoop(Duration elapsed) => _loopT.value = elapsed.inMicroseconds / 1e6;

  Duration _actDuration(FoldAct a) => switch (a) {
        FoldAct.nod => const Duration(milliseconds: 240),
        FoldAct.hop => const Duration(milliseconds: 300),
        FoldAct.cheer => const Duration(milliseconds: 420),
        FoldAct.tilt => const Duration(milliseconds: 420),
        FoldAct.land => const Duration(milliseconds: 420),
        FoldAct.bigHop => const Duration(milliseconds: 620),
        FoldAct.none => Duration.zero,
      };

  void _fire(FoldAct a) {
    if (!mounted || a == FoldAct.none) return;
    if (_reduced) {
      // Reduced motion: no nod, hop or squash. A pose still changes, as a cut.
      setState(() => _poseOverride = switch (a) { FoldAct.cheer || FoldAct.bigHop => FoldPose.cheer, FoldAct.tilt => FoldPose.shrug, _ => null });
      return;
    }
    _playing = a;
    _act
      ..duration = _actDuration(a)
      ..forward(from: 0);
  }

  void _onAct() {
    // The pose cross-fades on the squash low point of a cheer or a tilt, and back at the end.
    final t = _act.value;
    FoldPose? want;
    if (_playing == FoldAct.cheer || _playing == FoldAct.bigHop) want = t > 0.18 && t < 0.98 ? FoldPose.cheer : null;
    if (_playing == FoldAct.tilt) want = t > 0.12 && t < 0.96 ? FoldPose.shrug : null;
    if (want != _poseOverride) setState(() => _poseOverride = want);
  }

  @override
  void dispose() {
    _awake?.removeListener(_syncLoops);
    _blinkTimer?.cancel();
    _loop.dispose();
    _act.dispose();
    _blink.dispose();
    _loopT.dispose();
    super.dispose();
  }

  /// (lift dp, rotation radians, scaleX, scaleY) for the act at [t].
  (double, double, double, double) _actFrame(double t) {
    double squash(double local) {
      // 0..1 over the 90 ms hold: 1 -> squash -> 1.
      final k = math.sin(local.clamp(0.0, 1.0) * math.pi);
      return k;
    }

    switch (_playing) {
      case FoldAct.nod:
        final r = math.sin(t * math.pi) * 3 * math.pi / 180;
        return (0, r, 1, 1);
      case FoldAct.hop:
        // Up and down on glide, a squash for the last 30%.
        final up = t < 0.7 ? math.sin(t / 0.7 * math.pi) * 6 : 0.0;
        final s = t >= 0.7 ? squash((t - 0.7) / 0.3) : 0.0;
        return (up, 0, 1 + (MobBeat.squashX - 1) * s, 1 - (1 - MobBeat.squashY) * s);
      case FoldAct.cheer:
        // Anticipation squash, rise 10 dp, land squash, settle.
        final pre = t < 0.15 ? squash(t / 0.15) * 0.6 : 0.0;
        final up = t >= 0.15 && t < 0.75 ? math.sin((t - 0.15) / 0.6 * math.pi) * 10 : 0.0;
        final land = t >= 0.75 ? squash((t - 0.75) / 0.25) : 0.0;
        final s = pre + land;
        return (up, 0, 1 + (MobBeat.squashX - 1) * s, 1 - (1 - MobBeat.squashY) * s);
      case FoldAct.bigHop:
        final pre = t < 0.12 ? squash(t / 0.12) * 0.7 : 0.0;
        final up = t >= 0.12 && t < 0.8 ? math.sin((t - 0.12) / 0.68 * math.pi) * 22 : 0.0;
        final land = t >= 0.8 ? squash((t - 0.8) / 0.2) : 0.0;
        final s = pre + land;
        return (up, 0, 1 + (MobBeat.squashX - 1) * s, 1 - (1 - MobBeat.squashY) * s);
      case FoldAct.tilt:
        final r = math.sin(t * math.pi) * 6 * math.pi / 180;
        return (0, -r, 1, 1);
      case FoldAct.land:
        final s = t < 0.22 ? squash(t / 0.22) : 0.0;
        // A small settle overshoot after the squash (celebrate-like), 2% scale.
        final settle = t >= 0.22 ? math.sin((t - 0.22) / 0.78 * math.pi) * math.exp(-3 * (t - 0.22)) * 0.03 : 0.0;
        return (0, 0, 1 + (MobBeat.squashX - 1) * s - settle * 0.5, 1 - (1 - MobBeat.squashY) * s + settle);
      case FoldAct.none:
        return (0, 0, 1, 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manifest = foldManifestOf(ref);
    final art = manifest?[widget.fold];
    final pose = _poseOverride ?? widget.pose;
    final still = art?.still(pose);
    if (still == null) return _fallback(context);
    final size = widget.size;
    final side = size / still.box.height;
    final width = still.box.width * side;
    final c = context.mmColors;
    final path = widget.large ? (still.large ?? still.file) : still.file;

    Widget figure = SizedBox(
      width: width,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: -still.box.left * side,
            top: -still.box.top * side,
            width: side,
            height: side,
            child: _image(context, path, still, side),
          ),
          if (widget.blink && !widget.locked && still.eyes.isNotEmpty)
            Positioned(
              left: -still.box.left * side,
              top: -still.box.top * side,
              width: side,
              height: side,
              child: IgnorePointer(
                child: CustomPaint(painter: _LidPainter(_blink, still.eyes, still.visorColour ?? const Color(0xFF16151A))),
              ),
            ),
        ],
      ),
    );
    if (widget.mirror) figure = Transform.flip(flipX: true, child: figure);
    if (widget.brightness < 1) {
      final b = widget.brightness;
      figure = ColorFiltered(
        colorFilter: ColorFilter.matrix(<double>[b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0]),
        child: figure,
      );
    }
    if (widget.finish == FoldFinish.foil && !widget.locked && !MobFx.lite(context)) {
      figure = _FoilSheen(t: _loopT, child: figure);
    }

    final moving = AnimatedBuilder(
      animation: Listenable.merge([_act, _loopT]),
      builder: (context, child) {
        final (lift, rot, sx, sy) = _act.isAnimating || _act.value > 0 && _act.value < 1 ? _actFrame(_act.value) : (0.0, 0.0, 1.0, 1.0);
        final t = _loopT.value;
        final phaseS = widget.phase * 0.12;
        final breathe = widget.breathe ? 1 + 0.028 * (0.5 - 0.5 * math.cos(2 * math.pi * (t + phaseS) / 3.6)) : 1.0;
        final sway = widget.sway ? 2 * math.pi / 180 * math.sin(2 * math.pi * (t + phaseS) / 6.4) : 0.0;
        return Transform.translate(
          offset: Offset(0, -lift),
          child: Transform(
            alignment: Alignment.bottomCenter,
            transform: Matrix4.identity()
              ..rotateZ(rot + sway)
              ..scaleByDouble(sx, sy * breathe, 1, 1),
            child: child,
          ),
        );
      },
      child: figure,
    );

    final stack = SizedBox(
      width: width,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          if (widget.shadow)
            Positioned(
              bottom: -size * 0.035,
              child: AnimatedBuilder(
                animation: _act,
                builder: (context, _) {
                  final (lift, _, _, _) = _act.value > 0 && _act.value < 1 ? _actFrame(_act.value) : (0.0, 0.0, 1.0, 1.0);
                  final k = (1 - lift / (size * 0.6)).clamp(0.55, 1.0);
                  return CustomPaint(
                    size: Size(width * 0.78, size * 0.085),
                    painter: _ShadowPainter(scale: k, night: c.isNight, dashed: widget.ghost),
                  );
                },
              ),
            ),
          Positioned.fill(child: RepaintBoundary(child: moving)),
        ],
      ),
    );

    Widget out = widget.ghost ? Opacity(opacity: 0.55, child: stack) : stack;
    final label = widget.semanticLabel;
    out = label == null ? ExcludeSemantics(child: out) : Semantics(label: label, image: true, child: ExcludeSemantics(child: out));
    return out;
  }

  Widget _image(BuildContext context, String path, FoldStill still, double side) {
    Widget img = Image.asset(
      path,
      width: side,
      height: side,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      gaplessPlayback: true,
      errorBuilder: (context, _, _) => const SizedBox.shrink(),
    );
    if (widget.locked) {
      final c = context.mmColors;
      final edge = c.isNight ? const Color(0xFF3A372F) : const Color(0xFFFFFDF8);
      img = Stack(
        fit: StackFit.expand,
        children: [
          // The 1 dp paper edge: the silhouette a hair larger, in paper.
          Transform.scale(scale: 1 + 2 / side, child: ColorFiltered(colorFilter: ColorFilter.mode(edge, BlendMode.srcIn), child: img)),
          ColorFiltered(colorFilter: ColorFilter.mode(c.ink4, BlendMode.srcIn), child: img),
        ],
      );
    }
    // The pose change cross-fades in 120 ms (spec 5.2), both stills on one stack.
    return MmOverlapSwitcher(
      duration: const Duration(milliseconds: 120),
      outDuration: const Duration(milliseconds: 120),
      fit: StackFit.expand,
      alignment: Alignment.center,
      child: KeyedSubtree(key: ValueKey('$path/${widget.locked}'), child: img),
    );
  }

  Widget _fallback(BuildContext context) {
    final d = math.min(widget.size * 0.62, 56.0);
    final name = widget.fallbackName.trim();
    final initial = name.isEmpty ? '?' : String.fromCharCode(name.runes.first).toUpperCase();
    return SizedBox(
      width: math.max(d, widget.size * 0.62),
      height: widget.size,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Opacity(
          opacity: widget.ghost ? 0.55 : 1,
          child: ExcludeSemantics(
            child: Container(
              width: d,
              height: d,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: widget.locked ? context.mmColors.ink4 : MobColours.of(context, widget.fallbackColour), shape: BoxShape.circle),
              child: widget.locked
                  ? null
                  : Text(initial, style: context.mmType.label.copyWith(color: MobColours.inkOn(context), fontSize: d * 0.44, height: 1, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
      ),
    );
  }
}

class _LidPainter extends CustomPainter {
  _LidPainter(this.blink, this.eyes, this.colour) : super(repaint: blink);

  final Animation<double> blink;
  final List<Rect> eyes;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    // The eye scales y 1 -> 0.1 -> 1 over 120 ms: lids close from top and bottom to a 10% slit.
    final v = blink.value;
    if (v <= 0 || v >= 1) return;
    final k = math.sin(v * math.pi); // 0 -> 1 -> 0
    final closed = 0.9 * k;
    final paint = Paint()..color = colour;
    for (final e in eyes) {
      final r = Rect.fromLTWH(e.left * size.width, e.top * size.height, e.width * size.width, e.height * size.height).inflate(size.width * 0.004);
      final lid = r.height * closed / 2;
      final rr = Radius.circular(r.width * 0.3);
      canvas.drawRRect(RRect.fromRectAndCorners(Rect.fromLTWH(r.left, r.top, r.width, lid), bottomLeft: rr, bottomRight: rr), paint);
      canvas.drawRRect(RRect.fromRectAndCorners(Rect.fromLTWH(r.left, r.bottom - lid, r.width, lid), topLeft: rr, topRight: rr), paint);
    }
  }

  @override
  bool shouldRepaint(_LidPainter old) => old.eyes != eyes || old.colour != colour;
}

class _ShadowPainter extends CustomPainter {
  _ShadowPainter({required this.scale, required this.night, this.dashed = false});

  final double scale;
  final bool night;
  final bool dashed;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width * scale;
    final h = size.height * scale;
    final rect = Rect.fromCenter(center: size.center(Offset.zero), width: w, height: h);
    final colour = night ? const Color(0x2E000000) : const Color(0x1F3B2A12);
    if (dashed) {
      final p = Paint()
        ..color = colour.withValues(alpha: colour.a * 2.2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2;
      const n = 14;
      for (var i = 0; i < n; i++) {
        canvas.drawArc(rect, i * 2 * math.pi / n, math.pi / n, false, p);
      }
      return;
    }
    final p = Paint()
      ..color = colour
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, h * 0.25);
    canvas.drawOval(rect, p);
  }

  @override
  bool shouldRepaint(_ShadowPainter old) => old.scale != scale || old.night != night || old.dashed != dashed;
}

/// The foil edge (spec 0.4 "Finishes"): a warm lamp band crossing the figure once every 3.6 s while the
/// room is awake. A gradient mask, so the Lite tier and the shader-free path look the same.
class _FoilSheen extends StatelessWidget {
  const _FoilSheen({required this.t, required this.child});

  final ValueListenable<double> t;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: t,
      child: child,
      builder: (context, v, child) {
        final p = (v % 3.6) / 3.6;
        final x = -1.4 + p * 2.8;
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (r) => LinearGradient(
            begin: Alignment(x - 0.5, -1),
            end: Alignment(x + 0.5, 1),
            colors: const [Color(0x00F2B865), Color(0x66F2B865), Color(0x00F2B865)],
          ).createShader(r),
          child: child,
        );
      },
    );
  }
}
