// FoldPuppet (spec 5.2, technique C): one still per pose, moved around the still. Cheap by design:
// every move is a transform on its own RepaintBoundary, pivoted at the boots; the blink is a
// visor-coloured lid painted over each eye box from folds.json; a pose change cross-fades in 120 ms
// on the squash low point. No Rive, no image sequence.
//
// Loops (breathe in the den, sway in the lobby, blink everywhere) stop 12 s after the last touch
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

export 'fold_acts.dart';

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
    this.look,
    this.acting = false,
  });

  /// Null draws the member's initial disc (an old account with no Fold yet).
  final FoldKey? fold;

  /// The figure's height in dp (boots to top); the width follows the art.
  final double size;
  final FoldPose pose;

  /// Den only: scaleY 1 to 1.028 on a 3600 ms sweep, offset 600 ms per [phase] (MOB-MINIMAL 4.2).
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

  /// A glance an act asks for, -1 (left) .. 1 (right): the den's others turning toward a newcomer (4.2). Its size is
  /// how far the eyes go; the Fold's own idle glance fades out under it, so the eyes never jump. Null: idle glances only.
  final Animation<double>? look;

  /// A den act is playing (4.2): no micro-act and no idle glance starts until it ends, so the act's own poses and
  /// glances read clean.
  final bool acting;

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
  late final AnimationController _blink = AnimationController(vsync: this, duration: const Duration(milliseconds: 150));

  /// The glance: -1 (left) .. 0 .. 1 (right), moving the eyes' contents inside their windows (4.1, 4.2).
  late final AnimationController _glance = AnimationController(vsync: this, lowerBound: -1, upperBound: 1, value: 0);
  Timer? _glanceTimer;
  Timer? _glanceHold;
  Timer? _thinkTimer;
  Timer? _microTimer;

  /// One Fold at a time across the den: the last glance and the last micro-act (4.2).
  static DateTime _lastGlance = DateTime.fromMillisecondsSinceEpoch(0);
  static DateTime _lastMicro = DateTime.fromMillisecondsSinceEpoch(0);
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
    // An act's pose (a wave, a cheer) wins over an idle think that happened to be showing.
    if (widget.pose != old.pose && widget.pose != FoldPose.idle && _playing == FoldAct.none && _poseOverride == FoldPose.think) {
      _thinkTimer?.cancel();
      _poseOverride = null;
    }
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
      _glanceTimer ??= _scheduleGlance();
    } else {
      _blinkTimer?.cancel();
      _blinkTimer = null;
      _glanceTimer?.cancel();
      _glanceTimer = null;
      if (_glance.value != 0) _glance.value = 0;
    }
    // Micro-acts only where the Fold idles (the den breathes): a 3 degree nod or a 1.6 s think, one Fold at a time,
    // every 10 to 16 s. They stop with the other loops (12 s after the last touch, under a sheet, hidden, reduced motion).
    if (on && widget.breathe) {
      _microTimer ??= _scheduleMicro();
    } else {
      _microTimer?.cancel();
      _microTimer = null;
    }
  }

  /// A glance: 160 ms out by 1 to 2.5 dp, a 0.7 to 1.2 s hold, 160 ms back; every 8 to 14 s, never two Folds at once.
  Timer _scheduleGlance() => Timer(Duration(milliseconds: 8000 + _rng.nextInt(6000)), () async {
        _glanceTimer = null;
        if (!mounted || !_loopsWanted) return;
        final now = DateTime.now();
        if (now.difference(_lastGlance).inMilliseconds > 1800 && _playing == FoldAct.none && !widget.acting) {
          _lastGlance = now;
          final dir = _rng.nextBool() ? 1.0 : -1.0;
          try {
            await _glance.animateTo(dir, duration: const Duration(milliseconds: 160), curve: Motion.out).orCancel;
          } on TickerCanceled {
            return;
          }
          if (!mounted) return;
          _glanceHold = Timer(Duration(milliseconds: 700 + _rng.nextInt(500)), () {
            if (mounted) _glance.animateTo(0, duration: const Duration(milliseconds: 160), curve: Motion.inOut);
          });
        }
        if (mounted && _loopsWanted) _glanceTimer ??= _scheduleGlance();
      });

  Timer _scheduleMicro() => Timer(Duration(milliseconds: 10000 + _rng.nextInt(6000)), () {
        _microTimer = null;
        if (!mounted || !_loopsWanted) return;
        final now = DateTime.now();
        if (now.difference(_lastMicro).inMilliseconds > 4000 && _playing == FoldAct.none && widget.act == FoldAct.none && !widget.acting) {
          _lastMicro = now;
          final art = foldManifestOf(ref)?[widget.fold];
          final canThink = art?.poses.containsKey(FoldPose.think) ?? false;
          if (canThink && widget.pose == FoldPose.idle && _rng.nextBool()) {
            setState(() => _poseOverride = FoldPose.think);
            _thinkTimer?.cancel();
            _thinkTimer = Timer(const Duration(milliseconds: 1600), () {
              if (mounted && _playing == FoldAct.none && _poseOverride == FoldPose.think) setState(() => _poseOverride = null);
            });
          } else {
            _fire(FoldAct.nod);
          }
        }
        _microTimer = _scheduleMicro();
      });

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
    _glanceTimer?.cancel();
    _glanceHold?.cancel();
    _thinkTimer?.cancel();
    _microTimer?.cancel();
    _glance.dispose();
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
                child: EyeWindows(
                  path: path,
                  eyes: still.eyes,
                  visor: still.visorColour ?? const Color(0xFF16151A),
                  side: side,
                  blink: _blink,
                  glance: widget.look == null ? _glance : _LookOver(idle: _glance, look: widget.look!),
                  reach: (size / 80).clamp(1.0, 2.5),
                ),
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
        // 4.2 (DenLife): each member breathes 600 ms after the one before, so the room never breathes in sync.
        final breathe = widget.breathe ? 1 + 0.028 * (0.5 - 0.5 * math.cos(2 * math.pi * (t + widget.phase * 0.6) / 3.6)) : 1.0;
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

/// An act's glance over the idle one: as the act's look grows (0 to 1 in size), the idle glance fades out under it, so
/// a Fold mid idle-glance turns smoothly toward the newcomer and back, never with a jump.
class _LookOver extends CompoundAnimation<double> {
  _LookOver({required Animation<double> idle, required Animation<double> look}) : super(first: idle, next: look);

  @override
  double get value {
    final l = next.value.clamp(-1.0, 1.0);
    return first.value * (1 - l.abs()) + l;
  }
}

/// Eye windows (MOB-MINIMAL 4.1): each eye box from folds.json is a rounded window that redraws that eye from the
/// same still. Moving the window's content [reach] dp is a glance; squashing it to 8% for 150 ms is a blink of the real
/// eye shape. The window is the eye box widened by [reach] + 1 dp on each side, so a glance moves the eye inside the
/// window and never cuts it. Behind the squashing eye a soft, feathered lid in the visor colour covers only the eye's
/// own pixels (an eye-shaped rounded patch, never a hard box). Draws nothing while the eyes rest (no cost at idle).
class EyeWindows extends StatelessWidget {
  const EyeWindows({super.key, required this.path, required this.eyes, required this.visor, required this.side, required this.blink, required this.glance, this.reach = 1.5});

  final String path;

  /// Normalised to the still's square.
  final List<Rect> eyes;
  final Color visor;
  final double side;
  final Animation<double> blink;
  final Animation<double> glance;
  final double reach;

  /// The eye's height factor at blink progress [v]: 1 -> 0.08 -> 1.
  static double openness(double v) => v <= 0 || v >= 1 ? 1 : 1 - 0.92 * math.sin(v * math.pi);

  /// The window for eye box [eye] (already in dp): widened by [reach] + 1 dp on each side.
  static Rect windowFor(Rect eye, double reach) => Rect.fromLTRB(eye.left - reach - 1, eye.top, eye.right + reach + 1, eye.bottom);

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: Listenable.merge([blink, glance]),
        builder: (context, _) {
          final open = openness(blink.value);
          final dx = glance.value * reach;
          if (open >= 1 && dx.abs() < 0.01) return const SizedBox.shrink();
          return Stack(
            clipBehavior: Clip.none,
            children: [
              for (final n in eyes) ...[
                // The lid: an eye-shaped feathered patch over the eye's own pixels (and its soft rim), so neither a
                // blink nor a glance leaves a ghost of the resting eye.
                Positioned(
                    left: n.left * side - 2.5,
                    top: n.top * side - 2.5,
                    width: n.width * side + 5,
                    height: n.height * side + 5,
                    child: CustomPaint(painter: _LidPatchPainter(visor)),
                  ),
                Builder(builder: (context) {
                  final eye = Rect.fromLTWH(n.left * side, n.top * side, n.width * side, n.height * side);
                  final w = windowFor(eye, reach);
                  return Positioned(
                    left: w.left,
                    top: w.top,
                    width: w.width,
                    height: w.height,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(math.min(w.width, w.height) / 2),
                      clipBehavior: Clip.antiAlias,
                      // The window's content is the still itself (shifted for a glance), squashed about the eye's centre
                      // for a blink, so only the eye and its own visor fold to the slit.
                      child: Transform(
                        transform: Matrix4.diagonal3Values(1, open, 1),
                        origin: Offset(w.width / 2, w.height / 2),
                        // Cut the window out first, then squash it, so only the eye and its own visor fold to the slit.
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(math.min(w.width, w.height) / 2),
                          clipBehavior: Clip.antiAlias,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Positioned(
                                left: -w.left + dx,
                                top: -w.top,
                                width: side,
                                height: side,
                                child: Image.asset(path, width: side, height: side, fit: BoxFit.contain, filterQuality: FilterQuality.medium, gaplessPlayback: true, errorBuilder: (context, _, _) => const SizedBox.shrink()),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ],
          );
        },
      );
}

/// The lid behind a blinking eye: an eye-shaped rounded patch in the visor colour, its edge feathered so it never
/// reads as a box.
class _LidPatchPainter extends CustomPainter {
  _LidPatchPainter(this.visor);
  final Color visor;

  @override
  void paint(Canvas canvas, Size size) {
    final r = (Offset.zero & size).deflate(0.5);
    final paint = Paint()
      ..color = visor
      ..isAntiAlias = true
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.8);
    canvas.drawRRect(RRect.fromRectAndRadius(r, Radius.circular(math.min(r.width, r.height) / 2)), paint);
  }

  @override
  bool shouldRepaint(_LidPatchPainter old) => old.visor != visor;
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
