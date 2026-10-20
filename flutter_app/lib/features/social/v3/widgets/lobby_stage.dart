// L1's stage (MOB-BUILD-SPEC-V3 5.3 L1, 5.6 M2; Live 08 "Ready up", the den v2 S7 "Kabir is here now"):
// the den's lamp-lit room with the Folds of the members who are HERE (presence only), each with a paper
// tag under its name, "Host", "Here" or "Ready", and a dashed "Open seat" for each member who is not
// here (the count of seats only, never a name).
//
// Motion:
// - each member who arrives after you joined hops in (M2): a rise of 36 dp from 18 dp below the floor,
//   a fall onto it, the 1.08/0.88 squash for 90 ms at contact, then settle; their tag engraves 360 ms
//   after the landing;
// - "Ready" stamps in: scale 1.4 to 1 on `celebrate` with a 3 degree settle, the paper there from the
//   first frame;
// - Folds sway plus or minus 2 degrees on 6.4 s in the lobby (FoldPuppet.sway), blink, never in sync;
// - a sticker flies up 24 dp from the sender's head (iconPop 0.9 to 1), holds 1.8 s and fades 300 ms.
// Reduced motion: arrivals and stamps fade in over 120 ms, nothing hops, sways or flies.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_room_channel.dart';
import '../data/mob_v3_models.dart';
import '../logic/live_room.dart';
import 'den_stage.dart' show denRoomArt;
import 'fold_puppet.dart';
import 'mob_fx.dart';
import 'run_paper.dart';

/// One member standing in the lobby.
class LobbySeat {
  const LobbySeat({required this.memberId, required this.name, this.fold, this.colour = 0, this.status = RoomPresenceStatus.here, this.host = false, this.you = false});

  final String memberId;
  final String name;
  final FoldKey? fold;
  final int colour;
  final RoomPresenceStatus status;
  final bool host;
  final bool you;

  String get tag => host ? MobV3Copy.tagHost : (status == RoomPresenceStatus.ready ? MobV3Copy.tagReady : MobV3Copy.tagHere);
}

/// The hop-in timeline (M2, per joiner), in ms.
abstract final class LobbyHop {
  static const double rise = 200;
  static const double contact = 380;
  static const double squash = 90;
  static const double tagAt = contact + 360;
  static const double total = tagAt + 280;

  /// (dy, opacity, squash 0 to 1) at [ms]: from 18 dp below the floor up to 18 dp above it, down onto
  /// it, then the squash.
  static ({double dy, double opacity, double squash}) frame(double ms) {
    if (ms <= 0) return (dy: 18, opacity: 0, squash: 0);
    if (ms < rise) {
      final p = Motion.out.transform(ms / rise);
      return (dy: 18 - 36 * p, opacity: (ms / 120).clamp(0.0, 1.0), squash: 0);
    }
    if (ms < contact) {
      final p = Motion.leave.transform((ms - rise) / (contact - rise));
      return (dy: -18 + 18 * p, opacity: 1, squash: 0);
    }
    if (ms < contact + squash) return (dy: 0, opacity: 1, squash: 1 - (ms - contact) / squash);
    return (dy: 0, opacity: 1, squash: 0);
  }

  static double tag(double ms) => ((ms - tagAt) / 280).clamp(0.0, 1.0);
}

class LobbyStage extends StatefulWidget {
  const LobbyStage({super.key, required this.seats, this.openSeats = 0, this.stickers = const [], this.idle = true});

  /// The members here, in the order they stand.
  final List<LobbySeat> seats;

  /// Members of the Mob who are not here (dashed outlines, no names).
  final int openSeats;

  /// Stickers seen in the room; new ids fly over their sender.
  final List<RoomStickerSeen> stickers;

  /// Idle loops (sway, blink) may run.
  final bool idle;

  static const double height = 292;
  static const double band = 72;

  @override
  State<LobbyStage> createState() => _LobbyStageState();
}

class _LobbyStageState extends State<LobbyStage> with TickerProviderStateMixin {
  final Map<String, AnimationController> _hops = {};
  final Map<String, AnimationController> _stamps = {};
  final Map<int, (RoomStickerSeen, AnimationController)> _flights = {};
  final Set<int> _seenStickers = {};
  final Map<String, RoomPresenceStatus> _status = {};
  bool _first = true;

  bool get _reduced => MobFx.reduced(context);

  @override
  void initState() {
    super.initState();
    for (final s in widget.seats) {
      _status[s.memberId] = s.status;
    }
    for (final st in widget.stickers) {
      _seenStickers.add(st.id);
    }
  }

  @override
  void didUpdateWidget(LobbyStage old) {
    super.didUpdateWidget(old);
    final reduced = _reduced;
    for (final s in widget.seats) {
      final before = _status[s.memberId];
      if (before == null && !_first) {
        final c = AnimationController(vsync: this, duration: Duration(milliseconds: reduced ? 400 : LobbyHop.total.round()));
        c.addListener(_tick);
        _hops[s.memberId]?.dispose();
        _hops[s.memberId] = c;
        c.forward(from: 0);
      }
      if (s.status == RoomPresenceStatus.ready && before != RoomPresenceStatus.ready && !s.host) {
        final c = AnimationController(vsync: this, duration: reduced ? Motion.reducedFade : const Duration(milliseconds: 520));
        c.addListener(_tick);
        _stamps[s.memberId]?.dispose();
        _stamps[s.memberId] = c;
        c.forward(from: 0);
      }
      _status[s.memberId] = s.status;
    }
    final ids = {for (final s in widget.seats) s.memberId};
    _status.removeWhere((k, _) => !ids.contains(k));
    for (final st in widget.stickers) {
      if (_seenStickers.add(st.id)) {
        final c = AnimationController(vsync: this, duration: Duration(milliseconds: reduced ? 2040 : 2400));
        c.addListener(_tick);
        c.addStatusListener((s) {
          if (s == AnimationStatus.completed && mounted) {
            setState(() => _flights.remove(st.id)?.$2.dispose());
          }
        });
        _flights[st.id] = (st, c);
        while (_flights.length > 3) {
          final k = _flights.keys.first;
          _flights.remove(k)?.$2.dispose();
        }
        c.forward(from: 0);
      }
    }
  }

  void _tick() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    for (final c in [..._hops.values, ..._stamps.values]) {
      c.dispose();
    }
    for (final f in _flights.values) {
      f.$2.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _first = false;
    final colors = context.mmColors;
    final night = colors.isNight;
    final reduced = _reduced;
    final seats = widget.seats;
    final open = widget.openSeats.clamp(0, 4);
    final slots = seats.length + open;
    return Semantics(
      container: true,
      label: MobV3Copy.roomStage(seats.length, open),
      child: SizedBox(
        height: LobbyStage.height,
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth;
            final floorY = LobbyStage.height - LobbyStage.band;
            final slotW = (w - 2 * MmSpace.s12) / math.max(slots, 3);
            // As big as the seat allows (the lamp's room is the point of the screen), 64 dp with five.
            final size = slots >= 5 ? 64.0 : (slotW * 1.04).clamp(72.0, 104.0);
            final startX = MmSpace.s12 + (w - 2 * MmSpace.s12 - slotW * slots) / 2;
            double cx(int i) => startX + slotW * (i + 0.5);
            final children = <Widget>[
              // The room art behind, then the lamp pool on the floor, then the floor band.
              Positioned.fill(
                bottom: LobbyStage.band,
                child: ExcludeSemantics(
                  child: Image.asset(
                    denRoomArt(night),
                    fit: BoxFit.cover,
                    alignment: const Alignment(0, 0.35),
                    errorBuilder: (_, _, _) => ColoredBox(color: RunPaper.of(context).wall),
                  ),
                ),
              ),
              Positioned.fill(
                child: IgnorePointer(child: CustomPaint(painter: _LobbyLight(floorY: floorY, night: night))),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: floorY,
                bottom: 0,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: night ? const Color(0xFF221D16) : const Color(0xFFE6DCC8),
                    border: Border(top: BorderSide(color: night ? const Color(0xFF3A3126) : const Color(0xFFCDBFA4), width: 2)),
                  ),
                ),
              ),
            ];
            for (var i = 0; i < seats.length; i++) {
              final s = seats[i];
              final hop = _hops[s.memberId];
              final hopMs = hop == null ? LobbyHop.total : hop.value * (hop.duration!.inMilliseconds);
              final f = reduced ? (dy: 0.0, opacity: (hopMs / 120).clamp(0.0, 1.0), squash: 0.0) : LobbyHop.frame(hopMs);
              final tagOp = hop == null ? 1.0 : (reduced ? (hopMs / 120).clamp(0.0, 1.0) : LobbyHop.tag(hopMs));
              final sx = 1 + (MobBeat.squashX - 1) * f.squash;
              final sy = 1 - (1 - MobBeat.squashY) * f.squash;
              children
                ..add(
                  Positioned(
                    key: ValueKey('lobby-fold-${s.memberId}'),
                    left: cx(i) - size / 2,
                    top: floorY - size + 4 + f.dy,
                    width: size,
                    height: size,
                    child: Opacity(
                      opacity: f.opacity,
                      child: Transform(
                        alignment: Alignment.bottomCenter,
                        transform: Matrix4.diagonal3Values(sx, sy, 1),
                        child: RepaintBoundary(
                          child: FoldPuppet(
                            fold: s.fold,
                            size: size,
                            phase: s.colour + i,
                            sway: widget.idle && !reduced,
                            blink: widget.idle,
                            fallbackName: s.name,
                            fallbackColour: s.colour,
                            semanticLabel: MobV3Copy.tagFor(s.you ? MobV3Copy.tabYou : s.name, s.tag),
                          ),
                        ),
                      ),
                    ),
                  ),
                )
                ..add(
                  Positioned(
                    left: cx(i) - slotW / 2,
                    width: slotW,
                    top: floorY + 6,
                    child: ExcludeSemantics(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            s.you ? MobV3Copy.tabYou : s.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.mmType.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Opacity(opacity: tagOp, child: FittedBox(fit: BoxFit.scaleDown, child: _tag(context, s))),
                        ],
                      ),
                    ),
                  ),
                );
            }
            for (var j = 0; j < open; j++) {
              final i = seats.length + j;
              children
                ..add(
                  Positioned(
                    left: cx(i) - size * 0.36,
                    top: floorY - size * 0.92,
                    width: size * 0.72,
                    height: size * 0.88,
                    child: CustomPaint(painter: _DashedSeat(edge: night ? const Color(0x8CEDE5D3) : const Color(0x996B5F4A))),
                  ),
                )
                ..add(
                  Positioned(
                    left: cx(i) - slotW / 2,
                    width: slotW,
                    top: floorY + 6,
                    child: ExcludeSemantics(
                      child: Text(MobV3Copy.openSeat, textAlign: TextAlign.center, maxLines: 2, style: context.mmType.label.copyWith(color: colors.ink3)),
                    ),
                  ),
                );
            }
            for (final f in _flights.values) {
              final idx = seats.indexWhere((s) => s.memberId == f.$1.memberId);
              if (idx < 0) continue;
              children.add(_flight(context, f.$1, f.$2, cx(idx), floorY - size - 10, reduced));
            }
            return Stack(clipBehavior: Clip.hardEdge, children: children);
          },
        ),
      ),
    );
  }

  Widget _tag(BuildContext context, LobbySeat s) {
    final colors = context.mmColors;
    final paper = RunPaper.of(context);
    final type = context.mmType;
    if (s.host || s.status == RoomPresenceStatus.here) {
      return Container(
        key: ValueKey('lobby-tag-${s.memberId}'),
        padding: const EdgeInsets.fromLTRB(8, 3, 10, 3),
        decoration: ShapeDecoration(color: colors.raised, shape: StadiumBorder(side: BorderSide(color: colors.line))),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!s.host) ...[
              Container(width: 7, height: 7, decoration: BoxDecoration(color: colors.lamp, shape: BoxShape.circle)),
              const SizedBox(width: 5),
            ] else ...[
              Icon(LucideIcons.flag, size: 12, color: colors.ink2),
              const SizedBox(width: 4),
            ],
            Text(s.tag, style: type.caption.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
          ],
        ),
      );
    }
    // Ready: a paper stamp, inked, a little askew.
    final c = _stamps[s.memberId];
    final reduced = _reduced;
    var scale = 1.0;
    var turn = -3.0;
    var op = 1.0;
    if (c != null && c.isAnimating) {
      final ms = c.value * c.duration!.inMilliseconds;
      if (reduced) {
        op = (ms / 120).clamp(0.0, 1.0);
      } else {
        scale = _stampLand.x(ms / 1000);
        turn = -3 + 2 * math.exp(-ms / 160) * math.cos(ms / 50);
        op = (0.7 + 0.3 * ms / 60).clamp(0.0, 1.0);
      }
    }
    return Opacity(
      opacity: op,
      child: Transform.rotate(
        angle: turn * math.pi / 180,
        child: Transform.scale(
          scale: scale,
          child: Container(
            key: ValueKey('lobby-tag-${s.memberId}'),
            padding: const EdgeInsets.fromLTRB(7, 3, 9, 3),
            decoration: BoxDecoration(
              color: paper.paper,
              borderRadius: BorderRadius.circular(5),
              border: Border.all(color: paper.paperInk, width: 1.4),
              boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 3, offset: Offset(0, 1.5))],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.check, size: 13, color: paper.paperInk),
                const SizedBox(width: 3),
                Text(MobV3Copy.tagReady, style: type.caption.copyWith(color: paper.paperInk, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static final SpringSimulation _stampLand = SpringSimulation(Springs.celebrate, 1.4, 1, 0);
  static final SpringSimulation _pop = SpringSimulation(Springs.iconPop, 0.9, 1, 0);

  Widget _flight(BuildContext context, RoomStickerSeen st, AnimationController c, double x, double top, bool reduced) {
    final ms = c.value * c.duration!.inMilliseconds;
    final total = c.duration!.inMilliseconds.toDouble();
    final double op;
    double dy = 0;
    double scale = 1;
    if (reduced) {
      op = math.min((ms / 120).clamp(0.0, 1.0), ((total - ms) / 120).clamp(0.0, 1.0));
    } else {
      op = math.min((ms / 120).clamp(0.0, 1.0), ((total - ms) / 300).clamp(0.0, 1.0));
      dy = -24 * Motion.out.transform((ms / 300).clamp(0.0, 1.0));
      scale = _pop.x(ms / 1000).clamp(0.85, 1.1);
    }
    final paper = RunPaper.of(context);
    return Positioned(
      key: ValueKey('lobby-sticker-${st.id}'),
      left: x - 70,
      width: 140,
      top: top - 30 + dy,
      child: IgnorePointer(
        child: Opacity(
          opacity: op,
          child: Transform.scale(
            scale: scale,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: paper.paper,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: paper.paperEdge),
                  boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 6, offset: Offset(0, 3))],
                ),
                child: Text(MobV3Copy.sticker(st.kind), style: context.mmType.label.copyWith(color: paper.paperInk, fontWeight: FontWeight.w800)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The lamp's pool on the floor under the Folds (26% Night, 17% Day); the room art carries the lamp itself.
class _LobbyLight extends CustomPainter {
  _LobbyLight({required this.floorY, required this.night});

  final double floorY;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final base = night ? const Color(0xFFF2A93B) : const Color(0xFFF2C46B);
    final peak = night ? 0.26 : 0.17;
    final cx = size.width / 2;
    final c = Offset(cx, floorY);
    final rx = size.width * 0.5;
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.scale(1, 0.22);
    canvas.drawCircle(
      Offset.zero,
      rx,
      Paint()
        ..shader = RadialGradient(colors: [base.withValues(alpha: peak * 1.4), base.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: Offset.zero, radius: rx)),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_LobbyLight old) => old.floorY != floorY || old.night != night;
}

class _DashedSeat extends CustomPainter {
  _DashedSeat({required this.edge});

  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndCorners(
      Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
      topLeft: Radius.circular(size.width * 0.5),
      topRight: Radius.circular(size.width * 0.5),
      bottomLeft: const Radius.circular(10),
      bottomRight: const Radius.circular(10),
    );
    canvas.drawRRect(r, Paint()..color = edge.withValues(alpha: edge.a * 0.12));
    final p = Paint()
      ..color = edge
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    for (final m in (Path()..addRRect(r)).computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + 5, m.length)), p);
        d += 9;
      }
    }
    final c = Offset(size.width / 2, size.height * 0.52);
    final arm = math.min(size.width, size.height) * 0.14;
    final q = Paint()
      ..color = edge
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(c.translate(-arm, 0), c.translate(arm, 0), q);
    canvas.drawLine(c.translate(0, -arm), c.translate(0, arm), q);
  }

  @override
  bool shouldRepaint(_DashedSeat old) => old.edge != edge;
}
