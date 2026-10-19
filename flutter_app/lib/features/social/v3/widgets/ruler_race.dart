// The race view (MOB-BUILD-SPEC-V3 0.3 call 1, 5.3 R1, 5.6 M4, M6, M6b): Live's paper ruler on a
// lamp-lit desk, with full-body Folds walking it question by question. A 160 dp paper card:
// - one painter draws the wall, the graph paper, the lamp pool, the ruler with its numbers 1 to n
//   (yours filled in ink as you answer) and the flag pole at the end;
// - each Fold stands over the number of the question it is on, on its own RepaintBoundary, with its
//   name above (initials and a colour tab when 5 race, where Folds drop to 48 dp);
// - two Folds on one number stand in depth: the later arrival 10 dp up, at 0.86 and 70% brightness,
//   behind and a little aside;
// - ghosts (recorded runs) are drawn at 55% with a dashed shadow (FoldPuppet ghost);
// - a step glides 300 ms with a 6 dp hop; a Fold reaching the flag (M6) glides there, its last
//   number fills in its colour, it hops and lands with a squash, the ruler holds still for 70 ms at
//   the contact frame (hit-stop), then a paper pennant in its colour rises from the pole with 8 paper
//   bits, and [RulerRace.onFinishToast] fires for the toast.
// It never shows a pick, a mark or anyone's right or wrong: only where everyone is.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';
import 'fold_puppet.dart';
import 'mob_fx.dart';
import 'paper_particles.dart';
import 'run_paper.dart';

/// One Fold on the ruler.
class RulerRacer {
  const RulerRacer({
    required this.id,
    required this.name,
    this.fold,
    this.colour = 0,
    this.you = false,
    this.ghost = false,
    this.at = 1,
    this.arrivedMs = 0,
    this.finished = false,
  });

  final String id;
  final String name;
  final FoldKey? fold;
  final int colour;
  final bool you;
  final bool ghost;

  /// The question number the Fold stands over (1 to count). Ignored once [finished].
  final int at;

  /// When it reached where it stands (run time, ms): on a shared number the later arrival stands
  /// behind.
  final int arrivedMs;

  /// At the flag.
  final bool finished;
}

/// Geometry of the card, shared by the painter and the Folds.
class _Geo {
  _Geo(this.width, this.count);

  final double width;
  final int count;

  static const double height = 160;
  static const double rulerTop = 118;
  static const double rulerHeight = 22;
  static const double side = 12;

  double get poleX => width - 34;
  double get poleTop => 6;
  static const double boots = rulerTop + 3;

  double numberX(int i) {
    final a = side + 18;
    final b = poleX - 56;
    if (count <= 1) return (a + b) / 2;
    return a + (i.clamp(1, count) - 1) * (b - a) / (count - 1);
  }

  /// Where a Fold that reached the flag stands: at the pole, which stands behind it.
  double get flagStandX => poleX - 2;

  double slotX(int slot) => slot > count ? flagStandX : numberX(slot);
}

/// Depth on a shared number (spec 0.3, R1; walk H4). Row 0 is the earliest arrival, in front at full
/// size. Row 1 (second and third arrivals) stands 10 dp up at 0.86 and 70% brightness; row 2 (fourth
/// and fifth) 18 dp up at 0.76 and 60%. Later arrivals step aside, right then left, by about half a
/// Fold, so each one shows a face.
abstract final class RulerDepth {
  static int row(int k) => k == 0 ? 0 : (k <= 2 ? 1 : 2);
  static double scale(int row) => const [1.0, 0.86, 0.76][row.clamp(0, 2)];
  static double brightness(int row) => const [1.0, 0.7, 0.6][row.clamp(0, 2)];
  static double up(int row) => const [0.0, 10.0, 18.0][row.clamp(0, 2)];

  /// The widest a Fold may be, as a share of its height (wide arms are drawn smaller).
  static const double maxAspect = 1.0;

  /// The sideways step of the k-th arrival, as a share of the Fold size. At the flag everyone
  /// steps back left of the pole.
  static double aside(int k, {bool atFlag = false}) {
    const around = [0.0, 0.5, -0.5, 0.9, -0.9];
    const flag = [0.0, -0.45, -0.85, -1.2, -1.5];
    return (atFlag ? flag : around)[k.clamp(0, 4)];
  }
}

class RulerRace extends StatefulWidget {
  const RulerRace({
    super.key,
    required this.count,
    required this.racers,
    this.answered = 0,
    this.youAct = FoldAct.none,
    this.youActId = 0,
    this.onFinishToast,
    this.instant = false,
  });

  final int count;
  final List<RulerRacer> racers;

  /// How many questions you have answered: numbers 1 to [answered] are filled in ink.
  final int answered;

  /// One-shot acts on your Fold (nod on lock-in, cheer on right, tilt on not this one).
  final FoldAct youAct;
  final int youActId;

  /// Called when a ghost's toast should slide in (M6 at about 570 ms; at once in reduced motion).
  final ValueChanged<RulerRacer>? onFinishToast;

  /// Places everyone with no animation (a resumed run: the Folds reappear where they are).
  final bool instant;

  static const double height = _Geo.height;

  /// 5 players compact the ruler: 48 dp Folds and initials (spec 0.3).
  static bool compactFor(int racers) => racers >= 5;

  @override
  State<RulerRace> createState() => _RulerRaceState();
}

enum _MoveKind { none, step, finish }

class _Track {
  _Track(this.slot, this.controller);

  int slot;
  int from = 0;
  _MoveKind kind = _MoveKind.none;
  final AnimationController controller;
  bool toastSent = true;
  bool burstSent = true;

  double get ms => controller.value * (controller.duration?.inMilliseconds ?? 0);
}

class _Pennant {
  _Pennant({required this.id, required this.colour, required this.ghost, required this.controller});

  final String id;
  final int colour;
  final bool ghost;

  /// Reduced motion: a 120 ms fade instead of the pop.
  bool fade = false;

  /// 0 to 1 over the pop (iconPop 280; reduced: a 120 ms fade). Null = already up (no animation).
  final AnimationController controller;
}

/// The M6 finish timeline (ms), with the 70 ms hit-stop at the landing.
abstract final class RulerFinish {
  static const double glide = 300;
  static const double fillAt = 120;
  static const double fillLen = 160;
  static const double hopStart = 240;
  static const double contact = 420;
  static const double hitStop = 70;
  static const double release = contact + hitStop;
  static const double squashLen = 90;
  static const double pennantLen = 280;
  static const double toastAt = 570;
  static const double total = 900;

  static final SpringSimulation _pop = SpringSimulation(Springs.iconPop, 0, 1, 0);

  /// The pennant's height share at [ms] since it started rising (iconPop, with its overshoot).
  static double pennant(double ms) => ms <= 0 ? 0 : _pop.x(ms / 1000).clamp(0.0, 1.15);

  /// (x share 0 to 1, lift dp, squash 0 to 1) at [ms].
  static ({double x, double lift, double squash}) frame(double ms) {
    final x = Motion.glide.transform((ms / glide).clamp(0.0, 1.0));
    double lift = 0;
    if (ms > hopStart && ms < contact) lift = 14 * math.sin(math.pi * (ms - hopStart) / (contact - hopStart));
    double squash = 0;
    if (ms >= contact && ms <= release) {
      squash = 1; // the hit-stop: the contact frame holds still
    } else if (ms > release && ms < release + squashLen) {
      squash = 1 - (ms - release) / squashLen;
    }
    return (x: x, lift: lift, squash: squash);
  }
}

class _RulerRaceState extends State<RulerRace> with TickerProviderStateMixin {
  final Map<String, _Track> _tracks = {};
  final List<_Pennant> _pennants = [];
  final Map<String, AnimationController> _fills = {};
  final PaperParticlesController _bits = PaperParticlesController();
  _Geo? _geo;

  bool get _reduced => MobFx.reduced(context);

  int _slotOf(RulerRacer r) => r.finished ? widget.count + 1 : r.at.clamp(1, widget.count);

  @override
  void initState() {
    super.initState();
    for (final r in widget.racers) {
      _tracks[r.id] = _newTrack(r);
      if (r.finished) _addPennant(r, animate: false);
    }
  }

  _Track _newTrack(RulerRacer r) {
    final t = _Track(_slotOf(r), AnimationController(vsync: this, value: 1));
    t.controller.addListener(() => _onTrack(r.id, t));
    return t;
  }

  void _onTrack(String id, _Track t) {
    if (t.kind != _MoveKind.finish) return;
    final r = widget.racers.where((x) => x.id == id).firstOrNull;
    final geo = _geo;
    if (r == null || geo == null) return;
    _finishCues(r, t, geo);
  }

  void _addPennant(RulerRacer r, {required bool animate}) {
    if (_pennants.any((p) => p.id == r.id)) return;
    final c = AnimationController(vsync: this, duration: const Duration(milliseconds: 420), value: animate ? 0 : 1);
    c.addListener(_tick);
    _pennants.add(_Pennant(id: r.id, colour: r.colour, ghost: r.ghost, controller: c));
    final fill = AnimationController(vsync: this, duration: const Duration(milliseconds: 160), value: animate ? 0 : 1)..addListener(_tick);
    _fills[r.id] = fill;
  }

  void _tick() {
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(RulerRace old) {
    super.didUpdateWidget(old);
    final ids = {for (final r in widget.racers) r.id};
    for (final id in [..._tracks.keys]) {
      if (!ids.contains(id)) _tracks.remove(id)?.controller.dispose();
    }
    for (final r in widget.racers) {
      final slot = _slotOf(r);
      final t = _tracks[r.id];
      if (t == null) {
        _tracks[r.id] = _newTrack(r);
        if (r.finished) _addPennant(r, animate: false);
        continue;
      }
      if (t.slot == slot) continue;
      final jump = widget.instant || _reduced;
      t.from = t.slot;
      t.slot = slot;
      if (r.finished) {
        _addPennant(r, animate: !widget.instant);
        if (jump) {
          t.kind = _MoveKind.none;
          t.controller.value = 1;
          final p = _pennants.firstWhere((p) => p.id == r.id);
          final fill = _fills[r.id]!;
          if (widget.instant) {
            p.controller.value = 1;
            fill.value = 1;
          } else {
            // Reduced motion: the pennant and the toast fade in over 120 ms; nothing hops.
            fill.value = 1;
            p.fade = true;
            p.controller.duration = Motion.reducedFade;
            p.controller.forward(from: 0);
            // After this frame: didUpdateWidget runs inside the parent's build, and the toast sets state there.
            if (r.ghost) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) widget.onFinishToast?.call(r);
              });
            }
          }
          continue;
        }
        t.kind = _MoveKind.finish;
        t.toastSent = !r.ghost;
        t.burstSent = false;
        t.controller
          ..duration = const Duration(milliseconds: 900)
          ..forward(from: 0);
        continue;
      }
      if (jump) {
        t.kind = _MoveKind.none;
        t.controller.value = 1;
        continue;
      }
      t.kind = _MoveKind.step;
      t.controller
        ..duration = MobBeat.halfBeat
        ..forward(from: 0);
    }
  }

  @override
  void dispose() {
    for (final t in _tracks.values) {
      t.controller.dispose();
    }
    for (final p in _pennants) {
      p.controller.dispose();
    }
    for (final f in _fills.values) {
      f.dispose();
    }
    _bits.dispose();
    super.dispose();
  }

  /// Side effects of the finish timeline that happen at fixed times (fill, pennant, bits, toast).
  void _finishCues(RulerRacer r, _Track t, _Geo geo) {
    final ms = t.ms;
    final fill = _fills[r.id];
    if (fill != null && ms >= RulerFinish.fillAt && fill.value == 0 && !fill.isAnimating) fill.forward();
    final pen = _pennants.where((p) => p.id == r.id).firstOrNull;
    if (pen != null && ms >= RulerFinish.release && pen.controller.value == 0 && !pen.controller.isAnimating) {
      pen.controller.forward(from: 0);
    }
    if (!t.burstSent && ms >= RulerFinish.release) {
      t.burstSent = true;
      final n = MobFx.particles(context, 8);
      if (n > 0) {
        final i = _pennants.indexWhere((p) => p.id == r.id);
        _bits.burst(PaperBurst(
          origin: Offset(geo.poleX + 10, geo.poleTop + 7 + 15.0 * math.max(0, i)),
          count: n,
          speed: 170,
          spread: math.pi * 0.8,
          floorY: _Geo.rulerTop - 2,
          colours: [MobColours.of(context, r.colour), RunPaper.of(context).paper, const Color(0xFFF2A93B)],
          seed: r.id.hashCode & 0xffff,
        ));
      }
    }
    if (!t.toastSent && ms >= RulerFinish.toastAt) {
      t.toastSent = true;
      widget.onFinishToast?.call(r);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final geo = _Geo(box.maxWidth, widget.count);
        _geo = geo;
        final listenables = <Listenable>[for (final t in _tracks.values) t.controller];
        return SizedBox(
          height: _Geo.height,
          child: ClipRRect(
            borderRadius: MmRadius.panelAll,
            child: AnimatedBuilder(
              animation: Listenable.merge(listenables),
              builder: (context, _) => _card(context, geo),
            ),
          ),
        );
      },
    );
  }

  Widget _card(BuildContext context, _Geo geo) {
    final colors = context.mmColors;
    final paper = RunPaper.of(context);
    final compact = RulerRace.compactFor(widget.racers.length);
    final base = compact ? 48.0 : 64.0;
    final manifest = FoldManifest.cached;

    // Depth groups by the slot each Fold stands in (or is heading to).
    final groups = <int, List<RulerRacer>>{};
    for (final r in widget.racers) {
      groups.putIfAbsent(_tracks[r.id]?.slot ?? _slotOf(r), () => []).add(r);
    }
    final depth = <String, int>{};
    for (final g in groups.values) {
      g.sort((a, b) {
        final c = a.arrivedMs.compareTo(b.arrivedMs);
        if (c != 0) return c;
        if (a.you != b.you) return a.you ? -1 : 1;
        return a.id.compareTo(b.id);
      });
      for (var i = 0; i < g.length; i++) {
        depth[g[i].id] = i;
      }
    }

    // Each group (Folds on one number) stands like a group photo: the earliest arrival in front at
    // full size; later arrivals step back (10 dp up, 0.86, 70% brightness; a fourth and fifth one
    // more row back) and aside, alternating right and left by about half a Fold, so every Fold
    // shows a face. A group that would cross the card's edge shifts in whole, so nobody stacks on
    // one spot at the edge (H4).
    final placed = <_Placed>[];
    final byGroup = <int, List<_Placed>>{};
    for (final r in widget.racers) {
      final t = _tracks[r.id]!;
      final k = depth[r.id] ?? 0;
      final row = RulerDepth.row(k);
      final scale = RulerDepth.scale(row);
      // A wide Fold (arms out) is drawn smaller so it is never wider than the others (Hop, H4).
      final natural = FoldPuppet.widthFor(manifest, r.fold, base);
      final fit = natural > base * RulerDepth.maxAspect ? base * RulerDepth.maxAspect / natural : 1.0;
      final size = base * scale * fit;
      final w = FoldPuppet.widthFor(manifest, r.fold, size);
      final atFlag = t.slot > widget.count;
      final aside = RulerDepth.aside(k, atFlag: atFlag) * base;
      double x;
      var lift = 0.0;
      var squash = 0.0;
      final toX = geo.slotX(t.slot) + aside;
      switch (t.kind) {
        case _MoveKind.step:
          final p = t.controller.value;
          final fromX = geo.slotX(t.from) + aside;
          x = fromX + (toX - fromX) * Motion.glide.transform(p);
          lift = 6 * math.sin(math.pi * p);
        case _MoveKind.finish:
          final f = RulerFinish.frame(t.ms);
          final fromX = geo.slotX(t.from) + aside;
          x = fromX + (toX - fromX) * f.x;
          lift = f.lift;
          squash = f.squash;
        case _MoveKind.none:
          x = toX;
      }
      final pl = _Placed(racer: r, depth: row, x: x, size: size, width: w, lift: lift, squash: squash);
      placed.add(pl);
      byGroup.putIfAbsent(t.slot, () => []).add(pl);
    }
    final lo = _Geo.side + 2.0;
    final hi = geo.width - _Geo.side - 2.0;
    for (final g in byGroup.values) {
      var left = double.infinity;
      var right = -double.infinity;
      for (final p in g) {
        left = math.min(left, p.x - p.width / 2);
        right = math.max(right, p.x + p.width / 2);
      }
      var shift = 0.0;
      if (left < lo) shift = lo - left;
      if (right + shift > hi) shift = hi - right;
      if (shift != 0) {
        for (final p in g) {
          p.x += shift;
        }
      }
    }

    // Paint order: the back row first.
    placed.sort((a, b) => b.depth.compareTo(a.depth));

    // Names above, pushed apart so no two ever overlap.
    final labels = _layoutLabels(context, placed, geo, compact);

    final fills = <int, Color>{};
    for (final p in _pennants) {
      if (!p.ghost) continue;
      final f = _fills[p.id];
      if (f == null || f.value <= 0) continue;
      fills[widget.count] = Color.lerp(paper.paper, MobColours.of(context, p.colour), f.value)!;
    }

    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: RepaintBoundary(
            child: CustomPaint(
              painter: _RulerPainter(
                count: widget.count,
                answered: widget.answered,
                fills: fills,
                paper: paper,
                night: colors.isNight,
                line: colors.line,
                pennants: _pennants.isNotEmpty,
              ),
            ),
          ),
        ),
        for (final p in placed) _fold(context, p),
        for (final l in labels) l,
        for (var i = 0; i < _pennants.length; i++) _pennant(context, geo, i),
        Positioned.fill(child: IgnorePointer(child: PaperParticles(controller: _bits))),
      ],
    );
  }

  Widget _fold(BuildContext context, _Placed p) {
    final r = p.racer;
    final top = _Geo.boots - p.size - RulerDepth.up(p.depth);
    final sx = 1 + (MobBeat.squashX - 1) * p.squash;
    final sy = 1 - (1 - MobBeat.squashY) * p.squash;
    return Positioned(
      key: ValueKey('ruler-fold-${r.id}'),
      left: p.x - p.width / 2,
      top: top - p.lift,
      width: p.width,
      height: p.size,
      child: RepaintBoundary(
        child: Transform(
          alignment: Alignment.bottomCenter,
          transform: Matrix4.diagonal3Values(sx, sy, 1),
          child: FoldPuppet(
            key: ValueKey('ruler-puppet-${r.id}'),
            fold: r.fold,
            size: p.size,
            phase: r.colour,
            ghost: r.ghost,
            brightness: RulerDepth.brightness(p.depth),
            act: r.you ? widget.youAct : FoldAct.none,
            actId: r.you ? widget.youActId : 0,
            pose: r.finished && !r.ghost ? FoldPose.cheer : FoldPose.idle,
            fallbackName: r.name,
            fallbackColour: r.colour,
            semanticLabel: r.finished
                ? MobV3Copy.rulerDone(r.you ? MobV3Copy.tabYou : r.name)
                : MobV3Copy.rulerAt(r.you ? MobV3Copy.tabYou : r.name, r.at.clamp(1, widget.count), widget.count),
          ),
        ),
      ),
    );
  }

  /// Names sit in one row above every Fold, pushed apart so no two ever touch, each tied to its
  /// Fold's head by a short hairline (a name tag on a string). One row means a name never lands on
  /// another Fold's head (walk H4).
  List<Widget> _layoutLabels(BuildContext context, List<_Placed> placed, _Geo geo, bool compact) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final style = type.label.copyWith(fontWeight: FontWeight.w700, color: colors.ink);
    final items = <({_Placed p, String text, double w, double h})>[];
    for (final p in placed) {
      final name = p.racer.name.trim();
      final text = p.racer.you ? MobV3Copy.tabYou : (compact ? (name.isEmpty ? '?' : name.characters.first.toUpperCase()) : name);
      final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler)..layout();
      final extra = compact && !p.racer.you ? 10.0 : 0.0;
      items.add((p: p, text: text, w: tp.width + extra + 8, h: tp.height));
      tp.dispose();
    }
    if (items.isEmpty) return const [];
    final rows = RulerLabels.layout(
      [for (final it in items) (x: it.p.x, w: it.w)],
      minLeft: _Geo.side - 2,
      maxRight: geo.poleX - 4,
    );
    final labelH = items.map((e) => e.h).reduce(math.max);
    final base = compact ? 48.0 : 64.0;
    // The row sits above the highest head (row 2 standing back), with room for the string.
    final maxUp = placed.map((p) => RulerDepth.up(p.depth)).reduce(math.max);
    final rowTop = math.max(2.0, _Geo.boots - base - maxUp - labelH - 10);
    final strings = <({Offset from, Offset to, bool ghost})>[];
    final out = <Widget>[];
    for (var i = 0; i < items.length; i++) {
      final it = items[i];
      final p = it.p;
      final left = rows[i];
      final ghost = p.racer.ghost;
      final headTop = _Geo.boots - p.size - RulerDepth.up(p.depth) - p.lift + p.size * 0.08;
      strings.add((from: Offset(left + it.w / 2, rowTop + labelH + 1), to: Offset(p.x, headTop), ghost: ghost));
      Widget text = Text(
        it.text,
        maxLines: 1,
        softWrap: false,
        style: style.copyWith(color: ghost ? colors.ink2 : colors.ink),
      );
      if (compact && !p.racer.you) {
        text = Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 4, height: 12, decoration: BoxDecoration(color: MobColours.of(context, p.racer.colour), borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 3),
            text,
          ],
        );
      }
      out.add(Positioned(
        key: ValueKey('ruler-name-${p.racer.id}'),
        left: left,
        top: rowTop,
        width: it.w,
        child: ExcludeSemantics(child: Center(child: text)),
      ));
    }
    return [
      Positioned.fill(
        child: IgnorePointer(child: CustomPaint(painter: _StringPainter(strings: strings, colour: colors.ink3))),
      ),
      ...out,
    ];
  }

  Widget _pennant(BuildContext context, _Geo geo, int i) {
    final p = _pennants[i];
    final colour = MobColours.of(context, p.colour);
    final reduced = _reduced;
    final v = p.controller.value;
    final ms = v * (p.controller.duration?.inMilliseconds ?? 420);
    final fade = reduced || p.fade;
    final share = fade ? 1.0 : (v >= 1 ? 1.0 : RulerFinish.pennant(ms));
    final opacity = fade ? v : (v > 0 ? 1.0 : 0.0);
    return Positioned(
      key: ValueKey('ruler-pennant-${p.id}'),
      left: geo.poleX + 1,
      top: geo.poleTop + 15.0 * i,
      width: 22,
      height: 14,
      child: IgnorePointer(
        child: Opacity(
          opacity: opacity.clamp(0.0, 1.0),
          child: Transform(
            alignment: Alignment.centerLeft,
            transform: Matrix4.diagonal3Values(share.clamp(0.0, 1.2), 1, 1),
            child: CustomPaint(painter: _PennantPainter(colour: colour)),
          ),
        ),
      ),
    );
  }
}

class _Placed {
  _Placed({required this.racer, required this.depth, required this.x, required this.size, required this.width, required this.lift, required this.squash});

  final RulerRacer racer;
  final int depth;
  double x;
  final double size;
  final double width;
  final double lift;
  final double squash;
}

class _PennantPainter extends CustomPainter {
  const _PennantPainter({required this.colour});

  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cloth = Path()
      ..moveTo(0, 0)
      ..lineTo(w, 0)
      ..lineTo(w * 0.78, h / 2)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(cloth, Paint()..color = colour);
    // A paper fold down the middle and a soft edge, so it reads as paper, not a flat shape.
    canvas.drawLine(Offset(w * 0.42, 0), Offset(w * 0.42, h), Paint()
      ..color = const Color(0x22000000)
      ..strokeWidth = 1);
    canvas.drawPath(cloth, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8
      ..color = const Color(0x40000000));
  }

  @override
  bool shouldRepaint(_PennantPainter old) => old.colour != colour;
}

class _RulerPainter extends CustomPainter {
  _RulerPainter({required this.count, required this.answered, required this.fills, required this.paper, required this.night, required this.line, required this.pennants});

  final int count;
  final int answered;
  final Map<int, Color> fills;
  final RunPaper paper;
  final bool night;
  final Color line;
  final bool pennants;

  @override
  void paint(Canvas canvas, Size size) {
    final geo = _Geo(size.width, count);
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..color = paper.wall);
    // Graph paper.
    final grid = Paint()
      ..color = paper.grid
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += 16) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (var y = 0.0; y < size.height; y += 16) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    // The lamp pool, from above the middle.
    final lampC = Offset(size.width * 0.5, -20);
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(colors: [paper.lampPool, paper.lampPool.withValues(alpha: 0)]).createShader(
          Rect.fromCenter(center: lampC, width: size.width * 1.1, height: 300),
        ),
    );

    // The paper ruler with its shadow and ticks every 8 dp.
    final band = RRect.fromRectAndRadius(Rect.fromLTWH(_Geo.side, _Geo.rulerTop, size.width - 2 * _Geo.side, _Geo.rulerHeight), const Radius.circular(5));
    canvas.drawRRect(band.shift(const Offset(0, 3)), Paint()
      ..color = const Color(0x55000000)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
    canvas.drawRRect(band, Paint()..color = paper.paper);
    final tick = Paint()
      ..color = paper.paperLine
      ..strokeWidth = 1;
    for (var x = _Geo.side + 6; x < size.width - _Geo.side - 4; x += 8) {
      final long = ((x - _Geo.side - 6) / 8).round() % 5 == 0;
      canvas.drawLine(Offset(x, _Geo.rulerTop), Offset(x, _Geo.rulerTop + (long ? 7 : 4)), tick);
    }

    // Numbers: answered ones filled in ink, a finisher's last number in their colour.
    final show = <int>{for (var i = 1; i <= count; i++) if (count <= 10 || i == 1 || i == count || i % 5 == 0 || i <= answered + 1 && i >= answered) i};
    for (final i in show) {
      final cx = geo.numberX(i);
      final label = '$i';
      final done = i <= answered;
      final fill = fills[i];
      final tp = TextPainter(
        text: TextSpan(
          text: label,
          style: TextStyle(fontFamily: MmFonts.hanken, fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w700, color: done || fill != null ? paper.doneTagInk : paper.paperInk2, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final w = math.max(22.0, tp.width + 10);
      final tag = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(cx, _Geo.rulerTop + _Geo.rulerHeight / 2), width: w, height: 16), const Radius.circular(5));
      if (fill != null) {
        canvas.drawRRect(tag, Paint()..color = fill);
      } else if (done) {
        canvas.drawRRect(tag, Paint()..color = paper.doneTag);
      }
      tp.paint(canvas, Offset(cx - tp.width / 2, _Geo.rulerTop + (_Geo.rulerHeight - tp.height) / 2));
      tp.dispose();
    }

    // The flag pole at the end; its cloth is a dashed outline until someone reaches it.
    final poleX = geo.poleX;
    canvas.drawLine(
      Offset(poleX, _Geo.rulerTop + 2),
      Offset(poleX, geo.poleTop),
      Paint()
        ..color = night ? const Color(0xFFA09989) : const Color(0xFF655F53)
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round,
    );
    if (!pennants) {
      // A blank paper flag waiting for the first finisher (walk L3: an empty dashed outline read as
      // missing art): paper cloth, a soft fold down the middle and a pencil edge.
      final cloth = Path()
        ..moveTo(poleX + 1, geo.poleTop)
        ..lineTo(poleX + 23, geo.poleTop)
        ..lineTo(poleX + 18, geo.poleTop + 7)
        ..lineTo(poleX + 23, geo.poleTop + 14)
        ..lineTo(poleX + 1, geo.poleTop + 14)
        ..close();
      canvas.drawPath(cloth, Paint()..color = paper.paper);
      canvas.drawLine(Offset(poleX + 10, geo.poleTop + 1), Offset(poleX + 10, geo.poleTop + 13), Paint()
        ..color = paper.paperLine
        ..strokeWidth = 1);
      canvas.drawPath(
        cloth,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = night ? const Color(0xFFA09989) : const Color(0xFF655F53),
      );
    }
    // The card's hairline edge.
    canvas.drawRRect(RRect.fromRectAndRadius(rect.deflate(0.5), const Radius.circular(MmRadius.panel)), Paint()
      ..style = PaintingStyle.stroke
      ..color = line);
  }

  @override
  bool shouldRepaint(_RulerPainter old) =>
      old.count != count || old.answered != answered || old.night != night || old.pennants != pennants || !_sameFills(old.fills, fills) || old.line != line;

  static bool _sameFills(Map<int, Color> a, Map<int, Color> b) {
    if (a.length != b.length) return false;
    for (final e in a.entries) {
      if (b[e.key] != e.value) return false;
    }
    return true;
  }
}

/// Lays name tags out in one row: each centred over its Fold, pushed right where two would touch,
/// then pulled back left from the limit. Returns each tag's left edge, in the input order.
abstract final class RulerLabels {
  static const double gap = 4;

  static List<double> layout(List<({double x, double w})> tags, {required double minLeft, required double maxRight}) {
    final order = [for (var i = 0; i < tags.length; i++) i]..sort((a, b) {
        final c = tags[a].x.compareTo(tags[b].x);
        return c != 0 ? c : a.compareTo(b);
      });
    final lefts = List<double>.filled(tags.length, 0);
    double? prevRight;
    for (final i in order) {
      var l = math.max(minLeft, tags[i].x - tags[i].w / 2);
      if (prevRight != null) l = math.max(l, prevRight + gap);
      lefts[i] = l;
      prevRight = l + tags[i].w;
    }
    double? nextLeft;
    for (final i in order.reversed) {
      final limit = nextLeft == null ? maxRight : nextLeft - gap;
      if (lefts[i] + tags[i].w > limit) lefts[i] = limit - tags[i].w;
      nextLeft = lefts[i];
    }
    return lefts;
  }
}

class _StringPainter extends CustomPainter {
  _StringPainter({required this.strings, required this.colour});

  final List<({Offset from, Offset to, bool ghost})> strings;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    for (final s in strings) {
      if (s.to.dy - s.from.dy < 3) continue;
      final paint = Paint()
        ..color = colour.withValues(alpha: s.ghost ? 0.45 : 0.7)
        ..strokeWidth = 1
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(s.from, s.to, paint);
      canvas.drawCircle(s.to, 1.5, Paint()..color = colour.withValues(alpha: s.ghost ? 0.45 : 0.7));
    }
  }

  @override
  bool shouldRepaint(_StringPainter old) => true;
}
