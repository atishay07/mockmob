// The live room's ready phase (MOB-BUILD-SPEC-V3 5.3 L1, 5.6 M2; Live 08 "Ready up"; pass-1020 MOB-MINIMAL 3.3:
// "the ready phase is the lobby"). It is the first phase of the game screen, not a screen of its own: the run
// screen draws it until the host's start, then plays the 3, 2, 1 and the same runner.
//
// What a first-time student sees:
// - the lamp-lit room with the Folds of whoever is HERE (the server's presence only, L-55), each tagged "Host",
//   "Here" or "Ready", and a dashed "Open seat" for each member who is not here (no names);
// - when a friend arrives: their Fold hops in and the line reads "Kabir is here now." for a few seconds;
// - "Same 5 questions, same start..." (a race: "Same questions, same start, 5 minutes on one clock...");
// - "Send a sticker": Good luck, Let's go, One sec, Ready (they fly over the sender's Fold).
// The keys (I'm ready, Start for everyone, Play it later instead) are the run screen's bottom.
//
// R2: "Tap ready; Riya starts it."

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import '../logic/live_room.dart';
import 'countdown_stopwatch.dart' show RunHeadDisc;
import 'lobby_stage.dart';
import 'mob_fx.dart';
import 'sticker_row.dart';

/// The go-live wash (M2): a volt circle from the key that covers at most 40% of the screen at 22%
/// (Night) or 30% (Day) and is gone by 900 ms.
abstract final class GoLiveWash {
  static const double total = 900;
  static const double growAt = 180;
  static const double growEnd = 540;

  /// The radius whose full circle is 40% of the screen: centred on the key, at most that much shows.
  static double maxRadius(Size screen) => math.sqrt(0.40 * screen.width * screen.height / math.pi);

  /// (radius share 0 to 1, opacity share 0 to 1) at [ms].
  static ({double r, double o}) frame(double ms) {
    if (ms < growAt) return (r: 0, o: 0);
    if (ms < growEnd) return (r: Motion.out.transform((ms - growAt) / (growEnd - growAt)), o: 1);
    if (ms < total) return (r: 1, o: 1 - Motion.leave.transform((ms - growEnd) / (total - growEnd)));
    return (r: 1, o: 0);
  }

  static double alpha(bool night) => night ? 0.22 : 0.30;
}

/// The wash as a layer over the screen, from the key at the bottom centre.
class GoLiveWashLayer extends StatelessWidget {
  const GoLiveWashLayer({super.key, required this.controller});

  final Animation<double> controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final f = GoLiveWash.frame(controller.value * GoLiveWash.total);
        if (f.o <= 0) return const SizedBox.shrink();
        return CustomPaint(painter: _WashPainter(share: f.r, opacity: f.o * GoLiveWash.alpha(context.mmColors.isNight), colour: context.mmColors.volt));
      },
    );
  }
}

/// The ready phase's body: the room, the line under it and the sticker row.
class RoomReadyBody extends ConsumerStatefulWidget {
  const RoomReadyBody({super.key, required this.room, required this.gameId});

  final LiveRoom room;
  final String gameId;

  @override
  ConsumerState<RoomReadyBody> createState() => _RoomReadyBodyState();
}

class _RoomReadyBodyState extends ConsumerState<RoomReadyBody> with SingleTickerProviderStateMixin {
  late final AnimationController _line = AnimationController(vsync: this, duration: const Duration(milliseconds: 280), value: 1);
  Timer? _arrivalTimer;
  String? _arrival;
  int _arrivalsSeen = 0;

  @override
  void initState() {
    super.initState();
    // Arrivals before the room drew are not news (late fields read lazily would miss the first one).
    _arrivalsSeen = widget.room.arrivals;
    widget.room.addListener(_onRoom);
  }

  @override
  void dispose() {
    widget.room.removeListener(_onRoom);
    _arrivalTimer?.cancel();
    _line.dispose();
    super.dispose();
  }

  void _onRoom() {
    if (!mounted) return;
    final room = widget.room;
    if (room.arrivals != _arrivalsSeen) {
      _arrivalsSeen = room.arrivals;
      final id = room.arrivalId;
      if (id != null && room.present.containsKey(id)) {
        _arrival = id;
        // Your own join is yours to feel; a friend's arrival is a quiet tick.
        hapticsOf(context)?.selection();
        _line.forward(from: MobFx.reduced(context) ? 1 : 0);
        _arrivalTimer?.cancel();
        _arrivalTimer = Timer(const Duration(seconds: 4), () {
          if (!mounted) return;
          setState(() => _arrival = null);
          _line.forward(from: MobFx.reduced(context) ? 1 : 0);
        });
      }
    }
    setState(() {});
  }

  List<LobbySeat> _seats() {
    final room = widget.room;
    final hostId = room.hostId;
    final ids = room.present.keys.toList();
    final order = <String>[
      if (hostId != null && ids.contains(hostId) && hostId != room.youId) hostId,
      for (final m in room.members)
        if (ids.contains(m.memberId) && m.memberId != hostId && m.memberId != room.youId) m.memberId,
      if (ids.contains(room.youId)) room.youId,
    ];
    return [
      for (final id in order)
        if (room.member(id) case final m?)
          LobbySeat(memberId: id, name: m.name, fold: m.fold, colour: m.colour, status: room.present[id]!, host: id == hostId, you: id == room.youId),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final room = widget.room;
    final game = room.game;
    final now = room.serverNow();
    final closes = game?.closesAt;
    final seats = _seats();
    final open = math.max(0, room.members.length - seats.length);
    final n = game?.count ?? 5;
    final race = game?.format == GameFormat.race;

    // The line under the stage: an arrival first, then the host stepping away, then only you, then the rule.
    String? lineTitle;
    var line = race ? MobV3Copy.lobbyLineRace(game?.minutes ?? 5) : MobV3Copy.lobbyLine(n);
    final arrival = _arrival;
    if (arrival != null && room.present.containsKey(arrival)) {
      final name = room.nameOf(arrival);
      lineTitle = MobV3Copy.isHereNow(name);
      line = MobV3Copy.isHereNowLine(name);
    } else if (room.hostAway && closes != null) {
      line = MobV3Copy.hostAway(room.hostName, null, closes, now);
    } else if (room.onlyYou) {
      line = MobV3Copy.onlyYouHere;
    }
    final arrivalMember = arrival == null ? null : room.member(arrival);

    return SingleChildScrollView(
      key: const ValueKey('room-ready'),
      padding: const EdgeInsets.only(bottom: MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LobbyStage(seats: seats, openSeats: open, stickers: List.of(room.stickers)),
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
            child: FadeTransition(
              opacity: _line,
              child: Semantics(
                liveRegion: true,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (arrivalMember != null && lineTitle != null) ...[
                      RunHeadDisc(fold: arrivalMember.fold, colour: arrivalMember.colour, name: arrivalMember.name, size: 44),
                      const SizedBox(width: MmSpace.s12),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (lineTitle != null) Text(lineTitle, key: const ValueKey('lobby-arrival'), style: type.cardTitle.copyWith(color: colors.ink)),
                          Text(line, key: const ValueKey('lobby-line'), style: type.body.copyWith(color: colors.ink2)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: _LobbyStickers(gameId: widget.gameId, onSent: room.showOwnSticker),
          ),
        ],
      ),
    );
  }
}

/// The lobby's sticker row: the four lobby stickers; a send flies over your own Fold.
class _LobbyStickers extends ConsumerStatefulWidget {
  const _LobbyStickers({required this.gameId, required this.onSent});

  final String gameId;
  final ValueChanged<StickerKind> onSent;

  @override
  ConsumerState<_LobbyStickers> createState() => _LobbyStickersState();
}

class _LobbyStickersState extends ConsumerState<_LobbyStickers> {
  late final StickerBus _bus = ref.read(stickerBusProvider);
  int _lastId = 0;

  @override
  void initState() {
    super.initState();
    // Listening makes the row hand its flights to the stage (the sender's Fold) instead of the chip.
    _bus.addListener(_onBus);
    _lastId = _bus.recent.isEmpty ? 0 : _bus.recent.last.id;
  }

  @override
  void dispose() {
    _bus.removeListener(_onBus);
    super.dispose();
  }

  void _onBus() {
    for (final s in _bus.recent) {
      if (s.id > _lastId) {
        _lastId = s.id;
        widget.onSent(s.kind);
      }
    }
  }

  @override
  Widget build(BuildContext context) => StickerRow(kinds: StickerKind.lobby, gameId: widget.gameId, label: MobV3Copy.sendASticker, grid: true);
}

/// "Live" with a lamp-coloured dot that breathes (still in reduced motion).
class LiveDot extends StatefulWidget {
  const LiveDot({super.key});

  @override
  State<LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<LiveDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MobFx.reduced(context)) {
      _c.stop();
      _c.value = 1;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Container(
      key: const ValueKey('lobby-live'),
      height: 30,
      padding: const EdgeInsets.fromLTRB(9, 0, 11, 0),
      decoration: ShapeDecoration(color: colors.raised, shape: StadiumBorder(side: BorderSide(color: colors.line))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: Tween<double>(begin: 0.45, end: 1).animate(_c),
            child: Container(width: 8, height: 8, decoration: BoxDecoration(color: colors.lamp, shape: BoxShape.circle)),
          ),
          const SizedBox(width: 6),
          Text(MobV3Copy.liveDot, style: context.mmType.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _WashPainter extends CustomPainter {
  _WashPainter({required this.share, required this.opacity, required this.colour});

  final double share;
  final double opacity;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    if (share <= 0 || opacity <= 0) return;
    // From the key at the bottom centre.
    final centre = Offset(size.width / 2, size.height - 56);
    canvas.drawCircle(centre, GoLiveWash.maxRadius(size) * share, Paint()..color = colour.withValues(alpha: opacity));
  }

  @override
  bool shouldRepaint(_WashPainter old) => old.share != share || old.opacity != opacity || old.colour != colour;
}
