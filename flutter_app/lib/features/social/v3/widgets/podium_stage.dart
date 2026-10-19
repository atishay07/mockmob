// The podium reveal (MOB-BUILD-SPEC-V3 5.3 R7, 5.6 M7, the T4 tier): Live's staging (a hanging lamp
// whose cone narrows onto the plinths, "So far" while the game is open) with Arena's content (true
// order in every frame, shared places on plinths of the same height, the floor for 4th and 5th, the
// collective line, a visible Skip).
//
// One AnimationController drives the whole screen; every layer is a pure function of the elapsed
// milliseconds, so a frame at 1600 ms is the same frame every time, a Skip is the same timeline run
// to its end in 200 ms, and the order of marks is provable frame by frame (F10):
//
//   0-400     scrim to 35% and the lamp cone narrows to 62% (emphasized)
//   120       the header (game title, "So far" or "Final")
//   400       the collective line together with the floor members (marks static, never alone, F11)
//   1000      third unfolds (rotateX 90 to 0, perspective 0.0015, emphasized 420)
//   1600      second unfolds (shared places unfold together)
//   2200      first unfolds
//   +400      each Fold drops 60 dp (220, leave), lands at +620: squash 90 ms (FoldAct.land), settle,
//             10 paper bits stopped at the floor, light haptic (medium on first)
//   landing   marks roll up with countUp 720 from the marks of the place below
//   +280      the numeral engraves (280)
//   2820      first lands: the lamp swells to 60%, the foil sheen sweeps the plinth (sweep 700),
//             40 paper bits and 8 glints over 1400; 3240 the winner hops once (FoldAct.bigHop)
//   3700      the headline and the tie line
//   4200      keys rise; confirm haptic (the podium read is the server's ack)
//   4200-4800 the scrim clears
//
// The table (the podium switch off, or only you finished) lands everyone together with no places.
// Reduced motion: 120 ms fades 300 ms apart (third, second, first), about 1 s, no particles, no
// sheen, no squash. Lite: half the particles and a gradient mask instead of the shader.

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/key_button.dart';
import '../../../../core/widgets/pressable.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_puppet.dart';
import 'mob_fx.dart';
import 'paper_particles.dart';

// ---------------------------------------------------------------------------------------------------
// The plan: who stands where, and what each count rolls up from. Pure, so tests can read it.
// ---------------------------------------------------------------------------------------------------

enum PodiumLayout {
  /// Plinths with places, the floor beside them.
  stage,

  /// One paper table, everyone together, no places (switch off, or only you finished).
  table,
}

class PodiumPlan {
  PodiumPlan._({
    required this.layout,
    required this.onlyYou,
    required this.columns,
    required this.floor,
    required this.rollFrom,
  });

  factory PodiumPlan.of(Podium p) {
    final placed = [for (final x in p.places) if (!x.private && x.marks != null && x.place != null && !x.floor && x.place! <= 3) x];
    final floor = [for (final x in p.places) if (!placed.contains(x)) x];
    final onlyYou = p.places.length == 1 && p.places.first.you;
    if (!p.showPodium || onlyYou || placed.isEmpty) {
      return PodiumPlan._(layout: PodiumLayout.table, onlyYou: onlyYou, columns: List.unmodifiable(p.places), floor: const [], rollFrom: const {});
    }
    // Stage order: first in the middle, then left, right, left, right (Arena S14: You 2, Riya 1, Kabir 2).
    final sorted = [...placed]..sort((a, b) {
        final c = a.place!.compareTo(b.place!);
        if (c != 0) return c;
        if (a.you != b.you) return a.you ? -1 : 1;
        return 0;
      });
    final cols = <PodiumPlace>[];
    for (var i = 0; i < sorted.length; i++) {
      if (i == 0) {
        cols.add(sorted[i]);
      } else if (i.isOdd) {
        cols.insert(0, sorted[i]);
      } else {
        cols.add(sorted[i]);
      }
    }
    // Each place rolls up from the final marks of the place below it, so the order is true in every
    // frame (F10). The lowest stage place rolls from the highest floor mark, or 0.
    final places = {for (final x in placed) x.place!}.toList()..sort((a, b) => b.compareTo(a));
    final floorMarks = [for (final x in floor) if (x.marks != null && !x.private) x.marks!];
    var below = floorMarks.isEmpty ? 0 : floorMarks.reduce(math.max);
    final from = <String, int>{};
    for (final pl in places) {
      final members = placed.where((x) => x.place == pl).toList();
      final marks = members.first.marks!;
      final start = math.min(below, marks);
      for (final m in members) {
        from[m.memberId] = start;
      }
      below = marks;
    }
    return PodiumPlan._(layout: PodiumLayout.stage, onlyYou: false, columns: cols, floor: floor, rollFrom: from);
  }

  final PodiumLayout layout;
  final bool onlyYou;

  /// Left to right: the plinths (stage) or the Folds on the table (table, in time order).
  final List<PodiumPlace> columns;

  /// Floor members (place over 3) and private marks, beside the stage.
  final List<PodiumPlace> floor;

  /// memberId -> the count's starting value (stage only).
  final Map<String, int> rollFrom;

  bool get table => layout == PodiumLayout.table;

  /// 0 third, 1 second, 2 first.
  static int slotOf(int place) => (3 - place).clamp(0, 2);
}

// ---------------------------------------------------------------------------------------------------
// The timeline (ms)
// ---------------------------------------------------------------------------------------------------

abstract final class PodiumTimeline {
  static const double total = 4800;
  static const double tableTotal = 2300;
  static const double reducedTotal = 1020;
  static const double reducedTableTotal = 720;

  static const double scrimIn = 400;
  static const double header = 120;
  static const double collective = 400;
  static const List<double> slotStart = [1000, 1600, 2200];
  static const double dropAfter = 400;
  static const double landAfter = 620;
  static const double numeralAfterLanding = 280;
  static const double climax = 2820;
  static const double hop = 3240;
  static const double headline = 3700;
  static const double keys = 4200;
  static const double scrimOutEnd = 4800;

  static const double tableUnfold = 700;
  static const double tableDrop = 1100;
  static const double tableLand = 1320;
  static const double tableKeys = 1700;

  /// Reduced motion: third, second and first at 300, 600, 900; header, collective and floor at 0.
  static const List<double> reducedSlot = [300, 600, 900];

  static double land(int slot) => slotStart[slot] + landAfter;
}

double _seg(double ms, double start, double dur, [Curve curve = Curves.linear]) {
  if (dur <= 0) return ms >= start ? 1 : 0;
  return curve.transform(((ms - start) / dur).clamp(0.0, 1.0));
}

/// The foil sheen program (shaders/foil_sheen.frag), loaded once on the Mob's first podium. Never
/// throws; while it is not ready (or on Lite) a gradient mask stands in.
abstract final class FoilSheenProgram {
  static const String asset = 'shaders/foil_sheen.frag';

  /// Tests switch the shader off so goldens draw the deterministic mask.
  static bool enabled = true;
  static ui.FragmentProgram? _program;
  static Future<void>? _loading;

  static Future<void> precache() => _loading ??= _load();

  static Future<void> _load() async {
    if (!enabled) return;
    try {
      _program = await ui.FragmentProgram.fromAsset(asset);
    } on Object {
      _program = null;
    }
  }

  static bool get ready => enabled && _program != null;

  static ui.FragmentShader? newShader() => ready ? _program!.fragmentShader() : null;

  @visibleForTesting
  static void debugReset() {
    _program = null;
    _loading = null;
  }
}

// ---------------------------------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------------------------------

class PodiumStage extends StatefulWidget {
  const PodiumStage({
    super.key,
    required this.podium,
    required this.gameTitle,
    required this.now,
    this.onMoments,
    this.onRematch,
    this.onClose,
    this.autoplay = true,
  });

  final Podium podium;
  final String gameTitle;

  /// The server's clock, for "Places can change until 2:05 PM tomorrow."
  final DateTime now;
  final VoidCallback? onMoments;
  final VoidCallback? onRematch;
  final VoidCallback? onClose;

  /// False lands the end state at once (a podium seen before, or a test of the end state).
  final bool autoplay;

  @override
  State<PodiumStage> createState() => PodiumStageState();
}

class PodiumStageState extends State<PodiumStage> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  final PaperParticlesController _particles = PaperParticlesController();
  late PodiumPlan _plan = PodiumPlan.of(widget.podium);
  bool _started = false;
  bool _reduced = false;
  bool _skipping = false;
  bool _confirmed = false;
  double _lastMs = -1;
  final Map<String, int> _actIds = {};
  final Map<String, FoldAct> _acts = {};
  _Geometry? _geo;
  ui.FragmentShader? _shader;

  double get _total => _reduced ? (_plan.table ? PodiumTimeline.reducedTableTotal : PodiumTimeline.reducedTotal) : (_plan.table ? PodiumTimeline.tableTotal : PodiumTimeline.total);

  /// Elapsed ms on the timeline (for tests and frame goldens).
  double get elapsedMs => _c.value * _total;

  /// True while the reveal is still playing.
  bool get playing => _c.isAnimating && _c.value < 1;

  @override
  void initState() {
    super.initState();
    _c.addListener(_onTick);
    FoilSheenProgram.precache().then((_) {
      if (mounted && _shader == null) setState(() => _shader = FoilSheenProgram.newShader());
    });
    _shader = FoilSheenProgram.newShader();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _reduced = MobFx.reduced(context);
    _c.duration = Duration(milliseconds: _total.round());
    if (widget.autoplay) {
      _c.forward();
    } else {
      _lastMs = _total;
      _c.value = 1;
      _confirmed = true;
    }
  }

  @override
  void didUpdateWidget(PodiumStage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.podium, widget.podium)) _plan = PodiumPlan.of(widget.podium);
  }

  @override
  void dispose() {
    _c.dispose();
    _particles.dispose();
    _shader?.dispose();
    super.dispose();
  }

  /// Lands the end state within 200 ms (any tap, or the Skip pill).
  void skip() {
    if (_c.value >= 1 || _skipping) return;
    _skipping = true;
    _particles.clear();
    // 180 ms of motion after the first frame, so the end state is on screen within MobBeat.skip (200).
    _c.animateTo(1, duration: MobBeat.skip - const Duration(milliseconds: 20), curve: Curves.easeOut);
  }

  Haptics? get _haptics => hapticsOf(context);

  void _bump(String id, FoldAct act) {
    _acts[id] = act;
    _actIds[id] = (_actIds[id] ?? 0) + 1;
  }

  void _onTick() {
    final ms = elapsedMs;
    bool crossed(double t) => _lastMs < t && ms >= t;
    final geo = _geo;
    if (_reduced) {
      if (crossed(_total)) _confirm();
    } else if (_plan.table) {
      if (crossed(PodiumTimeline.tableLand) && !_skipping) {
        _haptics?.light();
        for (var i = 0; i < _plan.columns.length; i++) {
          final m = _plan.columns[i];
          _bump(m.memberId, FoldAct.land);
          if (geo != null && i < geo.cols.length) _bits(geo, geo.cols[i].centre, geo.tableTop, 10, 3 + i, m.colour);
        }
      }
      if (crossed(PodiumTimeline.tableKeys)) _confirm();
    } else {
      for (var slot = 0; slot < 3; slot++) {
        if (!crossed(PodiumTimeline.land(slot)) || _skipping) continue;
        final members = [
          for (var i = 0; i < _plan.columns.length; i++)
            if (PodiumPlan.slotOf(_plan.columns[i].place!) == slot) i,
        ];
        if (members.isEmpty) continue;
        if (slot == 2) {
          _haptics?.medium();
        } else {
          _haptics?.light();
        }
        for (final i in members) {
          final m = _plan.columns[i];
          _bump(m.memberId, FoldAct.land);
          if (geo != null) _bits(geo, geo.cols[i].centre, geo.plinthTop(m.place!), 10, 7 + i * 3 + slot, m.colour);
        }
        if (slot == 2 && geo != null) {
          // The first place's burst: 40 bits and 8 glints, floored above the names.
          final i = members.first;
          final c = geo.cols[i].centre;
          final top = geo.plinthTop(1);
          _particles.burst(PaperBurst(
            origin: Offset(c, top - 40),
            count: 40,
            speed: 300,
            spread: math.pi * 0.95,
            minLife: const Duration(milliseconds: 800),
            maxLife: const Duration(milliseconds: 1400),
            floorY: geo.floorY - 2,
            colours: _bitColours(_plan.columns[i].colour),
            glints: 8,
            glintRadius: 64,
            seed: 21,
          ));
        }
      }
      if (crossed(PodiumTimeline.hop) && !_skipping) {
        for (final m in _plan.columns) {
          if (m.place == 1) _bump(m.memberId, FoldAct.bigHop);
        }
      }
      if (crossed(PodiumTimeline.keys)) _confirm();
    }
    _lastMs = ms;
  }

  void _confirm() {
    if (_confirmed) return;
    _confirmed = true;
    _haptics?.confirm();
  }

  List<Color> _bitColours(int colour) {
    final night = context.mmColors.isNight;
    return [
      night ? const Color(0xFFF4F0E6) : const Color(0xFFFFFDF8),
      const Color(0xFFF2B865),
      _memberColour(colour),
    ];
  }

  Color _memberColour(int i) {
    const night = [Color(0xFF6E8BFF), Color(0xFF3FC6A8), Color(0xFFF2A93B), Color(0xFFFF7A8A), Color(0xFFB98CFF), Color(0xFF56B8F0), Color(0xFFE58E5A), Color(0xFF9FBF4A)];
    const day = [Color(0xFF3550C8), Color(0xFF0E7C66), Color(0xFF9A5B00), Color(0xFFB4243A), Color(0xFF6A3BC4), Color(0xFF0B6A9E), Color(0xFFA14A12), Color(0xFF55741A)];
    return (context.mmColors.isNight ? night : day)[i.clamp(0, 7)];
  }

  void _bits(_Geometry geo, double x, double y, int count, int seed, int colour) {
    _particles.burst(PaperBurst(
      origin: Offset(x, y - 4),
      count: count,
      speed: 150,
      angle: -math.pi / 2,
      spread: math.pi * 0.85,
      minLife: const Duration(milliseconds: 600),
      maxLife: const Duration(milliseconds: 1100),
      floorY: geo.floorY - 2,
      colours: _bitColours(colour),
      seed: seed,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => _frame(context, elapsedMs),
    );
  }

  // ---- One frame ---------------------------------------------------------------------------------

  String _name(PodiumPlace p) => p.you ? 'You' : p.name;

  String _headline() {
    final p = widget.podium;
    if (_plan.onlyYou) return MobV3Copy.onlyYouTitle;
    if (_plan.table) return MobV3Copy.everyonesMarks;
    final firsts = [for (final x in p.places) if (x.place == 1 && !x.private) x]..sort((a, b) => a.you == b.you ? 0 : (a.you ? -1 : 1));
    if (firsts.length > 1) return MobV3Copy.sharedTop([for (final f in firsts) _name(f)], p.soFar);
    final f = firsts.isEmpty ? null : firsts.first;
    if (f == null) return MobV3Copy.everyonesMarks;
    return p.soFar ? MobV3Copy.onTopSoFar(_name(f)) : MobV3Copy.cameFirst(_name(f));
  }

  String? _subline() {
    final p = widget.podium;
    if (_plan.onlyYou) return MobV3Copy.onlyYouLine;
    if (!p.soFar || p.closesAt == null) return null;
    if (_plan.table) return null;
    return MobV3Copy.placesCanChange(p.closesAt!, widget.now);
  }

  Widget _frame(BuildContext context, double ms) {
    final c = context.mmColors;
    final type = context.mmType;
    final p = widget.podium;
    final rm = _reduced;
    final table = _plan.table;

    // Timeline values for the layers that are not per column.
    final double scrim;
    if (rm) {
      scrim = 0;
    } else {
      final outAt = table ? PodiumTimeline.tableKeys : PodiumTimeline.keys;
      final outEnd = table ? PodiumTimeline.tableTotal : PodiumTimeline.scrimOutEnd;
      scrim = 0.35 * _seg(ms, 0, PodiumTimeline.scrimIn, MotionCurves.emphasized) * (1 - _seg(ms, outAt, outEnd - outAt, MotionCurves.glide));
    }
    final headerT = rm ? _seg(ms, 0, 120) : _seg(ms, PodiumTimeline.header, 360, MotionCurves.emphasized);
    final collectiveT = rm ? _seg(ms, 0, 120) : _seg(ms, PodiumTimeline.collective, 280, MotionCurves.out);
    final headlineAt = rm ? (table ? 300.0 : 900.0) : (table ? PodiumTimeline.header : PodiumTimeline.headline);
    final headlineT = rm ? _seg(ms, headlineAt, 120) : _seg(ms, headlineAt, 360, MotionCurves.emphasized);
    final tieT = headlineT;
    final keysAt = rm ? (table ? 600.0 : 900.0) : (table ? PodiumTimeline.tableKeys : PodiumTimeline.keys);
    final keysT = rm ? _seg(ms, keysAt, 120) : _seg(ms, keysAt, 360, MotionCurves.emphasized);
    final showSkip = ms < keysAt && _c.value < 1;
    final skipT = ms < keysAt ? 1.0 : 0.0;

    final night = c.isNight;
    final scrimColour = night ? const Color(0xFF000000) : const Color(0xFF2B200F);
    final scrimAlpha = night ? scrim : scrim * 0.5;

    final subline = _subline();
    final tie = p.tie;

    Widget fade(double t, Widget child, {double rise = 8}) => Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform.translate(offset: Offset(0, rm ? 0 : rise * (1 - t)), child: child),
        );

    final header = Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, MmSpace.gutter, 4),
      child: Row(
        children: [
          _IconKey(icon: LucideIcons.x, label: MobV3Copy.back, onTap: widget.onClose),
          const SizedBox(width: 4),
          Expanded(
            child: fade(
              headerT,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(widget.gameTitle, style: type.subhead.copyWith(color: c.ink)),
                  Text(p.soFar ? MobV3Copy.soFar : MobV3Copy.finalLabel, style: type.caption.copyWith(color: c.ink3)),
                ],
              ),
            ),
          ),
          AnimatedOpacity(
            opacity: showSkip ? skipT : 0,
            duration: const Duration(milliseconds: 160),
            child: IgnorePointer(ignoring: !showSkip, child: _SkipPill(onTap: skip)),
          ),
        ],
      ),
    );

    final headlineBlock = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.momentGutter - 4, 6, MmSpace.momentGutter - 4, 0),
      child: fade(
        headlineT,
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(header: true, child: Text(_headline(), key: const ValueKey('podium-headline'), style: type.headline.copyWith(color: c.ink))),
            if (subline != null) ...[
              const SizedBox(height: 4),
              Text(subline, key: const ValueKey('podium-subline'), style: type.body.copyWith(color: c.ink2)),
            ],
          ],
        ),
      ),
    );

    final lines = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.momentGutter - 4, MmSpace.s16, MmSpace.momentGutter - 4, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (p.of > 0)
            Opacity(
              opacity: collectiveT,
              child: Text(MobV3Copy.together(p.right, p.of), key: const ValueKey('podium-collective'), style: type.body.copyWith(color: c.ink)),
            ),
          if (tie != null && !table) ...[
            const SizedBox(height: 6),
            fade(tieT, Text(MobV3Copy.tieLine(tie), key: const ValueKey('podium-tie'), style: type.body.copyWith(color: c.ink2)), rise: 6),
          ],
        ],
      ),
    );

    final keys = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s16),
      child: fade(
        keysT,
        IgnorePointer(
          ignoring: keysT < 0.5,
          child: Row(
            children: [
              Expanded(child: KeyButton(label: MobV3Copy.everyonesMoment, onPressed: widget.onMoments)),
              const SizedBox(width: MmSpace.s12),
              _IconKey(icon: LucideIcons.repeat, label: MobV3Copy.askRematch, onTap: widget.onRematch, ring: true),
            ],
          ),
        ),
        rise: 16,
      ),
    );

    final body = LayoutBuilder(
      builder: (context, box) {
        final stage = _stage(context, ms, box.maxWidth);
        return SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [headlineBlock, const SizedBox(height: MmSpace.s8), stage, lines, const SizedBox(height: MmSpace.s8)],
          ),
        );
      },
    );

    // During the reveal any touch lands the end state (the Skip pill is the visible way); the close
    // button still works.
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) {
        if (_c.isAnimating) skip();
      },
      child: Stack(
        children: [
          Positioned.fill(child: IgnorePointer(child: ColoredBox(color: scrimColour.withValues(alpha: scrimAlpha)))),
          SafeArea(
            child: Column(
              children: [
                header,
                Expanded(child: body),
                keys,
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ---- The stage (lamp, plinths, Folds, floor, names) -----------------------------------------------

  Widget _stage(BuildContext context, double ms, double width) {
    final c = context.mmColors;
    final rm = _reduced;
    final lite = MobFx.lite(context);
    final scale = (width / 360).clamp(1.0, 1.14);
    final geo = _Geometry.layout(_plan, width, scale);
    _geo = geo;
    final night = c.isNight;
    final table = _plan.table;

    // The lamp: the cone narrows 100% -> 62% over 0-400 and swells at 2820 when first lands.
    final narrow = rm ? 1.0 : _seg(ms, 0, PodiumTimeline.scrimIn, MotionCurves.emphasized);
    final coneWidth = 1 - 0.38 * narrow;
    final base = night ? 0.26 : 0.20;
    final peak = night ? 0.60 : 0.42;
    final swell = (rm || table) ? 0.0 : _seg(ms, PodiumTimeline.climax, 600, MotionCurves.out);
    final strength = base * (0.55 + 0.45 * narrow) + (peak - base) * swell;

    final children = <Widget>[
      Positioned.fill(child: CustomPaint(painter: _GridPainter(colour: c.ink.withValues(alpha: night ? 0.04 : 0.05), floorY: geo.floorY))),
      Positioned.fill(
        child: CustomPaint(
          painter: _LampPainter(
            cx: geo.lampX,
            floorY: geo.floorY,
            width: width,
            coneWidth: coneWidth,
            strength: strength,
            night: night,
            blur: !lite,
            shade: night ? const Color(0xFFE9E2D0) : const Color(0xFFFFFDF8),
            shadeEdge: night ? const Color(0xFF8F8670) : const Color(0xFFCFC6B2),
            cord: c.ink3,
          ),
        ),
      ),
      // The floor line and the floor band under the plinths.
      Positioned(left: 0, right: 0, top: geo.floorY, height: 1, child: ColoredBox(color: c.lineStrong)),
    ];

    if (table) {
      _tableLayer(context, ms, geo, children);
    } else {
      _stageLayer(context, ms, geo, children);
    }

    children.add(Positioned.fill(child: PaperParticles(controller: _particles)));

    final stage = SizedBox(height: geo.height, child: Stack(clipBehavior: Clip.none, children: children));
    final names = _nameBand(context, ms, geo);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        stage,
        ColoredBox(
          color: night ? Color.alphaBlend(const Color(0x14000000), c.ground) : Color.alphaBlend(const Color(0x0A3B2A12), c.ground),
          child: Padding(padding: const EdgeInsets.only(top: 8, bottom: 10), child: names),
        ),
      ],
    );
  }

  /// Plinths, numerals, creases, sheen and the Folds on them; the floor members beside.
  void _stageLayer(BuildContext context, double ms, _Geometry geo, List<Widget> out) {
    final c = context.mmColors;
    final rm = _reduced;
    final night = c.isNight;
    final soFar = widget.podium.soFar;

    // Floor members: together with the collective line at 400, marks static.
    final floorT = rm ? _seg(ms, 0, 120) : _seg(ms, PodiumTimeline.collective, 360, MotionCurves.emphasized);
    for (var i = 0; i < _plan.floor.length; i++) {
      final m = _plan.floor[i];
      final col = geo.floorCols[i];
      out.add(Positioned(
        left: col.left,
        width: col.width,
        bottom: geo.height - geo.floorY - 1,
        child: Opacity(
          opacity: floorT,
          child: Transform.translate(
            offset: Offset(0, rm ? 0 : 14 * (1 - floorT)),
            child: Center(child: _puppet(m, geo.floorFold, large: false)),
          ),
        ),
      ));
    }

    for (var i = 0; i < _plan.columns.length; i++) {
      final m = _plan.columns[i];
      final col = geo.cols[i];
      final place = m.place!;
      final slot = PodiumPlan.slotOf(place);
      final start = PodiumTimeline.slotStart[slot];
      final h = geo.plinthHeight(place);
      final first = place == 1;

      final double unfold;
      final double plinthOpacity;
      final double drop;
      final double foldOpacity;
      final double numeral;
      if (rm) {
        final t = _seg(ms, PodiumTimeline.reducedSlot[slot], 120);
        unfold = 1;
        plinthOpacity = t;
        drop = 1;
        foldOpacity = t;
        numeral = t;
      } else {
        unfold = _seg(ms, start, MotionDurations.emphasized.inMilliseconds.toDouble(), MotionCurves.emphasized);
        plinthOpacity = ms >= start ? 1 : 0;
        drop = _seg(ms, start + PodiumTimeline.dropAfter, 220, MotionCurves.leave);
        // Never a ghost before its turn and never see-through mid-drop (Live defects).
        foldOpacity = ms >= start + PodiumTimeline.dropAfter ? 1 : 0;
        numeral = _seg(ms, start + PodiumTimeline.landAfter + PodiumTimeline.numeralAfterLanding, MotionDurations.engrave.inMilliseconds.toDouble(), MotionCurves.out);
      }
      final sheenP = (!rm && first) ? _seg(ms, PodiumTimeline.climax, MotionDurations.sweep.inMilliseconds.toDouble(), MotionCurves.sweep) : 0.0;
      final sheenOn = !rm && first && ms >= PodiumTimeline.climax && sheenP < 1;
      final foil = (!soFar && first) ? (rm ? numeral : _seg(ms, PodiumTimeline.climax + 700, 280)) : 0.0;

      final plinth = SizedBox(
        width: col.width,
        height: h,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              child: CustomPaint(
                painter: _PlinthPainter(
                  paper: night ? const Color(0xFFE6DFCD) : const Color(0xFFFBF8F1),
                  paperLow: night ? const Color(0xFFCFC6B0) : const Color(0xFFEDE7DA),
                  edge: night ? null : c.lineStrong,
                  ground: c.ground,
                  ruled: !soFar,
                  creases: place,
                  foil: foil,
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              top: 10,
              child: _Engrave(
                t: numeral,
                child: Text(
                  '$place',
                  key: ValueKey('podium-numeral-${m.memberId}'),
                  textAlign: TextAlign.center,
                  style: context.mmType.figureCompact.copyWith(color: const Color(0xFF2A251F), height: 1),
                ),
              ),
            ),
            if (sheenOn)
              Positioned.fill(
                child: IgnorePointer(
                  child: CustomPaint(painter: _SheenPainter(progress: sheenP, shader: MobFx.lite(context) ? null : _shader)),
                ),
              ),
          ],
        ),
      );
      final perspective = Matrix4.identity()
        ..setEntry(3, 2, 0.0015)
        ..rotateX((1 - unfold) * math.pi / 2);
      out.add(Positioned(
        left: col.left,
        top: geo.floorY - h,
        child: Opacity(
          opacity: plinthOpacity,
          child: Semantics(
            label: MobV3Copy.placeOf(place),
            child: Transform(alignment: Alignment.bottomCenter, transform: perspective, child: plinth),
          ),
        ),
      ));

      final size = first ? geo.firstFold : geo.fold;
      out.add(Positioned(
        left: col.left - 20,
        width: col.width + 40,
        bottom: geo.height - (geo.floorY - h) - 2,
        child: Opacity(
          opacity: foldOpacity,
          child: Transform.translate(
            offset: Offset(0, -60 * (1 - drop)),
            child: Center(child: _puppet(m, size, large: first)),
          ),
        ),
      ));
    }
  }

  /// The table: everyone together, in time order, no places and no numerals.
  void _tableLayer(BuildContext context, double ms, _Geometry geo, List<Widget> out) {
    final c = context.mmColors;
    final rm = _reduced;
    final night = c.isNight;
    final unfold = rm ? 1.0 : _seg(ms, PodiumTimeline.tableUnfold, 420, MotionCurves.emphasized);
    final tableOpacity = rm ? _seg(ms, 300, 120) : (ms >= PodiumTimeline.tableUnfold ? 1.0 : 0.0);
    final drop = rm ? 1.0 : _seg(ms, PodiumTimeline.tableDrop, 220, MotionCurves.leave);
    final foldOpacity = rm ? _seg(ms, 300, 120) : (ms >= PodiumTimeline.tableDrop ? 1.0 : 0.0);
    final perspective = Matrix4.identity()
      ..setEntry(3, 2, 0.0015)
      ..rotateX((1 - unfold) * math.pi / 2);
    out.add(Positioned(
      left: geo.tableLeft,
      width: geo.tableWidth,
      top: geo.tableTop,
      height: geo.floorY - geo.tableTop,
      child: Opacity(
        opacity: tableOpacity,
        child: Transform(
          alignment: Alignment.bottomCenter,
          transform: perspective,
          child: CustomPaint(
            painter: _PlinthPainter(
              paper: night ? const Color(0xFFE6DFCD) : const Color(0xFFFBF8F1),
              paperLow: night ? const Color(0xFFCFC6B0) : const Color(0xFFEDE7DA),
              edge: night ? null : c.lineStrong,
              ground: c.ground,
              ruled: true,
              creases: 0,
              foil: 0,
            ),
          ),
        ),
      ),
    ));
    for (var i = 0; i < _plan.columns.length; i++) {
      final m = _plan.columns[i];
      final col = geo.cols[i];
      out.add(Positioned(
        left: col.left - 16,
        width: col.width + 32,
        bottom: geo.height - geo.tableTop - 2,
        child: Opacity(
          opacity: foldOpacity,
          child: Transform.translate(offset: Offset(0, -60 * (1 - drop)), child: Center(child: _puppet(m, geo.fold, large: false))),
        ),
      ));
    }
  }

  Widget _puppet(PodiumPlace m, double size, {required bool large}) => FoldPuppet(
        key: ValueKey('podium-fold-${m.memberId}'),
        fold: m.fold,
        size: size,
        large: large,
        blink: !_reduced,
        act: _acts[m.memberId] ?? FoldAct.none,
        actId: _actIds[m.memberId] ?? 0,
        phase: m.colour,
        fallbackName: m.name,
        fallbackColour: m.colour,
      );

  /// Names and marks under each plinth, Fold on the floor or seat at the table.
  Widget _nameBand(BuildContext context, double ms, _Geometry geo) {
    final rm = _reduced;
    final cells = <({_Col col, Widget child})>[];
    for (var i = 0; i < _plan.columns.length; i++) {
      final m = _plan.columns[i];
      final double t;
      final int shown;
      if (_plan.table) {
        t = rm ? _seg(ms, 300, 120) : _seg(ms, PodiumTimeline.tableLand, MotionDurations.engrave.inMilliseconds.toDouble(), MotionCurves.out);
        shown = m.marks ?? 0;
      } else {
        final slot = PodiumPlan.slotOf(m.place!);
        if (rm) {
          t = _seg(ms, PodiumTimeline.reducedSlot[slot], 120);
          shown = m.marks!;
        } else {
          final land = PodiumTimeline.land(slot);
          t = _seg(ms, land, MotionDurations.engrave.inMilliseconds.toDouble(), MotionCurves.out);
          final from = _plan.rollFrom[m.memberId] ?? m.marks!;
          final roll = _seg(ms, land, MotionDurations.countUp.inMilliseconds.toDouble(), MotionCurves.out);
          shown = (from + (m.marks! - from) * roll).round();
        }
      }
      cells.add((col: geo.cols[i], child: Opacity(opacity: t, child: _nameCell(context, m, shown))));
    }
    if (!_plan.table) {
      final floorT = rm ? _seg(ms, 0, 120) : _seg(ms, PodiumTimeline.collective, 280, MotionCurves.out);
      for (var i = 0; i < _plan.floor.length; i++) {
        final m = _plan.floor[i];
        cells.add((col: geo.floorCols[i], child: Opacity(opacity: floorT, child: _nameCell(context, m, m.marks ?? 0))));
      }
    }
    cells.sort((a, b) => a.col.left.compareTo(b.col.left));
    final row = <Widget>[];
    var x = 0.0;
    for (final cell in cells) {
      final gap = cell.col.left - x;
      if (gap > 0) row.add(SizedBox(width: gap));
      row.add(SizedBox(width: cell.col.width, child: cell.child));
      x = cell.col.left + cell.col.width;
    }
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: row);
  }

  Widget _nameCell(BuildContext context, PodiumPlace m, int shown) {
    final c = context.mmColors;
    final type = context.mmType;
    final figure = type.figureCompact.copyWith(fontSize: 20, height: 1.1, color: c.ink2);
    final marksText = m.private || m.marks == null
        ? Text(MobV3Copy.private, key: ValueKey('podium-marks-${m.memberId}'), textAlign: TextAlign.center, style: type.caption.copyWith(color: c.ink3))
        : Text.rich(
            TextSpan(children: [
              TextSpan(text: '$shown', style: figure),
              TextSpan(text: shown == 1 || shown == -1 ? ' mark' : ' marks', style: type.caption.copyWith(color: c.ink3)),
            ]),
            key: ValueKey('podium-marks-${m.memberId}'),
            textAlign: TextAlign.center,
          );
    return Semantics(
      label: MobV3Copy.podiumSemantics(_name(m), (_plan.table || m.floor) ? null : m.place, m.private ? null : m.marks),
      excludeSemantics: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_name(m), textAlign: TextAlign.center, softWrap: true, style: type.labelLarge.copyWith(color: c.ink, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          marksText,
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------------

class _Col {
  const _Col(this.left, this.width);
  final double left;
  final double width;
  double get centre => left + width / 2;
}

class _Geometry {
  _Geometry({
    required this.height,
    required this.floorY,
    required this.lampX,
    required this.cols,
    required this.floorCols,
    required this.scale,
    required this.fold,
    required this.firstFold,
    required this.floorFold,
    this.tableLeft = 0,
    this.tableWidth = 0,
    this.tableTop = 0,
  });

  factory _Geometry.layout(PodiumPlan plan, double width, double scale) {
    const margin = 12.0;
    const gap = 6.0;
    final height = 300 * scale;
    final floorY = height - 2;
    final avail = width - margin * 2;
    if (plan.table) {
      final n = math.max(1, plan.columns.length);
      final w = math.min(96.0 * scale, (avail - 16 - (n - 1) * gap) / n);
      final total = n * w + (n - 1) * gap;
      final left = (width - total) / 2;
      final cols = [for (var i = 0; i < n; i++) _Col(left + i * (w + gap), w)];
      final tableH = 56 * scale;
      final fold = math.min(88 * scale, w * 1.15);
      return _Geometry(
        height: height,
        floorY: floorY,
        lampX: width / 2,
        cols: plan.columns.isEmpty ? const [] : cols,
        floorCols: const [],
        scale: scale,
        fold: fold,
        firstFold: fold,
        floorFold: fold,
        tableLeft: math.max(margin, left - 14),
        tableWidth: math.min(avail, total + 28),
        tableTop: floorY - tableH,
      );
    }
    final n = plan.columns.length;
    final f = plan.floor.length;
    const floorW = 66.0;
    final floorPart = f == 0 ? 0.0 : f * floorW + f * gap;
    final pw = ((avail - floorPart - (n - 1) * gap) / n).clamp(52.0, 92.0 * scale);
    final stageW = n * pw + (n - 1) * gap;
    final total = stageW + floorPart;
    final left = (width - total) / 2;
    final cols = [for (var i = 0; i < n; i++) _Col(left + i * (pw + gap), pw)];
    final floorCols = [for (var i = 0; i < f; i++) _Col(left + stageW + gap + i * (floorW + gap), floorW)];
    final firstIdx = plan.columns.indexWhere((p) => p.place == 1);
    final lampX = firstIdx < 0 ? left + stageW / 2 : cols[firstIdx].centre;
    return _Geometry(
      height: height,
      floorY: floorY,
      lampX: lampX,
      cols: cols,
      floorCols: floorCols,
      scale: scale,
      fold: math.min(84 * scale, pw * 1.12),
      firstFold: math.min(100 * scale, pw * 1.25),
      floorFold: 60,
    );
  }

  final double height;
  final double floorY;
  final double lampX;
  final List<_Col> cols;
  final List<_Col> floorCols;
  final double scale;
  final double fold;
  final double firstFold;
  final double floorFold;
  final double tableLeft;
  final double tableWidth;
  final double tableTop;

  double plinthHeight(int place) => switch (place) { 1 => 128, 2 => 96, _ => 72 } * scale;
  double plinthTop(int place) => floorY - plinthHeight(place);
}

// ---------------------------------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------------------------------

/// The numeral engraves left to right (engrave 280).
class _Engrave extends StatelessWidget {
  const _Engrave({required this.t, required this.child});

  final double t;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (t <= 0) return Opacity(opacity: 0, child: child);
    if (t >= 1) return child;
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (r) => LinearGradient(
        colors: const [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0x00FFFFFF)],
        stops: [0, (t * 1.2 - 0.1).clamp(0.0, 1.0), (t * 1.2 + 0.1).clamp(0.0, 1.0)],
      ).createShader(r),
      child: child,
    );
  }
}

class _SkipPill extends StatelessWidget {
  const _SkipPill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: MobV3Copy.skipShow,
      builder: (context, pressed, _) => Container(
        constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
        alignment: Alignment.center,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: c.raised.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: c.line),
          ),
          child: Text(MobV3Copy.skipShow, key: const ValueKey('podium-skip'), style: context.mmType.label.copyWith(color: pressed ? c.ink : c.ink2)),
        ),
      ),
    );
  }
}

class _IconKey extends StatelessWidget {
  const _IconKey({required this.icon, required this.label, required this.onTap, this.ring = false});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool ring;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: BorderRadius.circular(999),
      builder: (context, pressed, _) => Container(
        width: ring ? 56 : 48,
        height: ring ? 56 : 48,
        alignment: Alignment.center,
        decoration: ring
            ? BoxDecoration(shape: BoxShape.circle, color: c.raised, border: Border.all(color: c.lineStrong))
            : null,
        child: Icon(icon, size: ring ? 22 : 24, color: pressed ? c.ink2 : c.ink),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Painters
// ---------------------------------------------------------------------------------------------------

/// Graph paper at 4% ink behind the stage, fading out toward the top.
class _GridPainter extends CustomPainter {
  _GridPainter({required this.colour, required this.floorY});

  final Color colour;
  final double floorY;

  @override
  void paint(Canvas canvas, Size size) {
    const step = 20.0;
    final p = Paint()..strokeWidth = 1;
    for (var y = floorY; y > 0; y -= step) {
      final k = (y / floorY).clamp(0.0, 1.0);
      p.color = colour.withValues(alpha: colour.a * k);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
    final cx = size.width / 2;
    for (var x = cx % step; x < size.width; x += step) {
      p.shader = LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [colour, colour.withValues(alpha: 0)])
          .createShader(Rect.fromLTWH(0, 0, size.width, floorY));
      canvas.drawLine(Offset(x, 0), Offset(x, floorY), p);
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) => old.colour != colour || old.floorY != floorY;
}

/// The hanging lamp: cord, paper shade, bulb, and the cone of light to a pool on the floor.
class _LampPainter extends CustomPainter {
  _LampPainter({
    required this.cx,
    required this.floorY,
    required this.width,
    required this.coneWidth,
    required this.strength,
    required this.night,
    required this.blur,
    required this.shade,
    required this.shadeEdge,
    required this.cord,
  });

  final double cx;
  final double floorY;
  final double width;
  final double coneWidth;
  final double strength;
  final bool night;
  final bool blur;
  final Color shade;
  final Color shadeEdge;
  final Color cord;

  static const Color lamp = Color(0xFFF2A93B);

  @override
  void paint(Canvas canvas, Size size) {
    const shadeTop = 14.0;
    const shadeH = 20.0;
    final shadeBottom = shadeTop + shadeH;
    // The cone.
    final topHalf = 26.0;
    final bottomHalf = math.max(topHalf + 10, width * 0.5 * coneWidth);
    final cone = Path()
      ..moveTo(cx - topHalf, shadeBottom)
      ..lineTo(cx + topHalf, shadeBottom)
      ..lineTo(cx + bottomHalf, floorY)
      ..lineTo(cx - bottomHalf, floorY)
      ..close();
    final conePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [lamp.withValues(alpha: strength * 0.95), lamp.withValues(alpha: strength * 0.42)],
      ).createShader(Rect.fromLTRB(0, shadeBottom, size.width, floorY));
    if (blur) conePaint.maskFilter = const MaskFilter.blur(BlurStyle.normal, 7);
    canvas.drawPath(cone, conePaint);
    // The pool on the floor.
    final pool = Rect.fromCenter(center: Offset(cx, floorY), width: bottomHalf * 2.3, height: 44);
    canvas.drawOval(
      pool,
      Paint()
        ..shader = RadialGradient(colors: [lamp.withValues(alpha: strength * 0.9), lamp.withValues(alpha: 0)]).createShader(pool),
    );
    // Cord.
    canvas.drawLine(Offset(cx, 0), Offset(cx, shadeTop), Paint()
      ..color = cord
      ..strokeWidth = 1.2);
    // Bulb glow under the shade.
    final bulb = Rect.fromCenter(center: Offset(cx, shadeBottom + 1), width: 30, height: 10);
    canvas.drawOval(bulb, Paint()..shader = RadialGradient(colors: [const Color(0xFFFFF4D6).withValues(alpha: 0.95), const Color(0x00FFF4D6)]).createShader(bulb.inflate(4)));
    // Shade: a folded paper trapezoid with a darker lip.
    final s = Path()
      ..moveTo(cx - 13, shadeTop)
      ..lineTo(cx + 13, shadeTop)
      ..lineTo(cx + 34, shadeBottom)
      ..lineTo(cx - 34, shadeBottom)
      ..close();
    canvas.drawPath(s, Paint()..color = shade);
    canvas.drawLine(Offset(cx - 34, shadeBottom), Offset(cx + 34, shadeBottom), Paint()
      ..color = shadeEdge
      ..strokeWidth = 2);
    // One fold crease on the shade.
    canvas.drawLine(Offset(cx, shadeTop), Offset(cx + 6, shadeBottom), Paint()
      ..color = shadeEdge.withValues(alpha: 0.45)
      ..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(_LampPainter old) =>
      old.cx != cx || old.coneWidth != coneWidth || old.strength != strength || old.night != night || old.width != width || old.floorY != floorY;
}

/// A paper plinth: rounded top, a dog-ear in the top-right corner, ruled lines on a final podium,
/// fold creases under the dog-ear (1, 2 or 3: the place, told twice, never by colour alone), and the
/// foil rim along the top edge of a final first place.
class _PlinthPainter extends CustomPainter {
  _PlinthPainter({
    required this.paper,
    required this.paperLow,
    required this.ground,
    required this.ruled,
    required this.creases,
    required this.foil,
    this.edge,
  });

  final Color paper;
  final Color paperLow;
  final Color ground;
  final Color? edge;
  final bool ruled;
  final int creases;
  final double foil;

  @override
  void paint(Canvas canvas, Size size) {
    const r = 10.0;
    const ear = 16.0;
    final w = size.width;
    final h = size.height;
    final body = Path()
      ..moveTo(0, h)
      ..lineTo(0, r)
      ..quadraticBezierTo(0, 0, r, 0)
      ..lineTo(w - ear, 0)
      ..lineTo(w, ear)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(
      body,
      Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [paper, paperLow]).createShader(Offset.zero & size),
    );
    // A lit top edge.
    canvas.drawLine(const Offset(r, 0.75), Offset(w - ear, 0.75), Paint()
      ..color = const Color(0x99FFFFFF)
      ..strokeWidth = 1.5);
    if (ruled) {
      final line = Paint()
        ..color = const Color(0x1A2A251F)
        ..strokeWidth = 1;
      for (var y = 44.0; y < h - 4; y += 10) {
        canvas.drawLine(Offset(4, y), Offset(w - 4, y), line);
      }
    }
    final e = edge;
    if (e != null) {
      canvas.drawPath(body, Paint()
        ..color = e
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1);
    }
    // The dog-ear: the folded corner, its underside darker.
    final fold = Path()
      ..moveTo(w - ear, 0)
      ..lineTo(w - ear, ear - 3)
      ..quadraticBezierTo(w - ear, ear, w - ear + 3, ear)
      ..lineTo(w, ear)
      ..close();
    canvas.drawPath(fold.shift(const Offset(-1, 1.5)), Paint()
      ..color = const Color(0x33000000)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5));
    canvas.drawPath(fold, Paint()..color = Color.lerp(paperLow, const Color(0xFF8C8270), 0.35)!);
    // Creases: one short stroke per fold, under the dog-ear.
    final crease = Paint()
      ..color = const Color(0x552A251F)
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < creases; i++) {
      final x = w - 9 - i * 5.5;
      canvas.drawLine(Offset(x, ear + 7), Offset(x - 1.5, ear + 15), crease);
    }
    if (foil > 0) {
      final band = Rect.fromLTWH(r * 0.4, 0, w - ear - r * 0.4, 3.5);
      canvas.drawRect(
        band,
        Paint()
          ..shader = LinearGradient(colors: [
            const Color(0xFFF2B865).withValues(alpha: foil),
            const Color(0xFFFFF0C8).withValues(alpha: foil),
            const Color(0xFFF2B865).withValues(alpha: foil),
          ]).createShader(band),
      );
    }
  }

  @override
  bool shouldRepaint(_PlinthPainter old) =>
      old.paper != paper || old.ruled != ruled || old.creases != creases || old.foil != foil || old.edge != edge || old.ground != ground;
}

/// The foil sheen across the first plinth: the shader when ready, else a gradient mask.
class _SheenPainter extends CustomPainter {
  _SheenPainter({required this.progress, this.shader});

  final double progress;
  final ui.FragmentShader? shader;

  @override
  void paint(Canvas canvas, Size size) {
    final strength = math.sin(progress * math.pi).clamp(0.0, 1.0);
    final rect = Offset.zero & size;
    final clip = RRect.fromRectAndCorners(rect, topLeft: const Radius.circular(10));
    canvas.save();
    canvas.clipRRect(clip);
    final s = shader;
    if (s != null) {
      s
        ..setFloat(0, size.width)
        ..setFloat(1, size.height)
        ..setFloat(2, progress)
        ..setFloat(3, strength);
      canvas.drawRect(rect, Paint()..shader = s);
    } else {
      final x = -1.6 + progress * 3.2;
      canvas.drawRect(
        rect,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment(x - 0.55, -1),
            end: Alignment(x + 0.55, 1),
            colors: [
              const Color(0x00F2B865),
              const Color(0xFFF2B865).withValues(alpha: 0.55 * strength),
              const Color(0xFFFFF0C8).withValues(alpha: 0.75 * strength),
              const Color(0xFFF2B865).withValues(alpha: 0.55 * strength),
              const Color(0x00F2B865),
            ],
            stops: const [0, 0.38, 0.5, 0.62, 1],
          ).createShader(rect),
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SheenPainter old) => old.progress != progress || old.shader != shader;
}
